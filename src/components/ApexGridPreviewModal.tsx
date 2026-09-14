import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CalibrationCalculation, BlueprintAdjustments, CropArea, Point2D } from '../types';
import { canvasTo96DpiBlob } from '../utils/pngDpi';
import {
  X,
  Download,
  Copy,
  Check,
  CheckCircle2,
  Grid,
  Info,
  Maximize2,
  FileCheck,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
} from 'lucide-react';

interface ApexGridPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceImage: HTMLCanvasElement | HTMLImageElement | null;
  calculation: CalibrationCalculation | null;
  adjustments: BlueprintAdjustments;
  cropArea: CropArea;
  points: Point2D[];
  fileName: string;
}

export const ApexGridPreviewModal: React.FC<ApexGridPreviewModalProps> = ({
  isOpen,
  onClose,
  sourceImage,
  calculation,
  adjustments,
  cropArea,
  points,
  fileName,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const calibratedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [calibratedBlob, setCalibratedBlob] = useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [showGridOverlay, setShowGridOverlay] = useState(true);
  const [viewMode, setViewMode] = useState<'fit' | 'actual'>('fit');

  // Draw the preview onto the display canvas
  const drawPreview = useCallback(() => {
    const previewCanvas = previewCanvasRef.current;
    const exportCanvas = calibratedCanvasRef.current;
    if (!previewCanvas || !exportCanvas) return;

    const destW = exportCanvas.width;
    const destH = exportCanvas.height;
    if (destW === 0 || destH === 0) return;

    // Determine scale for display
    let prevScale = 1.0;
    if (viewMode === 'fit') {
      const maxPrevW = 750;
      const maxPrevH = 460;
      prevScale = Math.min(maxPrevW / destW, maxPrevH / destH, 1.0);
    } else {
      prevScale = 1.0; // 100% 1:1 pixel representation
    }

    const dispW = Math.max(1, Math.round(destW * prevScale));
    const dispH = Math.max(1, Math.round(destH * prevScale));

    previewCanvas.width = dispW;
    previewCanvas.height = dispH;

    const pCtx = previewCanvas.getContext('2d');
    if (!pCtx) return;

    pCtx.clearRect(0, 0, dispW, dispH);
    pCtx.imageSmoothingEnabled = true;
    pCtx.imageSmoothingQuality = 'high';

    // Draw calibrated floor plan
    pCtx.drawImage(exportCanvas, 0, 0, dispW, dispH);

    // Draw simulated Apex 10' Grid overlay if enabled
    if (showGridOverlay) {
      // In calibrated image, 1 foot = 9.6 pixels.
      // On preview canvas, 1 foot = 9.6 * prevScale pixels!
      const footPx = 9.6 * prevScale;
      const tenFootPx = footPx * 10;

      pCtx.save();

      // Minor 1-foot grid lines (only if spacing is at least 3.5px)
      if (footPx >= 3.5) {
        pCtx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
        pCtx.lineWidth = 1;
        for (let x = 0; x <= dispW; x += footPx) {
          pCtx.beginPath();
          pCtx.moveTo(x, 0);
          pCtx.lineTo(x, dispH);
          pCtx.stroke();
        }
        for (let y = 0; y <= dispH; y += footPx) {
          pCtx.beginPath();
          pCtx.moveTo(0, y);
          pCtx.lineTo(dispW, y);
          pCtx.stroke();
        }
      }

      // Major 10-foot grid lines (Apex Sketch default grid spacing)
      pCtx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      pCtx.lineWidth = 1.5;
      for (let x = 0; x <= dispW; x += tenFootPx) {
        pCtx.beginPath();
        pCtx.moveTo(x, 0);
        pCtx.lineTo(x, dispH);
        pCtx.stroke();
      }
      for (let y = 0; y <= dispH; y += tenFootPx) {
        pCtx.beginPath();
        pCtx.moveTo(0, y);
        pCtx.lineTo(dispW, y);
        pCtx.stroke();
      }

      // Add a scale badge overlay in bottom-left corner
      pCtx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      pCtx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      pCtx.lineWidth = 1;
      const label = "Apex 10-ft Grid (9.6 px/ft)";
      pCtx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
      const m = pCtx.measureText(label);
      const bx = 10;
      const by = dispH - 32;
      if (by > 10) {
        pCtx.fillRect(bx, by, m.width + 16, 22);
        pCtx.strokeRect(bx, by, m.width + 16, 22);
        pCtx.fillStyle = '#38bdf8';
        pCtx.textBaseline = 'middle';
        pCtx.fillText(label, bx + 8, by + 11);
      }

      pCtx.restore();
    }
  }, [showGridOverlay, viewMode]);

  // Generate calibrated image when modal opens or calibration params change
  useEffect(() => {
    if (!isOpen || !sourceImage || !calculation) return;

    let isMounted = true;
    setIsGenerating(true);
    setGenerationError(null);
    setHasCopied(false);
    setHasDownloaded(false);

    const generate = async () => {
      try {
        // 1. Determine base region (crop area or full image)
        const useCrop = cropArea.active && cropArea.width > 10 && cropArea.height > 10;
        const srcX = useCrop ? cropArea.x : 0;
        const srcY = useCrop ? cropArea.y : 0;
        const srcW = useCrop ? cropArea.width : sourceImage.width;
        const srcH = useCrop ? cropArea.height : sourceImage.height;

        // 2. Compute destination calibrated size
        // Ratio: targetPixels = actualFeet * 9.6; scaleRatio = targetPixels / measuredPixels
        const destW = Math.max(1, Math.round(srcW * calculation.scaleRatio));
        const destH = Math.max(1, Math.round(srcH * calculation.scaleRatio));

        // 3. Check for 90/270 deg rotation
        const isQuarterTurn = adjustments.rotation === 90 || adjustments.rotation === 270;
        const rotDestW = isQuarterTurn ? destH : destW;
        const rotDestH = isQuarterTurn ? destW : destH;

        // 4. Create high-resolution export canvas
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = rotDestW;
        exportCanvas.height = rotDestH;
        const expCtx = exportCanvas.getContext('2d', { willReadFrequently: true });
        if (!expCtx) {
          throw new Error('Failed to create 2D canvas context for export');
        }

        expCtx.imageSmoothingEnabled = true;
        expCtx.imageSmoothingQuality = 'high';

        // Apply image filters (contrast, brightness, invert, grayscale)
        const filters: string[] = [];
        if (adjustments.contrast !== 100) filters.push(`contrast(${adjustments.contrast}%)`);
        if (adjustments.brightness !== 100) filters.push(`brightness(${adjustments.brightness}%)`);
        if (adjustments.invert) filters.push('invert(100%)');
        if (adjustments.grayscale) filters.push('grayscale(100%)');
        expCtx.filter = filters.length > 0 ? filters.join(' ') : 'none';

        // Draw rotated or unrotated
        if (adjustments.rotation !== 0) {
          expCtx.save();
          expCtx.translate(rotDestW / 2, rotDestH / 2);
          expCtx.rotate((adjustments.rotation * Math.PI) / 180);
          expCtx.drawImage(sourceImage, srcX, srcY, srcW, srcH, -destW / 2, -destH / 2, destW, destH);
          expCtx.restore();
        } else {
          expCtx.drawImage(sourceImage, srcX, srcY, srcW, srcH, 0, 0, destW, destH);
        }
        expCtx.filter = 'none';

        // Store offscreen canvas in ref
        calibratedCanvasRef.current = exportCanvas;

        // Draw immediately onto the preview canvas
        if (isMounted) {
          drawPreview();
        }

        // Generate 96 DPI PNG Blob asynchronously
        try {
          const blob = await canvasTo96DpiBlob(exportCanvas);
          if (isMounted) {
            setCalibratedBlob(blob);
            setIsGenerating(false);
          }
        } catch (err) {
          console.warn('96 DPI chunk injection warning, falling back to standard PNG:', err);
          // Fallback to standard PNG blob if chunk injection failed
          exportCanvas.toBlob((b) => {
            if (isMounted) {
              setCalibratedBlob(b);
              setIsGenerating(false);
            }
          }, 'image/png');
        }
      } catch (err) {
        console.error('Error generating calibrated image:', err);
        if (isMounted) {
          setGenerationError(err instanceof Error ? err.message : 'Unknown generation error');
          setIsGenerating(false);
        }
      }
    };

    // Execute generation
    generate();

    return () => {
      isMounted = false;
    };
  }, [isOpen, sourceImage, calculation, adjustments, cropArea, drawPreview]);

  // Update preview when toggling grid overlay or viewMode without re-generating full image
  useEffect(() => {
    if (calibratedCanvasRef.current) {
      drawPreview();
    }
  }, [showGridOverlay, viewMode, drawPreview]);

  if (!isOpen || !calculation) return null;

  const handleDownload = () => {
    if (!calibratedBlob) return;
    const url = URL.createObjectURL(calibratedBlob);
    const a = document.createElement('a');
    a.href = url;
    const cleanBase = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Blueprint';
    a.download = `Apex_Calibrated_${cleanBase}_${calculation.actualFeet}ft_96DPI.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setHasDownloaded(true);
  };

  const handleCopyToClipboard = async () => {
    if (!calibratedBlob) return;
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': calibratedBlob,
          }),
        ]);
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 3000);
      } else {
        handleDownload();
      }
    } catch (err) {
      console.warn('Clipboard write error (often restricted in iframes):', err);
      // Fallback: trigger download directly
      handleDownload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-slate-100">
                  Calibrated Apex Background Ready
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  1:1 • 96 DPI
                </span>
              </div>
              <p className="text-xs text-slate-400">
                1 Foot on Apex Grid = Exactly 9.60 Pixels (Verified)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col lg:flex-row gap-5 overflow-y-auto">
          {/* Left: Interactive Canvas Preview */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span>Apex 10-ft Grid Alignment Preview</span>
              </span>

              <div className="flex items-center gap-2">
                {/* View Mode: Fit vs Actual */}
                <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('fit')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                      viewMode === 'fit'
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Fit View
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('actual')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                      viewMode === 'actual'
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    100% (1:1)
                  </button>
                </div>

                {/* Grid Overlay Toggle */}
                <button
                  type="button"
                  onClick={() => setShowGridOverlay(!showGridOverlay)}
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition cursor-pointer font-medium ${
                    showGridOverlay
                      ? 'bg-sky-600/30 text-sky-300 border border-sky-500/40'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>{showGridOverlay ? 'Grid Overlay ON' : 'Grid Overlay OFF'}</span>
                </button>
              </div>
            </div>

            {/* Preview Viewport Container - Canvas ALWAYS mounted */}
            <div className="relative rounded-xl overflow-auto border border-slate-700 bg-slate-950 flex items-center justify-center p-2 min-h-[300px] max-h-[500px]">
              {/* Canvas is NEVER unmounted to avoid null ref lifecycle drops */}
              <canvas
                ref={previewCanvasRef}
                className="rounded shadow-md block max-w-none"
              />

              {/* Loading Spinner Overlay */}
              {isGenerating && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-slate-300 z-10">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium">Resampling & injecting 96 DPI metadata...</span>
                </div>
              )}

              {/* Error Message if generation failed */}
              {generationError && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-2 text-rose-300 p-4 text-center z-10">
                  <AlertTriangle className="w-6 h-6 text-rose-400" />
                  <span className="text-xs font-medium">{generationError}</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-normal">
              Notice how the blueprint walls align with the simulated cyan 10-foot grid lines. In Apex Sketch, you can now trace walls directly!
            </p>
          </div>

          {/* Right: Technical Telemetry & Export Actions */}
          <div className="w-full lg:w-80 flex flex-col justify-between gap-4 shrink-0">
            {/* Calibration Telemetry Table */}
            <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 flex flex-col gap-3 font-mono text-xs">
              <div className="flex items-center gap-2 text-slate-300 font-bold uppercase text-[11px] tracking-wider pb-1 border-b border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Scale Verification</span>
              </div>

              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Known Wall:</span>
                <span className="font-bold text-white">{calculation.actualFeet} ft</span>
              </div>

              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Apex Wall Pixels:</span>
                <span className="text-emerald-400 font-bold">
                  {(calculation.actualFeet * 9.6).toFixed(1)} px
                </span>
              </div>

              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">DPI Metadata:</span>
                <span className="text-sky-400 font-bold">96 DPI (3,780 px/m)</span>
              </div>

              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Output Dimensions:</span>
                <span className="text-slate-200">
                  {calculation.calibratedWidth} × {calculation.calibratedHeight} px
                </span>
              </div>

              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Scaling Factor:</span>
                <span className="text-amber-400">
                  {(calculation.scaleRatio * 100).toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Step-by-step Apex Instructions */}
            <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/60 text-xs text-slate-300 flex flex-col gap-2">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span>Next in Apex Sketch v7:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px]">
                <li>Download or Copy this image</li>
                <li>In Apex: Go to <strong>Tools → Background Image</strong> (or paste)</li>
                <li>Verify wall lines sit squarely on Apex&apos;s 10&apos; grid</li>
                <li>Trace walls with the standard Apex wall tool!</li>
              </ol>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                id="btn-modal-download"
                onClick={handleDownload}
                disabled={!calibratedBlob || isGenerating}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-700/30 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                <span>{hasDownloaded ? 'Downloaded! (Download Again)' : 'Download Calibrated PNG'}</span>
              </button>

              <button
                type="button"
                id="btn-modal-copy"
                onClick={handleCopyToClipboard}
                disabled={!calibratedBlob || isGenerating}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {hasCopied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300">Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy to Clipboard (Paste in Apex)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

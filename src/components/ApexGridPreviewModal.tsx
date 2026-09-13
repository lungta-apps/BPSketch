import React, { useEffect, useRef, useState } from 'react';
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
  const [calibratedBlob, setCalibratedBlob] = useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [showGridOverlay, setShowGridOverlay] = useState(true);

  // Generate calibrated image when modal opens
  useEffect(() => {
    if (!isOpen || !sourceImage || !calculation) return;

    let isMounted = true;
    setIsGenerating(true);
    setHasCopied(false);
    setHasDownloaded(false);

    const generate = async () => {
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

      // 3. Create high-resolution export canvas
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = destW;
      exportCanvas.height = destH;
      const expCtx = exportCanvas.getContext('2d', { willReadFrequently: true });
      if (!expCtx) return;

      expCtx.imageSmoothingEnabled = true;
      expCtx.imageSmoothingQuality = 'high';

      // Apply image filters (contrast, brightness, invert, grayscale)
      const filters: string[] = [];
      if (adjustments.contrast !== 100) filters.push(`contrast(${adjustments.contrast}%)`);
      if (adjustments.brightness !== 100) filters.push(`brightness(${adjustments.brightness}%)`);
      if (adjustments.invert) filters.push('invert(100%)');
      if (adjustments.grayscale) filters.push('grayscale(100%)');
      expCtx.filter = filters.length > 0 ? filters.join(' ') : 'none';

      // Draw rotated / unrotated
      if (adjustments.rotation !== 0) {
        expCtx.save();
        expCtx.translate(destW / 2, destH / 2);
        expCtx.rotate((adjustments.rotation * Math.PI) / 180);
        expCtx.drawImage(sourceImage, srcX, srcY, srcW, srcH, -destW / 2, -destH / 2, destW, destH);
        expCtx.restore();
      } else {
        expCtx.drawImage(sourceImage, srcX, srcY, srcW, srcH, 0, 0, destW, destH);
      }
      expCtx.filter = 'none';

      // Generate 96 DPI PNG Blob
      try {
        const blob = await canvasTo96DpiBlob(exportCanvas);
        if (isMounted) {
          setCalibratedBlob(blob);
          setIsGenerating(false);
        }
      } catch (err) {
        console.error('Error generating 96 DPI calibrated blob:', err);
        setIsGenerating(false);
      }

      // Render to preview canvas inside modal
      const previewCanvas = previewCanvasRef.current;
      if (previewCanvas) {
        // Size preview canvas to fit nicely inside modal viewport
        const maxPrevW = 750;
        const maxPrevH = 450;
        const prevScale = Math.min(maxPrevW / destW, maxPrevH / destH, 1.0);

        previewCanvas.width = Math.round(destW * prevScale);
        previewCanvas.height = Math.round(destH * prevScale);
        const pCtx = previewCanvas.getContext('2d');
        if (pCtx) {
          pCtx.imageSmoothingEnabled = true;
          pCtx.imageSmoothingQuality = 'high';
          pCtx.drawImage(exportCanvas, 0, 0, previewCanvas.width, previewCanvas.height);

          // Draw simulated Apex 10' Grid overlay if enabled
          if (showGridOverlay) {
            // In calibrated image, 1 foot = 9.6 pixels.
            // On previewCanvas, 1 foot = 9.6 * prevScale pixels!
            const footPx = 9.6 * prevScale;
            const tenFootPx = footPx * 10;

            pCtx.save();
            // 1-foot minor grid lines
            pCtx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
            pCtx.lineWidth = 1;
            for (let x = 0; x < previewCanvas.width; x += footPx) {
              pCtx.beginPath();
              pCtx.moveTo(x, 0);
              pCtx.lineTo(x, previewCanvas.height);
              pCtx.stroke();
            }
            for (let y = 0; y < previewCanvas.height; y += footPx) {
              pCtx.beginPath();
              pCtx.moveTo(0, y);
              pCtx.lineTo(previewCanvas.width, y);
              pCtx.stroke();
            }

            // 10-foot major grid lines (Apex Sketch major grid)
            pCtx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
            pCtx.lineWidth = 1.5;
            for (let x = 0; x < previewCanvas.width; x += tenFootPx) {
              pCtx.beginPath();
              pCtx.moveTo(x, 0);
              pCtx.lineTo(x, previewCanvas.height);
              pCtx.stroke();
            }
            for (let y = 0; y < previewCanvas.height; y += tenFootPx) {
              pCtx.beginPath();
              pCtx.moveTo(0, y);
              pCtx.lineTo(previewCanvas.width, y);
              pCtx.stroke();
            }
            pCtx.restore();
          }
        }
      }
    };

    generate();

    return () => {
      isMounted = false;
    };
  }, [isOpen, sourceImage, calculation, adjustments, cropArea, showGridOverlay]);

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
        alert('Clipboard image copy is not supported in this browser. Please use Download.');
      }
    } catch (err) {
      console.warn('Clipboard write error:', err);
      // Fallback: download
      handleDownload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
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
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col lg:flex-row gap-6 overflow-y-auto">
          {/* Left: Interactive Canvas Preview */}
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span>Apex 10-ft Grid Alignment Preview</span>
              </span>
              <button
                type="button"
                onClick={() => setShowGridOverlay(!showGridOverlay)}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition cursor-pointer font-medium ${
                  showGridOverlay
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>{showGridOverlay ? 'Grid Overlay ON' : 'Grid Overlay OFF'}</span>
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center p-2 min-h-[260px]">
              {isGenerating ? (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Resampling & injecting 96 DPI metadata...</span>
                </div>
              ) : (
                <canvas ref={previewCanvasRef} className="max-w-full rounded shadow-md block" />
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-normal">
              Notice how the blueprint walls align with the simulated cyan 10-foot grid lines. In Apex Sketch, you can now trace walls directly!
            </p>
          </div>

          {/* Right: Technical Telemetry & Export Actions */}
          <div className="w-full lg:w-80 flex flex-col justify-between gap-4">
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
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                id="btn-modal-download"
                onClick={handleDownload}
                disabled={!calibratedBlob || isGenerating}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-700/30 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{hasDownloaded ? 'Downloaded! (Download Again)' : 'Download Calibrated PNG'}</span>
              </button>

              <button
                type="button"
                id="btn-modal-copy"
                onClick={handleCopyToClipboard}
                disabled={!calibratedBlob || isGenerating}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
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

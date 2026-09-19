import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Globe, ExternalLink } from 'lucide-react';
import { Header } from './components/Header';
import { CalibrationToolbar } from './components/CalibrationToolbar';
import { BlueprintCanvas } from './components/BlueprintCanvas';
import { AdjustmentsPanel } from './components/AdjustmentsPanel';
import { ApexGridPreviewModal } from './components/ApexGridPreviewModal';
import { ApexGuideModal } from './components/ApexGuideModal';
import { Point2D, BlueprintAdjustments, CalibrationCalculation, CropArea, PdfPageInfo } from './types';
import { parseDimension } from './utils/dimensionParser';
import { renderPdfPage } from './utils/pdfRenderer';

export default function App() {
  // Source Blueprint State
  const [sourceImage, setSourceImage] = useState<HTMLCanvasElement | HTMLImageElement | null>(null);
  const [originalSourceImage, setOriginalSourceImage] = useState<HTMLCanvasElement | HTMLImageElement | null>(null);
  const [hasCropApplied, setHasCropApplied] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');

  // PDF specific state
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [pdfInfo, setPdfInfo] = useState<PdfPageInfo | null>(null);

  // Calibration points & known distance
  const [points, setPoints] = useState<Point2D[]>([]);
  const [knownFeetInput, setKnownFeetInput] = useState<string>('');

  // Blueprint Adjustments & Crop
  const [adjustments, setAdjustments] = useState<BlueprintAdjustments>({
    contrast: 100,
    brightness: 100,
    invert: false,
    grayscale: false,
    rotation: 0,
  });

  const [cropArea, setCropArea] = useState<CropArea>({
    active: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [isCropMode, setIsCropMode] = useState<boolean>(false);

  // Modals & Panels
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);
  const [isAdjustmentsOpen, setIsAdjustmentsOpen] = useState<boolean>(false);
  const [showApexGrid, setShowApexGrid] = useState<boolean>(false);

  // Compute live calibration telemetry
  const calculation = useMemo<CalibrationCalculation | null>(() => {
    const parsed = parseDimension(knownFeetInput);
    if (!sourceImage || points.length !== 2 || !parsed.isValid || parsed.feet <= 0) {
      return null;
    }

    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    const measuredPixels = Math.hypot(dx, dy);
    if (measuredPixels < 1) return null;

    const actualFeet = parsed.feet;
    const currentPixelsPerFoot = measuredPixels / actualFeet;
    const apexPixelsPerFoot = 9.6; // exactly 96 DPI / 10 ft
    const targetPixels = actualFeet * apexPixelsPerFoot;
    const scaleRatio = targetPixels / measuredPixels;

    const useCrop = cropArea.active && cropArea.width > 10 && cropArea.height > 10;
    const srcW = useCrop ? cropArea.width : sourceImage.width;
    const srcH = useCrop ? cropArea.height : sourceImage.height;

    const calibratedWidth = Math.max(1, Math.round(srcW * scaleRatio));
    const calibratedHeight = Math.max(1, Math.round(srcH * scaleRatio));

    return {
      measuredPixels,
      actualFeet,
      currentPixelsPerFoot,
      apexPixelsPerFoot,
      scaleRatio,
      originalWidth: srcW,
      originalHeight: srcH,
      calibratedWidth,
      calibratedHeight,
    };
  }, [points, knownFeetInput, sourceImage, cropArea]);

  // Handle file upload (PDF or Image)
  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoading(true);
    setFileName(file.name);
    setPoints([]);
    setKnownFeetInput('');
    setCropArea({ active: false, x: 0, y: 0, width: 0, height: 0 });
    setIsCropMode(false);

    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        setLoadingMessage('Rendering high-resolution PDF pages...');
        const buffer = await file.arrayBuffer();
        setPdfData(buffer);

        const rendered = await renderPdfPage(buffer, 1, 2.0);
        setSourceImage(rendered.canvas);
        setOriginalSourceImage(rendered.canvas);
        setHasCropApplied(false);
        setPdfInfo({
          pageNumber: rendered.pageNumber,
          numPages: rendered.totalPdfPages,
          renderScale: 2.0,
        });
      } else {
        setLoadingMessage('Loading blueprint image...');
        setPdfData(null);
        setPdfInfo(null);

        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        setSourceImage(img);
        setOriginalSourceImage(img);
        setHasCropApplied(false);
      }
    } catch (err) {
      console.error('Failed to load file:', err);
      alert('Error loading file. If uploading a PDF, please make sure it is not password protected.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // PDF Page change
  const handlePdfPageChange = async (newPage: number) => {
    if (!pdfData || !pdfInfo) return;
    setIsLoading(true);
    setLoadingMessage(`Rendering PDF page ${newPage}...`);
    try {
      const rendered = await renderPdfPage(pdfData, newPage, pdfInfo.renderScale);
      setSourceImage(rendered.canvas);
      setOriginalSourceImage(rendered.canvas);
      setHasCropApplied(false);
      setPdfInfo({
        ...pdfInfo,
        pageNumber: rendered.pageNumber,
      });
      setPoints([]);
      setCropArea({ active: false, x: 0, y: 0, width: 0, height: 0 });
      setIsCropMode(false);
    } catch (err) {
      console.error('Error changing PDF page:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // PDF Render Scale change (sharpness)
  const handlePdfRenderScaleChange = async (newScale: number) => {
    if (!pdfData || !pdfInfo) return;
    setIsLoading(true);
    setLoadingMessage(`Re-rendering at ${newScale}x sharpness...`);
    try {
      const rendered = await renderPdfPage(pdfData, pdfInfo.pageNumber, newScale);
      setSourceImage(rendered.canvas);
      setOriginalSourceImage(rendered.canvas);
      setHasCropApplied(false);
      setPdfInfo({
        ...pdfInfo,
        renderScale: newScale,
      });
      setPoints([]);
      setCropArea({ active: false, x: 0, y: 0, width: 0, height: 0 });
      setIsCropMode(false);
    } catch (err) {
      console.error('Error changing render scale:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Apply Crop Action: cuts sourceImage to cropArea, shifts calibration points accordingly
  const handleApplyCrop = useCallback(() => {
    if (!sourceImage) return;
    if (!cropArea.active || cropArea.width < 10 || cropArea.height < 10) {
      setIsCropMode(false);
      return;
    }

    const { x, y, width, height } = cropArea;
    const imgW = ('naturalWidth' in sourceImage ? (sourceImage as HTMLImageElement).naturalWidth : 0) || sourceImage.width;
    const imgH = ('naturalHeight' in sourceImage ? (sourceImage as HTMLImageElement).naturalHeight : 0) || sourceImage.height;

    // Ensure x, y, width, height stay strictly within source bounds
    const safeX = Math.max(0, Math.min(x, imgW - 1));
    const safeY = Math.max(0, Math.min(y, imgH - 1));
    const safeW = Math.max(1, Math.min(width, imgW - safeX));
    const safeH = Math.max(1, Math.min(height, imgH - safeY));

    if (safeW < 5 || safeH < 5) return;

    // Create cropped canvas
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = Math.round(safeW);
    croppedCanvas.height = Math.round(safeH);
    const ctx = croppedCanvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      sourceImage,
      Math.round(safeX),
      Math.round(safeY),
      Math.round(safeW),
      Math.round(safeH),
      0,
      0,
      Math.round(safeW),
      Math.round(safeH)
    );

    // If there were existing calibration points, transform or retain them if inside crop
    if (points.length > 0) {
      const shifted = points.map((p) => ({
        x: p.x - safeX,
        y: p.y - safeY,
      }));
      // Keep points if they are strictly within cropped boundary
      const allInside = shifted.every(
        (p) => p.x >= 0 && p.y >= 0 && p.x <= safeW && p.y <= safeH
      );
      if (allInside) {
        setPoints(shifted);
      } else {
        setPoints([]);
      }
    }

    setSourceImage(croppedCanvas);
    setHasCropApplied(true);
    setCropArea({ active: false, x: 0, y: 0, width: 0, height: 0 });
    setIsCropMode(false);
  }, [sourceImage, cropArea, points]);

  // Reset Crop Action: restore full original image
  const handleResetCrop = useCallback(() => {
    if (!originalSourceImage) return;
    setSourceImage(originalSourceImage);
    setHasCropApplied(false);
    setCropArea({ active: false, x: 0, y: 0, width: 0, height: 0 });
    setIsCropMode(false);
    // Note: points measured on cropped view won't match full image coords, so reset points
    setPoints([]);
  }, [originalSourceImage]);

  // Physical Bitmap Rotation Action (preserves 1:1 coordinate integrity across all tools)
  const handleRotateImage = useCallback(
    (degrees: number) => {
      if (!sourceImage) return;
      const imgW = ('naturalWidth' in sourceImage ? (sourceImage as HTMLImageElement).naturalWidth : 0) || sourceImage.width;
      const imgH = ('naturalHeight' in sourceImage ? (sourceImage as HTMLImageElement).naturalHeight : 0) || sourceImage.height;
      const isQuarter = Math.abs(degrees) === 90 || Math.abs(degrees) === 270;

      const canvas = document.createElement('canvas');
      canvas.width = isQuarter ? imgH : imgW;
      canvas.height = isQuarter ? imgW : imgH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(sourceImage, -imgW / 2, -imgH / 2);

      setSourceImage(canvas);
      // Reset rotation state since the bitmap is now physically in the desired orientation
      setAdjustments((prev) => ({ ...prev, rotation: 0 }));
      setPoints([]);
      setCropArea({ active: false, x: 0, y: 0, width: 0, height: 0 });
      setIsCropMode(false);
    },
    [sourceImage]
  );

  // Global Clipboard paste support (Win+Shift+S snipping tool support)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            handleFileSelect(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFileSelect]);

  // Reset current blueprint state
  const handleReset = () => {
    setSourceImage(null);
    setFileName('');
    setPdfData(null);
    setPdfInfo(null);
    setPoints([]);
    setKnownFeetInput('');
    setCropArea({ active: false, x: 0, y: 0, width: 0, height: 0 });
    setIsCropMode(false);
    setAdjustments({
      contrast: 100,
      brightness: 100,
      invert: false,
      grayscale: false,
      rotation: 0,
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Header */}
      <Header
        onOpenGuide={() => setIsGuideModalOpen(true)}
        onFileSelect={handleFileSelect}
        hasImageLoaded={Boolean(sourceImage)}
        onReset={handleReset}
      />

      {/* Calibration Step Bar & Realtime Telemetry */}
      <CalibrationToolbar
        points={points}
        knownFeetInput={knownFeetInput}
        onKnownFeetChange={setKnownFeetInput}
        onClearPoints={() => setPoints([])}
        onTriggerCalibration={() => setIsExportModalOpen(true)}
        calculation={calculation}
        hasImage={Boolean(sourceImage)}
        showApexGrid={showApexGrid}
        onToggleApexGrid={() => setShowApexGrid((v) => !v)}
        onOpenGuide={() => setIsGuideModalOpen(true)}
      />

      {/* Main Workspace: Canvas + Adjustments Sidebar */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Interactive High-Performance Canvas */}
        <BlueprintCanvas
          sourceImage={sourceImage}
          points={points}
          onPointsChange={setPoints}
          adjustments={adjustments}
          calculation={calculation}
          cropArea={cropArea}
          onCropChange={setCropArea}
          isCropMode={isCropMode}
          setIsCropMode={setIsCropMode}
          onApplyCrop={handleApplyCrop}
          onResetCrop={handleResetCrop}
          hasCropApplied={hasCropApplied}
          knownFeetInput={knownFeetInput}
          onKnownFeetChange={setKnownFeetInput}
          showApexGrid={showApexGrid}
          onToggleApexGrid={() => setShowApexGrid((v) => !v)}
          onFileSelect={handleFileSelect}
        />

        {/* Adjustments & Multi-page PDF Controls */}
        <AdjustmentsPanel
          adjustments={adjustments}
          onAdjustmentsChange={setAdjustments}
          onRotateImage={handleRotateImage}
          pdfInfo={pdfInfo}
          onPageChange={handlePdfPageChange}
          onRenderScaleChange={handlePdfRenderScaleChange}
          isOpen={isAdjustmentsOpen}
          onToggle={() => setIsAdjustmentsOpen(!isAdjustmentsOpen)}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-4">
            <div className="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-200">{loadingMessage}</p>
            <span className="text-xs text-slate-400 mt-1">Please wait a moment</span>
          </div>
        )}
      </main>

      {/* App Footer with Copyright & Author Website */}
      <footer
        id="app-footer"
        className="h-8 border-t border-slate-800/90 bg-slate-950/95 px-4 flex items-center justify-between text-xs text-slate-400 select-none z-20 shrink-0"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-300">&copy; 2026 Bobbi Johnson</span>
          <span className="text-slate-600">&bull;</span>
          <a
            id="author-website-link"
            href="https://bobbijohnson.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1 font-medium hover:underline underline-offset-2"
          >
            <Globe className="w-3.5 h-3.5 opacity-75" />
            <span>bobbijohnson.dev</span>
            <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
          </a>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500">
          <span>Apex Blueprint Scaler</span>
          <span>&bull;</span>
          <span>1:1 Scale &bull; 96 DPI Tracing Calibration</span>
        </div>
      </footer>

      {/* Export & Apex 10' Grid Verification Modal */}
      <ApexGridPreviewModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        sourceImage={sourceImage}
        calculation={calculation}
        adjustments={adjustments}
        cropArea={cropArea}
        points={points}
        fileName={fileName}
      />

      {/* Apex Sketch v7 Appraiser Guide Modal */}
      <ApexGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />
    </div>
  );
}

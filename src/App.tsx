import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { CalibrationToolbar } from './components/CalibrationToolbar';
import { BlueprintCanvas } from './components/BlueprintCanvas';
import { AdjustmentsPanel } from './components/AdjustmentsPanel';
import { ApexGridPreviewModal } from './components/ApexGridPreviewModal';
import { ApexGuideModal } from './components/ApexGuideModal';
import { Point2D, BlueprintAdjustments, CalibrationCalculation, CropArea, PdfPageInfo } from './types';
import { parseDimension } from './utils/dimensionParser';
import { generateSampleBlueprint } from './utils/sampleBlueprint';
import { renderPdfPage } from './utils/pdfRenderer';

export default function App() {
  // Source Blueprint State
  const [sourceImage, setSourceImage] = useState<HTMLCanvasElement | HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState<string>('Sample_Residential_Blueprint.png');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');

  // PDF specific state
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [pdfInfo, setPdfInfo] = useState<PdfPageInfo | null>(null);

  // Calibration points & known distance
  const [points, setPoints] = useState<Point2D[]>([]);
  const [knownFeetInput, setKnownFeetInput] = useState<string>('48');

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
  const [isAdjustmentsOpen, setIsAdjustmentsOpen] = useState<boolean>(true);

  // Load sample blueprint on initial mount
  useEffect(() => {
    const sample = generateSampleBlueprint();
    setSourceImage(sample);
    setFileName('Sample_Residential_Blueprint.png');
    // Pre-seed points on the 48'-0" north wall of the sample blueprint
    // (In sampleBlueprint: ox = 400, oy = 350, wallW1 = 1200)
    setPoints([
      { x: 400, y: 350 },
      { x: 1600, y: 350 },
    ]);
    setKnownFeetInput('48');
  }, []);

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

  // Load Sample Blueprint
  const handleLoadSample = useCallback(() => {
    setIsLoading(true);
    setLoadingMessage('Loading sample blueprint...');
    setTimeout(() => {
      const sample = generateSampleBlueprint();
      setSourceImage(sample);
      setFileName('Sample_Residential_Blueprint.png');
      setPdfData(null);
      setPdfInfo(null);
      setPoints([
        { x: 400, y: 350 },
        { x: 1600, y: 350 },
      ]);
      setKnownFeetInput('48');
      setCropArea({ active: false, x: 0, y: 0, width: 0, height: 0 });
      setIsCropMode(false);
      setIsLoading(false);
    }, 100);
  }, []);

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
      setPdfInfo({
        ...pdfInfo,
        pageNumber: rendered.pageNumber,
      });
      setPoints([]);
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
      setPdfInfo({
        ...pdfInfo,
        renderScale: newScale,
      });
      setPoints([]);
    } catch (err) {
      console.error('Error changing render scale:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
        onLoadSample={handleLoadSample}
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
          knownFeetInput={knownFeetInput}
        />

        {/* Adjustments & Multi-page PDF Controls */}
        <AdjustmentsPanel
          adjustments={adjustments}
          onAdjustmentsChange={setAdjustments}
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

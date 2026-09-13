import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Point2D, BlueprintAdjustments, CalibrationCalculation, CropArea } from '../types';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Grid,
  Move,
  Search,
  Eye,
  Crosshair,
  Crop as CropIcon,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface BlueprintCanvasProps {
  sourceImage: HTMLCanvasElement | HTMLImageElement | null;
  points: Point2D[];
  onPointsChange: (pts: Point2D[]) => void;
  adjustments: BlueprintAdjustments;
  calculation: CalibrationCalculation | null;
  cropArea: CropArea;
  onCropChange: (crop: CropArea) => void;
  isCropMode: boolean;
  setIsCropMode: (mode: boolean) => void;
  knownFeetInput: string;
}

export const BlueprintCanvas: React.FC<BlueprintCanvasProps> = ({
  sourceImage,
  points,
  onPointsChange,
  adjustments,
  calculation,
  cropArea,
  onCropChange,
  isCropMode,
  setIsCropMode,
  knownFeetInput,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Transform state (Pan & Zoom)
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Tool modes & toggles
  const [activeTool, setActiveTool] = useState<'calibrate' | 'pan'>('calibrate');
  const [showApexGrid, setShowApexGrid] = useState(false);
  const [showLoupe, setShowLoupe] = useState(true);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);
  const [mouseCanvasPos, setMouseCanvasPos] = useState<Point2D | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  // Crop drag state
  const [cropDragStart, setCropDragStart] = useState<Point2D | null>(null);

  // Monitor Shift key for orthogonal snapping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true);

      // Keyboard arrow nudge for selected point
      if (selectedPointIndex !== null && points[selectedPointIndex]) {
        let dx = 0;
        let dy = 0;
        const step = e.shiftKey ? 5 : 1;
        if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;
        else if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;

        if (dx !== 0 || dy !== 0) {
          e.preventDefault();
          const updated = [...points];
          updated[selectedPointIndex] = {
            x: updated[selectedPointIndex].x + dx,
            y: updated[selectedPointIndex].y + dy,
          };
          onPointsChange(updated);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedPointIndex, points, onPointsChange]);

  // Fit image to canvas view
  const fitToView = useCallback(() => {
    if (!sourceImage || !containerRef.current) return;
    const container = containerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (cw === 0 || ch === 0) return;

    const imgW = sourceImage.width;
    const imgH = sourceImage.height;

    const fitScale = Math.min((cw - 60) / imgW, (ch - 60) / imgH, 1.0);
    setScale(fitScale);
    setPanX((cw - imgW * fitScale) / 2);
    setPanY((ch - imgH * fitScale) / 2);
  }, [sourceImage]);

  // Initial fit when image loads
  useEffect(() => {
    if (sourceImage) {
      fitToView();
    }
  }, [sourceImage, fitToView]);

  // Resize canvas when container size changes
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      canvasRef.current.width = containerRef.current.clientWidth;
      canvasRef.current.height = containerRef.current.clientHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Convert screen coordinates to source image coordinates
  const screenToImage = useCallback(
    (screenX: number, screenY: number): Point2D => {
      const imgX = (screenX - panX) / scale;
      const imgY = (screenY - panY) / scale;
      return { x: imgX, y: imgY };
    },
    [panX, panY, scale]
  );

  // Convert source image coordinates to screen coordinates
  const imageToScreen = useCallback(
    (imgX: number, imgY: number): Point2D => {
      return {
        x: imgX * scale + panX,
        y: imgY * scale + panY,
      };
    },
    [panX, panY, scale]
  );

  // Wheel zoom handler centered on mouse cursor
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!sourceImage || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = 1.15;
    const newScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor;
    // Bound zoom between 0.05x and 40x
    const clampedScale = Math.max(0.05, Math.min(40, newScale));

    const newPanX = mouseX - (mouseX - panX) * (clampedScale / scale);
    const newPanY = mouseY - (mouseY - panY) * (clampedScale / scale);

    setScale(clampedScale);
    setPanX(newPanX);
    setPanY(newPanY);
  };

  // Mouse Down
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const imgPos = screenToImage(mouseX, mouseY);

    // Pan with Right Click (button 2), Middle Click (button 1), Space+Left, or Pan Tool
    if (e.button === 2 || e.button === 1 || activeTool === 'pan' || e.altKey) {
      setIsDragging(true);
      setDragStart({ x: mouseX - panX, y: mouseY - panY });
      return;
    }

    if (e.button === 0) {
      // Crop mode selection
      if (isCropMode) {
        setCropDragStart(imgPos);
        onCropChange({
          active: true,
          x: imgPos.x,
          y: imgPos.y,
          width: 0,
          height: 0,
        });
        return;
      }

      // Check if clicking existing calibration point handle (threshold: 12px)
      if (hoveredPointIndex !== null) {
        setIsDraggingPoint(true);
        setSelectedPointIndex(hoveredPointIndex);
        return;
      }

      // Calibration Point Placement
      if (!sourceImage) return;
      // Ensure click is within image bounds
      if (
        imgPos.x >= 0 &&
        imgPos.y >= 0 &&
        imgPos.x <= sourceImage.width &&
        imgPos.y <= sourceImage.height
      ) {
        let finalPos = { ...imgPos };

        // If placing point 2 and Shift is pressed, snap orthogonal
        if (points.length === 1 && isShiftPressed) {
          const p1 = points[0];
          const dx = Math.abs(finalPos.x - p1.x);
          const dy = Math.abs(finalPos.y - p1.y);
          if (dx > dy) {
            finalPos.y = p1.y; // snap horizontal
          } else {
            finalPos.x = p1.x; // snap vertical
          }
        }

        if (points.length < 2) {
          const updated = [...points, finalPos];
          onPointsChange(updated);
          setSelectedPointIndex(updated.length - 1);
        } else {
          // Both points already set; clicking moves Point 1 to start fresh
          onPointsChange([finalPos]);
          setSelectedPointIndex(0);
        }
      }
    }
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const imgPos = screenToImage(mouseX, mouseY);
    setMouseCanvasPos(imgPos);

    // Pan update
    if (isDragging) {
      setPanX(mouseX - dragStart.x);
      setPanY(mouseY - dragStart.y);
      return;
    }

    // Crop drag update
    if (isCropMode && cropDragStart) {
      const minX = Math.min(cropDragStart.x, imgPos.x);
      const minY = Math.min(cropDragStart.y, imgPos.y);
      const width = Math.abs(imgPos.x - cropDragStart.x);
      const height = Math.abs(imgPos.y - cropDragStart.y);
      onCropChange({
        active: true,
        x: Math.max(0, minX),
        y: Math.max(0, minY),
        width,
        height,
      });
      return;
    }

    // Drag existing point handle
    if (isDraggingPoint && selectedPointIndex !== null) {
      let finalPos = { ...imgPos };
      if (isShiftPressed && points.length === 2) {
        const otherIndex = selectedPointIndex === 0 ? 1 : 0;
        const otherP = points[otherIndex];
        const dx = Math.abs(finalPos.x - otherP.x);
        const dy = Math.abs(finalPos.y - otherP.y);
        if (dx > dy) finalPos.y = otherP.y;
        else finalPos.x = otherP.x;
      }
      const updated = [...points];
      updated[selectedPointIndex] = finalPos;
      onPointsChange(updated);
      return;
    }

    // Check hover near points (within 12 screen pixels)
    let foundIndex: number | null = null;
    points.forEach((p, idx) => {
      const screenP = imageToScreen(p.x, p.y);
      const dist = Math.hypot(screenP.x - mouseX, screenP.y - mouseY);
      if (dist <= 14) {
        foundIndex = idx;
      }
    });
    setHoveredPointIndex(foundIndex);
  };

  // Mouse Up
  const handleMouseUp = () => {
    setIsDragging(false);
    setIsDraggingPoint(false);
    if (cropDragStart) {
      setCropDragStart(null);
    }
  };

  // Nudge selected point
  const nudgeSelectedPoint = (dx: number, dy: number) => {
    if (selectedPointIndex === null || !points[selectedPointIndex]) return;
    const updated = [...points];
    updated[selectedPointIndex] = {
      x: updated[selectedPointIndex].x + dx,
      y: updated[selectedPointIndex].y + dy,
    };
    onPointsChange(updated);
  };

  // Render main canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background dark workspace grid pattern
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!sourceImage) return;

    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(scale, scale);

    // Apply adjustments filter
    const filters: string[] = [];
    if (adjustments.contrast !== 100) filters.push(`contrast(${adjustments.contrast}%)`);
    if (adjustments.brightness !== 100) filters.push(`brightness(${adjustments.brightness}%)`);
    if (adjustments.invert) filters.push('invert(100%)');
    if (adjustments.grayscale) filters.push('grayscale(100%)');

    ctx.filter = filters.length > 0 ? filters.join(' ') : 'none';

    // Draw Source Image with rotation if applicable
    ctx.save();
    if (adjustments.rotation !== 0) {
      ctx.translate(sourceImage.width / 2, sourceImage.height / 2);
      ctx.rotate((adjustments.rotation * Math.PI) / 180);
      ctx.drawImage(sourceImage, -sourceImage.width / 2, -sourceImage.height / 2);
    } else {
      ctx.drawImage(sourceImage, 0, 0);
    }
    ctx.restore();

    // Reset filter for UI overlays
    ctx.filter = 'none';

    // 1. Simulated Apex 10' Grid Overlay (if enabled & calibrated)
    if (showApexGrid && calculation) {
      // In Apex, 1 foot = 9.6 pixels on the calibrated image.
      // So on the original uncalibrated image, 1 foot = calculation.currentPixelsPerFoot pixels!
      const pxPer10Ft = calculation.currentPixelsPerFoot * 10;
      const pxPer1Ft = calculation.currentPixelsPerFoot;

      ctx.save();
      // 1-foot minor grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.lineWidth = 1 / scale;
      for (let x = 0; x < sourceImage.width; x += pxPer1Ft) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, sourceImage.height);
        ctx.stroke();
      }
      for (let y = 0; y < sourceImage.height; y += pxPer1Ft) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(sourceImage.width, y);
        ctx.stroke();
      }

      // 10-foot major grid (standard Apex grid line)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 2 / scale;
      for (let x = 0; x < sourceImage.width; x += pxPer10Ft) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, sourceImage.height);
        ctx.stroke();
      }
      for (let y = 0; y < sourceImage.height; y += pxPer10Ft) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(sourceImage.width, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. Crop area boundary
    if (cropArea.active && cropArea.width > 0 && cropArea.height > 0) {
      ctx.save();
      // Dim outside crop
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      // Top
      ctx.fillRect(0, 0, sourceImage.width, cropArea.y);
      // Bottom
      ctx.fillRect(0, cropArea.y + cropArea.height, sourceImage.width, sourceImage.height - (cropArea.y + cropArea.height));
      // Left
      ctx.fillRect(0, cropArea.y, cropArea.x, cropArea.height);
      // Right
      ctx.fillRect(cropArea.x + cropArea.width, cropArea.y, sourceImage.width - (cropArea.x + cropArea.width), cropArea.height);

      // Crop border
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash([6 / scale, 6 / scale]);
      ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
      ctx.restore();
    }

    // 3. Calibration Points and Dimension Line
    if (points.length > 0) {
      ctx.save();

      // Connecting line
      if (points.length === 2) {
        const p1 = points[0];
        const p2 = points[1];

        // Glow shadow
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 8 / scale;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Solid dimension line
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3 / scale;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Distance & Angle Badge in center
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const angleDeg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);

        const badgeText = `${dist.toFixed(0)} px • ${knownFeetInput ? `${knownFeetInput} ft` : ''}`;

        ctx.font = `bold ${Math.max(12, 14 / scale)}px monospace`;
        const metrics = ctx.measureText(badgeText);
        const padX = 8 / scale;
        const padY = 4 / scale;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(
          midX - metrics.width / 2 - padX,
          midY - 12 / scale - padY,
          metrics.width + padX * 2,
          24 / scale
        );

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeRect(
          midX - metrics.width / 2 - padX,
          midY - 12 / scale - padY,
          metrics.width + padX * 2,
          24 / scale
        );

        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, midX, midY);
      }

      // Point Handles
      points.forEach((p, index) => {
        const isSelected = selectedPointIndex === index;
        const isHovered = hoveredPointIndex === index;

        // Outer glow circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, (isSelected || isHovered ? 12 : 8) / scale, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.4)' : 'rgba(239, 68, 68, 0.3)';
        ctx.fill();

        // Main Point Circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 / scale, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#3b82f4' : '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / scale;
        ctx.stroke();

        // Crosshairs in point
        const ch = 10 / scale;
        ctx.strokeStyle = isSelected ? '#93c5fd' : '#fca5a5';
        ctx.lineWidth = 1 / scale;
        ctx.beginPath();
        ctx.moveTo(p.x - ch, p.y);
        ctx.lineTo(p.x + ch, p.y);
        ctx.moveTo(p.x, p.y - ch);
        ctx.lineTo(p.x, p.y + ch);
        ctx.stroke();

        // Label (Pt 1 / Pt 2)
        ctx.font = `bold ${Math.max(10, 11 / scale)}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`Pt ${index + 1}`, p.x, p.y - 14 / scale);
      });

      ctx.restore();
    }

    ctx.restore();
  }, [
    sourceImage,
    panX,
    panY,
    scale,
    points,
    adjustments,
    showApexGrid,
    calculation,
    cropArea,
    selectedPointIndex,
    hoveredPointIndex,
    knownFeetInput,
  ]);

  // Render Loupe Magnifier
  useEffect(() => {
    if (!showLoupe || !loupeCanvasRef.current || !sourceImage || !mouseCanvasPos) return;

    const loupe = loupeCanvasRef.current;
    const lCtx = loupe.getContext('2d');
    if (!lCtx) return;

    const lw = loupe.width;
    const lh = loupe.height;
    const zoom = 5; // 5x magnification in loupe

    lCtx.clearRect(0, 0, lw, lh);

    // Draw source image crop inside loupe
    lCtx.imageSmoothingEnabled = false; // pixelated for precision inspection

    const srcW = lw / zoom;
    const srcH = lh / zoom;
    const srcX = mouseCanvasPos.x - srcW / 2;
    const srcY = mouseCanvasPos.y - srcH / 2;

    lCtx.fillStyle = '#0f172a';
    lCtx.fillRect(0, 0, lw, lh);

    lCtx.save();
    // Apply filters if any
    const filters: string[] = [];
    if (adjustments.contrast !== 100) filters.push(`contrast(${adjustments.contrast}%)`);
    if (adjustments.brightness !== 100) filters.push(`brightness(${adjustments.brightness}%)`);
    if (adjustments.invert) filters.push('invert(100%)');
    if (adjustments.grayscale) filters.push('grayscale(100%)');
    lCtx.filter = filters.length > 0 ? filters.join(' ') : 'none';

    lCtx.drawImage(sourceImage, srcX, srcY, srcW, srcH, 0, 0, lw, lh);
    lCtx.restore();

    // Crosshair in loupe center
    const cx = lw / 2;
    const cy = lh / 2;

    lCtx.strokeStyle = '#ef4444';
    lCtx.lineWidth = 1.5;
    lCtx.beginPath();
    lCtx.moveTo(cx - 20, cy);
    lCtx.lineTo(cx - 4, cy);
    lCtx.moveTo(cx + 4, cy);
    lCtx.lineTo(cx + 20, cy);
    lCtx.moveTo(cx, cy - 20);
    lCtx.lineTo(cx, cy - 4);
    lCtx.moveTo(cx, cy + 4);
    lCtx.lineTo(cx, cy + 20);
    lCtx.stroke();

    // Center 1-pixel dot
    lCtx.fillStyle = '#fef08a';
    lCtx.beginPath();
    lCtx.arc(cx, cy, 2, 0, Math.PI * 2);
    lCtx.fill();

    // Subtle subpixel grid
    lCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    lCtx.lineWidth = 1;
    const step = zoom;
    for (let x = 0; x < lw; x += step) {
      lCtx.beginPath();
      lCtx.moveTo(x, 0);
      lCtx.lineTo(x, lh);
      lCtx.stroke();
    }
    for (let y = 0; y < lh; y += step) {
      lCtx.beginPath();
      lCtx.moveTo(0, y);
      lCtx.lineTo(lw, y);
      lCtx.stroke();
    }
  }, [showLoupe, sourceImage, mouseCanvasPos, adjustments]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full overflow-hidden bg-slate-950 select-none cursor-crosshair"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Main High-Performance Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Empty State Banner */}
      {!sourceImage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
            <Crosshair className="w-8 h-8" />
          </div>
          <h2 className="text-base font-semibold text-slate-200 mb-1">
            No Blueprint Loaded
          </h2>
          <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed">
            Upload an architectural blueprint PDF or screenshot, or click &quot;Sample Plan&quot; above to see 1:1 Apex Sketch calibration in action.
          </p>
          <span className="text-[11px] text-blue-400 font-mono bg-blue-950/60 px-3 py-1 rounded-full border border-blue-800/60">
            Rule: 1 Foot on Apex Grid = 9.6 Pixels @ 96 DPI
          </span>
        </div>
      )}

      {/* Floating Instructions Pill */}
      {sourceImage && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/90 text-slate-200 border border-slate-700/80 px-4 py-1.5 rounded-full text-xs shadow-lg backdrop-blur-md pointer-events-none flex items-center gap-2">
          {points.length === 0 && (
            <>
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>Click <strong>Point 1</strong>: The start tick mark of any known wall (e.g. 48&apos;-0&quot;).</span>
            </>
          )}
          {points.length === 1 && (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Click <strong>Point 2</strong>: The end of that same wall. (Hold <strong>Shift</strong> for horizontal/vertical snap).</span>
            </>
          )}
          {points.length === 2 && (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Points placed! Verify dimension length above, then click <strong>Calibrate & Export</strong>.</span>
            </>
          )}
        </div>
      )}

      {/* On-Screen Canvas Navigation & Tool Controls */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-10">
        {/* Zoom & View Controls */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-lg shadow-lg backdrop-blur-md">
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(40, s * 1.25))}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
            title="Zoom In (or scroll wheel up)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.05, s / 1.25))}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
            title="Zoom Out (or scroll wheel down)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-800 my-auto" />
          <button
            type="button"
            onClick={fitToView}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
            title="Fit to Window"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setScale(1)}
            className="px-2 py-1 text-[11px] font-mono font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
            title="Actual 100% Zoom"
          >
            {Math.round(scale * 100)}%
          </button>
        </div>

        {/* Feature Toggles (Apex Grid, Loupe, Crop) */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-lg shadow-lg backdrop-blur-md">
          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'calibrate' ? 'pan' : 'calibrate')}
            className={`p-1.5 rounded transition cursor-pointer ${
              activeTool === 'pan'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Pan Tool (or hold Right-Click/Space)"
          >
            <Move className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowApexGrid(!showApexGrid)}
            disabled={!calculation}
            className={`p-1.5 rounded transition cursor-pointer ${
              showApexGrid
                ? 'bg-sky-600 text-white'
                : calculation
                ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                : 'text-slate-600 cursor-not-allowed'
            }`}
            title={
              calculation
                ? 'Simulate Apex 10-ft Grid Overlay on blueprint'
                : 'Set 2 points and dimension to enable Apex Grid simulation'
            }
          >
            <Grid className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowLoupe(!showLoupe)}
            className={`p-1.5 rounded transition cursor-pointer ${
              showLoupe
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Precision Magnifier Loupe"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (isCropMode) {
                onCropChange({ active: false, x: 0, y: 0, width: 0, height: 0 });
                setIsCropMode(false);
              } else {
                setIsCropMode(true);
              }
            }}
            className={`p-1.5 rounded transition cursor-pointer ${
              isCropMode
                ? 'bg-amber-600 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Crop blueprint to isolate floor plan area"
          >
            <CropIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Precision Magnifier Loupe Widget (Bottom Right) */}
      {showLoupe && sourceImage && mouseCanvasPos && (
        <div className="absolute bottom-4 right-4 bg-slate-900 border border-slate-800 rounded-xl p-2.5 shadow-2xl backdrop-blur-md flex flex-col items-center gap-1.5 z-10 select-none pointer-events-none">
          <div className="flex items-center justify-between w-full text-[10px] font-mono text-slate-400 px-0.5">
            <span className="font-semibold text-blue-400">5X LOUPE</span>
            <span>
              X:{Math.round(mouseCanvasPos.x)} Y:{Math.round(mouseCanvasPos.y)}
            </span>
          </div>
          <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-black">
            <canvas ref={loupeCanvasRef} width={150} height={150} className="block" />
          </div>
          <span className="text-[9px] text-slate-500">Crosshair shows exact target pixel</span>
        </div>
      )}

      {/* Selected Point Nudge Controller (appears when a point is active) */}
      {selectedPointIndex !== null && points[selectedPointIndex] && (
        <div className="absolute top-14 right-4 bg-slate-900/90 border border-slate-800 rounded-xl p-2 shadow-xl backdrop-blur-md flex flex-col items-center gap-1 z-10">
          <span className="text-[10px] font-semibold text-slate-400">
            Nudge Pt {selectedPointIndex + 1}
          </span>
          <button
            type="button"
            onClick={() => nudgeSelectedPoint(0, -1)}
            className="p-1 rounded hover:bg-slate-800 text-slate-300 transition cursor-pointer"
            title="Nudge Up 1px"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => nudgeSelectedPoint(-1, 0)}
              className="p-1 rounded hover:bg-slate-800 text-slate-300 transition cursor-pointer"
              title="Nudge Left 1px"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-mono text-blue-400 px-1">1px</span>
            <button
              type="button"
              onClick={() => nudgeSelectedPoint(1, 0)}
              className="p-1 rounded hover:bg-slate-800 text-slate-300 transition cursor-pointer"
              title="Nudge Right 1px"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => nudgeSelectedPoint(0, 1)}
            className="p-1 rounded hover:bg-slate-800 text-slate-300 transition cursor-pointer"
            title="Nudge Down 1px"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

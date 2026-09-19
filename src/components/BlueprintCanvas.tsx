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
  FileUp,
  UploadCloud,
  CheckCircle2,
  Check,
  X,
  RotateCcw,
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
  onKnownFeetChange: (val: string) => void;
  showApexGrid: boolean;
  onToggleApexGrid: () => void;
  onApplyCrop?: () => void;
  onResetCrop?: () => void;
  hasCropApplied?: boolean;
  onFileSelect?: (file: File) => void;
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
  onKnownFeetChange,
  showApexGrid,
  onToggleApexGrid,
  onApplyCrop,
  onResetCrop,
  hasCropApplied = false,
  onFileSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);
  const dropInputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop state
  const [isDragOver, setIsDragOver] = useState(false);

  // Transform state (Pan & Zoom)
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Tool modes & toggles
  const [activeTool, setActiveTool] = useState<'calibrate' | 'pan'>('calibrate');
  const [showLoupe, setShowLoupe] = useState(true);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);
  const [mouseCanvasPos, setMouseCanvasPos] = useState<Point2D | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [resizeCount, setResizeCount] = useState(0);

  // Crop drag state
  const [cropDragStart, setCropDragStart] = useState<Point2D | null>(null);

  // Monitor keyboard shortcuts: Shift snapping, arrow nudging, and Enter/Escape for crop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true);

      // Crop Mode shortcuts: Enter to confirm crop, Escape to cancel
      if (isCropMode) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (cropArea.active && cropArea.width > 10 && cropArea.height > 10 && onApplyCrop) {
            onApplyCrop();
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onCropChange({ active: false, x: 0, y: 0, width: 0, height: 0 });
          setIsCropMode(false);
          return;
        }
      }

      // Escape to cancel point placement
      if (e.key === 'Escape' && points.length > 0) {
        e.preventDefault();
        onPointsChange([]);
        return;
      }

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

    const handleBlur = () => {
      setIsShiftPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [selectedPointIndex, points, onPointsChange, isCropMode, cropArea, onApplyCrop, onCropChange, setIsCropMode]);

  // Fit image to canvas view
  const fitToView = useCallback(() => {
    if (!sourceImage || !containerRef.current) return;
    const container = containerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (cw === 0 || ch === 0) return;

    if (canvasRef.current) {
      canvasRef.current.width = cw;
      canvasRef.current.height = ch;
    }

    const imgW = ('naturalWidth' in sourceImage ? (sourceImage as HTMLImageElement).naturalWidth : 0) || sourceImage.width;
    const imgH = ('naturalHeight' in sourceImage ? (sourceImage as HTMLImageElement).naturalHeight : 0) || sourceImage.height;

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

  // Continuously synchronize canvas buffer dimensions with container via ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const syncCanvasSize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);

      if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w;
        canvas.height = h;
        setResizeCount((c) => c + 1);
      }
    };

    syncCanvasSize();

    const ro = new ResizeObserver(() => {
      syncCanvasSize();
    });
    ro.observe(container);

    window.addEventListener('resize', syncCanvasSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncCanvasSize);
    };
  }, []);

  // Accurately map client viewport coordinates to canvas internal bitmap pixel coordinates
  const getCanvasCoords = useCallback((e: React.MouseEvent | MouseEvent): { canvasX: number; canvasY: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    // Convert clientX / clientY (CSS pixels) to exact canvas buffer coordinates
    const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);
    return { canvasX, canvasY };
  }, []);

  // Convert canvas buffer coordinates to source image coordinates
  const screenToImage = useCallback(
    (canvasX: number, canvasY: number): Point2D => {
      const imgX = (canvasX - panX) / scale;
      const imgY = (canvasY - panY) / scale;
      return { x: imgX, y: imgY };
    },
    [panX, panY, scale]
  );

  // Convert source image coordinates to canvas buffer coordinates
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
    if (!sourceImage) return;

    const coords = getCanvasCoords(e);
    if (!coords) return;

    const mouseX = coords.canvasX;
    const mouseY = coords.canvasY;

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
    // Only handle mouse events originating directly on the canvas element (prevents overlay buttons/prompts from triggering drag/crop reset)
    if (e.target !== canvasRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const coords = getCanvasCoords(e);
    if (!coords) return;

    const mouseX = coords.canvasX;
    const mouseY = coords.canvasY;
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
        if (!sourceImage) return;
        const imgW = ('naturalWidth' in sourceImage ? (sourceImage as HTMLImageElement).naturalWidth : 0) || sourceImage.width;
        const imgH = ('naturalHeight' in sourceImage ? (sourceImage as HTMLImageElement).naturalHeight : 0) || sourceImage.height;
        const clampedPos = {
          x: Math.max(0, Math.min(imgW, imgPos.x)),
          y: Math.max(0, Math.min(imgH, imgPos.y)),
        };
        setCropDragStart(clampedPos);
        onCropChange({
          active: true,
          x: Math.round(clampedPos.x),
          y: Math.round(clampedPos.y),
          width: 0,
          height: 0,
        });
        return;
      }

      // Check if clicking existing calibration point handle (generous hit radius)
      if (hoveredPointIndex !== null) {
        setIsDraggingPoint(true);
        setSelectedPointIndex(hoveredPointIndex);
        return;
      }

      // Calibration Point Placement
      if (!sourceImage) return;
      const imgW = ('naturalWidth' in sourceImage ? (sourceImage as HTMLImageElement).naturalWidth : 0) || sourceImage.width;
      const imgH = ('naturalHeight' in sourceImage ? (sourceImage as HTMLImageElement).naturalHeight : 0) || sourceImage.height;

      // Ensure click is within image bounds
      if (
        imgPos.x >= 0 &&
        imgPos.y >= 0 &&
        imgPos.x <= imgW &&
        imgPos.y <= imgH
      ) {
        let finalPos = { ...imgPos };

        // If placing point 2 and Shift is held (via event or tracked state), snap orthogonal
        const isShift = e.shiftKey || isShiftPressed;
        if (points.length === 1 && isShift) {
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
          // Both points are already set!
          // DO NOT wipe the points. Instead, allow the user to pan the canvas naturally by dragging.
          setIsDragging(true);
          setDragStart({ x: mouseX - panX, y: mouseY - panY });
          return;
        }
      }
    }
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;

    // Track shift state directly from event
    if (e.shiftKey !== isShiftPressed) {
      setIsShiftPressed(e.shiftKey);
    }

    const mouseX = coords.canvasX;
    const mouseY = coords.canvasY;
    const imgPos = screenToImage(mouseX, mouseY);
    setMouseCanvasPos(imgPos);

    // Pan update
    if (isDragging) {
      setPanX(mouseX - dragStart.x);
      setPanY(mouseY - dragStart.y);
      return;
    }

    // Crop drag update
    if (isCropMode && cropDragStart && sourceImage) {
      const imgW = ('naturalWidth' in sourceImage ? (sourceImage as HTMLImageElement).naturalWidth : 0) || sourceImage.width;
      const imgH = ('naturalHeight' in sourceImage ? (sourceImage as HTMLImageElement).naturalHeight : 0) || sourceImage.height;

      const curX = Math.max(0, Math.min(imgW, imgPos.x));
      const curY = Math.max(0, Math.min(imgH, imgPos.y));
      const startX = Math.max(0, Math.min(imgW, cropDragStart.x));
      const startY = Math.max(0, Math.min(imgH, cropDragStart.y));

      const minX = Math.min(startX, curX);
      const minY = Math.min(startY, curY);
      const width = Math.abs(curX - startX);
      const height = Math.abs(curY - startY);

      onCropChange({
        active: true,
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.round(width),
        height: Math.round(height),
      });
      return;
    }

    // Drag existing point handle
    if (isDraggingPoint && selectedPointIndex !== null) {
      let finalPos = { ...imgPos };
      const isShift = e.shiftKey || isShiftPressed;
      if (isShift && points.length === 2) {
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

    // Check hover near points (within 22 canvas pixels for effortless grabbing)
    let foundIndex: number | null = null;
    points.forEach((p, idx) => {
      const screenP = imageToScreen(p.x, p.y);
      const dist = Math.hypot(screenP.x - mouseX, screenP.y - mouseY);
      if (dist <= 22) {
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

    // 3. Live guideline preview when placing Point 2
    if (points.length === 1 && mouseCanvasPos) {
      let targetX = mouseCanvasPos.x;
      let targetY = mouseCanvasPos.y;

      // Snapping guideline preview if Shift is held
      if (isShiftPressed) {
        const p1 = points[0];
        const dx = Math.abs(targetX - p1.x);
        const dy = Math.abs(targetY - p1.y);
        if (dx > dy) targetY = p1.y;
        else targetX = p1.x;
      }

      ctx.save();
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash([5 / scale, 5 / scale]);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();

      // Floating live pixel counter at mouse position
      const liveDist = Math.hypot(targetX - points[0].x, targetY - points[0].y);
      ctx.font = `bold ${Math.max(10, 12 / scale)}px monospace`;
      ctx.fillStyle = '#60a5fa';
      ctx.fillText(`${liveDist.toFixed(0)} px`, targetX + 10 / scale, targetY - 10 / scale);
      ctx.restore();
    }

    // 4. Calibration Points and Dimension Line
    if (points.length > 0) {
      ctx.save();

      // Connecting line
      if (points.length === 2) {
        const p1 = points[0];
        const p2 = points[1];
        const isCalibrated = Boolean(knownFeetInput && calculation);

        // Glow shadow
        ctx.strokeStyle = isCalibrated ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)';
        ctx.lineWidth = 8 / scale;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Solid dimension line
        ctx.strokeStyle = isCalibrated ? '#10b981' : '#3b82f6';
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

        const badgeText = isCalibrated
          ? `✓ ${calculation!.actualFeet.toFixed(1)} ft (${dist.toFixed(0)} px • ${calculation!.currentPixelsPerFoot.toFixed(1)} px/ft)`
          : `📏 ${dist.toFixed(0)} px — Enter wall length in Step 2 ➜`;

        ctx.font = `bold ${Math.max(11, 13 / scale)}px monospace`;
        const metrics = ctx.measureText(badgeText);
        const padX = 10 / scale;
        const padY = 5 / scale;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.fillRect(
          midX - metrics.width / 2 - padX,
          midY - 12 / scale - padY,
          metrics.width + padX * 2,
          24 / scale
        );

        ctx.strokeStyle = isCalibrated ? '#10b981' : '#3b82f6';
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeRect(
          midX - metrics.width / 2 - padX,
          midY - 12 / scale - padY,
          metrics.width + padX * 2,
          24 / scale
        );

        ctx.fillStyle = isCalibrated ? '#a7f3d0' : '#93c5fd';
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
    isShiftPressed,
    mouseCanvasPos,
    resizeCount,
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

    // Pixelated for precision subpixel inspection
    lCtx.imageSmoothingEnabled = false;

    lCtx.fillStyle = '#0f172a';
    lCtx.fillRect(0, 0, lw, lh);

    lCtx.save();
    // Center loupe view exactly on mouseCanvasPos with magnification
    lCtx.translate(lw / 2, lh / 2);
    lCtx.scale(zoom, zoom);
    lCtx.translate(-mouseCanvasPos.x, -mouseCanvasPos.y);

    // Apply filters if any
    const filters: string[] = [];
    if (adjustments.contrast !== 100) filters.push(`contrast(${adjustments.contrast}%)`);
    if (adjustments.brightness !== 100) filters.push(`brightness(${adjustments.brightness}%)`);
    if (adjustments.invert) filters.push('invert(100%)');
    if (adjustments.grayscale) filters.push('grayscale(100%)');
    lCtx.filter = filters.length > 0 ? filters.join(' ') : 'none';

    lCtx.drawImage(sourceImage, 0, 0);
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
      className={`relative flex-1 w-full h-full overflow-hidden bg-slate-950 select-none cursor-crosshair transition-colors ${
        isDragOver ? 'ring-2 ring-blue-500 ring-inset bg-slate-900/50' : ''
      }`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={() => {
        // Double-click to apply crop when crop area is active
        if (isCropMode && cropArea.active && cropArea.width > 10 && cropArea.height > 10 && onApplyCrop) {
          onApplyCrop();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragOver) setIsDragOver(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && onFileSelect) {
          onFileSelect(file);
        }
      }}
    >
      {/* Hidden file input for empty state click */}
      <input
        type="file"
        ref={dropInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && onFileSelect) {
            onFileSelect(file);
            e.target.value = '';
          }
        }}
        accept="application/pdf,image/png,image/jpeg,image/webp,image/tiff"
        className="hidden"
      />

      {/* Main High-Performance Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Empty State Banner */}
      {!sourceImage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 pointer-events-auto">
          <div
            onClick={() => dropInputRef.current?.click()}
            className="w-full max-w-lg p-8 rounded-2xl bg-slate-900/90 border-2 border-dashed border-slate-700 hover:border-blue-500 hover:bg-slate-900 transition-all duration-200 cursor-pointer flex flex-col items-center shadow-2xl backdrop-blur-sm group"
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 group-hover:scale-105 group-hover:bg-blue-600/20 flex items-center justify-center text-blue-400 mb-4 transition-all">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-semibold text-slate-100 mb-1">
              Upload Architectural Blueprint
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
              Drag and drop your PDF blueprint or high-res image here, or click to browse from your computer.
            </p>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dropInputRef.current?.click();
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <FileUp className="w-4 h-4" />
              <span>Select Blueprint File</span>
            </button>

            <div className="mt-6 pt-5 border-t border-slate-800/80 w-full flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
              <span>Supports PDF, PNG, JPG, TIFF</span>
              <span className="text-blue-400 bg-blue-950/80 px-2.5 py-0.5 rounded border border-blue-800/50">
                1:1 Scale @ 96 DPI for Apex v7
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-4">
            Tip: You can also take a screenshot (<kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">Win+Shift+S</kbd>) and paste with <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">Ctrl+V</kbd>
          </p>
        </div>
      )}

      {/* Floating Guidance & Interactive Calibration Prompts */}
      {sourceImage && (
        <>
          {/* CROP MODE: Active Box Action Prompt */}
          {isCropMode && cropArea.active && cropArea.width > 10 && cropArea.height > 10 && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/95 border-2 border-amber-500 text-slate-100 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md z-30 flex flex-col sm:flex-row items-center gap-4 animate-in fade-in zoom-in-95"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-md">
                  <CropIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Selected: {Math.round(cropArea.width)} × {Math.round(cropArea.height)} px</span>
                    <span className="text-[10px] uppercase font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                      Crop Ready
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Click <strong>Apply Crop</strong>, press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[10px] border border-slate-700">Enter</kbd>, or double-click to crop.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onApplyCrop) onApplyCrop();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition shadow-md shadow-amber-600/30 cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Apply Crop</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCropChange({ active: false, x: 0, y: 0, width: 0, height: 0 });
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                  title="Clear crop box to redraw"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Redraw</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCropChange({ active: false, x: 0, y: 0, width: 0, height: 0 });
                    setIsCropMode(false);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                  title="Cancel crop selection (Esc)"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          )}

          {/* CROP MODE: Drawing Prompt (when box not yet drawn) */}
          {isCropMode && (!cropArea.active || cropArea.width <= 10 || cropArea.height <= 10) && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-950/90 border border-amber-600/80 text-amber-200 px-4 py-2 rounded-full text-xs shadow-xl backdrop-blur-md z-30 flex items-center gap-2.5"
            >
              <CropIcon className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Crop Tool Active:</strong> Click and drag a box on the blueprint to isolate your floor plan area.
              </span>
              <button
                type="button"
                onClick={() => setIsCropMode(false)}
                className="ml-2 text-slate-400 hover:text-white p-0.5 rounded transition cursor-pointer"
                title="Cancel crop mode (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* CROPPED BLUEPRINT STATUS BADGE */}
          {hasCropApplied && !isCropMode && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              className="absolute top-3 left-4 bg-slate-900/95 border border-amber-500/70 text-amber-200 px-3 py-1.5 rounded-xl text-xs shadow-xl backdrop-blur-md z-10 flex items-center gap-2"
            >
              <CropIcon className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold text-slate-100">
                Cropped: {sourceImage.width} × {sourceImage.height} px
              </span>
              {onResetCrop && (
                <button
                  type="button"
                  onClick={onResetCrop}
                  className="ml-1 text-[11px] font-medium text-amber-400 hover:text-amber-200 underline cursor-pointer"
                  title="Restore uncropped blueprint"
                >
                  Reset Full
                </button>
              )}
            </div>
          )}

          {/* STEP 1: Point Placement Prompt (only when not in crop mode) */}
          {!isCropMode && points.length < 2 && (
            <div className={`absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/95 text-slate-200 border px-4 py-2 rounded-full text-xs shadow-xl backdrop-blur-md flex items-center gap-3 z-10 ${
              points.length === 1 ? 'border-amber-500/50 pointer-events-auto' : 'border-slate-700/80 pointer-events-none'
            }`}>
              {points.length === 0 && (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
                  <span>
                    <strong className="text-white">Step 1:</strong> Click the <strong>start corner</strong> of any wall with a printed measurement.
                  </span>
                </>
              )}
              {points.length === 1 && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                    <span>
                      <strong className="text-white">Step 1:</strong> Click the <strong>end corner</strong> of that wall.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPointsChange([]);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/25 hover:bg-rose-950/90 text-amber-200 hover:text-rose-200 border border-amber-400/60 hover:border-rose-400/80 transition cursor-pointer shadow-sm ml-1"
                    title="Clear this point and start over (or press Esc)"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                    <span>Re-measure</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* CALIBRATED: Success Badge with quick tools */}
          {points.length === 2 && knownFeetInput && calculation && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-emerald-500/80 text-emerald-100 px-4 py-2 rounded-2xl shadow-xl backdrop-blur-md z-20 flex flex-wrap items-center gap-3"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-white">✓ Calibrated for Apex!</span>
                <span className="text-xs text-emerald-300 font-mono">
                  {calculation.actualFeet.toFixed(1)}&apos; = {calculation.measuredPixels.toFixed(0)} px ({calculation.currentPixelsPerFoot.toFixed(1)} px/ft)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleApexGrid}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                    showApexGrid
                      ? 'bg-cyan-900/60 text-cyan-200 border-cyan-500'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{showApexGrid ? 'Apex 10&apos; Grid: ON' : 'Verify with 10&apos; Grid'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPointsChange([])}
                  className="text-[11px] text-slate-400 hover:text-rose-400 transition cursor-pointer"
                  title="Clear points and choose a different wall"
                >
                  Re-measure
                </button>
              </div>
            </div>
          )}

          {/* APEX GRID VERIFICATION HELPER CARD */}
          {showApexGrid && calculation && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-16 right-4 bg-slate-900/95 border border-cyan-500/50 text-slate-200 p-3.5 rounded-xl shadow-2xl backdrop-blur-md max-w-xs z-10 pointer-events-auto"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 text-cyan-300 font-bold text-xs">
                  <Grid className="w-4 h-4 text-cyan-400" />
                  <span>Apex 10&apos; Grid Active</span>
                </div>
                <button
                  type="button"
                  onClick={onToggleApexGrid}
                  className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800 cursor-pointer"
                >
                  Hide
                </button>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Each cyan grid square represents <strong className="text-cyan-300 font-semibold">10 × 10 feet</strong> in Apex Sketch.
              </p>
              <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400">
                💡 <strong className="text-slate-200">How to verify:</strong> Check other rooms on your blueprint (e.g. a 20-ft garage spans 2 squares, a 30-ft room spans 3).
              </div>
            </div>
          )}
        </>
      )}

      {/* On-Screen Canvas Navigation & Tool Controls */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-4 left-4 flex flex-col gap-2 z-10"
      >
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
            onClick={onToggleApexGrid}
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
            className={`p-1.5 rounded transition cursor-pointer relative ${
              isCropMode
                ? 'bg-amber-600 text-white'
                : hasCropApplied
                ? 'text-amber-400 hover:text-amber-300 hover:bg-slate-800'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title={
              hasCropApplied
                ? 'Crop tool (Currently cropped - click to crop further)'
                : 'Crop blueprint to isolate floor plan area'
            }
          >
            <CropIcon className="w-4 h-4" />
            {hasCropApplied && !isCropMode && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-900" />
            )}
          </button>

          {/* Reset Crop to full original blueprint */}
          {hasCropApplied && onResetCrop && (
            <button
              type="button"
              onClick={onResetCrop}
              className="p-1.5 rounded transition cursor-pointer text-slate-400 hover:text-rose-400 hover:bg-slate-800"
              title="Reset to original uncropped blueprint"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
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

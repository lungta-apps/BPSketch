import React from 'react';
import { BlueprintAdjustments, PdfPageInfo } from '../types';
import {
  RotateCw,
  RotateCcw,
  Sliders,
  SunMedium,
  Layers,
  FileText,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface AdjustmentsPanelProps {
  adjustments: BlueprintAdjustments;
  onAdjustmentsChange: (adj: BlueprintAdjustments) => void;
  pdfInfo: PdfPageInfo | null;
  onPageChange: (page: number) => void;
  onRenderScaleChange: (scale: number) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const AdjustmentsPanel: React.FC<AdjustmentsPanelProps> = ({
  adjustments,
  onAdjustmentsChange,
  pdfInfo,
  onPageChange,
  onRenderScaleChange,
  isOpen,
  onToggle,
}) => {
  const rotateCw = () => {
    onAdjustmentsChange({
      ...adjustments,
      rotation: (adjustments.rotation + 90) % 360,
    });
  };

  const rotateCcw = () => {
    onAdjustmentsChange({
      ...adjustments,
      rotation: (adjustments.rotation + 270) % 360,
    });
  };

  const resetAdjustments = () => {
    onAdjustmentsChange({
      contrast: 100,
      brightness: 100,
      invert: false,
      grayscale: false,
      rotation: 0,
    });
  };

  return (
    <div className="bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 text-slate-200 w-full md:w-72 shrink-0 flex flex-col z-10 select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
          <Sliders className="w-4 h-4 text-blue-400" />
          <span>Blueprint Controls</span>
        </div>
        <button
          type="button"
          onClick={resetAdjustments}
          className="text-[11px] text-slate-400 hover:text-white transition cursor-pointer"
        >
          Reset All
        </button>
      </div>

      <div className="p-4 flex flex-col gap-5 overflow-y-auto max-h-[calc(100vh-140px)]">
        {/* PDF Multi-page selector if a PDF is loaded */}
        {pdfInfo && pdfInfo.numPages > 1 && (
          <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/60 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>Blueprint Page</span>
              </span>
              <span className="font-mono text-blue-300">
                {pdfInfo.pageNumber} / {pdfInfo.numPages}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 mt-1">
              <button
                type="button"
                disabled={pdfInfo.pageNumber <= 1}
                onClick={() => onPageChange(pdfInfo.pageNumber - 1)}
                className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={pdfInfo.pageNumber}
                onChange={(e) => onPageChange(Number(e.target.value))}
                className="flex-1 text-xs bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none"
              >
                {Array.from({ length: pdfInfo.numPages }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>
                    Page {p}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={pdfInfo.pageNumber >= pdfInfo.numPages}
                onClick={() => onPageChange(pdfInfo.pageNumber + 1)}
                className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quality Render Scale */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 pt-2 border-t border-slate-700/50">
              <span>Sharpness / Scale:</span>
              <div className="flex gap-1">
                {[1.5, 2.0, 3.0].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onRenderScaleChange(s)}
                    className={`px-1.5 py-0.5 rounded font-mono transition cursor-pointer ${
                      pdfInfo.renderScale === s
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Orientation & Rotation */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Orientation</span>
            <span className="font-mono text-[11px] text-slate-400">{adjustments.rotation}°</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={rotateCcw}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rotate 90° L</span>
            </button>
            <button
              type="button"
              onClick={rotateCw}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Rotate 90° R</span>
            </button>
          </div>
        </div>

        {/* Filter Sliders */}
        <div className="flex flex-col gap-4">
          {/* Contrast */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Contrast Boost</span>
              <span className="font-mono text-blue-400 text-[11px]">{adjustments.contrast}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="250"
              step="5"
              value={adjustments.contrast}
              onChange={(e) =>
                onAdjustmentsChange({ ...adjustments, contrast: Number(e.target.value) })
              }
              className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-slate-500">
              Increases dimension tick & wall line darkness for faded blueprints.
            </span>
          </div>

          {/* Brightness */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Brightness</span>
              <span className="font-mono text-blue-400 text-[11px]">{adjustments.brightness}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="180"
              step="5"
              value={adjustments.brightness}
              onChange={(e) =>
                onAdjustmentsChange({ ...adjustments, brightness: Number(e.target.value) })
              }
              className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer p-1.5 rounded hover:bg-slate-800/50">
              <span>Invert Colors (Dark / Light)</span>
              <input
                type="checkbox"
                checked={adjustments.invert}
                onChange={(e) =>
                  onAdjustmentsChange({ ...adjustments, invert: e.target.checked })
                }
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer p-1.5 rounded hover:bg-slate-800/50">
              <span>Grayscale (Clean Scans)</span>
              <input
                type="checkbox"
                checked={adjustments.grayscale}
                onChange={(e) =>
                  onAdjustmentsChange({ ...adjustments, grayscale: e.target.checked })
                }
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Apex Sketch Quick Note Box */}
        <div className="bg-blue-950/40 border border-blue-900/60 rounded-lg p-3 text-[11px] text-slate-300 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-blue-300 font-bold text-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Apex v7 Tracing Rule</span>
          </div>
          <p className="leading-relaxed text-slate-400">
            Apex imports background images at fixed <strong className="text-slate-200">96 DPI</strong> with a 1&quot; = 10&apos; ratio (<strong className="text-slate-200">9.6 px/ft</strong>). Pre-scaling to this exact metric guarantees your blueprint walls land right on the Apex grid.
          </p>
        </div>
      </div>
    </div>
  );
};

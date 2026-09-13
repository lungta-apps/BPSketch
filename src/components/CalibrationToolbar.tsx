import React from 'react';
import { Point2D, CalibrationCalculation } from '../types';
import { CheckCircle2, AlertCircle, ArrowRight, Download, RotateCcw, Crosshair } from 'lucide-react';
import { parseDimension } from '../utils/dimensionParser';

interface CalibrationToolbarProps {
  points: Point2D[];
  knownFeetInput: string;
  onKnownFeetChange: (value: string) => void;
  onClearPoints: () => void;
  onTriggerCalibration: () => void;
  calculation: CalibrationCalculation | null;
  hasImage: boolean;
}

const PRESET_FEET = ['10', '18', '20', '22', '24', '36', '48'];

export const CalibrationToolbar: React.FC<CalibrationToolbarProps> = ({
  points,
  knownFeetInput,
  onKnownFeetChange,
  onClearPoints,
  onTriggerCalibration,
  calculation,
  hasImage,
}) => {
  const parsed = parseDimension(knownFeetInput);
  const isReady = points.length === 2 && parsed.isValid && parsed.feet > 0 && hasImage;

  return (
    <div className="bg-slate-900/95 border-b border-slate-800 text-slate-200 px-4 py-2.5 backdrop-blur-md z-10 select-none">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Step Indicators & Dimension Input */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Step 1: Click 2 Points */}
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60">
            <Crosshair className="w-4 h-4 text-blue-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                Step 1: Wall Endpoints
              </span>
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    points.length >= 1 ? 'bg-emerald-400 ring-2 ring-emerald-400/20' : 'bg-slate-600'
                  }`}
                />
                <span className={points.length >= 1 ? 'text-emerald-300' : 'text-slate-400'}>
                  Pt 1 {points.length >= 1 ? '✓' : ''}
                </span>
                <span className="text-slate-600">•</span>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    points.length === 2 ? 'bg-emerald-400 ring-2 ring-emerald-400/20' : 'bg-slate-600'
                  }`}
                />
                <span className={points.length === 2 ? 'text-emerald-300' : 'text-slate-400'}>
                  Pt 2 {points.length === 2 ? '✓' : ''}
                </span>
              </div>
            </div>

            {points.length > 0 && (
              <button
                type="button"
                onClick={onClearPoints}
                className="ml-1 text-slate-400 hover:text-rose-400 p-1 rounded transition"
                title="Clear points"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Step 2: Known Wall Dimension Input */}
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60">
            <div className="flex flex-col">
              <label htmlFor="known-feet-input" className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                Step 2: Known Wall Length
              </label>
              <div className="flex items-center gap-2 mt-0.5">
                <input
                  id="known-feet-input"
                  type="text"
                  value={knownFeetInput}
                  onChange={(e) => onKnownFeetChange(e.target.value)}
                  placeholder="e.g. 48 or 48'-0&quot;"
                  className="w-32 px-2.5 py-1 text-xs font-mono font-semibold bg-slate-950 border border-slate-700 rounded text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-400 font-medium">ft</span>
              </div>
            </div>

            {/* Quick preset chips */}
            <div className="hidden xl:flex items-center gap-1 pl-2 border-l border-slate-700/60">
              <span className="text-[10px] text-slate-500">Presets:</span>
              {PRESET_FEET.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onKnownFeetChange(f)}
                  className={`text-[11px] px-1.5 py-0.5 rounded font-mono transition cursor-pointer ${
                    knownFeetInput === f
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {f}&apos;
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Realtime Math Telemetry & Primary Calibration Button */}
        <div className="flex items-center gap-3">
          {calculation && (
            <div className="hidden lg:flex items-center gap-3 bg-slate-950/70 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300">
              <div>
                <span className="text-[10px] text-slate-500 block">MEASURED</span>
                <span className="font-semibold text-sky-400">{calculation.measuredPixels.toFixed(0)} px</span>
              </div>
              <ArrowRight className="w-3 h-3 text-slate-600" />
              <div>
                <span className="text-[10px] text-slate-500 block">RATIO</span>
                <span className="font-semibold text-emerald-400">
                  {calculation.currentPixelsPerFoot.toFixed(1)} → 9.6 px/ft
                </span>
              </div>
              <ArrowRight className="w-3 h-3 text-slate-600" />
              <div>
                <span className="text-[10px] text-slate-500 block">SCALE</span>
                <span className="font-semibold text-amber-400">
                  {(calculation.scaleRatio * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          <button
            id="btn-calibrate-export"
            type="button"
            disabled={!isReady}
            onClick={onTriggerCalibration}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold shadow transition cursor-pointer ${
              isReady
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-700/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Calibrate & Export for Apex</span>
          </button>
        </div>
      </div>
    </div>
  );
};

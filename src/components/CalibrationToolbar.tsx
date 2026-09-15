import React from 'react';
import { Point2D, CalibrationCalculation } from '../types';
import {
  CheckCircle2,
  ArrowRight,
  Download,
  RotateCcw,
  Crosshair,
  Grid,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { parseDimension } from '../utils/dimensionParser';

interface CalibrationToolbarProps {
  points: Point2D[];
  knownFeetInput: string;
  onKnownFeetChange: (value: string) => void;
  onClearPoints: () => void;
  onTriggerCalibration: () => void;
  calculation: CalibrationCalculation | null;
  hasImage: boolean;
  showApexGrid: boolean;
  onToggleApexGrid: () => void;
  onOpenGuide: () => void;
}

const PRESET_FEET = ['12', '20', '24', '30', '36', '40', '48'];

export const CalibrationToolbar: React.FC<CalibrationToolbarProps> = ({
  points,
  knownFeetInput,
  onKnownFeetChange,
  onClearPoints,
  onTriggerCalibration,
  calculation,
  hasImage,
  showApexGrid,
  onToggleApexGrid,
  onOpenGuide,
}) => {
  const parsed = parseDimension(knownFeetInput);
  const isPointsComplete = points.length === 2;
  const isFeetValid = parsed.isValid && parsed.feet > 0;
  const isCalibrated = isPointsComplete && isFeetValid && hasImage && calculation !== null;

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-slate-200 px-3 md:px-5 py-2.5 backdrop-blur-md z-20 select-none shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        {/* Left: 2-Step Guided Calibration Controls */}
        <div className="flex flex-wrap items-stretch sm:items-center gap-2.5">
          {/* STEP 1: Click 2 Wall Endpoints */}
          <div
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${
              isPointsComplete
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : points.length === 1
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                : 'bg-slate-800/90 border-slate-700 text-slate-300'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                isPointsComplete
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-blue-600 text-white'
              }`}
            >
              1
            </div>

            <div className="flex flex-col min-w-[190px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Step 1: Click Wall on Plan
                </span>
                {points.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearPoints}
                    className="text-[10px] text-slate-400 hover:text-rose-400 transition flex items-center gap-1 cursor-pointer ml-2"
                    title="Clear points to re-measure a different wall"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Re-measure</span>
                  </button>
                )}
              </div>

              <div className="text-xs font-semibold flex items-center gap-1.5 mt-0.5">
                {points.length === 0 && (
                  <span className="text-blue-300 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    Click start corner of wall
                  </span>
                )}
                {points.length === 1 && (
                  <span className="text-amber-300 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Click end corner of wall
                  </span>
                )}
                {isPointsComplete && calculation && (
                  <span className="text-emerald-300 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Measured: {calculation.measuredPixels.toFixed(0)} px
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Arrow Divider */}
          <div className="hidden sm:flex items-center text-slate-600">
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* STEP 2: Enter Wall Dimension from Blueprint */}
          <div
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${
              isFeetValid
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : isPointsComplete
                ? 'bg-blue-950/50 border-blue-500/70 text-blue-200 ring-2 ring-blue-500/30'
                : 'bg-slate-800/90 border-slate-700 text-slate-300 opacity-70'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                isFeetValid
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-indigo-600 text-white'
              }`}
            >
              2
            </div>

            <div className="flex flex-col">
              <label
                htmlFor="known-feet-input"
                className="text-[10px] uppercase font-bold tracking-wider text-slate-400"
              >
                Step 2: Enter Blueprint Dimension
              </label>

              <div className="flex items-center gap-1.5 mt-0.5">
                <input
                  id="known-feet-input"
                  type="text"
                  value={knownFeetInput}
                  onChange={(e) => onKnownFeetChange(e.target.value)}
                  placeholder="e.g. 24 or 24' 6&quot;"
                  className={`w-28 sm:w-32 px-2.5 py-1 text-xs font-mono font-bold rounded border text-slate-100 placeholder:text-slate-500 focus:outline-none transition ${
                    isPointsComplete && !isFeetValid
                      ? 'bg-blue-950/80 border-blue-400 ring-2 ring-blue-400/40 text-white animate-pulse'
                      : 'bg-slate-950 border-slate-700 focus:border-blue-500'
                  }`}
                />
                <span className="text-xs font-bold text-slate-400">ft</span>

                {/* Presets */}
                <div className="hidden lg:flex items-center gap-1 ml-1 border-l border-slate-700/60 pl-2">
                  <span className="text-[10px] text-slate-500">Presets:</span>
                  {PRESET_FEET.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => onKnownFeetChange(f)}
                      className={`text-[11px] px-1.5 py-0.5 rounded font-mono font-semibold transition cursor-pointer ${
                        knownFeetInput === f
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {f}&apos;
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Verification Tools & Primary Export Button */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-800">
          {/* Visual Verification: Apex 10' Grid Toggle */}
          <button
            type="button"
            onClick={onToggleApexGrid}
            disabled={!hasImage}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              showApexGrid
                ? 'bg-cyan-950 text-cyan-200 border-cyan-500/60 shadow-sm shadow-cyan-500/20'
                : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title="Overlay simulated 10-ft Apex Sketch grid lines on blueprint to verify wall scale visually"
          >
            <Grid className={`w-4 h-4 ${showApexGrid ? 'text-cyan-400' : 'text-slate-400'}`} />
            <span>{showApexGrid ? 'Apex 10&apos; Grid: ON' : 'Show Apex 10&apos; Grid'}</span>
          </button>

          {/* Calibration Telemetry Pill (when ready) */}
          {isCalibrated && calculation && (
            <div className="hidden md:flex flex-col text-right px-2 font-mono text-[11px] text-slate-400">
              <span className="text-emerald-400 font-bold flex items-center gap-1 justify-end">
                <Sparkles className="w-3 h-3" />
                1 ft = 9.6 px (Apex v7)
              </span>
              <span className="text-slate-400 text-[10px]">
                {calculation.actualFeet.toFixed(1)}&apos; wall = {(calculation.actualFeet * 9.6).toFixed(1)} px
              </span>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            id="btn-calibrate-export"
            type="button"
            disabled={!isCalibrated}
            onClick={onTriggerCalibration}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition cursor-pointer ${
              isCalibrated
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-700/25 ring-2 ring-emerald-400/40 animate-pulse'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
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


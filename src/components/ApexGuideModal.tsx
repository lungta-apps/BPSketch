import React from 'react';
import { X, BookOpen, Lightbulb, CheckCircle, ArrowRight, ShieldCheck, Ruler } from 'lucide-react';

interface ApexGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApexGuideModal: React.FC<ApexGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                Apex Sketch v7 Tracing &amp; Calibration Guide
              </h3>
              <p className="text-xs text-slate-400">
                How to trace blueprints when advanced photometrics are disabled
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

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6 text-slate-300 text-xs leading-relaxed">
          {/* Section 1: The Problem & The Solution */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <span>The Problem &amp; Discovery</span>
            </h4>
            <p className="text-slate-400">
              When photometrics is turned off in Apex Sketch v7, blueprints imported as a background cannot be resized or shifted inside Apex. A 20-foot wall on the blueprint will often measure 38 or 52 feet on the Apex grid, making direct tracing impossible.
            </p>
            <p className="text-slate-400">
              However, our mathematical analysis of Apex Sketch&apos;s rendering engine revealed:
            </p>
            <div className="bg-blue-950/60 border border-blue-800/80 p-3 rounded-lg font-mono text-xs text-blue-200 mt-1">
              <span className="text-white font-bold block mb-1">Apex Sketch Golden Ratio:</span>
              • Standard Windows Screen DPI = 96 DPI (96 pixels/inch)<br />
              • Apex Internal Scale = 1 inch : 10 feet<br />
              • Ratio: 96 pixels ÷ 10 feet = <strong className="text-emerald-400">9.60 Pixels per Foot</strong>
            </div>
          </div>

          {/* Section 2: 4-Step Workflow */}
          <div className="flex flex-col gap-3">
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Ruler className="w-4 h-4 text-blue-400" />
              <span>Step-by-Step Appraiser Workflow</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-slate-800/50 border border-slate-700/60 p-3.5 rounded-xl flex flex-col gap-1.5">
                <span className="text-blue-400 font-bold text-xs uppercase tracking-wider">
                  Step 1 • Upload Plan
                </span>
                <p className="text-slate-400 text-[11px]">
                  Drop in your city blueprint PDF or screenshot image. If multi-page, select the floor plan sheet.
                </p>
              </div>

              <div className="bg-slate-800/50 border border-slate-700/60 p-3.5 rounded-xl flex flex-col gap-1.5">
                <span className="text-blue-400 font-bold text-xs uppercase tracking-wider">
                  Step 2 • Click Wall Ends
                </span>
                <p className="text-slate-400 text-[11px]">
                  Zoom in on any wall with a labeled dimension (e.g. 24&apos;-0&quot;). Click the start and end tick marks. Use the 5X loupe for exact precision.
                </p>
              </div>

              <div className="bg-slate-800/50 border border-slate-700/60 p-3.5 rounded-xl flex flex-col gap-1.5">
                <span className="text-blue-400 font-bold text-xs uppercase tracking-wider">
                  Step 3 • Calibrate &amp; Export
                </span>
                <p className="text-slate-400 text-[11px]">
                  Type the dimension (e.g. &quot;24&quot; or &quot;24&apos; 6&quot;&quot;). The scaler recalculates the image to 9.6 px/ft and embeds the 96 DPI metadata.
                </p>
              </div>

              <div className="bg-slate-800/50 border border-slate-700/60 p-3.5 rounded-xl flex flex-col gap-1.5">
                <span className="text-blue-400 font-bold text-xs uppercase tracking-wider">
                  Step 4 • Trace in Apex v7
                </span>
                <p className="text-slate-400 text-[11px]">
                  Open Apex Sketch → import background image. Every wall will fall squarely on the 10-foot grid lines for rapid, effortless tracing!
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Pro Tips */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Appraiser Tips</span>
            </h4>
            <ul className="list-disc list-inside space-y-1.5 text-slate-400 text-[11px]">
              <li>
                <strong className="text-slate-200">Longest wall yields highest accuracy:</strong> Calibrating on a 48&apos; wall provides tighter sub-inch precision than calibrating on a 6&apos; closet wall.
              </li>
              <li>
                <strong className="text-slate-200">Hold Shift for pure straight lines:</strong> Holding Shift snaps Point 2 to perfectly horizontal or vertical orientation.
              </li>
              <li>
                <strong className="text-slate-200">Crop Tool:</strong> Blueprints often have large empty margins and title blocks. Use the crop tool to isolate just the house footprint before exporting.
              </li>
              <li>
                <strong className="text-slate-200">Contrast Boost:</strong> If a scanned blueprint has faint or gray lines, bump Contrast to 150-180% in Blueprint Controls.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition cursor-pointer"
          >
            Got it, Let&apos;s Calibrate!
          </button>
        </div>
      </div>
    </div>
  );
};

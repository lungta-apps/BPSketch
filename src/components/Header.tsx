import React from 'react';
import { Ruler, FileUp, HelpCircle, RefreshCw } from 'lucide-react';

interface HeaderProps {
  onOpenGuide: () => void;
  onFileSelect: (file: File) => void;
  hasImageLoaded: boolean;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenGuide,
  onFileSelect,
  hasImageLoaded,
  onReset,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      e.target.value = ''; // reset so same file can be reloaded
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white px-4 py-3 shrink-0 select-none shadow-md z-20">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Ruler className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-slate-100 tracking-tight">
                Apex Blueprint Scaler
              </h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                1:1 Scale @ 96 DPI
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Calibrate PDF blueprints & images for direct tracing in Apex Sketch v7
            </p>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="application/pdf,image/png,image/jpeg,image/webp,image/tiff"
            className="hidden"
          />

          <button
            id="btn-upload-blueprint"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm cursor-pointer"
          >
            <FileUp className="w-4 h-4" />
            <span>Upload Blueprint (PDF/IMG)</span>
          </button>

          {hasImageLoaded && (
            <button
              id="btn-reset-all"
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
              title="Reset current blueprint and points"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          <button
            id="btn-open-guide"
            type="button"
            onClick={onOpenGuide}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Apex Guide</span>
          </button>
        </div>
      </div>
    </header>
  );
};

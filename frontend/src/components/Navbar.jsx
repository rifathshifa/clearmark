import React from 'react';
import { Sparkles, Image as ImageIcon, Video, ShieldCheck, Cpu, History } from 'lucide-react';

export default function Navbar({ activeMode, setActiveMode, backendStatus, onOpenLegal, onOpenHistory }) {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-mint-200/70 shadow-mint-sm backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-mint-600 via-mint-500 to-limeAccent-400 flex items-center justify-center shadow-mint-md text-white">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse-subtle" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-forest-900">
                  Clear<span className="text-gradient">Mark</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-mint-100 text-mint-800 border border-mint-200 shadow-xs">
                  AI v2.0
                </span>
              </div>
              <p className="text-[11px] text-sage-600 font-medium hidden sm:block">
                Remove marks. Keep memories.
              </p>
            </div>
          </div>

          {/* Mode Switcher Pills */}
          <div className="flex items-center p-1 bg-mint-100/70 rounded-2xl border border-mint-200/80 shadow-inner">
            <button
              onClick={() => setActiveMode('photo')}
              className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                activeMode === 'photo'
                  ? 'bg-white text-mint-800 shadow-mint-sm scale-[1.02]'
                  : 'text-sage-600 hover:text-forest-900 hover:bg-white/50'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-mint-600" />
              <span>Photo Remover</span>
            </button>
            <button
              onClick={() => setActiveMode('video')}
              className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                activeMode === 'video'
                  ? 'bg-white text-mint-800 shadow-mint-sm scale-[1.02]'
                  : 'text-sage-600 hover:text-forest-900 hover:bg-white/50'
              }`}
            >
              <Video className="w-4 h-4 text-mint-600" />
              <span>Video Remover</span>
            </button>
          </div>

          {/* Right Status, History & Legal Policy */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Backend AI Model Badge */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-mint-50/80 border border-mint-200/80 text-xs">
              <span className={`w-2 h-2 rounded-full ${backendStatus?.ai_available ? 'bg-mint-500 animate-ping' : 'bg-amber-400'}`} />
              <Cpu className="w-3.5 h-3.5 text-mint-600" />
              <span className="font-semibold text-forest-800">
                {backendStatus?.ai_available ? 'LaMa Neural Engine Active' : 'Optical Engine'}
              </span>
            </div>

            {/* History Button */}
            <button
              onClick={onOpenHistory}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl text-forest-800 bg-white/70 hover:bg-mint-100/80 border border-mint-200 transition-all shadow-xs"
              title="View processed file history"
            >
              <History className="w-4 h-4 text-mint-600" />
              <span className="hidden md:inline">History</span>
            </button>

            {/* Ethics / Legal Policy Button */}
            <button
              onClick={onOpenLegal}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-xl text-sage-700 hover:text-mint-700 hover:bg-mint-100/60 transition-colors"
              title="Authorized Use & Watermark Removal Ethics"
            >
              <ShieldCheck className="w-4 h-4 text-mint-600" />
              <span className="hidden sm:inline">Authorized Use</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}

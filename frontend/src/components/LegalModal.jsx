import React from 'react';
import { X, ShieldAlert, CheckCircle, AlertTriangle, Cpu, Scale } from 'lucide-react';

export default function LegalModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl glass-panel-elevated rounded-3xl p-6 sm:p-8 border border-mint-200/90 shadow-mint-lg flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-sage-400 hover:text-forest-900 hover:bg-mint-100/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-mint-100 border border-mint-200 flex items-center justify-center text-mint-700 shadow-xs">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-forest-950">
              Authorized Use & Ethical Guidelines
            </h2>
            <p className="text-xs text-sage-600 font-medium">
              ClearMark Watermark Removal Policy
            </p>
          </div>
        </div>

        {/* Policy Points */}
        <div className="flex flex-col gap-4 text-xs sm:text-sm text-forest-900 leading-relaxed">
          
          <div className="p-4 rounded-2xl bg-mint-50/80 border border-mint-200 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-mint-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-forest-950">Authorized Modification Only:</span>
              <p className="text-sage-700 mt-0.5">
                This tool is strictly intended for photos and videos that you personally own, created, or possess explicit license or written authorization from the copyright holder to edit.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-950">Provenance & Authenticity Marks:</span>
              <p className="text-amber-800 mt-0.5">
                Do not use ClearMark to strip cryptographic authenticity metadata (such as C2PA tags), provenance badges, or copyright management information from third-party media without legal authority.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-sage-50/80 border border-sage-200 flex items-start gap-3">
            <Cpu className="w-5 h-5 text-mint-700 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-forest-950">Neural Inpainting Realism & Limitations:</span>
              <p className="text-sage-700 mt-0.5">
                ClearMark uses the Big-LaMa deep convolutional inpainting network to reconstruct background pixels based on surrounding patterns. While it excels on textures (sky, water, fabric, foliage, architecture), clean reconstruction is mathematically impossible when the watermark obscures complex, non-repetitive subject matter (such as unique human facial features or intricate text). Results are never faked.
              </p>
            </div>
          </div>

        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-mint-600 to-mint-700 hover:from-mint-500 hover:to-mint-600 text-white shadow-mint-sm transition-all"
          >
            I Understand & Agree
          </button>
        </div>

      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Download,
  RotateCcw,
  Eye,
  Columns,
  SplitSquareVertical,
  CheckCircle2,
  Clock,
  Sparkles,
  Share2
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ComparisonViewer({
  originalSrc,
  inpaintedSrc,
  meta,
  onReset,
  onDownload,
  mode = 'photo'
}) {
  const [sliderPos, setSliderPos] = useState(50); // percentage 0-100
  const [viewMode, setViewMode] = useState('slider'); // 'slider' | 'side-by-side'
  const [isHoldingOriginal, setIsHoldingOriginal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  // Trigger celebratory confetti in Mint & Lime palette
  useEffect(() => {
    try {
      confetti({
        particleCount: 55,
        spread: 65,
        origin: { y: 0.8 },
        colors: ['#10B981', '#34D399', '#6EE7B7', '#A3E635', '#2DD4BF']
      });
    } catch (e) {
      // ignore
    }
  }, []);

  const handleDrag = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const onMouseMove = useCallback((e) => {
    if (isDragging) handleDrag(e.clientX);
  }, [isDragging, handleDrag]);

  const onTouchMove = useCallback((e) => {
    if (isDragging && e.touches[0]) handleDrag(e.touches[0].clientX);
  }, [isDragging, handleDrag]);

  const stopDragging = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', stopDragging);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', stopDragging);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', stopDragging);
    };
  }, [isDragging, onMouseMove, onTouchMove, stopDragging]);

  return (
    <div className="w-full flex flex-col gap-5 animate-fade-in">
      {/* Top Header & Actions Bar */}
      <div className="glass-panel-elevated rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 border border-mint-200 shadow-mint-sm">
        
        {/* Left Status & Stats */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-mint-100 border border-mint-200 flex items-center justify-center text-mint-700 shadow-xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-forest-900 text-sm sm:text-base flex items-center gap-2">
              <span>Watermark Removed Successfully</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-mint-100 text-mint-800 border border-mint-200">
                100% Quality Preserved
              </span>
            </h3>
            <div className="flex items-center gap-3 text-xs text-sage-600 font-medium mt-0.5">
              {meta?.width && meta?.height && (
                <span>{meta.width} × {meta.height} px</span>
              )}
              {meta?.processing_time_sec && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-sage-400" />
                  {meta.processing_time_sec}s
                </span>
              )}
              {meta?.model_used && (
                <span className="text-mint-700 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-mint-600" />
                  {meta.model_used}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* View Mode & Hold Button */}
        <div className="flex items-center gap-2">
          {/* Hold to Compare Button */}
          <button
            onMouseDown={() => setIsHoldingOriginal(true)}
            onMouseUp={() => setIsHoldingOriginal(false)}
            onMouseLeave={() => setIsHoldingOriginal(false)}
            onTouchStart={() => setIsHoldingOriginal(true)}
            onTouchEnd={() => setIsHoldingOriginal(false)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-mint-100 hover:bg-mint-200 text-forest-900 border border-mint-200 transition-all select-none active:scale-95 shadow-xs"
            title="Press and hold to view the original with watermark"
          >
            <Eye className="w-4 h-4 text-mint-700" />
            <span className="hidden sm:inline">Hold for Original</span>
          </button>

          {/* View Toggle */}
          <div className="flex items-center p-1 bg-mint-100/70 rounded-xl border border-mint-200 shadow-inner">
            <button
              onClick={() => setViewMode('slider')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'slider' ? 'bg-white text-mint-800 shadow-mint-sm' : 'text-sage-600 hover:text-forest-900'
              }`}
              title="Split Comparison Slider"
            >
              <SplitSquareVertical className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'side-by-side' ? 'bg-white text-mint-800 shadow-mint-sm' : 'text-sage-600 hover:text-forest-900'
              }`}
              title="Side-by-side View"
            >
              <Columns className="w-4 h-4" />
            </button>
          </div>

          {/* Reset / Process Another */}
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-forest-800 hover:bg-mint-100 hover:text-forest-950 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">New Edit</span>
          </button>

          {/* Download Button */}
          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-mint-600 via-mint-500 to-mint-700 hover:from-mint-500 hover:to-mint-600 text-white shadow-mint-md transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>
        </div>

      </div>

      {/* Quality Warning if watermark was very large or complex */}
      {meta?.quality_assessment?.warning && (
        <div className="glass-panel p-3.5 rounded-2xl border border-amber-300 bg-amber-50/90 text-amber-800 text-xs flex items-center gap-2.5 animate-fade-in shadow-sm">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
          <span>{meta.quality_assessment.message}</span>
        </div>
      )}

      {/* Main Comparison Area */}
      {viewMode === 'slider' ? (
        <div
          ref={containerRef}
          onMouseDown={() => setIsDragging(true)}
          onTouchStart={() => setIsDragging(true)}
          className="relative w-full rounded-2xl overflow-hidden glass-panel border border-mint-200 checkerboard-bg flex items-center justify-center min-h-[440px] max-h-[640px] select-none cursor-ew-resize shadow-inner group"
        >
          {/* Base Inpainted Result (Clean) */}
          <img
            src={isHoldingOriginal ? originalSrc : inpaintedSrc}
            alt="AI Inpainted Result"
            className="max-h-[600px] max-w-full object-contain pointer-events-none"
          />

          {/* Top Layer: Original (Clipped according to slider position) */}
          {!isHoldingOriginal && (
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center"
              style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
            >
              <img
                src={originalSrc}
                alt="Original with Watermark"
                className="max-h-[600px] max-w-full object-contain pointer-events-none"
              />
              <span className="absolute top-4 left-4 bg-forest-950/80 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                Original (With Watermark)
              </span>
            </div>
          )}

          {/* Inpainted Label */}
          {!isHoldingOriginal && (
            <span className="absolute top-4 right-4 bg-mint-700/90 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
              AI Cleaned (Inpainted)
            </span>
          )}

          {/* Draggable Divider Line & Pill Handle */}
          {!isHoldingOriginal && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_12px_rgba(16,185,129,0.8)] pointer-events-none"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-mint-lg border-2 border-mint-500 flex items-center justify-center text-mint-700 cursor-ew-resize">
                <SplitSquareVertical className="w-4 h-4" />
              </div>
            </div>
          )}

          {/* Helper tip */}
          <div className="absolute bottom-3 bg-forest-950/75 backdrop-blur-md text-white text-[11px] px-3.5 py-1.5 rounded-full pointer-events-none shadow-md">
            Drag the slider to inspect the background reconstruction
          </div>
        </div>
      ) : (
        /* Side-by-side mode */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-panel rounded-2xl p-3 border border-mint-200 flex flex-col gap-2">
            <span className="text-xs font-bold text-sage-700 px-2">Original (Watermarked)</span>
            <div className="rounded-xl overflow-hidden checkerboard-bg flex items-center justify-center min-h-[340px] max-h-[480px]">
              <img src={originalSrc} alt="Original" className="max-h-[460px] object-contain" />
            </div>
          </div>
          <div className="glass-panel-elevated rounded-2xl p-3 border border-mint-300 flex flex-col gap-2 shadow-mint-sm">
            <span className="text-xs font-extrabold text-mint-700 px-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-mint-600" /> AI Cleaned
            </span>
            <div className="rounded-xl overflow-hidden checkerboard-bg flex items-center justify-center min-h-[340px] max-h-[480px]">
              <img src={inpaintedSrc} alt="Inpainted" className="max-h-[460px] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

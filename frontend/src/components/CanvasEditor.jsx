import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Paintbrush,
  Square,
  Eraser,
  RotateCcw,
  RotateCw,
  Trash2,
  Sparkles,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

export default function CanvasEditor({
  imageSrc,
  onMaskChange,
  isProcessing = false,
  feather = 4,
  setFeather,
  selectedEngine = 'auto',
  setSelectedEngine,
  hasAiModel = true
}) {
  const containerRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const cursorCanvasRef = useRef(null);

  const [tool, setTool] = useState('brush'); // 'brush' | 'rect' | 'eraser'
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [maskColor, setMaskColor] = useState('rgba(16, 185, 129, 0.70)'); // vibrant mint green
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [canvasScale, setCanvasScale] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hasDrawnMask, setHasDrawnMask] = useState(false);

  // Pre-load image natural dimensions
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      setHistory([]);
      setRedoStack([]);
      setHasDrawnMask(false);
      if (onMaskChange) onMaskChange(null);
    };
  }, [imageSrc]);

  // Adjust display scale to fit container dynamically
  const updateScale = useCallback(() => {
    if (!containerRef.current || !imageSize.width) return;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = 560; // Max viewport height in px
    const scaleX = (containerWidth - 32) / imageSize.width;
    const scaleY = containerHeight / imageSize.height;
    const fitScale = Math.min(scaleX, scaleY, 1);
    setCanvasScale(fitScale);
  }, [imageSize]);

  useEffect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [updateScale]);

  // Push state to undo history
  const saveState = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    setHistory((prev) => [...prev.slice(-15), imageData]);
    setRedoStack([]);
    exportMask();
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const maskCanvas = maskCanvasRef.current;
    const ctx = maskCanvas.getContext('2d');
    const current = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    setRedoStack((prev) => [...prev, current]);

    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    ctx.putImageData(previous, 0, 0);
    exportMask();
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const maskCanvas = maskCanvasRef.current;
    const ctx = maskCanvas.getContext('2d');
    const current = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    setHistory((prev) => [...prev, current]);

    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    ctx.putImageData(next, 0, 0);
    exportMask();
  };

  const handleClear = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    saveState();
    const ctx = maskCanvas.getContext('2d');
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    setHasDrawnMask(false);
    if (onMaskChange) onMaskChange(null);
  };

  // Quick Presets
  const applyPreset = (type) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas || !imageSize.width) return;
    saveState();
    const ctx = maskCanvas.getContext('2d');
    ctx.fillStyle = maskColor;

    const w = imageSize.width;
    const h = imageSize.height;

    if (type === 'bottom-right') {
      const pw = Math.round(w * 0.24);
      const ph = Math.round(h * 0.14);
      ctx.fillRect(w - pw - Math.round(w * 0.02), h - ph - Math.round(h * 0.02), pw, ph);
    } else if (type === 'bottom-left') {
      const pw = Math.round(w * 0.24);
      const ph = Math.round(h * 0.14);
      ctx.fillRect(Math.round(w * 0.02), h - ph - Math.round(h * 0.02), pw, ph);
    } else if (type === 'top-right') {
      const pw = Math.round(w * 0.24);
      const ph = Math.round(h * 0.12);
      ctx.fillRect(w - pw - Math.round(w * 0.02), Math.round(h * 0.02), pw, ph);
    } else if (type === 'center') {
      const pw = Math.round(w * 0.38);
      const ph = Math.round(h * 0.22);
      ctx.fillRect((w - pw) / 2, (h - ph) / 2, pw, ph);
    }
    exportMask();
  };

  // Convert client mouse/touch to original image pixel coordinates
  const getCanvasCoords = (e) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return { x: 0, y: 0 };
    const rect = maskCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const scaleX = maskCanvas.width / rect.width;
    const scaleY = maskCanvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  // Export clean 8-bit black/white mask matching exact image resolution
  const exportMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas || maskCanvas.width === 0) return;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = maskCanvas.width;
    exportCanvas.height = maskCanvas.height;
    const expCtx = exportCanvas.getContext('2d');

    // Fill with black
    expCtx.fillStyle = '#000000';
    expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Read maskCanvas pixels: any pixel with alpha > 15 becomes pure white
    const maskCtx = maskCanvas.getContext('2d');
    const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const expData = expCtx.getImageData(0, 0, exportCanvas.width, exportCanvas.height);

    let hasPixels = false;
    for (let i = 0; i < maskData.data.length; i += 4) {
      if (maskData.data[i + 3] > 15) {
        expData.data[i] = 255;
        expData.data[i + 1] = 255;
        expData.data[i + 2] = 255;
        expData.data[i + 3] = 255;
        hasPixels = true;
      }
    }
    expCtx.putImageData(expData, 0, 0);
    setHasDrawnMask(hasPixels);

    if (hasPixels && onMaskChange) {
      const dataUrl = exportCanvas.toDataURL('image/png');
      onMaskChange(dataUrl);
    } else if (onMaskChange) {
      onMaskChange(null);
    }
  };

  // Drawing handlers
  const handleStart = (e) => {
    if (isProcessing) return;
    const coords = getCanvasCoords(e);
    setIsDrawing(true);
    setStartPos(coords);
    saveState();

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');

    // Scale brush size relative to image resolution vs display
    const effectiveBrushSize = brushSize / (canvasScale * zoomLevel);

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, effectiveBrushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = maskColor;
      ctx.strokeStyle = maskColor;
      ctx.lineWidth = effectiveBrushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, effectiveBrushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    }
  };

  const handleMove = (e) => {
    const coords = getCanvasCoords(e);
    updateCursor(coords);

    if (!isDrawing || isProcessing) return;
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    const effectiveBrushSize = brushSize / (canvasScale * zoomLevel);

    if (tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = maskColor;
      ctx.strokeStyle = maskColor;
      ctx.lineWidth = effectiveBrushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    } else if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, effectiveBrushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const handleEnd = (e) => {
    if (!isDrawing || isProcessing) return;
    setIsDrawing(false);

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');

    if (tool === 'rect') {
      const coords = getCanvasCoords(e);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = maskColor;
      const x = Math.min(startPos.x, coords.x);
      const y = Math.min(startPos.y, coords.y);
      const width = Math.abs(coords.x - startPos.x);
      const height = Math.abs(coords.y - startPos.y);
      if (width > 2 && height > 2) {
        ctx.fillRect(x, y, width, height);
      }
    }

    exportMask();
  };

  const updateCursor = (coords) => {
    const cursorCanvas = cursorCanvasRef.current;
    if (!cursorCanvas) return;
    const ctx = cursorCanvas.getContext('2d');
    ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);

    const effectiveBrushSize = brushSize / (canvasScale * zoomLevel);

    if (tool === 'rect') {
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2 / (canvasScale * zoomLevel);
      ctx.beginPath();
      ctx.moveTo(coords.x - 15, coords.y);
      ctx.lineTo(coords.x + 15, coords.y);
      ctx.moveTo(coords.x, coords.y - 15);
      ctx.lineTo(coords.x, coords.y + 15);
      ctx.stroke();
      return;
    }

    ctx.strokeStyle = tool === 'eraser' ? '#EF4444' : '#10B981';
    ctx.lineWidth = 2.5 / (canvasScale * zoomLevel);
    ctx.beginPath();
    ctx.arc(coords.y ? coords.x : 0, coords.y || 0, effectiveBrushSize / 2, 0, Math.PI * 2);
    ctx.stroke();
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Top Interactive Toolbar */}
      <div className="glass-panel-elevated rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 border border-mint-200 shadow-mint-sm">
        
        {/* Tools: Brush, Rect, Eraser */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setTool('brush')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              tool === 'brush'
                ? 'bg-gradient-to-r from-mint-600 to-mint-700 text-white shadow-mint-sm scale-[1.02]'
                : 'text-forest-800 hover:bg-mint-100/70 hover:text-forest-900'
            }`}
            title="Brush Tool: Paint over watermark"
          >
            <Paintbrush className="w-4 h-4" />
            <span>Brush</span>
          </button>

          <button
            onClick={() => setTool('rect')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              tool === 'rect'
                ? 'bg-gradient-to-r from-mint-600 to-mint-700 text-white shadow-mint-sm scale-[1.02]'
                : 'text-forest-800 hover:bg-mint-100/70 hover:text-forest-900'
            }`}
            title="Rectangle Tool: Drag a box around watermark"
          >
            <Square className="w-4 h-4" />
            <span>Rectangle</span>
          </button>

          <button
            onClick={() => setTool('eraser')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              tool === 'eraser'
                ? 'bg-rose-500 text-white shadow-sm scale-[1.02]'
                : 'text-forest-800 hover:bg-rose-50 hover:text-rose-600'
            }`}
            title="Eraser: Remove strokes from selection"
          >
            <Eraser className="w-4 h-4" />
            <span>Eraser</span>
          </button>

          <div className="h-6 w-px bg-mint-200 mx-1 hidden sm:block" />

          {/* Undo / Redo / Clear */}
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="p-2 rounded-xl text-forest-800 hover:bg-mint-100/70 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            title="Undo"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-2 rounded-xl text-forest-800 hover:bg-mint-100/70 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            title="Redo"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleClear}
            disabled={!hasDrawnMask}
            className="p-2 rounded-xl text-forest-800 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            title="Clear Selection"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Brush Size Slider */}
        <div className="flex items-center gap-2 bg-mint-50/80 px-3 py-1.5 rounded-xl border border-mint-200">
          <span className="text-xs font-semibold text-forest-800 whitespace-nowrap">Size:</span>
          <input
            type="range"
            min="8"
            max="140"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-20 sm:w-28 accent-mint-600 cursor-pointer"
          />
          <span className="text-xs font-bold text-mint-700 w-6 text-right">{brushSize}px</span>
        </div>

        {/* Soft Edge & Engine Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-mint-50/80 px-3 py-1.5 rounded-xl border border-mint-200 text-xs">
            <span className="text-forest-800 font-medium">Soft Edge:</span>
            <input
              type="range"
              min="0"
              max="15"
              value={feather}
              onChange={(e) => setFeather(Number(e.target.value))}
              className="w-16 accent-mint-600 cursor-pointer"
              title="Softens mask border for seamless gradient blending"
            />
            <span className="font-bold text-mint-700">{feather}px</span>
          </div>

          <select
            value={selectedEngine}
            onChange={(e) => setSelectedEngine(e.target.value)}
            className="text-xs font-bold bg-white border border-mint-300 rounded-xl px-2.5 py-1.5 text-forest-900 focus:outline-none focus:ring-2 focus:ring-mint-500 shadow-xs"
          >
            <option value="auto">AI Neural (Auto)</option>
            <option value="lama" disabled={!hasAiModel}>LaMa Deep Model</option>
            <option value="fast">Fast Optical Inpainter</option>
          </select>
        </div>

      </div>

      {/* Preset Quick Badges */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-bold text-sage-600 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-mint-600" /> Quick Presets:
        </span>
        <button
          onClick={() => applyPreset('bottom-right')}
          className="px-2.5 py-1 rounded-lg bg-white/80 border border-mint-200 text-forest-800 hover:border-mint-400 hover:bg-mint-50 transition-colors font-medium shadow-xs"
        >
          Bottom-Right (Gemini / TikTok)
        </button>
        <button
          onClick={() => applyPreset('bottom-left')}
          className="px-2.5 py-1 rounded-lg bg-white/80 border border-mint-200 text-forest-800 hover:border-mint-400 hover:bg-mint-50 transition-colors font-medium shadow-xs"
        >
          Bottom-Left
        </button>
        <button
          onClick={() => applyPreset('top-right')}
          className="px-2.5 py-1 rounded-lg bg-white/80 border border-mint-200 text-forest-800 hover:border-mint-400 hover:bg-mint-50 transition-colors font-medium shadow-xs"
        >
          Top-Right
        </button>
        <button
          onClick={() => applyPreset('center')}
          className="px-2.5 py-1 rounded-lg bg-white/80 border border-mint-200 text-forest-800 hover:border-mint-400 hover:bg-mint-50 transition-colors font-medium shadow-xs"
        >
          Center Logo
        </button>
      </div>

      {/* Canvas Area Container */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden glass-panel border border-mint-200 checkerboard-bg flex items-center justify-center min-h-[420px] max-h-[640px] select-none shadow-inner"
      >
        {imageSrc && (
          <div
            className="relative cursor-crosshair"
            style={{
              width: imageSize.width > 0 ? `${imageSize.width * canvasScale * zoomLevel}px` : 'auto',
              height: imageSize.height > 0 ? `${imageSize.height * canvasScale * zoomLevel}px` : 'auto',
              maxWidth: '100%',
              maxHeight: '580px',
              transition: 'width 0.1s ease-out, height 0.1s ease-out'
            }}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={() => {
              if (isDrawing) handleEnd();
              const c = cursorCanvasRef.current;
              if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
            }}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          >
            {/* Direct Hardware-Accelerated Base Image (Always Visible!) */}
            <img
              src={imageSrc}
              alt="Source target"
              className="w-full h-full object-contain pointer-events-none select-none block"
              draggable={false}
              onLoad={(e) => {
                const w = e.target.naturalWidth;
                const h = e.target.naturalHeight;
                if (w && h) {
                  setImageSize({ width: w, height: h });
                }
              }}
            />

            {/* Overlaid Mask Canvas */}
            <canvas
              ref={maskCanvasRef}
              width={imageSize.width || 100}
              height={imageSize.height || 100}
              className="absolute inset-0 w-full h-full pointer-events-none opacity-85"
            />

            {/* Dynamic Cursor Canvas */}
            <canvas
              ref={cursorCanvasRef}
              width={imageSize.width || 100}
              height={imageSize.height || 100}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>
        )}

        {/* Tip Badge */}
        <div className="absolute bottom-3 left-4 bg-forest-950/80 backdrop-blur-md text-white text-[11px] px-3.5 py-1.5 rounded-full flex items-center gap-2 shadow-md pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-mint-400 animate-ping" />
          <span>Draw or drag a box over the watermark you want to erase</span>
        </div>

        {/* Zoom Controls */}
        <div className="absolute bottom-3 right-4 flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-mint-sm border border-mint-200">
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
            className="p-1.5 text-forest-800 hover:text-mint-700 hover:bg-mint-50 rounded-lg transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-bold text-forest-900 px-1">{Math.round(zoomLevel * 100)}%</span>
          <button
            onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
            className="p-1.5 text-forest-800 hover:text-mint-700 hover:bg-mint-50 rounded-lg transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(1)}
            className="px-2 py-1 text-[10px] font-bold text-mint-700 hover:bg-mint-100/70 rounded-lg"
            title="Reset Zoom"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

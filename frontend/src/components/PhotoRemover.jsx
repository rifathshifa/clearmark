import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Sparkles,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
  FileCheck,
  Zap,
  ArrowRight
} from 'lucide-react';
import CanvasEditor from './CanvasEditor';
import ComparisonViewer from './ComparisonViewer';

export default function PhotoRemover({ backendStatus }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [maskDataUrl, setMaskDataUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Settings
  const [feather, setFeather] = useState(4);
  const [selectedEngine, setSelectedEngine] = useState('auto');

  const fileInputRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid image (JPG, PNG, or WEBP)');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('File size exceeds 50MB limit');
      return;
    }

    setError(null);
    setResult(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setImageSrc(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleInpaint = async () => {
    if (!selectedFile && !imageSrc) {
      setError('Please select or upload an image first');
      return;
    }
    if (!maskDataUrl) {
      setError('Please mark the watermark area using the brush or rectangle tool');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append('image', selectedFile);
      } else {
        const res = await fetch(imageSrc);
        const blob = await res.blob();
        formData.append('image', blob, 'image.png');
      }

      formData.append('mask_base64', maskDataUrl);
      formData.append('mode', selectedEngine);
      formData.append('feather', feather);

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/inpaint/photo`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to process image');
      }

      setResult(data);
    } catch (err) {
      setError(err.message || 'An error occurred during inpainting');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result?.image_data) return;
    const a = document.createElement('a');
    a.href = result.image_data;
    a.download = result.filename || 'watermark_removed.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReset = () => {
    setResult(null);
    setMaskDataUrl(null);
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in">
      
      {/* If result is ready, show ComparisonViewer */}
      {result ? (
        <ComparisonViewer
          originalSrc={imageSrc}
          inpaintedSrc={result.image_data}
          meta={result}
          onReset={handleReset}
          onDownload={handleDownload}
          mode="photo"
        />
      ) : (
        /* Image Selection & Canvas Editor Area */
        <div className="flex flex-col gap-6">
          
          {/* If no image selected yet, show Hero Banner & Dropzone */}
          {!imageSrc ? (
            <div className="flex flex-col gap-8">
              {/* Hero Banner Card */}
              <div className="glass-panel-elevated rounded-3xl p-6 sm:p-12 border border-mint-200/90 shadow-mint-md relative overflow-hidden text-center">
                <div className="max-w-2xl mx-auto flex flex-col items-center gap-4 relative z-10">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-mint-100/90 border border-mint-300 text-mint-800 text-xs font-bold shadow-xs">
                    <Sparkles className="w-4 h-4 text-mint-600" />
                    <span>Deep LaMa Neural Inpainting</span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-forest-950 leading-tight">
                    Remove Watermarks with <br />
                    <span className="text-gradient">Flawless AI Reconstruction</span>
                  </h1>

                  <p className="text-base sm:text-lg font-bold text-mint-700 tracking-wide">
                    Remove marks. Keep memories.
                  </p>

                  <p className="text-xs sm:text-sm text-sage-700 font-medium max-w-xl">
                    Mark Gemini AI symbols, stock logos, or date stamps. ClearMark's neural network reconstructs natural texture, grain, and lighting with zero blur.
                  </p>
                </div>

                {/* Subtle Background Mint Glowing Orbs */}
                <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-mint-200/40 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-sage-200/35 blur-3xl pointer-events-none" />
              </div>

              {/* Upload Dropzone with Drag-and-Drop Feedback */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`glass-panel rounded-3xl p-8 sm:p-14 border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center justify-center gap-4 text-center group ${
                  dragActive
                    ? 'border-mint-600 bg-mint-100/60 scale-[1.01] shadow-mint-md'
                    : 'border-mint-300/80 hover:border-mint-500 hover:bg-white/90 shadow-mint-sm'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                  className="hidden"
                />

                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-mint-100/90 group-hover:bg-mint-200/90 border border-mint-200 flex items-center justify-center text-mint-700 shadow-mint-sm transition-all group-hover:scale-105">
                  <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10 text-mint-600" />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-base sm:text-lg font-bold text-forest-900">
                    Drag and drop your photo here, or <span className="text-mint-700 underline underline-offset-2">Browse Device</span>
                  </span>
                  <span className="text-xs text-sage-600 font-medium">
                    Supports JPG, PNG, WEBP • Up to 50MB • Lossless Resolution Preserved
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Image is loaded: Canvas Editor and Inpaint Button */
            <div className="flex flex-col gap-4">
              
              {/* File details bar */}
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-mint-600" />
                  <span className="text-xs font-bold text-forest-900 truncate max-w-xs sm:max-w-md">
                    {selectedFile?.name || 'Selected Photo'}
                  </span>
                </div>
                <button
                  onClick={() => { setImageSrc(null); setSelectedFile(null); setMaskDataUrl(null); }}
                  className="text-xs font-bold text-sage-600 hover:text-rose-600 transition-colors"
                >
                  Change Photo
                </button>
              </div>

              {/* Interactive Canvas Editor */}
              <CanvasEditor
                imageSrc={imageSrc}
                onMaskChange={setMaskDataUrl}
                isProcessing={isProcessing}
                feather={feather}
                setFeather={setFeather}
                selectedEngine={selectedEngine}
                setSelectedEngine={setSelectedEngine}
                hasAiModel={backendStatus?.ai_available}
              />

              {/* Action Bar */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={handleInpaint}
                  disabled={!maskDataUrl || isProcessing}
                  className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-sm font-bold bg-gradient-to-r from-mint-600 via-mint-500 to-mint-700 hover:from-mint-500 hover:to-mint-600 text-white shadow-mint-md transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Reconstructing Background...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Erase Marked Watermark</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

          {/* Error Message Alert */}
          {error && (
            <div className="glass-panel p-4 rounded-2xl border border-rose-200 bg-rose-50/90 text-rose-700 flex items-center gap-3 text-xs sm:text-sm font-medium animate-shake">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

        </div>
      )}

    </div>
  );
}

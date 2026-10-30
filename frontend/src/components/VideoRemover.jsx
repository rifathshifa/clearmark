import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Video,
  Sparkles,
  Play,
  Pause,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Download,
  Volume2,
  Film,
  RotateCcw,
  Sliders,
  Info
} from 'lucide-react';
import CanvasEditor from './CanvasEditor';

export default function VideoRemover({ backendStatus }) {
  const [selectedVideoFile, setSelectedVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [capturedFrameUrl, setCapturedFrameUrl] = useState(null);
  const [maskDataUrl, setMaskDataUrl] = useState(null);

  // Processing state
  const [taskId, setTaskId] = useState(null);
  const [taskStatus, setTaskStatus] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultVideoUrl, setResultVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Settings
  const [feather, setFeather] = useState(4);
  const [selectedEngine, setSelectedEngine] = useState('auto');

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollingRef = useRef(null);

  const handleVideoFile = (file) => {
    if (!file) return;
    const valid = ['video/mp4', 'video/quicktime', 'video/mov', 'video/webm'];
    if (!valid.includes(file.type) && !file.name.match(/\.(mp4|mov|webm)$/i)) {
      setError('Please upload a valid MP4 or MOV video');
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      setError('Video file exceeds 200MB limit');
      return;
    }

    setError(null);
    setResultVideoUrl(null);
    setTaskId(null);
    setTaskStatus(null);
    setSelectedVideoFile(file);

    const url = URL.createObjectURL(file);
    setVideoUrl(url);
  };

  // When video loads metadata, capture initial frame
  const onVideoLoaded = () => {
    if (!videoRef.current) return;
    setVideoDuration(videoRef.current.duration || 0);
    captureFrame();
  };

  // Capture current video frame onto canvas to allow marking watermark
  const captureFrame = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frameData = canvas.toDataURL('image/png');
    setCapturedFrameUrl(frameData);
  };

  // Video scrubber change
  const handleSeek = (e) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  // Start Video Inpainting
  const handleStartInpaint = async () => {
    if (!selectedVideoFile) {
      setError('Please upload a video first');
      return;
    }
    if (!maskDataUrl) {
      setError('Please mark the watermark area on the video frame');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResultVideoUrl(null);

    try {
      const formData = new FormData();
      formData.append('video', selectedVideoFile);
      formData.append('mask_base64', maskDataUrl);
      formData.append('mode', selectedEngine);

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/inpaint/video`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to start video processing');
      }

      setTaskId(data.task_id);
      startPolling(data.task_id);
    } catch (err) {
      setError(err.message || 'Failed to submit video task');
      setIsProcessing(false);
    }
  };

  // Poll video task status
  const startPolling = (id) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/inpaint/video/status/${id}`);
        if (!res.ok) return;
        const statusData = await res.json();
        setTaskStatus(statusData);

        if (statusData.status === 'completed') {
          clearInterval(pollingRef.current);
          setIsProcessing(false);
          setResultVideoUrl(`${API_URL}${statusData.download_url}`);
        } else if (statusData.status === 'failed') {
          clearInterval(pollingRef.current);
          setIsProcessing(false);
          setError(statusData.error || 'Video inpainting failed');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleDownloadVideo = () => {
    if (!resultVideoUrl) return;
    const a = document.createElement('a');
    a.href = resultVideoUrl;
    a.download = taskStatus?.filename || 'video_watermark_removed.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReset = () => {
    setSelectedVideoFile(null);
    setVideoUrl(null);
    setCapturedFrameUrl(null);
    setMaskDataUrl(null);
    setTaskId(null);
    setTaskStatus(null);
    setResultVideoUrl(null);
    setError(null);
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in">
      
      {/* If result is ready, show Completed Video Comparison */}
      {resultVideoUrl ? (
        <div className="flex flex-col gap-5 animate-fade-in">
          {/* Header Bar */}
          <div className="glass-panel-elevated rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 border border-mint-200 shadow-mint-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-mint-100 border border-mint-200 flex items-center justify-center text-mint-700 shadow-xs">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-forest-900 text-sm sm:text-base flex items-center gap-2">
                  <span>Video Watermark Removed</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-mint-100 text-mint-800 border border-mint-200 flex items-center gap-1">
                    <Volume2 className="w-3 h-3 text-mint-600" /> Audio Preserved
                  </span>
                </h3>
                <p className="text-xs text-sage-600 font-medium">
                  {taskStatus?.total_frames || 'All'} frames inpainted with temporal smoothing & H.264 encode
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-forest-800 hover:bg-mint-100 hover:text-forest-950 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Process Another</span>
              </button>
              <button
                onClick={handleDownloadVideo}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-mint-600 via-mint-500 to-mint-700 hover:from-mint-500 hover:to-mint-600 text-white shadow-mint-md transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Download MP4</span>
              </button>
            </div>
          </div>

          {/* Dual Video Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-panel rounded-2xl p-3 border border-mint-200 flex flex-col gap-2">
              <span className="text-xs font-bold text-sage-700 px-2 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-sage-500" /> Original Video (With Watermark)
              </span>
              <div className="rounded-xl overflow-hidden bg-forest-950 flex items-center justify-center min-h-[300px]">
                <video src={videoUrl} controls className="max-h-[460px] w-full" />
              </div>
            </div>

            <div className="glass-panel-elevated rounded-2xl p-3 border border-mint-300 flex flex-col gap-2 shadow-mint-sm">
              <span className="text-xs font-extrabold text-mint-700 px-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-mint-600" /> AI Cleaned Video (Audio Preserved)
              </span>
              <div className="rounded-xl overflow-hidden bg-forest-950 flex items-center justify-center min-h-[300px]">
                <video src={resultVideoUrl} controls autoPlay className="max-h-[460px] w-full" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Video Selection & Marking Flow */
        <div className="flex flex-col gap-6">
          
          {/* If no video uploaded yet, show Upload Dropzone */}
          {!videoUrl ? (
            <div className="flex flex-col gap-8">
              {/* Hero Banner Card */}
              <div className="glass-panel-elevated rounded-3xl p-6 sm:p-12 border border-mint-200/90 shadow-mint-md relative overflow-hidden text-center">
                <div className="max-w-2xl mx-auto flex flex-col items-center gap-4 relative z-10">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-mint-100/90 border border-mint-300 text-mint-800 text-xs font-bold shadow-xs">
                    <Volume2 className="w-4 h-4 text-mint-600" />
                    <span>Temporal Frame Consistency & Lossless Audio</span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-forest-950 leading-tight">
                    Clean Video Watermarks <br />
                    <span className="text-gradient">Without Jitter or Quality Loss</span>
                  </h1>
                  <p className="text-base sm:text-lg font-bold text-mint-700 tracking-wide">
                    Remove marks. Keep memories.
                  </p>
                  <p className="text-xs sm:text-sm text-sage-700 font-medium max-w-xl">
                    Remove stationary logos, corner symbols, and timestamps across video frames with ClearMark. The original audio track and video bitrates are strictly preserved.
                  </p>
                </div>

                <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-mint-200/40 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-sage-200/35 blur-3xl pointer-events-none" />
              </div>

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleVideoFile(e.dataTransfer.files[0]);
                  }
                }}
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
                  accept="video/mp4,video/quicktime,video/mov,video/webm"
                  onChange={(e) => e.target.files && handleVideoFile(e.target.files[0])}
                  className="hidden"
                />

                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-mint-100/90 group-hover:bg-mint-200/90 border border-mint-200 flex items-center justify-center text-mint-700 shadow-mint-sm transition-all group-hover:scale-105">
                  <Video className="w-8 h-8 sm:w-10 sm:h-10 text-mint-600" />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-base sm:text-lg font-bold text-forest-900">
                    Drag and drop your video here, or <span className="text-mint-700 underline underline-offset-2">Browse Device</span>
                  </span>
                  <span className="text-xs text-sage-600 font-medium">
                    Supports MP4, MOV, WEBM • Up to 200MB • Audio Track Copied 1:1
                  </span>
                </div>
              </div>

              {/* Information Note */}
              <div className="glass-panel p-4 rounded-2xl border border-mint-200/90 flex items-start gap-3 text-xs text-forest-900 shadow-xs">
                <Info className="w-4 h-4 text-mint-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-forest-950">How Video Watermark Removal Works:</span>
                  <p className="mt-0.5 text-sage-600">
                    You mark the watermark position on any representative frame. The backend applies neural inpainting consistently across all frames with anti-flicker temporal smoothing, then remuxes the original synchronized audio stream.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Video is Loaded: Timeline Scrubber + Frame Canvas Marker */
            <div className="flex flex-col gap-5">
              
              {/* Hidden Video element for frame extraction */}
              <video
                ref={videoRef}
                src={videoUrl}
                onLoadedMetadata={onVideoLoaded}
                onSeeked={captureFrame}
                className="hidden"
              />

              {/* Scrubber & Instructions Bar */}
              <div className="glass-panel-elevated rounded-2xl p-4 flex flex-col gap-3 border border-mint-200 shadow-mint-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-mint-600" />
                    <span className="text-xs font-bold text-forest-950">
                      Step 1: Scrub video timeline to find watermark
                    </span>
                  </div>
                  <button
                    onClick={() => { setVideoUrl(null); setSelectedVideoFile(null); setCapturedFrameUrl(null); }}
                    className="text-xs font-bold text-sage-600 hover:text-rose-600 transition-colors"
                  >
                    Change Video
                  </button>
                </div>

                {/* Timeline slider */}
                <div className="flex items-center gap-3 bg-mint-50/80 p-2.5 rounded-xl border border-mint-200">
                  <span className="text-xs font-bold text-forest-900 w-12 text-center">
                    {currentTime.toFixed(1)}s
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={videoDuration || 10}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 accent-mint-600 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-forest-900 w-12 text-center">
                    {videoDuration.toFixed(1)}s
                  </span>
                </div>
              </div>

              {/* Canvas Editor on Captured Video Frame */}
              {capturedFrameUrl && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 px-2 text-xs font-bold text-forest-900">
                    <Sparkles className="w-4 h-4 text-mint-600" />
                    <span>Step 2: Paint or drag a box over the watermark to remove</span>
                  </div>

                  <CanvasEditor
                    imageSrc={capturedFrameUrl}
                    onMaskChange={setMaskDataUrl}
                    isProcessing={isProcessing}
                    feather={feather}
                    setFeather={setFeather}
                    selectedEngine={selectedEngine}
                    setSelectedEngine={setSelectedEngine}
                    hasAiModel={backendStatus?.ai_available}
                  />
                </div>
              )}

              {/* Progress Bar Display if task is running */}
              {isProcessing && (
                <div className="glass-panel-elevated rounded-2xl p-5 border border-mint-300 flex flex-col gap-3 shadow-mint-sm">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-forest-950 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-mint-600" />
                      <span>{taskStatus?.message || 'Processing video frames...'}</span>
                    </span>
                    <span className="text-mint-700 font-extrabold text-sm">
                      {taskStatus?.progress || 5}%
                    </span>
                  </div>

                  {/* Progress track */}
                  <div className="w-full h-3 rounded-full bg-mint-100 overflow-hidden border border-mint-200">
                    <div
                      className="h-full bg-gradient-to-r from-mint-500 via-mint-600 to-teal-600 transition-all duration-300"
                      style={{ width: `${taskStatus?.progress || 5}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-sage-600">
                    <span>
                      Frame: {taskStatus?.current_frame || 0} / {taskStatus?.total_frames || '...'}
                    </span>
                    <span className="flex items-center gap-1 font-bold text-mint-700">
                      <Volume2 className="w-3.5 h-3.5" /> Audio Track Sync Enabled
                    </span>
                  </div>
                </div>
              )}

              {/* Action Button */}
              {!isProcessing && (
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={handleStartInpaint}
                    disabled={!maskDataUrl || isProcessing}
                    className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-sm font-bold bg-gradient-to-r from-mint-600 via-mint-500 to-mint-700 hover:from-mint-500 hover:to-mint-600 text-white shadow-mint-md transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>Inpaint Video Watermark</span>
                  </button>
                </div>
              )}

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

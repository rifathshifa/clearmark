import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  FileImage,
  Film,
  Calendar,
  Clock,
  Sparkles,
  Download,
  Database,
  ArrowRight,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { API_URL } from '../config';

export default function HistoryModal({ isOpen, onClose }) {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/history?limit=25`);
      if (!res.ok) throw new Error('Failed to retrieve history');
      const data = await res.json();
      setHistoryData(data.files || []);
    } catch (err) {
      setError(err.message || 'Error connecting to database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl glass-panel-elevated rounded-3xl p-6 sm:p-8 border border-mint-200/90 shadow-mint-lg flex flex-col gap-6 max-h-[88vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-mint-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-mint-600 to-mint-400 flex items-center justify-center text-white shadow-mint-sm">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-forest-900">
                  Processing History
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-mint-100 text-mint-800 border border-mint-200 flex items-center gap-1">
                  <Database className="w-3 h-3 text-mint-600" /> PostgreSQL Saved
                </span>
              </div>
              <p className="text-xs text-sage-600 font-medium">
                Track and review recently cleaned photos and videos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchHistory}
              disabled={loading}
              title="Refresh history"
              className="p-2 rounded-xl text-sage-500 hover:text-forest-800 hover:bg-mint-100/60 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-mint-600' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-sage-400 hover:text-forest-900 hover:bg-mint-100/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 min-h-[220px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <RefreshCw className="w-8 h-8 text-mint-600 animate-spin" />
              <p className="text-xs font-semibold text-sage-600">Retrieving PostgreSQL records...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : historyData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-mint-100/80 border border-mint-200 flex items-center justify-center text-mint-700">
                <HardDrive className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-bold text-forest-900 text-sm">No Files in History Yet</h4>
                <p className="text-xs text-sage-600 max-w-sm mt-1">
                  Once you remove watermarks from photos or videos, their persistent records will automatically appear here.
                </p>
              </div>
            </div>
          ) : (
            historyData.map((item) => {
              const processed = item.processed_files?.[0];
              const isVideo = item.file_type?.startsWith('video') || item.filename?.match(/\.(mp4|mov|webm)$/i);

              return (
                <div
                  key={item.id}
                  className="glass-panel p-4 rounded-2xl border border-mint-100 hover:border-mint-300 transition-all hover:shadow-mint-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-mint-100/90 border border-mint-200 flex items-center justify-center text-mint-700 flex-shrink-0 group-hover:scale-105 transition-transform">
                      {isVideo ? (
                        <Film className="w-5 h-5 text-mint-600" />
                      ) : (
                        <FileImage className="w-5 h-5 text-mint-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-forest-900 text-xs sm:text-sm truncate max-w-[200px] sm:max-w-xs">
                          {item.original_filename || item.filename}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-sage-100 text-forest-800">
                          {isVideo ? 'Video' : 'Photo'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-sage-600 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-sage-400" />
                          {formatDate(item.created_at)}
                        </span>
                        <span>•</span>
                        <span>{formatFileSize(item.file_size)}</span>
                        {processed?.processing_time_sec && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-mint-700 font-semibold">
                              <Clock className="w-3 h-3" />
                              {processed.processing_time_sec}s
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions / Status */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {processed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-mint-700 bg-mint-100/90 px-2.5 py-1 rounded-xl border border-mint-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Cleaned
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sage-600 bg-sage-100 px-2.5 py-1 rounded-xl">
                        Uploaded
                      </span>
                    )}

                    {processed?.output_url && (
                      <a
                        href={processed.output_url.startsWith('http') ? processed.output_url : `${API_URL}${processed.output_url}`}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-mint-600 to-mint-700 hover:from-mint-500 hover:to-mint-600 text-white shadow-mint-sm transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-mint-100 flex items-center justify-between text-[11px] text-sage-500">
          <span>Connected to PostgreSQL Database</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-mint-100 hover:bg-mint-200 text-forest-800 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

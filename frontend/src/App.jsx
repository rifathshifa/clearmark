import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import PhotoRemover from './components/PhotoRemover';
import VideoRemover from './components/VideoRemover';
import LegalModal from './components/LegalModal';
import HistoryModal from './components/HistoryModal';
import { Shield, Cpu } from 'lucide-react';
import { API_URL } from './config';

export default function App() {
  const [activeMode, setActiveMode] = useState('photo'); // 'photo' | 'video'
  const [backendStatus, setBackendStatus] = useState(null);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/status`);
        if (res.ok) {
          const data = await res.json();
          setBackendStatus(data);
        }
      } catch (err) {
        console.warn('Backend currently offline or unreachable:', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [API_URL]);

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden selection:bg-mint-500 selection:text-white">
      
      {/* Dynamic Background Mint & Sage Glowing Ambient Orbs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 rounded-full bg-mint-200/40 blur-3xl pointer-events-none -z-10 animate-float" />
      <div className="fixed bottom-10 right-10 w-[30rem] h-[30rem] rounded-full bg-sage-200/35 blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/2 left-[-10rem] w-80 h-80 rounded-full bg-limeAccent-100/25 blur-3xl pointer-events-none -z-10" />

      {/* Navigation Bar */}
      <Navbar
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        backendStatus={backendStatus}
        onOpenLegal={() => setIsLegalOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      {/* Main App Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {activeMode === 'photo' ? (
          <PhotoRemover backendStatus={backendStatus} />
        ) : (
          <VideoRemover backendStatus={backendStatus} />
        )}
      </main>

      {/* Modern Light Green Footer */}
      <footer className="w-full glass-panel border-t border-mint-200/80 py-6 px-4 sm:px-8 text-xs text-sage-600 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          
          <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3">
            <span className="font-extrabold text-forest-950">ClearMark</span>
            <span className="hidden sm:inline text-sage-300">•</span>
            <span className="text-sage-600 italic hidden md:inline">"Remove marks. Keep memories."</span>
            <span className="hidden sm:inline text-sage-300">•</span>
            <span className="font-semibold text-forest-900">© 2026 Rifath Shifa M. All Rights Reserved.</span>
            <span className="hidden sm:inline text-sage-300">•</span>
            <span className="text-mint-700 font-bold">Developed by Rifath Shifa M</span>
          </div>

          <div className="flex items-center gap-4 font-semibold text-sage-700">
            <button
              onClick={() => setIsLegalOpen(true)}
              className="hover:text-mint-700 transition-colors flex items-center gap-1"
            >
              <Shield className="w-3.5 h-3.5 text-mint-600" /> Authorized Use Policy
            </button>
            <span className="text-sage-300">•</span>
            <span className="flex items-center gap-1 text-sage-600">
              <Cpu className="w-3.5 h-3.5 text-mint-600" /> Powered by Big-LaMa & FFmpeg
            </span>
          </div>

        </div>
      </footer>

      {/* Authorized Use & Ethics Modal */}
      <LegalModal isOpen={isLegalOpen} onClose={() => setIsLegalOpen(false)} />

      {/* Persistent History Modal */}
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />

    </div>
  );
}

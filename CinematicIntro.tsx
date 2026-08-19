import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, SkipForward, RotateCcw } from 'lucide-react';

interface CinematicIntroProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CinematicIntro: React.FC<CinematicIntroProps> = ({ isOpen, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [introUrl, setIntroUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/media')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data?.introUrl) setIntroUrl(data.introUrl);
        else onClose();
      })
      .catch(() => onClose());
    return () => { cancelled = true; };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !introUrl) return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.muted = true;
    video.defaultMuted = true;
    setIsMuted(true);
    video.play().catch(() => window.setTimeout(onClose, 150));
  }, [isOpen, introUrl, onClose]);

  if (!isOpen) return null;

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    if (video.paused) video.play().catch(() => {});
  };

  const restart = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black flex items-center justify-center overflow-hidden" style={{paddingTop:'env(safe-area-inset-top)',paddingBottom:'env(safe-area-inset-bottom)'}}>
      {introUrl && <video
        ref={videoRef}
        src={introUrl}
        className="absolute inset-0 h-full w-full object-cover bg-black"
        playsInline
        autoPlay
        muted
        preload="auto"
        onEnded={onClose}
        onError={onClose}
      />}

      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-4 sm:p-6 bg-gradient-to-t from-black/80 via-black/20 to-transparent" style={{paddingBottom:'max(1rem, env(safe-area-inset-bottom))'}}>
        <div className="flex items-center gap-2">
          <button onClick={toggleMute} className="rounded-sm border border-white/20 bg-black/60 p-2.5 text-white hover:bg-black/80" aria-label={isMuted ? 'Unmute intro' : 'Mute intro'}>
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button onClick={restart} className="rounded-sm border border-white/20 bg-black/60 p-2.5 text-white hover:bg-black/80" aria-label="Replay intro">
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>
        <button onClick={onClose} className="flex items-center gap-2 rounded-sm border border-[#D4AF37]/50 bg-black/70 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#D4AF37] hover:bg-black">
          <SkipForward className="h-4 w-4" /> Skip Intro
        </button>
      </div>
    </div>
  );
};

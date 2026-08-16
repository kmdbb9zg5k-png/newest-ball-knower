import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, SkipForward, RotateCcw } from 'lucide-react';

interface CinematicIntroProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CinematicIntro: React.FC<CinematicIntroProps> = ({ isOpen, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = 0;
    video.muted = false;
    setIsMuted(false);
    setAutoplayBlocked(false);

    const attempt = video.play();
    if (attempt) {
      attempt.catch(() => {
        // Browsers commonly block autoplay with sound. Fall back to muted
        // autoplay, then let the user unmute with one click.
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => setAutoplayBlocked(true));
      });
    }
  }, [isOpen]);

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

  const manualPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setIsMuted(false);
    setAutoplayBlocked(false);
    video.play().catch(() => {
      video.muted = true;
      setIsMuted(true);
      video.play().catch(() => {});
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        src="/assets/ball-knower-opening.mp4"
        className="absolute inset-0 h-full w-full object-cover bg-black"
        playsInline
        preload="auto"
        onEnded={onClose}
        onError={() => setAutoplayBlocked(true)}
      />

      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-4 sm:p-6 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="rounded-sm border border-white/20 bg-black/60 p-2.5 text-white hover:bg-black/80"
            aria-label={isMuted ? 'Unmute intro' : 'Mute intro'}
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button
            onClick={restart}
            className="rounded-sm border border-white/20 bg-black/60 p-2.5 text-white hover:bg-black/80"
            aria-label="Replay intro"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>

        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-sm border border-[#D4AF37]/50 bg-black/70 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#D4AF37] hover:bg-black"
        >
          <SkipForward className="h-4 w-4" />
          Skip Intro
        </button>
      </div>

      {autoplayBlocked && (
        <button
          onClick={manualPlay}
          className="relative z-20 rounded-md border border-[#D4AF37]/50 bg-black/80 px-7 py-4 text-sm font-black uppercase tracking-widest text-[#D4AF37]"
        >
          Play Ball Knower Intro
        </button>
      )}
    </div>
  );
};

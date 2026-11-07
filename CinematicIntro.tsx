import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, SkipForward, RotateCcw } from 'lucide-react';
import { trackBallKnowerEvent } from './analytics';

interface CinematicIntroProps {
  onClose: (finished: boolean) => void;
}

export const CinematicIntro: React.FC<CinematicIntroProps> = ({ onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onCloseRef = useRef(onClose);
  const hasExited = useRef(false);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const [isMuted, setIsMuted] = useState(() => {
    try { return localStorage.getItem('ball-knower-intro-sound-v1') !== 'on'; } catch { return true; }
  });
  const [introUrl, setIntroUrl] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const finishIntro = useCallback((outcome: 'completed' | 'skipped' | 'unavailable' | 'playback_error') => {
    if (hasExited.current) return;
    hasExited.current = true;
    trackBallKnowerEvent('Intro Exited', { outcome });
    onCloseRef.current(outcome === 'completed' || outcome === 'skipped');
  }, []);

  useEffect(() => {
    trackBallKnowerEvent('Intro Shown');
    const controller = new AbortController();
    fetch('/api/media', { cache: 'no-store', signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error('media unavailable');
        return r.json();
      })
      .then(data => {
        if (controller.signal.aborted) return;
        if (data?.introUrl) setIntroUrl(data.introUrl);
        else finishIntro('unavailable');
      })
      .catch(() => { if (!controller.signal.aborted) finishIntro('unavailable'); });
    return () => controller.abort();
  }, [finishIntro]);

  useEffect(() => {
    if (!introUrl) return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    const wantsSound = (() => { try { return localStorage.getItem('ball-knower-intro-sound-v1') === 'on'; } catch { return false; } })();
    video.muted = !wantsSound;
    video.defaultMuted = !wantsSound;
    setIsMuted(!wantsSound);
    let cancelled = false;
    video.play().catch(() => {
      if (cancelled) return;
      // iOS may reject autoplay with sound. Fall back to muted autoplay so the
      // intro still starts, then allow the user's first tap to enable sound.
      video.muted = true;
      video.defaultMuted = true;
      setIsMuted(true);
      video.play().catch(() => { if (!cancelled) finishIntro('playback_error'); });
    });
    return () => { cancelled = true; };
  }, [introUrl, finishIntro]);

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    try { localStorage.setItem('ball-knower-intro-sound-v1', video.muted ? 'off' : 'on'); } catch {}
    if (video.paused) video.play().catch(() => {});
  };

  const restart = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,#17120a_0%,#08090b_46%,#020203_100%)]" style={{paddingTop:'env(safe-area-inset-top)',paddingBottom:'env(safe-area-inset-bottom)'}}>
      {!videoReady && <div className="absolute inset-0 z-[1] grid place-items-center" aria-hidden="true"><div className="text-center"><div className="font-display text-4xl font-black uppercase tracking-[.1em] text-[#D4AF37]">Ball Knower</div><div className="mx-auto mt-3 h-px w-24 bg-gradient-to-r from-transparent via-[#D4AF37]/70 to-transparent"/></div></div>}
      {introUrl && <video
        ref={videoRef}
        src={introUrl}
        className={`absolute inset-0 h-full w-full object-cover bg-black transition-opacity duration-200 ${videoReady?'opacity-100':'opacity-0'}`}
        playsInline
        autoPlay
        muted={isMuted}
        preload="metadata"
        onCanPlay={() => setVideoReady(true)}
        onPlaying={() => setVideoReady(true)}
        onEnded={() => finishIntro('completed')}
        onError={() => finishIntro('playback_error')}
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
        <button onClick={() => finishIntro('skipped')} className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-white/55 backdrop-blur-sm transition hover:bg-black/60 hover:text-white/85">
          <SkipForward className="h-3 w-3" /> Skip
        </button>
      </div>
    </div>
  );
};

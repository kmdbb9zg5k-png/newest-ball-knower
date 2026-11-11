import React, { useEffect, useState } from 'react';
import { ModalPortal } from './ModalPortal';
import './soundtrackControl.css';
import { useSoundtrack } from './SoundtrackContext';
import { Volume2, VolumeX, Volume1, Play, Pause, SkipForward, SkipBack, AudioLines, Disc3, Repeat1, Shuffle, X } from 'lucide-react';

export const SoundtrackControl: React.FC = () => {
  const { isPlaying, isMuted, volume, currentTrack, toggleMute } = useSoundtrack();
  const [isOpen, setIsOpen] = useState(false);
  const volumePct = Math.round(volume * 100);

  return (
    <div className="relative">
      {/* Top-Right Speaker Control Pill Button */}
      <div className="flex items-center rounded-full bg-[#1A1A1A] border border-white/10 p-0.5 shadow-md">
        {/* Direct Mute / Unmute Button */}
        <button
          id="soundtrack-mute-toggle-btn"
          type="button"
          aria-label={isMuted ? 'Unmute soundtrack' : 'Mute soundtrack'}
          aria-pressed={isMuted}
          onClick={toggleMute}
          className={`flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-full transition-all cursor-pointer ${
            isMuted
              ? 'text-zinc-500 hover:text-white hover:bg-zinc-800'
              : isPlaying
              ? 'text-[#D4AF37] bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 shadow-[0_0_12px_rgba(212,175,55,0.25)]'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
          title={isMuted ? 'Unmute Soundtrack' : 'Mute Soundtrack'}
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="h-4 w-4" />
          ) : volume < 0.35 ? (
            <Volume1 className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>

        {/* Mini Waveform & Menu Trigger */}
        <button
          id="soundtrack-panel-toggle-btn"
          type="button"
          onClick={() => setIsOpen(open => !open)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-controls={isOpen ? "soundtrack-panel" : undefined}
          aria-label="Soundtrack settings and tracks"
          className="flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded-full text-left transition-colors hover:bg-zinc-800/60 sm:h-auto sm:w-auto sm:gap-1.5 sm:px-2.5 sm:py-1"
          title="Soundtrack Settings & Tracks"
        >
          {/* Animated Equalizer Bars when Playing */}
          {isPlaying && !isMuted ? (
            <div className="flex items-end gap-0.5 h-3.5 w-3.5">
              <span className="w-0.5 bg-[#D4AF37] rounded-full animate-pulse" style={{ height: '70%', animationDuration: '0.6s' }} />
              <span className="w-0.5 bg-[#D4AF37] rounded-full animate-pulse" style={{ height: '100%', animationDuration: '0.4s' }} />
              <span className="w-0.5 bg-[#D4AF37] rounded-full animate-pulse" style={{ height: '50%', animationDuration: '0.8s' }} />
            </div>
          ) : (
            <Disc3 className={`h-3.5 w-3.5 ${isMuted ? 'text-zinc-600' : 'text-zinc-400'}`} />
          )}

          <div className="hidden flex-col sm:flex">
            <span className="text-[9px] font-black uppercase tracking-wider text-zinc-300 max-w-[90px] truncate leading-tight">
              {currentTrack.title}
            </span>
            <span className="text-[8px] font-mono font-bold text-zinc-500 leading-none">
              {isMuted ? 'MUTED' : `${volumePct}% VOL`}
            </span>
          </div>
        </button>
      </div>

      {isOpen && <SoundtrackPanel onClose={() => setIsOpen(false)}/>}
    </div>
  );
};

function formatTime(seconds: number) {
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function SoundtrackPanel({ onClose }: { onClose: () => void }) {
  const {
    isPlaying, isMuted, volume, currentTrack, currentTrackIndex, allTracks, setVolume,
    nextTrack, prevTrack, selectTrack, play, pause, isIntroActive,
    shuffle, repeat, toggleShuffle, toggleRepeat, observePosition, seek,
  } = useSoundtrack();
  const [position, setPosition] = useState({ elapsed: 0, duration: 0 });
  const volumePct = isMuted ? 0 : Math.round(volume * 100);
  const canPlay = allTracks.length > 0 && !isIntroActive;
  const progress = position.duration ? Math.min(position.elapsed, position.duration) : 0;
  useEffect(() => observePosition(setPosition), [observePosition]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return <ModalPortal>
    <div className="bk-soundtrack-scrim" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section id="soundtrack-panel" className="bk-soundtrack-sheet" role="dialog" aria-modal="true" aria-labelledby="soundtrack-heading">
        <header className="bk-soundtrack-header">
          <AudioLines aria-hidden="true"/>
          <h2 id="soundtrack-heading">Ball Knower Soundtrack</h2>
          <button type="button" onClick={onClose} aria-label="Close soundtrack settings"><X aria-hidden="true"/></button>
        </header>
        <div className="bk-soundtrack-now">
          <img src="/atmosphere/soundtrack-cover.webp" width="320" height="320" alt=""/>
          <div>
            <span>Now playing</span>
            <h3>{currentTrack.title}</h3>
            <p>{currentTrack.subtitle}</p>
          </div>
        </div>
        <div className="bk-soundtrack-progress">
          <span>{formatTime(progress)}</span>
          <input type="range" aria-label="Playback position" min="0" max={position.duration || 1}
            step="any" value={progress} disabled={!position.duration}
            aria-valuetext={formatTime(progress)} onChange={event => seek(event.currentTarget.valueAsNumber)}
            style={{ '--soundtrack-fill': `${position.duration ? progress / position.duration * 100 : 0}%` } as React.CSSProperties}/>
          <span>{formatTime(position.duration)}</span>
        </div>
        <div className="bk-soundtrack-transport">
          <button type="button" aria-label="Shuffle tracks" aria-pressed={shuffle} onClick={toggleShuffle}><Shuffle aria-hidden="true"/></button>
          <button type="button" aria-label="Previous track" disabled={!canPlay} onClick={prevTrack}><SkipBack aria-hidden="true"/></button>
          <button type="button" className="bk-soundtrack-play" aria-label={isPlaying ? 'Pause' : 'Play'} disabled={!canPlay} onClick={isPlaying ? pause : play}>
            {isPlaying ? <Pause aria-hidden="true"/> : <Play aria-hidden="true"/>}
          </button>
          <button type="button" aria-label="Next track" disabled={!canPlay} onClick={nextTrack}><SkipForward aria-hidden="true"/></button>
          <button type="button" aria-label="Repeat current track" aria-pressed={repeat} onClick={toggleRepeat}><Repeat1 aria-hidden="true"/></button>
        </div>
        <div className="bk-soundtrack-volume">
          <div><label htmlFor="bk-soundtrack-volume">Volume</label><span>{isMuted ? 'Muted' : `${volumePct}%`}</span></div>
          <Volume1 aria-hidden="true"/>
          <input id="bk-soundtrack-volume" type="range" aria-label="Soundtrack volume" min="0" max="100"
            value={volumePct} aria-valuetext={isMuted ? 'Muted' : `${volumePct}%`}
            onChange={event => setVolume(event.currentTarget.valueAsNumber / 100, true)}
            style={{ '--soundtrack-fill': `${volumePct}%` } as React.CSSProperties}/>
          <Volume2 aria-hidden="true"/>
        </div>
        <div className="bk-soundtrack-list-heading"><h3 id="soundtrack-tracks">Track list</h3><span>{allTracks.length} {allTracks.length === 1 ? 'track' : 'tracks'}</span></div>
        <ol className="bk-soundtrack-list" aria-labelledby="soundtrack-tracks">
          {allTracks.map((track, index) => {
            const active = currentTrackIndex === index;
            return <li key={track.id}>
              <button type="button" aria-current={active ? 'true' : undefined} disabled={!canPlay} onClick={() => selectTrack(index)}>
                <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <strong>{track.title}</strong>
                {active && isPlaying && !isMuted && <AudioLines aria-hidden="true"/>}
              </button>
            </li>;
          })}
        </ol>
      </section>
    </div>
  </ModalPortal>;
}

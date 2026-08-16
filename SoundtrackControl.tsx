import React, { useState, useRef, useEffect } from 'react';
import { useSoundtrack } from '../context/SoundtrackContext';
import { Volume2, VolumeX, Volume1, Play, Pause, SkipForward, SkipBack, Music, Disc3 } from 'lucide-react';

export const SoundtrackControl: React.FC = () => {
  const {
    isPlaying,
    isMuted,
    volume,
    currentTrack,
    currentTrackIndex,
    allTracks,
    toggleMute,
    setVolume,
    nextTrack,
    prevTrack,
    selectTrack,
    play,
    pause,
    isIntroActive,
  } = useSoundtrack();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const volumePct = Math.round(volume * 100);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Top-Right Speaker Control Pill Button */}
      <div className="flex items-center rounded-full bg-[#1A1A1A] border border-white/10 p-0.5 shadow-md">
        {/* Direct Mute / Unmute Button */}
        <button
          id="soundtrack-mute-toggle-btn"
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
          onClick={() => setIsOpen(!isOpen)}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-left hover:bg-zinc-800/60 rounded-full transition-colors cursor-pointer"
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

          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-wider text-zinc-300 max-w-[90px] truncate leading-tight">
              {currentTrack.title}
            </span>
            <span className="text-[8px] font-mono font-bold text-zinc-500 leading-none">
              {isMuted ? 'MUTED' : `${volumePct}% VOL`}
            </span>
          </div>
        </button>
      </div>

      {/* Expanded Audio Settings & Track Selection Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-lg border border-white/10 bg-[#121212] p-3.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-[#D4AF37]" />
              <div>
                <h4 className="text-xs font-black uppercase text-white tracking-wider">BALL KNOWER SOUNDTRACK</h4>
                <p className="text-[9px] text-zinc-500 font-bold uppercase">NFL DRAFT NIGHT ATMOSPHERE</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-500 hover:text-white text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>

          {/* Currently Playing Card */}
          <div className="my-3 rounded-md bg-[#1A1A1A] border border-white/5 p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-mono uppercase tracking-widest text-[#D4AF37] font-black">
                TRACK {currentTrackIndex + 1} OF {allTracks.length}
              </span>
              <span className="text-[8px] font-bold uppercase px-1.5 py-0.2 bg-zinc-800 text-zinc-400 rounded-xs">
                {currentTrack.mood}
              </span>
            </div>
            <div className="text-xs font-black uppercase text-white tracking-wide truncate">
              {currentTrack.title}
            </div>
            <div className="text-[10px] text-zinc-400 truncate mb-3">
              {currentTrack.subtitle}
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-3 pt-1 border-t border-white/5">
              <button
                onClick={prevTrack}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Previous Track"
              >
                <SkipBack className="h-4 w-4" />
              </button>

              {isPlaying ? (
                <button
                  onClick={pause}
                  className="flex items-center justify-center h-8 w-8 rounded-full bg-[#D4AF37] text-black hover:bg-white transition-colors cursor-pointer shadow-md font-bold"
                  title="Pause"
                >
                  <Pause className="h-4 w-4 fill-black" />
                </button>
              ) : (
                <button
                  onClick={play}
                  className="flex items-center justify-center h-8 w-8 rounded-full bg-[#D4AF37] text-black hover:bg-white transition-colors cursor-pointer shadow-md font-bold"
                  title="Play"
                >
                  <Play className="h-4 w-4 fill-black ml-0.5" />
                </button>
              )}

              <button
                onClick={nextTrack}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Next Track"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Volume Slider Control */}
          <div className="space-y-1.5 mb-3 px-1">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-zinc-400">
              <span className="flex items-center gap-1">
                {isMuted ? <VolumeX className="h-3 w-3 text-red-400" /> : <Volume2 className="h-3 w-3 text-[#D4AF37]" />}
                <span>Volume</span>
              </span>
              <span className="font-mono text-[#D4AF37]">{isMuted ? 'Muted' : `${volumePct}%`}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volumePct}
                onChange={e => {
                  const val = parseInt(e.target.value, 10) / 100;
                  setVolume(val);
                  if (isMuted && val > 0) {
                    toggleMute();
                  }
                }}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
              />
            </div>
            <div className="flex justify-between text-[8px] font-mono text-zinc-600">
              <span>0%</span>
              <span>22% (Atmospheric)</span>
              <span>100%</span>
            </div>
          </div>

          {/* Track Selection List */}
          <div className="space-y-1 pt-2 border-t border-white/5">
            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-1 mb-1">
              Select Soundtrack Theme:
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {allTracks.map((track, idx) => (
                <button
                  key={track.id}
                  onClick={() => selectTrack(idx)}
                  className={`w-full flex items-center justify-between rounded-sm px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
                    currentTrackIndex === idx
                      ? 'bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37]'
                      : 'text-zinc-300 hover:bg-[#1A1A1A] hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono text-[9px] text-zinc-500 font-bold">0{idx + 1}</span>
                    <div className="truncate">
                      <div className="text-[11px] font-black uppercase tracking-wide truncate">
                        {track.title}
                      </div>
                      <div className="text-[8px] text-zinc-500 truncate">
                        {track.mood} • {track.tempoBpm} BPM
                      </div>
                    </div>
                  </div>
                  {currentTrackIndex === idx && isPlaying && !isMuted && (
                    <span className="h-2 w-2 rounded-full bg-[#D4AF37] animate-ping shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-3 pt-2 border-t border-white/5 text-[9px] text-zinc-500 text-center font-mono uppercase">
            Plays seamlessly across all draft screens & lobby
          </div>
        </div>
      )}
    </div>
  );
};

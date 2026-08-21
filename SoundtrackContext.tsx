import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { globalSoundtrackEngine, SoundtrackTrack } from './soundtrackEngine';
import { loadUserState, saveUserState } from './userStateCloud';

type MediaTrack = SoundtrackTrack & { url?: string };

interface SoundtrackContextType {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTrack: MediaTrack;
  currentTrackIndex: number;
  allTracks: MediaTrack[];
  toggleMute: () => void;
  setVolume: (vol: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  selectTrack: (index: number) => void;
  play: () => void;
  pause: () => void;
  playDraftPickSfx: () => void;
  playRemoveSfx: () => void;
  playLockSfx: () => void;
  playWarningSfx: () => void;
  setIntroActive: (active: boolean) => void;
  isIntroActive: boolean;
}

const SoundtrackContext = createContext<SoundtrackContextType | undefined>(undefined);
const STORAGE_KEY_MUTED = 'bk_soundtrack_muted';
const STORAGE_KEY_VOLUME = 'bk_soundtrack_volume';
const STORAGE_KEY_TRACK = 'bk_soundtrack_track_idx';
const STORAGE_KEY_LAST_TRACK = 'bk_soundtrack_last_track_id';
const FALLBACK_TRACK: MediaTrack = { id:'loading', title:'Ball Knower', subtitle:'Loading soundtrack…', tempoBpm:0, mood:'Ball Knower', durationSec:0 };

const randomTrackIndex = (tracks: MediaTrack[], excludedIndex = -1) => {
  if (tracks.length <= 1) return 0;
  let next = excludedIndex;
  while (next === excludedIndex) next = Math.floor(Math.random() * tracks.length);
  return next;
};

export const SoundtrackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tracksRef = useRef<MediaTrack[]>([]);
  const [tracks, setTracks] = useState<MediaTrack[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(() => { try { const v=localStorage.getItem(STORAGE_KEY_MUTED); return v!==null ? JSON.parse(v) : false; } catch { return false; } });
  const [volume, setVolumeState] = useState<number>(() => { try { const v=localStorage.getItem(STORAGE_KEY_VOLUME); return v!==null ? parseFloat(v) : .22; } catch { return .22; } });
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(() => { try { return parseInt(localStorage.getItem(STORAGE_KEY_TRACK)||'0',10)||0; } catch { return 0; } });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isIntroActive, setIsIntroActiveState] = useState(true);

  useEffect(() => {
    let active = true;
    void loadUserState<{ muted?: boolean; volume?: number }>('soundtrack_preferences').then(preferences => {
      if (!active || !preferences) return;
      if (typeof preferences.muted === 'boolean') setIsMuted(preferences.muted);
      if (typeof preferences.volume === 'number') setVolumeState(Math.max(0, Math.min(1, preferences.volume)));
    }).catch(error => console.warn('Soundtrack preference cloud restore failed', error));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    fetch('/api/media').then(r=>r.json()).then(data => {
      const loaded: MediaTrack[] = Array.isArray(data?.tracks) ? data.tracks : [];
      tracksRef.current = loaded;
      setTracks(loaded);
      if (loaded.length) {
        let lastTrackId = '';
        try { lastTrackId = localStorage.getItem(STORAGE_KEY_LAST_TRACK) || ''; } catch {}
        const lastIndex = loaded.findIndex(track => track.id === lastTrackId);
        setCurrentTrackIndex(randomTrackIndex(loaded, lastIndex));
      }
    }).catch(()=>{ tracksRef.current = []; setTracks([]); });
  }, []);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks.length]);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.addEventListener('ended', () => {
        const loaded = tracksRef.current;
        setCurrentTrackIndex(i => randomTrackIndex(loaded, i));
      });
      audioRef.current = audio;
    }
    return () => { audioRef.current?.pause(); };
  }, []);

  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    a.volume = Math.max(0,Math.min(1,volume));
    a.muted = isMuted;
    try {
      localStorage.setItem(STORAGE_KEY_MUTED, JSON.stringify(isMuted));
      localStorage.setItem(STORAGE_KEY_VOLUME, String(volume));
      localStorage.setItem(STORAGE_KEY_TRACK, String(currentTrackIndex));
      const trackId = tracks[currentTrackIndex]?.id;
      if (trackId) localStorage.setItem(STORAGE_KEY_LAST_TRACK, trackId);
    } catch {}
  }, [volume,isMuted,currentTrackIndex,tracks]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void saveUserState('soundtrack_preferences', { muted: isMuted, volume }).catch(error => console.warn('Soundtrack preference cloud save failed', error));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [isMuted, volume]);

  const startIndex = useCallback((idx:number) => {
    if (isIntroActive || !tracks.length) return;
    const normalized = (idx + tracks.length) % tracks.length;
    const track = tracks[normalized];
    const a = audioRef.current;
    if (!a || !track?.url) return;
    setCurrentTrackIndex(normalized);
    if (a.src !== track.url) a.src = track.url;
    a.volume = volume; a.muted = isMuted;
    a.play().then(()=>setIsPlaying(true)).catch(()=>setIsPlaying(false));
  }, [tracks,isIntroActive,volume,isMuted]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || isIntroActive || !tracks.length || !isPlaying) return;
    const track = tracks[currentTrackIndex % tracks.length];
    if (track?.url && a.src !== track.url) { a.src = track.url; a.play().catch(()=>{}); }
  }, [currentTrackIndex, tracks, isIntroActive, isPlaying]);

  const play = useCallback(() => startIndex(currentTrackIndex), [startIndex,currentTrackIndex]);
  const pause = useCallback(() => { audioRef.current?.pause(); setIsPlaying(false); }, []);
  const toggleMute = useCallback(() => setIsMuted(v=>!v), []);
  const setVolume = useCallback((v:number) => setVolumeState(Math.max(0,Math.min(1,v))), []);
  const selectTrack = useCallback((i:number) => startIndex(i), [startIndex]);
  const nextTrack = useCallback(() => startIndex(randomTrackIndex(tracks, currentTrackIndex)), [startIndex,tracks,currentTrackIndex]);
  const prevTrack = useCallback(() => startIndex(currentTrackIndex-1), [startIndex,currentTrackIndex]);

  const setIntroActive = useCallback((active:boolean) => {
    setIsIntroActiveState(active);
    if (active) { audioRef.current?.pause(); setIsPlaying(false); }
    else {
      window.setTimeout(() => startIndex(currentTrackIndex), 0);
    }
  }, [startIndex,currentTrackIndex]);

  useEffect(() => {
    const resume = () => { if (!isIntroActive && !isPlaying && tracks.length) startIndex(currentTrackIndex); };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    return () => { window.removeEventListener('pointerdown', resume); window.removeEventListener('keydown', resume); };
  }, [isIntroActive,isPlaying,tracks.length,startIndex,currentTrackIndex]);

  const playDraftPickSfx = useCallback(()=>globalSoundtrackEngine.playDraftPickSound(),[]);
  const playRemoveSfx = useCallback(()=>globalSoundtrackEngine.playRemovePlayerSound(),[]);
  const playLockSfx = useCallback(()=>globalSoundtrackEngine.playRosterLockedSound(),[]);
  const playWarningSfx = useCallback(()=>globalSoundtrackEngine.playWarningSound(),[]);
  const currentTrack = tracks[currentTrackIndex % Math.max(1,tracks.length)] || FALLBACK_TRACK;

  return <SoundtrackContext.Provider value={{isPlaying,isMuted,volume,currentTrack,currentTrackIndex,allTracks:tracks,toggleMute,setVolume,nextTrack,prevTrack,selectTrack,play,pause,playDraftPickSfx,playRemoveSfx,playLockSfx,playWarningSfx,setIntroActive,isIntroActive}}>{children}</SoundtrackContext.Provider>;
};

export const useSoundtrack = () => {
  const context = useContext(SoundtrackContext);
  if (!context) throw new Error('useSoundtrack must be used within a SoundtrackProvider');
  return context;
};

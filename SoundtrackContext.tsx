import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { globalSoundtrackEngine, SoundtrackTrack } from './soundtrackEngine';
import { loadUserState, saveUserState } from './userStateCloud';
import { keepActiveSoundtrackTrack, soundtrackVolume } from './soundtrackPolicy';

type MediaTrack = SoundtrackTrack & { url?: string; manualOnly?: boolean };

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

const automaticTrackIndexes = (tracks: MediaTrack[]) => tracks
  .map((track, index) => ({ track, index }))
  .filter(({ track }) => !track.manualOnly)
  .map(({ index }) => index);

const randomTrackIndex = (tracks: MediaTrack[], excludedIndex = -1) => {
  const eligible = automaticTrackIndexes(tracks).filter(index => index !== excludedIndex);
  const fallback = automaticTrackIndexes(tracks);
  const choices = eligible.length ? eligible : fallback;
  return choices.length ? choices[Math.floor(Math.random() * choices.length)] : 0;
};

const adjacentTrackIndex = (tracks: MediaTrack[], currentIndex: number, direction: 1 | -1) => {
  if (!tracks.length) return 0;
  for (let offset = 1; offset <= tracks.length; offset += 1) {
    const index = (currentIndex + direction * offset + tracks.length) % tracks.length;
    if (!tracks[index]?.manualOnly) return index;
  }
  return currentIndex;
};

const absoluteTrackUrl = (url: string) => new URL(url, window.location.href).href;

export const SoundtrackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tracksRef = useRef<MediaTrack[]>([]);
  const shouldPlayRef = useRef(false);
  const introActiveRef = useRef(true);
  const appActiveRef = useRef(document.visibilityState==='visible');
  const nativeActiveRef = useRef(true);
  const currentTrackIndexRef = useRef(0);
  const recoveredTrackUrlsRef = useRef<Map<string,string>>(new Map());
  const recoveryInFlightRef = useRef(false);
  const playbackVersionRef = useRef(0);
  const preferencesEditedRef = useRef(false);
  const [preferencesReady,setPreferencesReady] = useState(false);
  const [tracks, setTracks] = useState<MediaTrack[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY_MUTED)||'false')===true; } catch { return false; } });
  const [volume, setVolumeState] = useState<number>(() => { try { const v=localStorage.getItem(STORAGE_KEY_VOLUME); return v!==null ? soundtrackVolume(v) : .22; } catch { return .22; } });
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(() => { try { return parseInt(localStorage.getItem(STORAGE_KEY_TRACK)||'0',10)||0; } catch { return 0; } });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isIntroActive, setIsIntroActiveState] = useState(true);
  const preferencesOwner = useRef<string | null>((()=>{try{return localStorage.getItem('ballknower_cloud_owner_v1');}catch{return null;}})());

  useEffect(() => {
    let active = true;
    const owner=preferencesOwner.current;
    // Local/offline soundtrack controls must not bootstrap a cloud account.
    if(!owner){setPreferencesReady(true);return;}
    void loadUserState<{ muted?: boolean; volume?: number }>('soundtrack_preferences',owner).then(preferences => {
      if (!active || !preferences || preferencesEditedRef.current) return;
      if (typeof preferences.muted === 'boolean') setIsMuted(preferences.muted);
      if (typeof preferences.volume === 'number') setVolumeState(soundtrackVolume(preferences.volume));
    }).catch(error => console.warn('Soundtrack preference cloud restore failed', error)).finally(()=>{if(active)setPreferencesReady(true);});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    fetch('/api/media').then(r=>r.json()).then(data => {
      const loaded: MediaTrack[] = Array.isArray(data?.tracks) ? data.tracks.filter(keepActiveSoundtrackTrack) : [];
      tracksRef.current = loaded;
      setTracks(loaded);
      if (loaded.length) {
        let lastTrackId = '';
        try { lastTrackId = localStorage.getItem(STORAGE_KEY_LAST_TRACK) || ''; } catch {}
        const lastIndex = loaded.findIndex(track => track.id === lastTrackId);
        const nextIndex = randomTrackIndex(loaded, lastIndex);
        currentTrackIndexRef.current = nextIndex;
        setCurrentTrackIndex(nextIndex);
      }
    }).catch(()=>{ tracksRef.current = []; setTracks([]); });
  }, []);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks.length]);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'metadata';
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const advance = () => {
        const loaded=tracksRef.current,nextIndex=randomTrackIndex(loaded,currentTrackIndexRef.current),track=loaded[nextIndex];
        currentTrackIndexRef.current=nextIndex;setCurrentTrackIndex(nextIndex);playbackVersionRef.current+=1;
        // Browsers may emit pause before ended. Start the next track from the
        // user's playback intent instead of the transient isPlaying state.
        if(!track?.url||!shouldPlayRef.current||introActiveRef.current||!appActiveRef.current)return;
        audio.src=recoveredTrackUrlsRef.current.get(track.url)||absoluteTrackUrl(track.url);
        audio.play().catch(()=>setIsPlaying(false));
      };
      const handleEnded = () => {
        const loaded = tracksRef.current;
        const track = loaded[currentTrackIndexRef.current % Math.max(1, loaded.length)];
        if (track?.url && audio.currentTime < 30 && !recoveryInFlightRef.current && !recoveredTrackUrlsRef.current.has(track.url)) {
          recoveryInFlightRef.current = true;
          const resumeAt = audio.currentTime;
          const version=playbackVersionRef.current;
          const isCurrent=()=>audioRef.current===audio&&playbackVersionRef.current===version;
          void (async () => {
            try {
              let playableUrl = recoveredTrackUrlsRef.current.get(track.url);
              if (!playableUrl) {
                const response = await fetch(track.url, { cache: 'reload' });
                if (!response.ok) throw new Error(`Soundtrack recovery failed (${response.status})`);
                const blob=await response.blob();
                if(!isCurrent())return;
                playableUrl = URL.createObjectURL(blob);
                recoveredTrackUrlsRef.current.set(track.url, playableUrl);
              }
              if(!isCurrent())return;
              audio.src = playableUrl;
              audio.addEventListener('loadedmetadata', () => {
                if(!isCurrent()||audio.src!==playableUrl)return;
                audio.currentTime = Math.min(resumeAt, Math.max(0, audio.duration - .25));
                if (shouldPlayRef.current && !introActiveRef.current && appActiveRef.current) audio.play().catch(()=>setIsPlaying(false));
              }, { once: true });
              audio.load();
            } catch (error) {
              console.warn('Soundtrack premature-end recovery failed', error);
              if(isCurrent())advance();
            } finally {
              recoveryInFlightRef.current = false;
            }
          })();
          return;
        }
        advance();
      };
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('ended', handleEnded);
      audioRef.current = audio;
      return () => {
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('ended', handleEnded);
        audio.pause();
        audioRef.current=null;playbackVersionRef.current+=1;
        recoveredTrackUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        recoveredTrackUrlsRef.current.clear();
      };
    }
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
    if(!preferencesReady||!preferencesEditedRef.current)return;
    let owner=preferencesOwner.current;
    if(!owner){try{owner=localStorage.getItem('ballknower_cloud_owner_v1');}catch{return;}}
    if(!owner)return;
    preferencesOwner.current=owner;
    // Capture the originating owner with the debounce; account switches must
    // reject this write rather than applying an earlier user's preferences.
    const timer = window.setTimeout(() => {
      void saveUserState('soundtrack_preferences', { muted: isMuted, volume },owner).catch(error => console.warn('Soundtrack preference cloud save failed', error));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [isMuted, volume, preferencesReady]);

  const startIndex = useCallback((idx:number) => {
    shouldPlayRef.current = true;
    if (introActiveRef.current || !appActiveRef.current || !tracks.length) return;
    const normalized = (idx + tracks.length) % tracks.length;
    const track = tracks[normalized];
    const a = audioRef.current;
    if (!a || !track?.url) return;
    playbackVersionRef.current+=1;
    currentTrackIndexRef.current = normalized;
    setCurrentTrackIndex(normalized);
    const nextUrl = recoveredTrackUrlsRef.current.get(track.url)||absoluteTrackUrl(track.url);
    if (a.src !== nextUrl) a.src = nextUrl;
    a.volume = volume; a.muted = isMuted;
    a.play().then(()=>setIsPlaying(true)).catch(()=>setIsPlaying(false));
  }, [tracks,volume,isMuted]);

  useEffect(() => {
    if (!tracks.length || introActiveRef.current || !shouldPlayRef.current) return;
    startIndex(currentTrackIndexRef.current);
  }, [tracks, startIndex]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || isIntroActive || !appActiveRef.current || !shouldPlayRef.current || !tracks.length || !isPlaying) return;
    const track = tracks[currentTrackIndex % tracks.length];
    if (track?.url) {
      const nextUrl = recoveredTrackUrlsRef.current.get(track.url)||absoluteTrackUrl(track.url);
      if (a.src !== nextUrl) { a.src = nextUrl; a.play().catch(()=>{}); }
    }
  }, [currentTrackIndex, tracks, isIntroActive, isPlaying]);

  useEffect(() => { currentTrackIndexRef.current = currentTrackIndex; }, [currentTrackIndex]);

  const play = useCallback(() => startIndex(currentTrackIndex), [startIndex,currentTrackIndex]);
  const pause = useCallback(() => { shouldPlayRef.current = false; audioRef.current?.pause(); setIsPlaying(false); }, []);
  const toggleMute = useCallback(() => {preferencesEditedRef.current=true;setIsMuted(v=>!v);}, []);
  const setVolume = useCallback((v:number) => {preferencesEditedRef.current=true;setVolumeState(soundtrackVolume(v));}, []);
  const selectTrack = useCallback((i:number) => startIndex(i), [startIndex]);
  const nextTrack = useCallback(() => startIndex(randomTrackIndex(tracks, currentTrackIndex)), [startIndex,tracks,currentTrackIndex]);
  const prevTrack = useCallback(() => startIndex(adjacentTrackIndex(tracks, currentTrackIndex, -1)), [startIndex,tracks,currentTrackIndex]);

  const setIntroActive = useCallback((active:boolean) => {
    introActiveRef.current = active;
    setIsIntroActiveState(active);
    if (active) {
      shouldPlayRef.current = false;
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      shouldPlayRef.current = true;
      // Deliberately do not defer this call. When the intro is skipped by a tap,
      // keeping play() inside that same user gesture lets iOS unlock the audio.
      startIndex(currentTrackIndexRef.current);
    }
  }, [startIndex]);

  useEffect(() => {
    const resume = () => {
      const audio = audioRef.current;
      if (!introActiveRef.current && appActiveRef.current && shouldPlayRef.current && audio?.paused && tracksRef.current.length) {
        audio.play().then(()=>setIsPlaying(true)).catch(()=>setIsPlaying(false));
      }
    };
    const resumeWhenVisible = () => {
      appActiveRef.current = nativeActiveRef.current && document.visibilityState === 'visible';
      if (appActiveRef.current) resume();
      else audioRef.current?.pause();
    };
    window.addEventListener('pointerdown', resume, { passive:true });
    window.addEventListener('touchend', resume, { passive:true });
    window.addEventListener('keydown', resume);
    window.addEventListener('pageshow', resume);
    document.addEventListener('visibilitychange', resumeWhenVisible);

    let removeNativeListener:(()=>Promise<void>)|null=null;
    let nativeListenerActive=true;
    if (Capacitor.isNativePlatform()) {
      void CapacitorApp.addListener('appStateChange', ({isActive}) => {
        if(!nativeListenerActive)return;
        nativeActiveRef.current=isActive;
        appActiveRef.current = isActive && document.visibilityState==='visible';
        if (appActiveRef.current) resume();
        else {
          audioRef.current?.pause();
          setIsPlaying(false);
        }
      }).then(handle => { if(nativeListenerActive)removeNativeListener = () => handle.remove();else void handle.remove(); });
    }

    return () => {
      nativeListenerActive=false;
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('touchend', resume);
      window.removeEventListener('keydown', resume);
      window.removeEventListener('pageshow', resume);
      document.removeEventListener('visibilitychange', resumeWhenVisible);
      void removeNativeListener?.();
    };
  }, []);

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

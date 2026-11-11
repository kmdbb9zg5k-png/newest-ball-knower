import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { globalSoundtrackEngine, SoundtrackTrack } from './soundtrackEngine';
import { loadUserState, saveUserState } from './userStateCloud';
import { keepActiveSoundtrackTrack, soundtrackVolume } from './soundtrackPolicy';

type PlaybackPosition = { elapsed: number; duration: number };

type MediaTrack = SoundtrackTrack & { url?: string; manualOnly?: boolean };

interface SoundtrackContextType {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTrack: MediaTrack;
  currentTrackIndex: number;
  allTracks: MediaTrack[];
  toggleMute: () => void;
  setVolume: (vol: number, unmute?: boolean) => void;
  shuffle: boolean;
  repeat: boolean;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  observePosition: (listener: (position: PlaybackPosition) => void) => () => void;
  seek: (seconds: number) => void;
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

// Randomize every eligible song once per cycle, instead of replaying the same
// handful while other songs never get heard. The first song also avoids the
// last one played on the previous app launch when alternatives are available.
const shuffledTrackOrder = (tracks: MediaTrack[], excludedIndex = -1) => {
  const remaining = automaticTrackIndexes(tracks);
  const order: number[] = [];
  while (remaining.length) {
    const pick = Math.floor(Math.random() * remaining.length);
    order.push(remaining.splice(pick, 1)[0]);
  }
  if (order.length > 1 && order[0] === excludedIndex) {
    const replacement = 1 + Math.floor(Math.random() * (order.length - 1));
    [order[0], order[replacement]] = [order[replacement], order[0]];
  }
  return order;
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

function soundtrackGain(audio: HTMLAudioElement) {
  // iOS can accept assignments to media volume without attenuating the sound.
  const iOS = /iPhone|iPad|iPod/.test(window.navigator?.userAgent ?? '') ||
    (window.navigator?.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  audio.volume = .5;
  const needsGain = iOS || audio.volume !== .5;
  audio.volume = 1;
  const AudioContextClass = window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!needsGain || !AudioContextClass) return null;

  let context: AudioContext | undefined;
  try {
    context = new AudioContextClass();
    const gain = context.createGain();
    gain.connect(context.destination);
    context.createMediaElementSource(audio).connect(gain);
    // Set before assigning a source. The public soundtrack store permits CORS.
    audio.crossOrigin = 'anonymous';
    return { context, gain };
  } catch {
    void context?.close().catch(() => {});
    return null;
  }
}

export const SoundtrackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gainRef = useRef<ReturnType<typeof soundtrackGain>>(null);
  const resumeGain = useCallback(() => {
    const context = gainRef.current?.context;
    if (context && context.state !== 'running') void context.resume().catch(() => {});
  }, []);
  const tracksRef = useRef<MediaTrack[]>([]);
  const shouldPlayRef = useRef(false);
  const introActiveRef = useRef(true);
  const appActiveRef = useRef(document.visibilityState==='visible');
  const nativeActiveRef = useRef(true);
  const currentTrackIndexRef = useRef(0);
  const shuffleQueueRef = useRef<number[]>([]);
  const takeShuffledTrackIndex = (loaded: MediaTrack[], excludedIndex = -1) => {
    const allowed = new Set(automaticTrackIndexes(loaded));
    let queue = shuffleQueueRef.current.filter(index => allowed.has(index) && index !== excludedIndex);
    if (!queue.length) queue = shuffledTrackOrder(loaded, excludedIndex);
    const next = queue.shift() ?? 0;
    shuffleQueueRef.current = queue;
    return next;
  };
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
  const [shuffle, setShuffle] = useState(true);
  const shuffleRef = useRef(true);
  const [repeat, setRepeat] = useState(false);
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
        const order = shuffledTrackOrder(loaded, lastIndex);
        const nextIndex = order.shift() ?? 0;
        shuffleQueueRef.current = order;
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
      gainRef.current = soundtrackGain(audio);
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const advance = () => {
        const loaded = tracksRef.current;
        const index = currentTrackIndexRef.current;
        const nextIndex = shuffleRef.current ? takeShuffledTrackIndex(loaded, index) : adjacentTrackIndex(loaded, index, 1);
        const track = loaded[nextIndex];
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
        void gainRef.current?.context.close().catch(() => {});
        gainRef.current = null;
        recoveredTrackUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        recoveredTrackUrlsRef.current.clear();
      };
    }
  }, []);

  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const graph = gainRef.current;
    if (graph) graph.gain.gain.value = isMuted ? 0 : volume;
    else {
      a.volume = volume;
      a.muted = isMuted || volume === 0;
    }
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

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = repeat;
  }, [repeat]);

  const observePosition = useCallback((listener: (position: PlaybackPosition) => void) => {
    const audio = audioRef.current;
    if (!audio) return () => {};
    const update = () => listener({
      elapsed: audio.currentTime || 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
    });
    const events = ['timeupdate', 'durationchange', 'emptied', 'seeked'];
    events.forEach(event => audio.addEventListener(event, update));
    update();
    return () => events.forEach(event => audio.removeEventListener(event, update));
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (audio && Number.isFinite(audio.duration) && Number.isFinite(seconds)) {
      audio.currentTime = Math.min(audio.duration, Math.max(0, seconds));
    }
  }, []);

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
    resumeGain();
    a.play().then(()=>setIsPlaying(true)).catch(()=>setIsPlaying(false));
  }, [tracks,resumeGain]);

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
  const setVolume = useCallback((value: number, unmute = false) => {
    preferencesEditedRef.current = true;
    const nextVolume = soundtrackVolume(value);
    setVolumeState(nextVolume);
    if (unmute && nextVolume > 0) setIsMuted(false);
  }, []);
  const toggleShuffle = useCallback(() => {
    shuffleRef.current = !shuffleRef.current;
    shuffleQueueRef.current = [];
    setShuffle(shuffleRef.current);
  }, []);
  const toggleRepeat = useCallback(() => setRepeat(value => !value), []);
  const selectTrack = useCallback((i:number) => {
    // Explicit selection counts as hearing this song in the current shuffle.
    shuffleQueueRef.current = shuffleQueueRef.current.filter(index => index !== i);
    startIndex(i);
  }, [startIndex]);
  const nextTrack = useCallback(() => startIndex(shuffleRef.current
    ? takeShuffledTrackIndex(tracks, currentTrackIndex)
    : adjacentTrackIndex(tracks, currentTrackIndex, 1)), [startIndex,tracks,currentTrackIndex]);
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
      if (introActiveRef.current || !appActiveRef.current || !shouldPlayRef.current || !audio || !tracksRef.current.length) return;
      resumeGain();
      if (audio.paused) audio.play().then(()=>setIsPlaying(true)).catch(()=>setIsPlaying(false));
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
  }, [resumeGain]);

  const playDraftPickSfx = useCallback(()=>globalSoundtrackEngine.playDraftPickSound(),[]);
  const playRemoveSfx = useCallback(()=>globalSoundtrackEngine.playRemovePlayerSound(),[]);
  const playLockSfx = useCallback(()=>globalSoundtrackEngine.playRosterLockedSound(),[]);
  const playWarningSfx = useCallback(()=>globalSoundtrackEngine.playWarningSound(),[]);
  const currentTrack = tracks[currentTrackIndex % Math.max(1,tracks.length)] || FALLBACK_TRACK;

  return <SoundtrackContext.Provider value={{isPlaying,isMuted,volume,currentTrack,currentTrackIndex,allTracks:tracks,toggleMute,setVolume,shuffle,repeat,toggleShuffle,toggleRepeat,observePosition,seek,nextTrack,prevTrack,selectTrack,play,pause,playDraftPickSfx,playRemoveSfx,playLockSfx,playWarningSfx,setIntroActive,isIntroActive}}>{children}</SoundtrackContext.Provider>;
};

export const useSoundtrack = () => {
  const context = useContext(SoundtrackContext);
  if (!context) throw new Error('useSoundtrack must be used within a SoundtrackProvider');
  return context;
};

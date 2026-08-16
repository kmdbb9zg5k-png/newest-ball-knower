/**
 * BALL KNOWER - Premium NFL Draft Soundtrack & SFX Engine
 * Uses Web Audio API for continuous, zero-latency, high-fidelity cinematic NFL Draft music
 * and crystal-clear broadcast sound effects (Draft pick chime, war-room lock, etc.)
 */

export interface SoundtrackTrack {
  id: string;
  title: string;
  subtitle: string;
  tempoBpm: number;
  mood: string;
  durationSec: number;
}

export const SOUNDTRACK_TRACKS: SoundtrackTrack[] = [
  {
    id: 'track-1-primetime',
    title: 'Primetime Draft Night',
    subtitle: 'Main Theme • Dramatic Brass & Sub 808s',
    tempoBpm: 120,
    mood: 'Epic Broadcast',
    durationSec: 48,
  },
  {
    id: 'track-2-war-room',
    title: 'War Room Tension',
    subtitle: 'Clock Ticking • Minor Suspense Strings',
    tempoBpm: 95,
    mood: 'Tense Strategy',
    durationSec: 44,
  },
  {
    id: 'track-3-championship',
    title: 'Championship Pulse',
    subtitle: 'Stadium Anthem • Driving Energy & Horns',
    tempoBpm: 128,
    mood: 'High Energy',
    durationSec: 40,
  },
  {
    id: 'track-4-franchise-glory',
    title: 'Franchise Glory',
    subtitle: 'Orchestral Fanfare • Triumphant Brass',
    tempoBpm: 100,
    mood: 'Triumphant',
    durationSec: 48,
  },
  {
    id: 'track-5-gridiron-symphony',
    title: 'Gridiron Symphony',
    subtitle: 'Modern Electronic • Deep Arp Grooves',
    tempoBpm: 112,
    mood: 'Atmospheric',
    durationSec: 42,
  },
  {
    id: 'track-6-32nd-pick',
    title: 'The 32nd Pick',
    subtitle: 'Countdown Beat • Final Round Suspense',
    tempoBpm: 90,
    mood: 'Clutch Drama',
    durationSec: 46,
  },
];

export class SoundtrackEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private isPlaying: boolean = false;
  private isMuted: boolean = false;
  private volume: number = 0.22; // 22% default as requested
  private currentTrackIndex: number = 0;
  private sequenceTimer: any = null;
  private activeNodes: { stop?: () => void; disconnect?: () => void }[] = [];
  private loopInterval: any = null;

  constructor() {
    // Lazy init audio context on first interaction
  }

  private initContext(): boolean {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return false;
      this.ctx = new AudioContextClass();

      // Master output node
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Music sub-bus
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      // SFX sub-bus (independent volume so SFX punch through clearly)
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(1.3, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    return true;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      if (!this.isMuted) {
        this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
      }
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      const target = this.isMuted ? 0 : this.volume;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }
  }

  public startTrack(index: number = 0) {
    if (!this.initContext()) return;
    this.stopCurrentMusic();
    this.isPlaying = true;
    this.currentTrackIndex = (index + SOUNDTRACK_TRACKS.length) % SOUNDTRACK_TRACKS.length;

    const track = SOUNDTRACK_TRACKS[this.currentTrackIndex];
    this.scheduleTrackLoop(track);
  }

  public stop() {
    this.isPlaying = false;
    this.stopCurrentMusic();
  }

  public pause() {
    this.stop();
  }

  public resume() {
    if (!this.isPlaying) {
      this.startTrack(this.currentTrackIndex);
    }
  }

  public nextTrack() {
    this.startTrack(this.currentTrackIndex + 1);
  }

  public prevTrack() {
    this.startTrack(this.currentTrackIndex - 1);
  }

  private stopCurrentMusic() {
    if (this.sequenceTimer) {
      clearTimeout(this.sequenceTimer);
      this.sequenceTimer = null;
    }
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    this.activeNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {}
    });
    this.activeNodes = [];
  }

  // Generate continuous atmospheric draft music using Web Audio synthesis
  private scheduleTrackLoop(track: SoundtrackTrack) {
    if (!this.ctx || !this.musicGain || !this.isPlaying) return;

    const ctx = this.ctx;
    const bpm = track.tempoBpm;
    const beatSec = 60 / bpm;
    const totalBars = 16;
    const loopDuration = totalBars * 4 * beatSec;

    const renderLoop = () => {
      if (!this.isPlaying || !this.ctx || !this.musicGain) return;
      const startTime = this.ctx.currentTime + 0.05;

      switch (track.id) {
        case 'track-1-primetime':
          this.synthesizePrimetimeTheme(startTime, beatSec, totalBars);
          break;
        case 'track-2-war-room':
          this.synthesizeWarRoomTheme(startTime, beatSec, totalBars);
          break;
        case 'track-3-championship':
          this.synthesizeChampionshipPulse(startTime, beatSec, totalBars);
          break;
        case 'track-4-franchise-glory':
          this.synthesizeFranchiseGlory(startTime, beatSec, totalBars);
          break;
        case 'track-5-gridiron-symphony':
          this.synthesizeGridironSymphony(startTime, beatSec, totalBars);
          break;
        case 'track-6-32nd-pick':
        default:
          this.synthesize32ndPick(startTime, beatSec, totalBars);
          break;
      }

      // Schedule next loop seamlessly
      this.sequenceTimer = setTimeout(() => {
        if (this.isPlaying) {
          renderLoop();
        }
      }, (loopDuration - 0.2) * 1000);
    };

    renderLoop();
  }

  // ================= THEME 1: PRIMETIME DRAFT NIGHT =================
  private synthesizePrimetimeTheme(startTime: number, beatSec: number, totalBars: number) {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const dest = this.musicGain;

    // Chord progression (F minor -> Db -> Eb -> C)
    const chords = [
      { bass: 43.65, notes: [174.61, 207.65, 261.63] }, // F1, F3, Ab3, C4
      { bass: 34.65, notes: [138.59, 174.61, 207.65] }, // Db1, Db3, F3, Ab3
      { bass: 38.89, notes: [155.56, 196.00, 233.08] }, // Eb1, Eb3, G3, Bb3
      { bass: 32.70, notes: [130.81, 164.81, 196.00] }, // C1, C3, E3, G3
    ];

    for (let bar = 0; bar < totalBars; bar++) {
      const chord = chords[bar % 4];
      const barTime = startTime + bar * 4 * beatSec;

      // Deep 808 Sub-bass pulse
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(chord.bass * 2, barTime);
      subOsc.frequency.exponentialRampToValueAtTime(chord.bass, barTime + 0.1);

      subGain.gain.setValueAtTime(0.5, barTime);
      subGain.gain.exponentialRampToValueAtTime(0.01, barTime + 4 * beatSec);
      subOsc.connect(subGain);
      subGain.connect(dest);
      subOsc.start(barTime);
      subOsc.stop(barTime + 4 * beatSec);
      this.activeNodes.push(subOsc);

      // Warm orchestral string pad (lowpass filtered saw)
      chord.notes.forEach((freq, idx) => {
        const padOsc = ctx.createOscillator();
        const padFilter = ctx.createBiquadFilter();
        const padGain = ctx.createGain();

        padOsc.type = 'sawtooth';
        padOsc.frequency.setValueAtTime(freq, barTime);

        padFilter.type = 'lowpass';
        padFilter.frequency.setValueAtTime(450 + (bar % 4) * 80, barTime);
        padFilter.Q.setValueAtTime(2, barTime);

        padGain.gain.setValueAtTime(0.01, barTime);
        padGain.gain.linearRampToValueAtTime(0.08, barTime + 0.8);
        padGain.gain.linearRampToValueAtTime(0.01, barTime + 3.8 * beatSec);

        padOsc.connect(padFilter);
        padFilter.connect(padGain);
        padGain.connect(dest);
        padOsc.start(barTime);
        padOsc.stop(barTime + 4 * beatSec);
        this.activeNodes.push(padOsc);
      });

      // Draft broadcast brass stabs (Beats 1 and 3.5)
      [0, 2.5].forEach(beatOffset => {
        const brassTime = barTime + beatOffset * beatSec;
        const brassOsc1 = ctx.createOscillator();
        const brassOsc2 = ctx.createOscillator();
        const brassFilter = ctx.createBiquadFilter();
        const brassGain = ctx.createGain();

        brassOsc1.type = 'sawtooth';
        brassOsc2.type = 'sawtooth';
        brassOsc1.frequency.setValueAtTime(chord.notes[0] * 2, brassTime);
        brassOsc2.frequency.setValueAtTime(chord.notes[2] * 2 + 1.5, brassTime); // detuned

        brassFilter.type = 'lowpass';
        brassFilter.frequency.setValueAtTime(2200, brassTime);
        brassFilter.frequency.exponentialRampToValueAtTime(600, brassTime + 0.6);

        brassGain.gain.setValueAtTime(0.12, brassTime);
        brassGain.gain.exponentialRampToValueAtTime(0.001, brassTime + 0.7);

        brassOsc1.connect(brassFilter);
        brassOsc2.connect(brassFilter);
        brassFilter.connect(brassGain);
        brassGain.connect(dest);

        brassOsc1.start(brassTime);
        brassOsc2.start(brassTime);
        brassOsc1.stop(brassTime + 0.7);
        brassOsc2.stop(brassTime + 0.7);
        this.activeNodes.push(brassOsc1, brassOsc2);
      });

      // Tight hi-hat rhythm (every 8th note)
      for (let step = 0; step < 8; step++) {
        const hatTime = barTime + step * (beatSec / 2);
        this.triggerHiHat(hatTime, step % 2 === 0 ? 0.05 : 0.025);
      }
    }
  }

  // ================= THEME 2: WAR ROOM TENSION =================
  private synthesizeWarRoomTheme(startTime: number, beatSec: number, totalBars: number) {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const dest = this.musicGain;

    const baseNote = 110; // A2
    for (let bar = 0; bar < totalBars; bar++) {
      const barTime = startTime + bar * 4 * beatSec;

      // Minor suspense pulsing drone
      const droneOsc = ctx.createOscillator();
      const droneFilter = ctx.createBiquadFilter();
      const droneGain = ctx.createGain();

      droneOsc.type = 'triangle';
      const rootFreq = bar % 2 === 0 ? baseNote : baseNote * 0.9438; // A to G#
      droneOsc.frequency.setValueAtTime(rootFreq, barTime);

      droneFilter.type = 'lowpass';
      droneFilter.frequency.setValueAtTime(320, barTime);

      droneGain.gain.setValueAtTime(0.15, barTime);
      droneGain.gain.linearRampToValueAtTime(0.12, barTime + 2 * beatSec);
      droneGain.gain.linearRampToValueAtTime(0.01, barTime + 4 * beatSec);

      droneOsc.connect(droneFilter);
      droneFilter.connect(droneGain);
      droneGain.connect(dest);
      droneOsc.start(barTime);
      droneOsc.stop(barTime + 4 * beatSec);
      this.activeNodes.push(droneOsc);

      // Fast War-Room Clock Ticking (16th notes)
      for (let t = 0; t < 16; t++) {
        const tickTime = barTime + t * (beatSec / 4);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(t % 4 === 0 ? 2400 : 1800, tickTime);
        gain.gain.setValueAtTime(t % 4 === 0 ? 0.04 : 0.015, tickTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, tickTime + 0.03);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(tickTime);
        osc.stop(tickTime + 0.03);
        this.activeNodes.push(osc);
      }

      // Heartbeat sub pulse on beats 1 and 3
      [0, 2].forEach(beat => {
        const kickTime = barTime + beat * beatSec;
        const kickOsc = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(90, kickTime);
        kickOsc.frequency.exponentialRampToValueAtTime(35, kickTime + 0.15);
        kickGain.gain.setValueAtTime(0.4, kickTime);
        kickGain.gain.exponentialRampToValueAtTime(0.001, kickTime + 0.3);

        kickOsc.connect(kickGain);
        kickGain.connect(dest);
        kickOsc.start(kickTime);
        kickOsc.stop(kickTime + 0.3);
        this.activeNodes.push(kickOsc);
      });
    }
  }

  // ================= THEME 3: CHAMPIONSHIP PULSE =================
  private synthesizeChampionshipPulse(startTime: number, beatSec: number, totalBars: number) {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const dest = this.musicGain;

    const progression = [130.81, 164.81, 196.0, 220.0]; // C3, E3, G3, A3
    for (let bar = 0; bar < totalBars; bar++) {
      const barTime = startTime + bar * 4 * beatSec;
      const root = progression[bar % 4];

      // Driving electro-synth bass (8th note pumping)
      for (let s = 0; s < 8; s++) {
        const stepTime = barTime + s * (beatSec / 2);
        const synth = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        synth.type = 'sawtooth';
        synth.frequency.setValueAtTime(root / 2, stepTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, stepTime);
        filter.frequency.exponentialRampToValueAtTime(200, stepTime + beatSec / 2);

        gain.gain.setValueAtTime(0.12, stepTime);
        gain.gain.exponentialRampToValueAtTime(0.01, stepTime + (beatSec / 2) * 0.9);

        synth.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        synth.start(stepTime);
        synth.stop(stepTime + beatSec / 2);
        this.activeNodes.push(synth);
      }

      // Stadium brass hook on bar 1 and 3
      if (bar % 2 === 0) {
        [0, 1.5, 3].forEach((b, i) => {
          const brassTime = barTime + b * beatSec;
          const horn = ctx.createOscillator();
          const hornGain = ctx.createGain();
          horn.type = 'square';
          horn.frequency.setValueAtTime(root * (i === 0 ? 1.5 : i === 1 ? 2 : 2.5), brassTime);
          hornGain.gain.setValueAtTime(0.06, brassTime);
          hornGain.gain.exponentialRampToValueAtTime(0.001, brassTime + 0.4);

          horn.connect(hornGain);
          hornGain.connect(dest);
          horn.start(brassTime);
          horn.stop(brassTime + 0.4);
          this.activeNodes.push(horn);
        });
      }
    }
  }

  // ================= THEME 4: FRANCHISE GLORY =================
  private synthesizeFranchiseGlory(startTime: number, beatSec: number, totalBars: number) {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const dest = this.musicGain;

    const chords = [
      [146.83, 185.0, 220.0], // D major
      [164.81, 196.0, 246.94], // E minor
      [174.61, 220.0, 261.63], // F# minor
      [196.0, 246.94, 293.66], // G major
    ];

    for (let bar = 0; bar < totalBars; bar++) {
      const barTime = startTime + bar * 4 * beatSec;
      const chord = chords[bar % 4];

      // Majestic string swells
      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, barTime);
        gain.gain.setValueAtTime(0.01, barTime);
        gain.gain.linearRampToValueAtTime(0.07, barTime + 1.2);
        gain.gain.linearRampToValueAtTime(0.01, barTime + 3.9 * beatSec);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(barTime);
        osc.stop(barTime + 4 * beatSec);
        this.activeNodes.push(osc);
      });

      // Timpani roll impact on beat 1
      const timpani = ctx.createOscillator();
      const timpaniGain = ctx.createGain();
      timpani.type = 'sine';
      timpani.frequency.setValueAtTime(110, barTime);
      timpani.frequency.exponentialRampToValueAtTime(45, barTime + 0.8);
      timpaniGain.gain.setValueAtTime(0.4, barTime);
      timpaniGain.gain.exponentialRampToValueAtTime(0.001, barTime + 1.0);

      timpani.connect(timpaniGain);
      timpaniGain.connect(dest);
      timpani.start(barTime);
      timpani.stop(barTime + 1.0);
      this.activeNodes.push(timpani);
    }
  }

  // ================= THEME 5: GRIDIRON SYMPHONY =================
  private synthesizeGridironSymphony(startTime: number, beatSec: number, totalBars: number) {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const dest = this.musicGain;

    const scale = [174.61, 196.0, 207.65, 233.08, 261.63, 293.66, 311.13, 349.23];
    for (let bar = 0; bar < totalBars; bar++) {
      const barTime = startTime + bar * 4 * beatSec;

      // Arpeggiated sequence (16th notes)
      for (let s = 0; s < 16; s++) {
        const stepTime = barTime + s * (beatSec / 4);
        const noteFreq = scale[(s * 2 + bar) % scale.length];
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(noteFreq, stepTime);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200 + Math.sin(s) * 400, stepTime);
        filter.Q.setValueAtTime(3, stepTime);

        gain.gain.setValueAtTime(0.04, stepTime);
        gain.gain.exponentialRampToValueAtTime(0.001, stepTime + 0.12);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        osc.start(stepTime);
        osc.stop(stepTime + 0.15);
        this.activeNodes.push(osc);
      }

      // Smooth warm bass foundation
      const bass = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bass.type = 'sine';
      bass.frequency.setValueAtTime(87.31, barTime); // F2
      bassGain.gain.setValueAtTime(0.3, barTime);
      bassGain.gain.linearRampToValueAtTime(0.1, barTime + 3.8 * beatSec);
      bass.connect(bassGain);
      bassGain.connect(dest);
      bass.start(barTime);
      bass.stop(barTime + 4 * beatSec);
      this.activeNodes.push(bass);
    }
  }

  // ================= THEME 6: THE 32ND PICK =================
  private synthesize32ndPick(startTime: number, beatSec: number, totalBars: number) {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const dest = this.musicGain;

    for (let bar = 0; bar < totalBars; bar++) {
      const barTime = startTime + bar * 4 * beatSec;

      // Dramatic low drone with pitch bend
      const drone = ctx.createOscillator();
      const droneGain = ctx.createGain();
      drone.type = 'sawtooth';
      drone.frequency.setValueAtTime(55, barTime); // A1
      if (bar % 4 === 3) {
        drone.frequency.linearRampToValueAtTime(51.91, barTime + 3 * beatSec); // G#1 drop
      }

      const droneFilter = ctx.createBiquadFilter();
      droneFilter.type = 'lowpass';
      droneFilter.frequency.setValueAtTime(240, barTime);

      droneGain.gain.setValueAtTime(0.18, barTime);
      droneGain.gain.linearRampToValueAtTime(0.02, barTime + 3.9 * beatSec);

      drone.connect(droneFilter);
      droneFilter.connect(droneGain);
      droneGain.connect(dest);
      drone.start(barTime);
      drone.stop(barTime + 4 * beatSec);
      this.activeNodes.push(drone);

      // Subtle atmospheric noise riser
      this.triggerAtmosphereSweep(barTime + 2 * beatSec, 2 * beatSec);
    }
  }

  private triggerHiHat(time: number, volume: number) {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const bufferSize = ctx.sampleRate * 0.03;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8000, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    noise.start(time);
    this.activeNodes.push(noise);
  }

  private triggerAtmosphereSweep(time: number, duration: number) {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, time);
    filter.frequency.exponentialRampToValueAtTime(2400, time + duration);
    filter.Q.setValueAtTime(4, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.03, time + duration * 0.8);
    gain.gain.linearRampToValueAtTime(0.0001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    noise.start(time);
    this.activeNodes.push(noise);
  }

  // ================= DRAFT SOUND EFFECTS (PLAY OVER MUSIC) =================

  /**
   * Commissioner "The Pick Is In" Chime + Sub Drop Impact
   */
  public playDraftPickSound() {
    if (!this.initContext() || this.isMuted || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dest = this.sfxGain;

    // Chime Note 1 (High Crystal)
    const chime1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    chime1.type = 'sine';
    chime1.frequency.setValueAtTime(1046.5, now); // C6
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    chime1.connect(gain1);
    gain1.connect(dest);
    chime1.start(now);
    chime1.stop(now + 0.6);

    // Chime Note 2 (Major Third Up - E6)
    const chime2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    chime2.type = 'sine';
    chime2.frequency.setValueAtTime(1318.51, now + 0.08); // E6
    gain2.gain.setValueAtTime(0.4, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    chime2.connect(gain2);
    gain2.connect(dest);
    chime2.start(now + 0.08);
    chime2.stop(now + 0.8);

    // Draft Room Heavy Sub Impact
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, now);
    sub.frequency.exponentialRampToValueAtTime(35, now + 0.45);
    subGain.gain.setValueAtTime(0.6, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    sub.connect(subGain);
    subGain.connect(dest);
    sub.start(now);
    sub.stop(now + 0.5);
  }

  /**
   * Player Removed Woosh Sound
   */
  public playRemovePlayerSound() {
    if (!this.initContext() || this.isMuted || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dest = this.sfxGain;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.25);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Official Roster Lock Gavel + Stadium Fanfare
   */
  public playRosterLockedSound() {
    if (!this.initContext() || this.isMuted || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dest = this.sfxGain;

    // Gavel strike heavy impact
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(180, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.8);
    subGain.gain.setValueAtTime(0.8, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    sub.connect(subGain);
    subGain.connect(dest);
    sub.start(now);
    sub.stop(now + 0.9);

    // Fanfare triad chords (C5 -> E5 -> G5 -> C6)
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const fanfare = ctx.createOscillator();
      const fGain = ctx.createGain();
      fanfare.type = 'triangle';
      fanfare.frequency.setValueAtTime(freq, now + i * 0.09);
      fGain.gain.setValueAtTime(0.35, now + i * 0.09);
      fGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.8);
      fanfare.connect(fGain);
      fGain.connect(dest);
      fanfare.start(now + i * 0.09);
      fanfare.stop(now + i * 0.09 + 0.8);
    });
  }

  /**
   * Salary Cap Warning Sound
   */
  public playWarningSound() {
    if (!this.initContext() || this.isMuted || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dest = this.sfxGain;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getVolume(): number {
    return this.volume;
  }

  public getCurrentTrackIndex(): number {
    return this.currentTrackIndex;
  }
}

// Global singleton instance for seamless app-wide audio persistence
export const globalSoundtrackEngine = new SoundtrackEngine();

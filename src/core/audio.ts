import { CdMusic } from './cdMusic';
import { ChipMusic } from './music';

/** Which soundtrack: MUSIC's chiptune, CD AUDIO's full track, or silence. */
export type MusicTrack = 'chip' | 'cd' | null;

/**
 * Procedural audio via Web Audio. Browsers only allow audio after a user gesture, so
 * `unlock()` is called from the first key/pointer press (the tape loader's
 * "PRESS ANY KEY TO START TAPE").
 */

/** One segment of a tape load, in seconds from the start of the tape. */
export interface TapeSegment {
  kind: 'pilot' | 'data';
  start: number;
  end: number;
}

export interface TapeHandle {
  /** Cut all tape sound immediately (skip, or the hard cut at the end). */
  stop(): void;
}

export type SfxName =
  | 'jump'
  | 'land'
  | 'punch'
  | 'enemyDie'
  | 'die'
  | 'pickup'
  | 'bossHit'
  | 'clank'
  | 'bossLand'
  | 'bossDie'
  | 'throw'
  | 'switch'
  | 'flag'
  | 'swing'
  | 'clang'
  | 'step'
  | 'slam'
  | 'dash'
  | 'talk'
  | 'save'
  | 'splash'
  | 'ignite'
  | 'glitch'
  | 'voiceHup'
  | 'voiceHah'
  | 'voiceOof'
  | 'voiceNpc'
  | 'voiceBoss'
  | 'smash'
  | 'shatter'
  | 'zap'
  | 'alarm'
  | 'shutter'
  | 'deprecate'
  | 'reclaim'
  | 'beam'
  | 'restore'
  | 'achievement';

/** Vowel formants (Hz): F1, F2, F3. */
const VOWELS = {
  a: [800, 1150, 2900],
  e: [400, 2000, 2600],
  i: [300, 2300, 3000],
  o: [450, 800, 2830],
  u: [325, 700, 2530],
  uh: [600, 1000, 2500],
} as const;
type Vowel = keyof typeof VOWELS;

export interface SfxOptions {
  /** -1 (left) .. 1 (right). STEREO. */
  pan?: number;
  /** SAMPLES: a fuller, roomier sound. */
  rich?: boolean;
  /** 0..1 volume scale (distant footsteps are quieter). */
  volume?: number;
}

const PILOT_HZ = 807;
const BIT0_HZ = 2000;
const BIT1_HZ = 1000;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private chip: ChipMusic | null = null;
  private cd: CdMusic | null = null;
  private track: MusicTrack = null;
  /** Where sweep() and noise() send their output while a sound is being built. */
  private bus: AudioNode | null = null;
  private reverb: ConvolverNode | null = null;

  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch {
        return; // No Web Audio: the game stays silent.
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().then(() => this.syncMusic());
    } else {
      this.syncMusic();
    }
  }

  /** Choose the soundtrack. Starts as soon as audio is allowed; tracks crossfade. */
  setMusic(track: MusicTrack): void {
    this.track = track;
    this.syncMusic();
  }

  private syncMusic(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || ctx.state !== 'running') return;
    const noise = () => (this.noiseBuffer ??= makeNoiseBuffer(ctx));
    if (this.track === 'chip') {
      this.cd?.stop();
      this.chip ??= new ChipMusic(ctx, master, noise);
      this.chip.start();
    } else if (this.track === 'cd') {
      // The chiptune gives way to the "real" soundtrack.
      this.chip?.stop(1.5);
      this.cd ??= new CdMusic(ctx, master, noise);
      this.cd.start();
    } else {
      this.chip?.stop();
      this.cd?.stop();
    }
  }

  /** ADAPTIVE MUSIC: how much danger there is (0..1). Only the CD track listens. */
  setIntensity(value: number): void {
    this.cd?.setIntensity(value);
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Era 0's only sound: one square-wave beep. */
  beep(frequency = 880, duration = 0.07): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.setValueAtTime(0.18, t + duration * 0.8);
    gain.gain.linearRampToValueAtTime(0, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  /**
   * Sound effects, all synthesized. Era 1 sounds are simple one-voice blips. With
   * SAMPLES + STEREO (`rich` + `pan`) the same sounds play through a small room and sit
   * in the stereo field.
   */
  sfx(name: SfxName, options: SfxOptions = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.value = options.volume ?? 1;
    let tail: AudioNode = bus;
    if (options.pan) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, options.pan));
      tail = tail.connect(panner);
    }
    tail.connect(this.master);
    if (options.rich) {
      this.reverb ??= makeReverb(ctx, this.master);
      tail.connect(this.reverb);
    }
    this.bus = bus;
    this.playSfx(name, t, options.rich === true);
    this.bus = null;
    // Let the graph be collected once the longest sound has finished.
    setTimeout(() => bus.disconnect(), 3000);
  }

  private playSfx(name: SfxName, t: number, rich: boolean): void {
    switch (name) {
      case 'jump':
        this.sweep('square', 300, 720, t, 0.12, 0.12);
        break;
      case 'land':
        this.sweep('square', 140, 90, t, 0.04, 0.08);
        break;
      case 'punch':
        this.noise(t, 0.06, 0.18, 3000);
        break;
      case 'enemyDie':
        this.sweep('square', 700, 90, t, 0.18, 0.14);
        break;
      case 'die':
        this.sweep('square', 880, 55, t, 0.7, 0.16);
        break;
      case 'pickup':
        this.sweep('square', 660, 660, t, 0.07, 0.12);
        this.sweep('square', 990, 990, t + 0.08, 0.1, 0.12);
        break;
      case 'bossHit':
        this.sweep('square', 220, 70, t, 0.2, 0.16);
        this.noise(t, 0.12, 0.2, 1500);
        break;
      case 'clank':
        this.sweep('square', 1400, 1100, t, 0.05, 0.1);
        this.sweep('square', 1100, 1100, t + 0.06, 0.04, 0.06);
        break;
      case 'bossLand':
        this.noise(t, 0.3, 0.3, 400);
        break;
      case 'throw':
        this.sweep('square', 900, 1500, t, 0.06, 0.08);
        break;
      case 'switch':
        this.sweep('square', 400, 400, t, 0.06, 0.12);
        this.sweep('square', 600, 600, t + 0.07, 0.06, 0.12);
        this.sweep('square', 800, 800, t + 0.14, 0.12, 0.12);
        break;
      case 'flag':
        this.sweep('square', 523, 523, t, 0.08, 0.1);
        this.sweep('square', 659, 659, t + 0.09, 0.08, 0.1);
        this.sweep('square', 784, 784, t + 0.18, 0.08, 0.1);
        this.sweep('square', 1047, 1047, t + 0.27, 0.16, 0.1);
        break;
      case 'swing':
        // A whoosh: filtered noise sweeping up.
        this.noise(t, 0.14, 0.22, 900, 'bandpass', 3200);
        break;
      case 'clang':
        // Metal: inharmonic partials ringing out.
        for (const [hz, v] of [
          [1180, 0.07],
          [1630, 0.05],
          [2350, 0.04],
          [3170, 0.03],
        ]) {
          this.sweep(rich ? 'sine' : 'square', hz, hz * 0.98, t, 0.3, v);
        }
        this.noise(t, 0.05, 0.15, 5000, 'highpass');
        break;
      case 'step':
        this.noise(t, 0.06, 0.3, 450);
        this.sweep('sine', 110, 60, t, 0.05, 0.15);
        break;
      case 'slam':
        this.noise(t, 0.5, 0.45, 300);
        this.sweep('sine', 90, 35, t, 0.4, 0.35);
        break;
      case 'dash':
        this.noise(t, 0.16, 0.18, 1500, 'highpass', 6000);
        break;
      case 'talk':
        this.sweep('square', 560 + Math.random() * 160, 600, t, 0.03, 0.04);
        break;
      case 'save':
        // A floppy drive grinding away.
        for (let i = 0; i < 6; i++) {
          this.sweep('square', 85 + (i % 2) * 20, 85, t + i * 0.09, 0.07, 0.05);
          this.noise(t + i * 0.09, 0.05, 0.08, 2500, 'bandpass');
        }
        break;
      case 'splash':
        this.noise(t, 0.25, 0.25, 1800, 'bandpass', 600);
        this.noise(t + 0.05, 0.15, 0.12, 4000, 'highpass');
        break;
      case 'ignite':
        this.noise(t, 0.4, 0.3, 300, 'lowpass', 2500);
        break;
      case 'glitch':
        // Digital tearing: random square bursts.
        for (let i = 0; i < 10; i++) {
          this.sweep(
            'square',
            80 + Math.random() * 2000,
            60 + Math.random() * 3000,
            t + i * 0.05,
            0.05,
            0.08,
          );
        }
        this.noise(t, 0.6, 0.2, 6000, 'highpass');
        break;
      case 'voiceHup':
        this.vowel(t, 0.12, 'uh', 'uh', 230, 270, 0.25, true);
        break;
      case 'voiceHah':
        this.vowel(t, 0.2, 'a', 'a', 210, 170, 0.3, true);
        break;
      case 'voiceOof':
        this.vowel(t, 0.32, 'o', 'u', 190, 120, 0.3, false);
        break;
      case 'voiceNpc': {
        const vowels: Vowel[] = ['a', 'e', 'i', 'o', 'u'];
        const v = vowels[Math.floor(Math.random() * vowels.length)];
        const pitch = 250 + Math.random() * 90;
        this.vowel(t, 0.09, v, v, pitch, pitch * 1.05, 0.18, Math.random() < 0.4);
        break;
      }
      case 'voiceBoss': {
        const vowels: Vowel[] = ['a', 'o', 'uh', 'e'];
        const v = vowels[Math.floor(Math.random() * vowels.length)];
        this.vowel(t, 0.16, v, v, 70 + Math.random() * 15, 62, 0.35, false, true);
        break;
      }
      case 'smash':
        // Concrete giving way: a thump, then crumbling.
        this.sweep('sine', 120, 40, t, 0.35, 0.35);
        this.noise(t, 0.5, 0.4, 900, 'lowpass', 200);
        for (let i = 0; i < 6; i++) {
          this.noise(t + 0.06 + i * 0.05 + Math.random() * 0.03, 0.06, 0.15, 2500, 'bandpass');
        }
        break;
      case 'shatter':
        // Glass: a bright crash and tinkling bits.
        this.noise(t, 0.3, 0.3, 5000, 'highpass');
        for (let i = 0; i < 9; i++) {
          const hz = 2500 + Math.random() * 3500;
          this.sweep('sine', hz, hz * 0.97, t + i * 0.035 + Math.random() * 0.04, 0.12, 0.05);
        }
        break;
      case 'zap':
        this.sweep('sawtooth', 2400, 120, t, 0.22, 0.14);
        this.sweep('square', 1800, 90, t, 0.18, 0.08);
        this.noise(t, 0.2, 0.18, 3000, 'highpass');
        break;
      case 'alarm':
        // The drone's "!": two quick rising chirps.
        this.sweep('square', 900, 1300, t, 0.07, 0.07);
        this.sweep('square', 900, 1300, t + 0.1, 0.07, 0.07);
        break;
      case 'shutter':
        this.noise(t, 0.03, 0.3, 4000, 'highpass');
        this.noise(t + 0.07, 0.04, 0.22, 2500, 'bandpass');
        break;
      case 'deprecate':
        // Everything powering down.
        this.sweep('sawtooth', 900, 30, t, 1.1, 0.16);
        this.sweep('square', 450, 25, t + 0.05, 1.0, 0.08);
        this.noise(t, 1.1, 0.2, 4000, 'lowpass', 120);
        for (let i = 0; i < 6; i++) {
          this.sweep('square', 200 + Math.random() * 1500, 50, t + i * 0.12, 0.06, 0.06);
        }
        break;
      case 'reclaim':
        [523, 659, 784, 1047, 1319].forEach((hz, i) => {
          this.sweep(rich ? 'triangle' : 'square', hz, hz, t + i * 0.06, 0.18, 0.08);
        });
        break;
      case 'beam':
        this.noise(t, 0.45, 0.32, 1800, 'bandpass', 500);
        this.sweep('sawtooth', 160, 40, t, 0.45, 0.18);
        break;
      case 'restore':
        // Everything coming back at once: a huge rising chord and a shimmer.
        for (const [hz, v] of [
          [110, 0.12],
          [165, 0.1],
          [220, 0.1],
          [277, 0.08],
          [330, 0.08],
          [440, 0.06],
        ]) {
          this.sweep('sawtooth', hz / 2, hz * 2, t, 1.6, v);
        }
        for (let i = 0; i < 14; i++) {
          const hz = 1500 + Math.random() * 3000;
          this.sweep('sine', hz, hz, t + 1 + i * 0.07, 0.25, 0.04);
        }
        break;
      case 'achievement':
        this.sweep('sine', 988, 988, t, 0.08, 0.1);
        this.sweep('sine', 1319, 1319, t + 0.08, 0.16, 0.1);
        break;
      case 'bossDie':
        for (let i = 0; i < 8; i++) {
          this.noise(t + i * 0.18, 0.15, 0.22, 900 - i * 80);
          this.sweep('square', 500 - i * 50, 60, t + i * 0.18, 0.16, 0.08);
        }
        break;
    }
  }

  /**
   * VOICE: formant synthesis. A buzzy source through three band-pass filters tuned to a
   * vowel (gliding to another), with a falling or rising pitch. `breath` adds an "h";
   * `menace` distorts it (for the Deprecator).
   */
  private vowel(
    start: number,
    duration: number,
    from: Vowel,
    to: Vowel,
    pitchFrom: number,
    pitchTo: number,
    volume: number,
    breath: boolean,
    menace = false,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const out = this.bus ?? this.master;
    const source = ctx.createOscillator();
    source.type = 'sawtooth';
    source.frequency.setValueAtTime(pitchFrom, start);
    source.frequency.exponentialRampToValueAtTime(pitchTo, start + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(volume, start + 0.015);
    env.gain.setValueAtTime(volume, start + duration * 0.7);
    env.gain.linearRampToValueAtTime(0, start + duration);
    let tail: AudioNode = env;
    if (menace) {
      const shaper = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) curve[i] = Math.tanh((i / 128 - 1) * 4);
      shaper.curve = curve;
      tail = env.connect(shaper);
    }
    VOWELS[from].forEach((freq, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 8 + i * 4;
      filter.frequency.setValueAtTime(freq, start);
      filter.frequency.linearRampToValueAtTime(VOWELS[to][i], start + duration);
      const g = ctx.createGain();
      g.gain.value = [1, 0.6, 0.3][i] * 3;
      source.connect(filter).connect(g).connect(env);
    });
    tail.connect(out);
    source.start(start);
    source.stop(start + duration + 0.02);
    if (breath) this.noise(start, 0.05, volume * 0.5, 2500, 'bandpass');
  }

  private sweep(
    type: OscillatorType,
    from: number,
    to: number,
    start: number,
    duration: number,
    volume: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    osc.connect(gain).connect(this.bus ?? this.master);
    osc.start(start);
    osc.stop(start + duration + 0.01);
  }

  private noise(
    start: number,
    duration: number,
    volume: number,
    cutoff: number,
    type: BiquadFilterType = 'lowpass',
    cutoffEnd?: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    this.noiseBuffer ??= makeNoiseBuffer(ctx);
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(cutoff, start);
    if (cutoffEnd) filter.frequency.exponentialRampToValueAtTime(cutoffEnd, start + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source
      .connect(filter)
      .connect(gain)
      .connect(this.bus ?? this.master);
    source.start(start);
    source.stop(start + duration + 0.01);
  }

  /**
   * Play a cassette load: steady pilot tones and data screech (random bits, each one
   * square cycle at 2kHz or 1kHz, like real tape encoding). It's low-passed and kept
   * quiet, so it's recognisable without being painful.
   */
  playTape(segments: readonly TapeSegment[]): TapeHandle {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return { stop() {} };

    const t0 = ctx.currentTime + 0.05;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2600;
    const bus = ctx.createGain();
    bus.gain.value = 0.11;
    filter.connect(bus).connect(master);

    const sources: AudioScheduledSourceNode[] = [];
    for (const seg of segments) {
      const duration = seg.end - seg.start;
      let source: AudioScheduledSourceNode;
      if (seg.kind === 'pilot') {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = PILOT_HZ;
        source = osc;
      } else {
        const buffer = makeDataBuffer(ctx, duration);
        const node = ctx.createBufferSource();
        node.buffer = buffer;
        source = node;
      }
      source.connect(filter);
      source.start(t0 + seg.start);
      source.stop(t0 + seg.end);
      sources.push(source);
    }

    return {
      stop() {
        for (const s of sources) {
          try {
            s.stop();
          } catch {
            // Already stopped.
          }
        }
        bus.disconnect();
      },
    };
  }
}

/** Random data encoded as square-wave cycles: 0 = short cycle, 1 = long cycle. */
function makeDataBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.ceil(seconds * rate);
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  let i = 0;
  while (i < length) {
    const hz = Math.random() < 0.5 ? BIT0_HZ : BIT1_HZ;
    const half = Math.max(1, Math.round(rate / hz / 2));
    for (let k = 0; k < half && i < length; k++) data[i++] = 0.5;
    for (let k = 0; k < half && i < length; k++) data[i++] = -0.5;
  }
  return buffer;
}

function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** A small room: a stereo impulse of decaying noise, mixed in quietly. */
function makeReverb(ctx: AudioContext, destination: AudioNode): ConvolverNode {
  const length = Math.floor(ctx.sampleRate * 0.6);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
    }
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  const wet = ctx.createGain();
  wet.gain.value = 0.3;
  convolver.connect(wet).connect(destination);
  return convolver;
}

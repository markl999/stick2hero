import { ChipMusic } from './music';

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
  | 'save';

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
  private music: ChipMusic | null = null;
  /** Where sweep() and noise() send their output while a sound is being built. */
  private bus: AudioNode | null = null;
  private reverb: ConvolverNode | null = null;
  private musicWanted = false;

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

  /** MUSIC on or off. Starts as soon as audio is allowed, fading in. */
  setMusic(on: boolean): void {
    this.musicWanted = on;
    this.syncMusic();
  }

  private syncMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (this.musicWanted && ctx.state === 'running') {
      this.music ??= new ChipMusic(
        ctx,
        this.master,
        () => (this.noiseBuffer ??= makeNoiseBuffer(ctx)),
      );
      this.music.start();
    } else if (!this.musicWanted) {
      this.music?.stop();
    }
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
      case 'bossDie':
        for (let i = 0; i < 8; i++) {
          this.noise(t + i * 0.18, 0.15, 0.22, 900 - i * 80);
          this.sweep('square', 500 - i * 50, 60, t + i * 0.18, 0.16, 0.08);
        }
        break;
    }
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

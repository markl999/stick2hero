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
  | 'flag';

const PILOT_HZ = 807;
const BIT0_HZ = 2000;
const BIT1_HZ = 1000;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private music: ChipMusic | null = null;
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

  /** Era 1 SFX: simple one-voice arcade sounds, all synthesized. */
  sfx(name: SfxName): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state !== 'running') return;
    const t = ctx.currentTime;
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
    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.01);
  }

  private noise(start: number, duration: number, volume: number, cutoff: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    this.noiseBuffer ??= makeNoiseBuffer(ctx);
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter).connect(gain).connect(this.master);
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

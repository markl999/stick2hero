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

const PILOT_HZ = 807;
const BIT0_HZ = 2000;
const BIT1_HZ = 1000;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

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
    if (this.ctx.state === 'suspended') void this.ctx.resume();
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

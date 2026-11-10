import { noteToHz } from './music';

/**
 * CD AUDIO (Era 4): a fuller, late-90s style soundtrack, still made entirely in code.
 * An original 16-bar loop in D minor at 96 BPM:
 *   bars 1–8   pads, bass, breakbeat and a quiet arpeggio
 *   bars 9–16  the lead melody comes in (vibrato, echo), drums push harder
 * Everything goes through a reverb so it sounds "produced" next to the chiptune.
 */

const BPM = 96;
const SIXTEENTH = 60 / BPM / 4;
const STEPS_PER_BAR = 16;
const BARS = 16;
const LOOKAHEAD = 0.2;

interface Chord {
  pad: string[];
  arp: string[];
  bass: string;
}

const DM: Chord = { pad: ['D3', 'F3', 'A3', 'D4'], arp: ['D4', 'F4', 'A4', 'D5'], bass: 'D2' };
const BB: Chord = { pad: ['A#2', 'D3', 'F3', 'A#3'], arp: ['A#3', 'D4', 'F4', 'A#4'], bass: 'A#1' };
const F: Chord = { pad: ['F3', 'A3', 'C4', 'F4'], arp: ['F4', 'A4', 'C5', 'F5'], bass: 'F2' };
const C: Chord = { pad: ['C3', 'E3', 'G3', 'C4'], arp: ['C4', 'E4', 'G4', 'C5'], bass: 'C2' };
const GM: Chord = { pad: ['G3', 'A#3', 'D4', 'G4'], arp: ['G4', 'A#4', 'D5', 'G5'], bass: 'G1' };
const A: Chord = { pad: ['A3', 'C#4', 'E4', 'A4'], arp: ['A4', 'C#5', 'E5', 'A5'], bass: 'A1' };

const PROGRESSION = [DM, BB, F, C, DM, BB, GM, A];

// The lead, in eighth notes, for bars 9–16 ('.' rest, '-' hold).
// prettier-ignore
const LEAD = [
  'D5 . F5 . A5 - G5 F5',
  'F5 - D5 . A#4 . C5 D5',
  'C5 . F5 . A5 - G5 A5',
  'G5 - E5 - C5 . D5 E5',
  'F5 . A5 . D6 - C6 A5',
  'A#5 - A5 - F5 . D5 F5',
  'G5 . A#5 . A5 G5 F5 E5',
  'E5 - C#5 - A4 . . .',
].map((bar) => bar.split(/\s+/));

// 16-step drum patterns: K kick, S snare, H hat, O open hat.
const DRUMS_A = 'K.H.S.HKK.H.S.HO';
const DRUMS_B = 'K.HKS.H.K.HKS.HO';

export class CdMusic {
  private readonly out: GainNode;
  private readonly reverb: ConvolverNode;
  private readonly echo: DelayNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
    private readonly noise: () => AudioBuffer,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(destination);

    // A big-ish hall.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = impulse(ctx, 1.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.reverb.connect(wet).connect(this.out);

    // A dotted-eighth echo for the lead.
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = SIXTEENTH * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.35;
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.4;
    this.echo.connect(feedback).connect(this.echo);
    this.echo.connect(echoOut).connect(this.out);
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  start(fadeIn = 2.5): void {
    if (this.timer) return;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0.9, t + fadeIn);
    this.step = 0;
    this.nextTime = t + 0.05;
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  stop(fadeOut = 1): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0, t + fadeOut);
  }

  private schedule(): void {
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += SIXTEENTH;
      this.step = (this.step + 1) % (BARS * STEPS_PER_BAR);
    }
  }

  private playStep(step: number, t: number): void {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const s = step % STEPS_PER_BAR;
    const chord = PROGRESSION[bar % PROGRESSION.length];
    const second = bar >= 8;

    // Pads: one long chord per bar.
    if (s === 0) {
      for (const note of chord.pad) this.pad(noteToHz(note), t, SIXTEENTH * STEPS_PER_BAR);
    }
    // Bass: a pulsing pattern on the root and its octave.
    if ([0, 3, 6, 8, 10, 14].includes(s)) {
      const octave = s === 6 || s === 14;
      const hz = noteToHz(chord.bass) * (octave ? 2 : 1);
      this.bass(hz, t, SIXTEENTH * (s === 0 || s === 8 ? 2.5 : 1.5));
    }
    // Arpeggio in the first half; the lead takes over in the second.
    if (!second && s % 2 === 0) {
      const note = chord.arp[(s / 2) % chord.arp.length];
      this.pluck(noteToHz(note), t, SIXTEENTH * 1.5, 0.035);
    }
    if (second && s % 2 === 0) {
      const eighths = LEAD[bar - 8];
      const i = s / 2;
      const note = eighths[i];
      if (note !== '.' && note !== '-') {
        let length = 1;
        while (eighths[i + length] === '-') length++;
        this.lead(noteToHz(note), t, SIXTEENTH * 2 * length * 0.95);
      }
    }
    // Drums.
    const drum = (second ? DRUMS_B : DRUMS_A)[s];
    if (drum === 'K') this.kick(t);
    else if (drum === 'S') this.snare(t);
    else if (drum === 'H') this.hat(t, 0.03);
    else if (drum === 'O') this.hat(t, 0.12);
  }

  private voice(destination: AudioNode, reverbSend: number): GainNode {
    const g = this.ctx.createGain();
    g.connect(destination);
    if (reverbSend > 0) {
      const send = this.ctx.createGain();
      send.gain.value = reverbSend;
      g.connect(send).connect(this.reverb);
    }
    return g;
  }

  /** Warm, detuned saws through a low-pass filter, swelling in. */
  private pad(hz: number, t: number, duration: number): void {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;
    const env = this.voice(this.out, 0.6);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.022, t + 0.5);
    env.gain.setValueAtTime(0.022, t + duration - 0.3);
    env.gain.linearRampToValueAtTime(0, t + duration + 0.2);
    filter.connect(env);
    for (const detune of [-9, 0, 9]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = hz;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + duration + 0.25);
    }
  }

  private bass(hz: number, t: number, duration: number): void {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(180, t + duration);
    const env = this.voice(this.out, 0);
    env.gain.setValueAtTime(0.16, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + duration);
    filter.connect(env);
    for (const [type, mult] of [
      ['sawtooth', 1],
      ['sine', 0.5],
    ] as const) {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = hz * mult * 2;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    }
  }

  private pluck(hz: number, t: number, duration: number, volume: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = hz;
    const env = this.voice(this.out, 0.5);
    env.gain.setValueAtTime(volume, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(env);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  /** The lead: a filtered square with vibrato, into the echo and the hall. */
  private lead(hz: number, t: number, duration: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = hz;
    const vibrato = this.ctx.createOscillator();
    vibrato.frequency.value = 5.5;
    const depth = this.ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(hz * 0.012, t + Math.min(0.3, duration));
    vibrato.connect(depth).connect(osc.frequency);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    const env = this.voice(this.out, 0.5);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.05, t + 0.02);
    env.gain.setValueAtTime(0.05, t + duration * 0.8);
    env.gain.linearRampToValueAtTime(0, t + duration);
    osc.connect(filter).connect(env);
    env.connect(this.echo);
    osc.start(t);
    vibrato.start(t);
    osc.stop(t + duration + 0.02);
    vibrato.stop(t + duration + 0.02);
  }

  private kick(t: number): void {
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.15);
    const env = this.voice(this.out, 0.1);
    env.gain.setValueAtTime(0.4, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(env);
    osc.start(t);
    osc.stop(t + 0.32);
    this.noiseHit(t, 0.012, 0.15, 3000, 'lowpass', 0);
  }

  private snare(t: number): void {
    this.noiseHit(t, 0.18, 0.16, 1800, 'bandpass', 0.4);
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    const env = this.voice(this.out, 0.3);
    env.gain.setValueAtTime(0.12, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(env);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  private hat(t: number, duration: number): void {
    this.noiseHit(t, duration, 0.045, 8000, 'highpass', 0.15);
  }

  private noiseHit(
    t: number,
    duration: number,
    volume: number,
    cutoff: number,
    type: BiquadFilterType,
    reverbSend: number,
  ): void {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise();
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = cutoff;
    const env = this.voice(this.out, reverbSend);
    env.gain.setValueAtTime(volume, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(filter).connect(env);
    source.start(t);
    source.stop(t + duration + 0.02);
  }
}

function impulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++)
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
  }
  return buffer;
}

/**
 * MUSIC (Era 2): a tiny 3-channel chiptune, played by a look-ahead scheduler.
 *   lead  25% pulse wave
 *   bass  triangle
 *   drums noise (kick, snare, hat)
 * The tune is an original 8-bar loop in A minor, written as note names: '.' is a rest
 * and '-' holds the previous note.
 */

const BPM = 150;
const STEP = 60 / BPM / 2; // eighth notes
const LOOKAHEAD = 0.15;

// prettier-ignore
const LEAD = [
  'A4 C5 E5 A5 G5 E5 C5 E5',
  'F4 A4 C5 F5 E5 C5 A4 C5',
  'G4 B4 D5 G5 F5 D5 B4 D5',
  'E5 -  E5 G#5 B5 - A5 -',
  'A4 C5 E5 A5 B5 A5 G5 E5',
  'F5 E5 D5 C5 D5 E5 F5 A5',
  'G5 F5 E5 D5 C5 B4 C5 D5',
  'E5 -  -  B4 E5 -  -  .',
].join(' ').split(/\s+/);

// Root and fifth per bar: A F G E A F C E.
const BASS_BARS: [string, string][] = [
  ['A2', 'E3'],
  ['F2', 'C3'],
  ['G2', 'D3'],
  ['E2', 'B2'],
  ['A2', 'E3'],
  ['F2', 'C3'],
  ['C3', 'G2'],
  ['E2', 'B2'],
];
const BASS = BASS_BARS.flatMap(([root, fifth]) => [
  root,
  '.',
  root.replace('2', '3'),
  '.',
  fifth,
  '.',
  root.replace('2', '3'),
  '.',
]);

// K kick, S snare, H hat.
const DRUMS = Array.from({ length: 8 }, () => ['K', 'H', 'S', 'H', 'K', 'H', 'S', 'H']).flat();

const LENGTH = LEAD.length;

const NOTE_INDEX: Record<string, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
};

export function noteToHz(note: string): number {
  const match = /^([A-G]#?)(\d)$/.exec(note);
  if (!match) throw new Error(`Bad note "${note}"`);
  const midi = (Number(match[2]) + 1) * 12 + NOTE_INDEX[match[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** How many steps a note at `i` lasts, counting following '-' holds. */
function noteLength(track: string[], i: number): number {
  let n = 1;
  while (track[(i + n) % LENGTH] === '-' && n < LENGTH) n++;
  return n;
}

export class ChipMusic {
  private readonly out: GainNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;
  private pulse: PeriodicWave | null = null;

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
    private readonly noise: () => AudioBuffer,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(destination);
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  start(fadeIn = 2): void {
    if (this.timer) return;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.linearRampToValueAtTime(1, t + fadeIn);
    this.step = 0;
    this.nextTime = t + 0.05;
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  stop(fadeOut = 0.4): void {
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
      this.nextTime += STEP;
      this.step = (this.step + 1) % LENGTH;
    }
  }

  private playStep(i: number, t: number): void {
    const lead = LEAD[i];
    if (lead !== '.' && lead !== '-') {
      this.tone(this.pulseWave(), noteToHz(lead), t, noteLength(LEAD, i) * STEP * 0.92, 0.06);
    }
    const bass = BASS[i];
    if (bass !== '.' && bass !== '-') this.tone('triangle', noteToHz(bass), t, STEP * 0.9, 0.16);
    const drum = DRUMS[i];
    if (drum === 'K') this.kick(t);
    else if (drum === 'S') this.hit(t, 0.12, 0.11, 1800);
    else if (drum === 'H') this.hit(t, 0.03, 0.04, 8000);
  }

  private pulseWave(): PeriodicWave {
    if (this.pulse) return this.pulse;
    // Fourier series of a 25% duty pulse.
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    }
    this.pulse = this.ctx.createPeriodicWave(real, imag);
    return this.pulse;
  }

  private tone(
    type: OscillatorType | PeriodicWave,
    hz: number,
    t: number,
    duration: number,
    volume: number,
  ): void {
    const osc = this.ctx.createOscillator();
    if (type instanceof PeriodicWave) osc.setPeriodicWave(type);
    else osc.type = type;
    osc.frequency.value = hz;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.setValueAtTime(volume, t + duration * 0.7);
    gain.gain.linearRampToValueAtTime(0, t + duration);
    osc.connect(gain).connect(this.out);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private kick(t: number): void {
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain).connect(this.out);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  private hit(t: number, duration: number, volume: number, cutoff: number): void {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise();
    const filter = this.ctx.createBiquadFilter();
    filter.type = cutoff > 4000 ? 'highpass' : 'bandpass';
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(filter).connect(gain).connect(this.out);
    source.start(t);
    source.stop(t + duration + 0.01);
  }
}

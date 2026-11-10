import type { AudioEngine, MusicTrack, TapeHandle, TapeSegment } from '../core/audio';
import type { Input } from '../core/input';
import type { ResolutionRequest } from '../render/display';
import type { PixelCanvas } from '../render/pixelCanvas';
import type { PostFx } from '../render/postFx';
import { font } from '../render/tiers/hdCommon';
import type { Scene } from './scene';

/*
 * The ending: the tape loads one more time. The same picture as the loading screen (a
 * sunburst, a rocky peak, a caped hero, the title on the right), but in full colour at
 * full resolution, and the hero is you: the stick man, with everything he collected. Then
 * STICK and 2 fall off the title, and it reads HERO.
 *
 * Timeline (seconds): 0.4 pilot tone · 1.6 data, the picture loads row by row · 5.6 the
 * screech cuts out · 6.4 the title loses its first two words · 8.4 THE END · 10 any key.
 */
const SEGMENTS: readonly TapeSegment[] = [
  { kind: 'pilot', start: 0, end: 1.2 },
  { kind: 'data', start: 1.2, end: 5.2 },
];
const TAPE_START = 0.4;
const PICTURE = { start: 1.6, end: 5.2 };
const CUT = 5.6;
const TITLE_DROP = 6.4;
const THE_END = 8.4;
const ANY_KEY = 10;

/** Picture design space: the same 256×144 as the tape loader's picture. */
const PW = 256;
const PH = 144;

export interface EndingOptions {
  audio: AudioEngine;
  score: number;
  deaths: number;
  reducedMotion: boolean;
  onDone(): void;
}

export class EndingScene implements Scene {
  readonly name = 'ending';
  private t = 0;
  private tape: TapeHandle | null = null;
  private picture: HTMLCanvasElement | null = null;

  constructor(private readonly options: EndingOptions) {}

  resolution(): ResolutionRequest {
    return 'native';
  }

  smooth(): boolean {
    return true;
  }

  postFx(): PostFx | null {
    const after = this.t > CUT ? Math.min(1, (this.t - CUT) / 0.8) : 0.3;
    return { bloom: 0.5 * after + 0.15, aberration: 2.5, vignette: 0.5, grain: 0.04, time: this.t };
  }

  music(): MusicTrack {
    return this.t > TITLE_DROP ? 'cd' : null;
  }

  renderCap(): number | null {
    return null;
  }

  update(dt: number, input: Input): void {
    const before = this.t;
    this.t += dt;
    if (before < TAPE_START && this.t >= TAPE_START) {
      this.tape = this.options.audio.playTape(SEGMENTS);
    }
    if (before < CUT && this.t >= CUT) this.tape?.stop();
    if (this.t > ANY_KEY && input.wasAnyPressed()) this.options.onDone();
  }

  render(p: PixelCanvas): void {
    const ctx = p.context;
    const W = p.width;
    const H = p.height;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    const t = this.t;
    if (t < TAPE_START) {
      ctx.restore();
      return;
    }
    // The picture sits where the tape loader's did: 80% of the screen, centred.
    const pw = W * 0.8;
    const ph = H * 0.8;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    if (t < CUT) this.drawBorder(ctx, W, H, t);
    else this.drawAfterglow(ctx, W, H, t);

    ctx.fillStyle = '#000000';
    ctx.fillRect(px, py, pw, ph);
    if (!this.picture || this.picture.width !== Math.round(pw)) {
      this.picture = renderHeroPictureHd(Math.round(pw), Math.round(ph));
    }
    const progress = Math.max(0, Math.min(1, (t - PICTURE.start) / (PICTURE.end - PICTURE.start)));
    const rows = Math.floor(progress * ph);
    if (rows > 0) ctx.drawImage(this.picture, 0, 0, pw, rows, px, py, pw, rows);
    // The title loads with the rest of the picture, row by row.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, t < PICTURE.end ? py + rows : H);
    ctx.clip();
    this.drawTitle(ctx, px, py, pw / PW, t);
    ctx.restore();

    if (t >= PICTURE.end && t < CUT) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(px, py + ph - ph * 0.07, pw * 0.2, ph * 0.07);
      ctx.fillStyle = '#ffffff';
      ctx.font = font(ph * 0.04);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText('LOADING...', px + ph * 0.02, py + ph - ph * 0.035);
    }
    if (t >= THE_END) this.drawCredits(ctx, W, H, px, py, pw, ph, t);
    ctx.restore();
  }

  /** The loading stripes, in colour this time. */
  private drawBorder(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    const colours = ['#ff3d9a', '#3df2ff', '#ffd23d', '#7c4dff', '#3dff8a'];
    const data = t >= TAPE_START + 1.2 && !this.options.reducedMotion;
    const band = H / 20;
    for (let y = 0; y < H;) {
      let h: number;
      let colour: string;
      if (data) {
        h = 1 + Math.floor(Math.random() * 3) * (H / 360);
        colour = colours[Math.floor(Math.random() * colours.length)];
      } else {
        h = band;
        const i = Math.floor((y + t * H * 0.4) / band);
        colour = i % 2 === 0 ? colours[Math.floor(i / 2) % colours.length] : '#000000';
      }
      ctx.fillStyle = colour;
      ctx.fillRect(0, y, W, h + 1);
      y += h;
    }
  }

  /** After the cut: a slow glow behind the picture instead of stripes. */
  private drawAfterglow(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.7);
    const k = Math.min(1, (t - CUT) / 1.5);
    g.addColorStop(0, `rgba(255,140,90,${(0.5 * k).toFixed(3)})`);
    g.addColorStop(1, 'rgba(40,10,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /** STICK / 2 / HERO, and then just HERO. */
  private drawTitle(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    k: number,
    t: number,
  ): void {
    if (t < PICTURE.start + (PICTURE.end - PICTURE.start) * 0.15) return;
    const cx = px + 199 * k;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const drop = Math.max(0, t - TITLE_DROP);
    // STICK and 2 glitch, then fall away.
    for (const [word, y, size] of [
      ['STICK', 38, 24],
      ['2', 64, 24],
    ] as const) {
      if (drop > 1.6) continue;
      const fall = drop > 0.5 ? (drop - 0.5) ** 2 * 120 * k : 0;
      const jitter = drop > 0 && drop < 0.5 ? (Math.random() - 0.5) * 6 * k : 0;
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, drop - 0.8) / 0.8);
      ctx.font = font(size * k, 900);
      if (drop > 0) {
        ctx.fillStyle = '#ff3d9a';
        ctx.fillText(word, cx + jitter - 2 * k, py + y * k + fall);
        ctx.fillStyle = '#3df2ff';
        ctx.fillText(word, cx + jitter + 2 * k, py + y * k + fall);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillText(word, cx + jitter, py + y * k + fall);
    }
    ctx.globalAlpha = 1;
    // HERO rises into the middle and glows.
    const rise = Math.min(1, Math.max(0, (drop - 1) / 1.2));
    const ease = 1 - (1 - rise) ** 3;
    const y = py + (92 - 22 * ease) * k;
    const size = (22 + 8 * ease) * k;
    ctx.font = font(size, 900);
    const g = ctx.createLinearGradient(cx, y - size / 2, cx, y + size / 2);
    g.addColorStop(0, '#fff6d0');
    g.addColorStop(1, '#ffb347');
    ctx.fillStyle = g;
    ctx.fillText('HERO', cx, y);
    ctx.font = font(7 * k, 600);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('1978 — NOW', cx, py + 116 * k);
  }

  private drawCredits(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    px: number,
    py: number,
    pw: number,
    ph: number,
    t: number,
  ): void {
    const k = Math.min(1, (t - THE_END) / 0.8);
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(px, py + ph * 0.86, pw, ph * 0.14);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = font(ph * 0.05, 900);
    ctx.fillText('THE END', px + pw * 0.3, py + ph * 0.93);
    ctx.font = font(ph * 0.032, 600);
    const { score, deaths } = this.options;
    ctx.fillText(
      `SCORE ${Math.floor(score).toLocaleString('en-GB')}   ·   DEATHS ${deaths}`,
      px + pw * 0.68,
      py + ph * 0.93,
    );
    ctx.globalAlpha = 1;
    if (t > ANY_KEY && Math.floor(t * 2) % 2 === 0) {
      ctx.font = font(H * 0.025, 700);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText('THANK YOU FOR PLAYING  ·  PRESS ANY KEY', W / 2, H - (H - ph) / 4);
    }
  }
}

/**
 * The loading-screen picture again, at full resolution and in colour, with the stick man
 * as the hero: fists on hips, cape out behind, standing on the peak against the sun.
 */
export function renderHeroPictureHd(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const k = width / PW;
  ctx.scale(k, k);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // A dawn sky.
  const sky = ctx.createLinearGradient(0, 0, 0, PH);
  sky.addColorStop(0, '#1a0b3d');
  sky.addColorStop(0.55, '#7a2a6b');
  sky.addColorStop(1, '#ff8a5c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, PW, PH);

  // The sunburst, on the left like the original.
  const sun = { x: 80, y: 60 };
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 146, PH);
  ctx.clip();
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + 0.08;
    const spread = 0.07;
    ctx.fillStyle = i % 2 ? 'rgba(255,200,110,0.45)' : 'rgba(255,140,80,0.35)';
    ctx.beginPath();
    ctx.moveTo(sun.x, sun.y);
    ctx.lineTo(sun.x + Math.cos(a - spread) * 300, sun.y + Math.sin(a - spread) * 300);
    ctx.lineTo(sun.x + Math.cos(a + spread) * 300, sun.y + Math.sin(a + spread) * 300);
    ctx.fill();
  }
  const disc = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 46);
  disc.addColorStop(0, '#ffd88a');
  disc.addColorStop(0.7, '#ff9f4a');
  disc.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // The peak.
  const peak = [0, 144, 20, 124, 38, 127, 56, 113, 80, 117, 104, 109, 122, 121, 146, 118, 146, 144];
  const rock = ctx.createLinearGradient(0, 108, 0, 144);
  rock.addColorStop(0, '#3a1f52');
  rock.addColorStop(1, '#140a24');
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.moveTo(peak[0], peak[1]);
  for (let i = 2; i < peak.length; i += 2) ctx.lineTo(peak[i], peak[i + 1]);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,190,120,0.7)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(peak[2], peak[3]);
  for (let i = 4; i < peak.length - 2; i += 2) ctx.lineTo(peak[i], peak[i + 1]);
  ctx.stroke();

  // The hero: the stick man, scaled up to the original hero's height, feet on the peak.
  const s = 3.05;
  const fx = 80;
  const fy = 114;
  const P = (x: number, y: number): [number, number] => [fx + x * s, fy + y * s];
  // The cape, billowing out to the left.
  ctx.fillStyle = '#d7263d';
  ctx.beginPath();
  ctx.moveTo(...P(-1.5, -18.5));
  ctx.bezierCurveTo(...P(-8, -19), ...P(-15, -14), ...P(-21, -2));
  ctx.lineTo(...P(-16, -4.5));
  ctx.lineTo(...P(-15, -0.5));
  ctx.lineTo(...P(-11, -4));
  ctx.lineTo(...P(-8, -1));
  ctx.bezierCurveTo(...P(-5, -8), ...P(-3, -12), ...P(1.5, -18.5));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#7e0f22';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(...P(-2.5, -17));
  ctx.quadraticCurveTo(...P(-9, -12), ...P(-14, -3));
  ctx.stroke();
  // The sword across his back.
  ctx.strokeStyle = '#eef3ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(...P(3, -11));
  ctx.lineTo(...P(-5, -27));
  ctx.stroke();

  const limb = (pts: [number, number][]) => {
    ctx.beginPath();
    ctx.moveTo(...P(...pts[0]));
    for (const pt of pts.slice(1)) ctx.lineTo(...P(...pt));
    // Backlit by the sun: a dark outline, so he reads like the original's silhouette.
    ctx.strokeStyle = '#1a0b2e';
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.strokeStyle = '#f4efe6';
    ctx.lineWidth = 6;
    ctx.stroke();
  };
  // Legs, planted wide.
  limb([
    [-5.5, 0],
    [0, -9],
    [5.5, 0],
  ]);
  limb([
    [0, -9],
    [0, -19],
  ]);
  // The tunic and belt.
  const tunic = ctx.createLinearGradient(0, fy - 19 * s, 0, fy - 6 * s);
  tunic.addColorStop(0, '#4aa3f0');
  tunic.addColorStop(1, '#1d5fa8');
  ctx.fillStyle = tunic;
  ctx.beginPath();
  ctx.moveTo(...P(-3, -18));
  ctx.lineTo(...P(3, -18));
  ctx.lineTo(...P(5.5, -6.5));
  ctx.lineTo(...P(-5.5, -6.5));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1a0b2e';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#8d5524';
  ctx.fillRect(...P(-4.4, -10.2), 8.8 * s, 1.6 * s);
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath();
  ctx.moveTo(...P(0, -16.5));
  ctx.lineTo(...P(1.8, -14.2));
  ctx.lineTo(...P(0, -12));
  ctx.lineTo(...P(-1.8, -14.2));
  ctx.fill();
  // Arms: elbows out, fists on hips.
  limb([
    [0, -17],
    [-6, -13],
    [-3, -9.6],
  ]);
  limb([
    [0, -17],
    [6, -13],
    [3, -9.6],
  ]);
  ctx.fillStyle = '#ffd3b0';
  for (const x of [-3, 3]) {
    ctx.beginPath();
    ctx.arc(...P(x, -9.6), 1.7 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#2a2440';
  for (const x of [-5.5, 5.5]) {
    ctx.beginPath();
    ctx.ellipse(...P(x, -0.8), 2.4 * s, 1.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The head, with a determined face.
  ctx.fillStyle = '#1a0b2e';
  ctx.beginPath();
  ctx.arc(...P(0, -23.5), 5.3 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f4efe6';
  ctx.beginPath();
  ctx.arc(...P(0, -23.5), 4.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1b1533';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(...P(-2.6, -26));
  ctx.lineTo(...P(-0.6, -25));
  ctx.moveTo(...P(2.6, -26));
  ctx.lineTo(...P(0.6, -25));
  ctx.moveTo(...P(-1.2, -21.4));
  ctx.lineTo(...P(1.2, -21.4));
  ctx.stroke();
  ctx.fillStyle = '#1b1533';
  for (const x of [-1.5, 1.5]) {
    ctx.beginPath();
    ctx.arc(...P(x, -24), 0.8 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // The title panel, like the original (its words are drawn live, so they can fall off).
  ctx.fillStyle = 'rgba(8,4,24,0.85)';
  ctx.fillRect(146, 0, PW - 146, PH);
  ctx.strokeStyle = 'rgba(255,210,61,0.6)';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(152, 22, 94, 96);
  return canvas;
}

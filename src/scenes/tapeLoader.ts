import type { AudioEngine, TapeHandle, TapeSegment } from '../core/audio';
import type { Input } from '../core/input';
import { RESOLUTIONS, type Resolution } from '../render/display';
import { GLYPH_H, textWidth } from '../render/font3x5';
import { PICTURE_H, PICTURE_W, renderHeroPicture, type Bitmap } from '../render/heroPicture';
import type { PixelCanvas } from '../render/pixelCanvas';
import type { Scene } from './scene';

/**
 * The tape-loader intro (PRD §6). Timeline, in seconds after the key press:
 *   0.0–2.2  pilot tone, thick slow border stripes
 *   2.2–2.5  header burst
 *   2.5–3.0  pilot again; "PROGRAM: STICK2HERO"
 *   3.0–8.0  data screech, thin flickering stripes, the hero picture loads row by row
 *   8.0–8.6  "LOADING..."
 *   8.6      hard cut: silence, white screen, the stick man
 */
const SEGMENTS: readonly TapeSegment[] = [
  { kind: 'pilot', start: 0, end: 2.2 },
  { kind: 'data', start: 2.2, end: 2.5 },
  { kind: 'pilot', start: 2.5, end: 3.0 },
  { kind: 'data', start: 3.0, end: 8.6 },
];
const HEADER_TEXT = { start: 2.5, end: 3.3 };
const PICTURE = { start: 3.0, end: 8.0 };
const LOADING_TEXT_START = 8.0;
export const TAPE_END = 8.6;

const STRIPE_ON = '#d8d8d8'; // Softer than pure white: it's a lot of flicker.
const STRIPE_OFF = '#000000';

export interface TapeLoaderOptions {
  audio: AudioEngine;
  /** After the first full load, any key skips. */
  skippable: boolean;
  reducedMotion: boolean;
  onDone(completed: boolean): void;
}

export class TapeLoaderScene implements Scene {
  readonly name = 'tape';
  private phase: 'prompt' | 'loading' | 'done' = 'prompt';
  private t = 0;
  private promptT = 0;
  private tape: TapeHandle | null = null;
  private readonly picture: Bitmap;
  private image: ImageData | null = null;
  private rowsShown = 0;

  constructor(private readonly options: TapeLoaderOptions) {
    this.picture = renderHeroPicture();
  }

  resolution(): Resolution {
    return RESOLUTIONS.ERA1; // 320×180: the loader got all the budget.
  }

  renderCap(): number | null {
    return null;
  }

  update(dt: number, input: Input): void {
    if (this.phase === 'prompt') {
      this.promptT += dt;
      if (input.wasAnyPressed()) {
        this.phase = 'loading';
        this.t = 0;
        this.tape = this.options.audio.playTape(SEGMENTS);
      }
      return;
    }
    if (this.phase !== 'loading') return;
    this.t += dt;
    if (this.options.skippable && this.t > 0.3 && input.wasAnyPressed()) this.finish(false);
    else if (this.t >= TAPE_END) this.finish(true);
  }

  private finish(completed: boolean): void {
    this.phase = 'done';
    this.tape?.stop();
    this.options.onDone(completed);
  }

  render(p: PixelCanvas): void {
    p.clear('#000');
    if (this.phase === 'prompt') {
      this.renderPrompt(p);
      return;
    }
    this.renderBorder(p);
    this.renderScreen(p);
  }

  private renderPrompt(p: PixelCanvas): void {
    if (Math.floor(this.promptT * 2) % 2 === 1) return; // blink
    p.color('#fff');
    p.textCentered('PRESS ANY KEY TO START TAPE', p.width / 2, p.height / 2 - GLYPH_H, 2);
  }

  /** Inner "screen" rectangle, centred, the size of the picture. */
  private inner(p: PixelCanvas) {
    return { x: (p.width - PICTURE_W) / 2, y: (p.height - PICTURE_H) / 2 };
  }

  private renderBorder(p: PixelCanvas): void {
    const t = this.t;
    const reduced = this.options.reducedMotion;
    const inData = SEGMENTS.some((s) => s.kind === 'data' && t >= s.start && t < s.end);

    for (let y = 0; y < p.height;) {
      let height: number;
      let on: boolean;
      if (inData && !reduced) {
        // Data: thin stripes, random every frame.
        height = 1 + Math.floor(Math.random() * 3);
        on = Math.random() < 0.5;
      } else {
        // Pilot (or reduced motion): thick bands rolling slowly upwards.
        const band = inData ? 4 : 9;
        const speed = reduced ? 12 : 70;
        const offset = Math.floor(t * speed);
        height = 1;
        on = Math.floor((y + offset) / band) % 2 === 0;
      }
      p.color(on ? STRIPE_ON : STRIPE_OFF);
      p.rect(0, y, p.width, height);
      y += height;
    }
  }

  private renderScreen(p: PixelCanvas): void {
    const { x, y } = this.inner(p);
    p.color('#000');
    p.rect(x, y, PICTURE_W, PICTURE_H);
    const t = this.t;

    // The picture paints in row by row, top to bottom.
    const progress = (t - PICTURE.start) / (PICTURE.end - PICTURE.start);
    const rows = Math.max(0, Math.min(PICTURE_H, Math.floor(progress * PICTURE_H)));
    if (rows > 0) {
      this.image ??= blackImage();
      this.fillRows(rows);
      p.putImage(this.image, x, y);
    }

    p.color('#fff');
    if (t >= HEADER_TEXT.start && t < HEADER_TEXT.end) {
      p.text('PROGRAM: STICK2HERO', x + 4, y + 4, 1);
    }
    if (t >= LOADING_TEXT_START) {
      const text = 'LOADING...';
      p.color('#000');
      p.rect(x, y + PICTURE_H - 9, textWidth(text) + 8, 9);
      p.color('#fff');
      p.text(text, x + 4, y + PICTURE_H - 7, 1);
    }
  }

  /** Copy newly revealed rows of the 1-bit picture into the ImageData. */
  private fillRows(rows: number): void {
    const image = this.image;
    if (!image) return;
    const { bits } = this.picture;
    for (let row = this.rowsShown; row < rows; row++) {
      for (let col = 0; col < PICTURE_W; col++) {
        const i = row * PICTURE_W + col;
        const v = bits[i] ? 255 : 0;
        image.data[i * 4] = v;
        image.data[i * 4 + 1] = v;
        image.data[i * 4 + 2] = v;
        image.data[i * 4 + 3] = 255;
      }
    }
    this.rowsShown = rows;
  }
}

/** Opaque black ImageData the size of the picture (unrevealed rows stay black). */
function blackImage(): ImageData {
  const image = new ImageData(PICTURE_W, PICTURE_H);
  for (let i = 3; i < image.data.length; i += 4) image.data[i] = 255;
  return image;
}

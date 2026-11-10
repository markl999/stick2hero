import { glyph, GLYPH_H, GLYPH_W, textWidth } from './font3x5';

/**
 * A pixel-perfect drawing surface for the low-res eras. Everything is integer
 * fillRects on a 2D canvas the size of the internal resolution, so lines stay
 * crisp 1px wide no matter how the GPU would anti-alias a stroke.
 */
export class PixelCanvas {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas not supported');
    this.ctx = ctx;
    this.resize(width, height);
  }

  get width(): number {
    return this.canvas.width;
  }

  get height(): number {
    return this.canvas.height;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  clear(color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  color(color: string): void {
    this.ctx.fillStyle = color;
  }

  rect(x: number, y: number, w: number, h: number): void {
    if (w <= 0 || h <= 0) return;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  pset(x: number, y: number): void {
    this.ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  hline(x0: number, x1: number, y: number): void {
    const a = Math.round(Math.min(x0, x1));
    const b = Math.round(Math.max(x0, x1));
    this.ctx.fillRect(a, Math.round(y), b - a + 1, 1);
  }

  vline(x: number, y0: number, y1: number): void {
    const a = Math.round(Math.min(y0, y1));
    const b = Math.round(Math.max(y0, y1));
    this.ctx.fillRect(Math.round(x), a, 1, b - a + 1);
  }

  strokeRect(x: number, y: number, w: number, h: number): void {
    this.hline(x, x + w - 1, y);
    this.hline(x, x + w - 1, y + h - 1);
    this.vline(x, y, y + h - 1);
    this.vline(x + w - 1, y, y + h - 1);
  }

  /** Bresenham line, 1px wide. */
  line(x0: number, y0: number, x1: number, y1: number): void {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const xe = Math.round(x1);
    const ye = Math.round(y1);
    const dx = Math.abs(xe - x);
    const dy = -Math.abs(ye - y);
    const sx = x < xe ? 1 : -1;
    const sy = y < ye ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.ctx.fillRect(x, y, 1, 1);
      if (x === xe && y === ye) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /** Midpoint circle outline, 1px wide. */
  circle(cx: number, cy: number, r: number): void {
    const x0 = Math.round(cx);
    const y0 = Math.round(cy);
    const radius = Math.max(1, Math.round(r));
    let x = radius;
    let y = 0;
    let err = 1 - radius;
    while (x >= y) {
      for (const [px, py] of [
        [x, y],
        [y, x],
        [-y, x],
        [-x, y],
        [-x, -y],
        [-y, -x],
        [y, -x],
        [x, -y],
      ]) {
        this.ctx.fillRect(x0 + px, y0 + py, 1, 1);
      }
      y++;
      if (err < 0) err += 2 * y + 1;
      else {
        x--;
        err += 2 * (y - x) + 1;
      }
    }
  }

  /** Draw text with the 3×5 font. `scale` is screen pixels per font pixel. */
  text(text: string, x: number, y: number, scale = 1): void {
    const s = Math.max(1, Math.round(scale));
    let cx = Math.round(x);
    const cy = Math.round(y);
    for (const ch of text) {
      const rows = glyph(ch);
      for (let gy = 0; gy < GLYPH_H; gy++) {
        for (let gx = 0; gx < GLYPH_W; gx++) {
          if (rows[gy][gx]) this.ctx.fillRect(cx + gx * s, cy + gy * s, s, s);
        }
      }
      cx += (GLYPH_W + 1) * s;
    }
  }

  textCentered(text: string, centerX: number, y: number, scale = 1): void {
    const s = Math.max(1, Math.round(scale));
    this.text(text, centerX - Math.floor((textWidth(text) * s) / 2), y, s);
  }
}

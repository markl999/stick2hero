import { glyph, GLYPH_H, textWidth } from './font3x5';

/**
 * A pixel-perfect drawing surface for the low-res eras. Everything is integer
 * fillRects on a 2D canvas the size of the internal resolution, so lines stay
 * crisp 1px wide no matter how the GPU would anti-alias a stroke.
 */
export class PixelCanvas {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private shade: HTMLCanvasElement | null = null;

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

  /** Draw everything inside `fn` mirrored left-to-right (the ← LEFT moment). */
  mirrored(fn: () => void): void {
    this.ctx.save();
    this.ctx.setTransform(-1, 0, 0, 1, this.width, 0);
    fn();
    this.ctx.restore();
  }

  /** Draw everything inside `fn` clipped to a circle (the COLOUR wave). */
  clippedToCircle(cx: number, cy: number, r: number, fn: () => void): void {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
    this.ctx.clip();
    fn();
    this.ctx.restore();
  }

  /** TRANSPARENCY: draw everything inside `fn` at this opacity. */
  withAlpha(alpha: number, fn: () => void): void {
    const before = this.ctx.globalAlpha;
    this.ctx.globalAlpha = before * Math.max(0, Math.min(1, alpha));
    fn();
    this.ctx.globalAlpha = before;
  }

  /**
   * LIGHTING: cover everything in darkness, except soft circles of light. The darkness
   * is drawn on its own layer with the lights cut out of it, then laid over the scene.
   */
  darkness(color: string, lights: readonly { x: number; y: number; r: number }[]): void {
    this.shade ??= document.createElement('canvas');
    const shade = this.shade;
    if (shade.width !== this.width || shade.height !== this.height) {
      shade.width = this.width;
      shade.height = this.height;
    }
    const ctx = shade.getContext('2d');
    if (!ctx) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, shade.width, shade.height);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, shade.width, shade.height);
    ctx.globalCompositeOperation = 'destination-out';
    for (const light of lights) {
      if (light.r <= 0) continue;
      const g = ctx.createRadialGradient(
        light.x,
        light.y,
        light.r * 0.15,
        light.x,
        light.y,
        light.r,
      );
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.75)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(light.x, light.y, light.r, 0, Math.PI * 2);
      ctx.fill();
    }
    this.ctx.drawImage(shade, 0, 0);
  }

  imageData(): ImageData {
    return this.ctx.getImageData(0, 0, this.width, this.height);
  }

  putImage(image: ImageData, x: number, y: number): void {
    this.ctx.putImageData(image, Math.round(x), Math.round(y));
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

  /** Filled circle. */
  disc(cx: number, cy: number, r: number): void {
    const x0 = Math.round(cx);
    const y0 = Math.round(cy);
    const radius = Math.max(1, Math.round(r));
    for (let dy = -radius; dy <= radius; dy++) {
      const half = Math.floor(Math.sqrt(radius * radius - dy * dy + radius * 0.8));
      this.ctx.fillRect(x0 - half, y0 + dy, half * 2 + 1, 1);
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
        for (let gx = 0; gx < rows[gy].length; gx++) {
          if (rows[gy][gx]) this.ctx.fillRect(cx + gx * s, cy + gy * s, s, s);
        }
      }
      cx += (rows[0].length + 1) * s;
    }
  }

  textCentered(text: string, centerX: number, y: number, scale = 1): void {
    const s = Math.max(1, Math.round(scale));
    this.text(text, centerX - Math.floor((textWidth(text) * s) / 2), y, s);
  }
}

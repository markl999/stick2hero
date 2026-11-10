import type { Input } from '../core/input';
import { INITIALS_LENGTH, type ScoreEntry } from '../core/scores';
import { RESOLUTIONS, type ResolutionRequest } from '../render/display';
import { GLYPH_H, textWidth } from '../render/font3x5';
import type { PixelCanvas } from '../render/pixelCanvas';

/** Menus are laid out on a 320×180 page, scaled up in whole steps to fit the canvas. */
export const PAGE_W = 320;
export const PAGE_H = 180;

export const INK = '#ffffff';
export const DIM = '#8a8a96';
export const BLACK = '#000000';
export const PHOSPHOR = '#33ff66';

/** Menus need at least 320×180 to be readable, so Era 0's 160×90 gets bumped up. */
export function menuResolution(under: ResolutionRequest): ResolutionRequest {
  if (under === 'native' || under.width >= PAGE_W) return under;
  return RESOLUTIONS.ERA1;
}

export class Page {
  readonly k: number;
  private readonly ox: number;
  private readonly oy: number;

  constructor(readonly p: PixelCanvas) {
    this.k = Math.max(1, Math.floor(Math.min(p.width / PAGE_W, p.height / PAGE_H)));
    this.ox = Math.floor((p.width - PAGE_W * this.k) / 2);
    this.oy = Math.floor((p.height - PAGE_H * this.k) / 2);
  }

  color(c: string): this {
    this.p.color(c);
    return this;
  }

  rect(x: number, y: number, w: number, h: number): void {
    this.p.rect(this.ox + x * this.k, this.oy + y * this.k, w * this.k, h * this.k);
  }

  strokeRect(x: number, y: number, w: number, h: number): void {
    this.p.strokeRect(this.ox + x * this.k, this.oy + y * this.k, w * this.k, h * this.k);
  }

  text(t: string, x: number, y: number, scale = 1): void {
    this.p.text(t, this.ox + x * this.k, this.oy + y * this.k, scale * this.k);
  }

  center(t: string, y: number, scale = 1, cx = PAGE_W / 2): void {
    this.text(t, cx - Math.floor((textWidth(t) * scale) / 2), y, scale);
  }

  right(t: string, x: number, y: number, scale = 1): void {
    this.text(t, x - textWidth(t) * scale, y, scale);
  }

  /** A row of text drawn reversed (ink box, black letters) when it's selected. */
  item(t: string, x: number, y: number, w: number, scale: number, selected: boolean): void {
    const h = GLYPH_H * scale;
    if (selected) {
      this.color(INK).rect(x - 2 * scale, y - scale, w + 4 * scale, h + 2 * scale);
      this.color(BLACK);
    } else this.color(INK);
    this.text(t, x, y, scale);
  }

  /** Dim everything already drawn (the frozen game behind a menu). */
  shade(alpha: number): void {
    this.p.withAlpha(alpha, () => {
      this.p.color(BLACK);
      this.p.rect(0, 0, this.p.width, this.p.height);
    });
  }
}

/** Menu movement: the fixed menu keys, or whatever you've bound to the directions. */
export function menuPressed(input: Input, dir: 'up' | 'down' | 'left' | 'right'): boolean {
  const fixed = { up: 'menuUp', down: 'menuDown', left: 'menuLeft', right: 'menuRight' } as const;
  return input.wasPressed(fixed[dir]) || input.wasPressed(dir);
}

export function menuConfirm(input: Input): boolean {
  return input.wasPressed('confirm') || input.wasPressed('attack');
}

export function menuBack(input: Input): boolean {
  return input.wasPressed('back') || input.wasPressed('pause');
}

function ordinal(n: number): string {
  const suffix =
    n % 10 === 1 && n !== 11
      ? 'ST'
      : n % 10 === 2 && n !== 12
        ? 'ND'
        : n % 10 === 3 && n !== 13
          ? 'RD'
          : 'TH';
  return `${n}${suffix}`;
}

/** The arcade table: rank, score, initials. The row for `run` flashes. */
export function drawScoreTable(
  page: Page,
  table: readonly ScoreEntry[],
  run: number,
  time: number,
  top = 30,
): void {
  page.color(PHOSPHOR).center('HIGH SCORES', top - 22, 2);
  table.forEach((e, i) => {
    const y = top + i * 13;
    const mine = run > 0 && e.run === run;
    if (mine && Math.floor(time * 4) % 2 === 0) page.color(INK);
    else page.color(i === 0 ? '#ffd23d' : PHOSPHOR);
    page.right(ordinal(i + 1), 112, y, 2);
    page.right(e.score.toString().padStart(6, '0'), 188, y, 2);
    page.text(e.initials.padEnd(INITIALS_LENGTH, ' '), 204, y, 2);
    if (mine) page.text('<', 240, y, 2);
  });
}

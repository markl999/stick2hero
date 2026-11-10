import type { Game } from '../../game/game';

/* Shared by the HD renderer's files: the frame, colours and small helpers. */

export interface HdFrame {
  ctx: CanvasRenderingContext2D;
  game: Game;
  alpha: number;
  W: number;
  H: number;
  /** Screen pixels per world unit (zoom included). */
  s: number;
  /** Top-left of the view, in world units. */
  camX: number;
  camY: number;
  t: number;
  /** World → screen. */
  sx(wx: number): number;
  sy(wy: number): number;
  /** Draw in world units from here on. */
  world(): void;
  /** Draw in screen pixels from here on. */
  screen(): void;
}

export const NEON_PINK = '#ff3d9a';
export const NEON_CYAN = '#3df2ff';
export const NEON_GOLD = '#ffd23d';

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Deterministic pseudo-random 0..1. */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function font(px: number, weight = 700): string {
  return `${weight} ${Math.max(6, Math.round(px))}px "Avenir Next", "Segoe UI", Roboto, system-ui, sans-serif`;
}

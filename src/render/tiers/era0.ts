import { TILE, VIEW_H, VIEW_W } from '../../config';
import { FEATURES } from '../../core/features';
import { MOMENT_DURATION, type Game } from '../../game/game';
import { PICKUP_SIZE } from '../../game/pickup';
import { GLYPH_H, textWidth } from '../font3x5';
import type { PixelCanvas } from '../pixelCanvas';
import { era0Pose } from '../stickman';

const PAPER = '#ffffff';
const INK = '#000000';

/**
 * Era 0 ("BOOT") look: a white void, 1px black lines, the 3×5 font.
 * Draws in internal-resolution pixels, so it works at any resolution the debug
 * overlay picks (it's just chunkier at 160×90).
 */
export function drawEra0(p: PixelCanvas, game: Game, alpha: number): void {
  const s = p.width / VIEW_W; // pixels per world unit
  const cam = game.camera;
  const X = (wx: number) => Math.round((wx - cam.x) * s);
  const Y = (wy: number) => Math.round((wy - cam.y) * s);
  /** Font scale: one font pixel = 2 world units (1px at 160×90). */
  const fs = Math.max(1, Math.round(2 * s));

  const inverted = game.flashing;
  const paper = inverted ? INK : PAPER;
  const ink = inverted ? PAPER : INK;
  p.clear(paper);
  p.color(ink);

  // Tiles: outline only the edges that face empty space, so solid regions read as line art.
  const map = game.map;
  const tx0 = Math.floor(cam.x / TILE);
  const tx1 = Math.floor((cam.x + VIEW_W - 1) / TILE);
  const ty0 = Math.floor(cam.y / TILE);
  const ty1 = Math.floor((cam.y + VIEW_H - 1) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (!map.isSolidForDraw(tx, ty)) continue;
      const left = X(tx * TILE);
      const right = X((tx + 1) * TILE) - 1;
      const top = Y(ty * TILE);
      const bottom = Y((ty + 1) * TILE) - 1;
      if (!map.isSolidForDraw(tx, ty - 1)) p.hline(left, right, top);
      if (!map.isSolidForDraw(tx, ty + 1)) p.hline(left, right, bottom);
      if (!map.isSolidForDraw(tx - 1, ty)) p.vline(left, top, bottom);
      if (!map.isSolidForDraw(tx + 1, ty)) p.vline(right, top, bottom);
    }
  }

  // Pickups: a bobbing square with a "?" and its label floating above.
  const half = Math.max(3, Math.round((PICKUP_SIZE / 2) * s));
  for (const pickup of game.pickups) {
    if (pickup.collected) continue;
    // Only pickups on the current screen (otherwise the label clamp drags them into view).
    if (pickup.x < cam.x || pickup.x >= cam.x + VIEW_W) continue;
    if (pickup.y < cam.y || pickup.y >= cam.y + VIEW_H) continue;
    const bob = Math.round(Math.sin(game.time * 3 + pickup.x * 0.1) * 1.5 * s);
    const cx = X(pickup.x);
    const cy = Y(pickup.y) + bob;
    // Odd-sized box so the glyph sits exactly in the middle.
    p.strokeRect(cx - half, cy - half, half * 2 + 1, half * 2 + 1);
    p.textCentered('?', cx, cy - Math.floor((GLYPH_H * fs) / 2), fs);
    // Keep labels fully on screen near the edges.
    const label = FEATURES[pickup.feature].label;
    const halfW = Math.ceil((textWidth(label) * fs) / 2);
    const labelX = Math.min(Math.max(cx, halfW + fs), p.width - halfW - fs);
    p.textCentered(label, labelX, cy - half - (GLYPH_H + 2) * fs, fs);
  }

  // The stick man.
  const player = game.player;
  const px = lerp(player.prevX, player.box.x, alpha) + player.box.w / 2;
  const py = lerp(player.prevY, player.box.y, alpha) + player.box.h;
  const pose = era0Pose({ arms: game.features.has('ARMS') });
  for (const [x0, y0, x1, y1] of pose.segments) {
    p.line(X(px + x0), Y(py + y0), X(px + x1), Y(py + y1));
  }
  p.circle(X(px + pose.head.x), Y(py + pose.head.y), pose.head.r * s);

  // HUD.
  if (game.features.has('SCORE')) {
    const score = Math.floor(game.displayScore).toString().padStart(6, '0');
    p.text(`SCORE ${score}`, 2 * fs, 2 * fs, fs);
  }

  // Unlock moment banner (placeholder until each feature gets its own moment in M1).
  const moment = game.moment;
  if (moment) {
    const blinkingOut = moment.t > MOMENT_DURATION - 0.5 && Math.floor(moment.t * 8) % 2 === 0;
    if (!blinkingOut) {
      const top = Math.round(p.height * 0.22);
      p.textCentered('FEATURE ADDED', p.width / 2, top, fs);
      p.textCentered(FEATURES[moment.feature].label, p.width / 2, top + (GLYPH_H + 3) * fs, fs * 2);
    }
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

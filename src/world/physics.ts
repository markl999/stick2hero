import { TILE } from '../config';
import type { SolidQuery } from './tilemap';

/** Axis-aligned box in world units. (x, y) is the top-left corner. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const EPS = 1e-6;

/**
 * Move a box horizontally and resolve against solid tiles.
 * Assumes |dx| < TILE per call (true at our speeds with a 60Hz step).
 * Returns true if the box was stopped by a tile.
 */
export function moveX(b: Box, dx: number, map: SolidQuery): boolean {
  if (dx === 0) return false;
  b.x += dx;
  const ty0 = Math.floor(b.y / TILE);
  const ty1 = Math.floor((b.y + b.h - EPS) / TILE);
  if (dx > 0) {
    const tx = Math.floor((b.x + b.w - EPS) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      if (map.isSolid(tx, ty)) {
        b.x = tx * TILE - b.w;
        return true;
      }
    }
  } else {
    const tx = Math.floor(b.x / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      if (map.isSolid(tx, ty)) {
        b.x = (tx + 1) * TILE;
        return true;
      }
    }
  }
  return false;
}

/** Vertical counterpart of moveX. Same |dy| < TILE assumption. */
export function moveY(b: Box, dy: number, map: SolidQuery): boolean {
  if (dy === 0) return false;
  b.y += dy;
  const tx0 = Math.floor(b.x / TILE);
  const tx1 = Math.floor((b.x + b.w - EPS) / TILE);
  if (dy > 0) {
    const ty = Math.floor((b.y + b.h - EPS) / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      if (map.isSolid(tx, ty)) {
        b.y = ty * TILE - b.h;
        return true;
      }
    }
  } else {
    const ty = Math.floor(b.y / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      if (map.isSolid(tx, ty)) {
        b.y = (ty + 1) * TILE;
        return true;
      }
    }
  }
  return false;
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

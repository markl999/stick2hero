import { TILE } from '../config';
import type { SolidQuery } from './tilemap';

/*
 * Light geometry for DYNAMIC SHADOWS (Era 5). Pure maths on the tile grid, shared by the
 * game rules (is the player lit? can a drone see them?) and the renderer (shadow and
 * vision-cone polygons), so what you see is exactly what the drones see.
 */

export interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export interface Vec {
  x: number;
  y: number;
}

/**
 * True if no solid tile lies on the straight line between two points. Walks the tiles
 * the line passes through (Amanatides & Woo). The tiles holding the two end points
 * don't count, so a light mounted against a wall still shines.
 */
export function lineOfSight(
  map: SolidQuery,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  let tx = Math.floor(x0 / TILE);
  let ty = Math.floor(y0 / TILE);
  const ex = Math.floor(x1 / TILE);
  const ey = Math.floor(y1 / TILE);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const tDeltaX = dx !== 0 ? Math.abs(TILE / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
  let tMaxX = dx !== 0 ? (dx > 0 ? (tx + 1) * TILE - x0 : x0 - tx * TILE) / Math.abs(dx) : Infinity;
  let tMaxY = dy !== 0 ? (dy > 0 ? (ty + 1) * TILE - y0 : y0 - ty * TILE) / Math.abs(dy) : Infinity;
  for (let i = 0; i < 400; i++) {
    if (tx === ex && ty === ey) return true;
    if (tMaxX < tMaxY) {
      if (tMaxX > 1) return true;
      tMaxX += tDeltaX;
      tx += stepX;
    } else {
      if (tMaxY > 1) return true;
      tMaxY += tDeltaY;
      ty += stepY;
    }
    if (tx === ex && ty === ey) return true;
    if (map.isSolid(tx, ty)) return false;
  }
  return true;
}

/**
 * The edges of solid regions (edges between a solid and an empty tile) inside a
 * rectangle, merged into long runs so a whole rooftop is a handful of segments.
 */
export function occluders(
  map: SolidQuery,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Segment[] {
  const tx0 = Math.floor(minX / TILE);
  const ty0 = Math.floor(minY / TILE);
  const tx1 = Math.floor(maxX / TILE);
  const ty1 = Math.floor(maxY / TILE);
  const solid = (tx: number, ty: number) =>
    tx >= tx0 && tx <= tx1 && ty >= ty0 && ty <= ty1 && map.isSolid(tx, ty);
  const out: Segment[] = [];

  // Horizontal edges, on the line between rows ty-1 and ty.
  for (let ty = ty0; ty <= ty1 + 1; ty++) {
    let start = 0;
    let kind = 0;
    for (let tx = tx0; tx <= tx1 + 1; tx++) {
      const above = solid(tx, ty - 1);
      const below = solid(tx, ty);
      const k = above === below ? 0 : below ? 1 : 2;
      if (k !== kind) {
        if (kind) out.push({ ax: start * TILE, ay: ty * TILE, bx: tx * TILE, by: ty * TILE });
        start = tx;
        kind = k;
      }
    }
  }
  // Vertical edges, on the line between columns tx-1 and tx.
  for (let tx = tx0; tx <= tx1 + 1; tx++) {
    let start = 0;
    let kind = 0;
    for (let ty = ty0; ty <= ty1 + 1; ty++) {
      const left = solid(tx - 1, ty);
      const right = solid(tx, ty);
      const k = left === right ? 0 : right ? 1 : 2;
      if (k !== kind) {
        if (kind) out.push({ ax: tx * TILE, ay: start * TILE, bx: tx * TILE, by: ty * TILE });
        start = ty;
        kind = k;
      }
    }
  }
  return out;
}

/** Distance along the ray (origin + t·dir) to a segment, or null if it misses. */
function raySegment(ox: number, oy: number, dx: number, dy: number, s: Segment): number | null {
  const sx = s.bx - s.ax;
  const sy = s.by - s.ay;
  const denom = dx * sy - dy * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((s.ax - ox) * sy - (s.ay - oy) * sx) / denom;
  const u = ((s.ax - ox) * dy - (s.ay - oy) * dx) / denom;
  if (t < 0 || u < -1e-6 || u > 1 + 1e-6) return null;
  return t;
}

/**
 * Everything a light at `origin` can reach within `radius`, as a polygon (points in angle
 * order). Rays go out to every occluder corner, plus a hair either side of it, and stop at
 * the nearest edge. The polygon is bounded by a square of side 2·radius.
 */
export function visibilityPolygon(map: SolidQuery, origin: Vec, radius: number): Vec[] {
  const { x: ox, y: oy } = origin;
  const minX = ox - radius;
  const minY = oy - radius;
  const maxX = ox + radius;
  const maxY = oy + radius;
  const segments = occluders(map, minX, minY, maxX, maxY);
  segments.push(
    { ax: minX, ay: minY, bx: maxX, by: minY },
    { ax: maxX, ay: minY, bx: maxX, by: maxY },
    { ax: maxX, ay: maxY, bx: minX, by: maxY },
    { ax: minX, ay: maxY, bx: minX, by: minY },
  );

  const angles: number[] = [];
  for (const s of segments) {
    for (const [x, y] of [
      [s.ax, s.ay],
      [s.bx, s.by],
    ]) {
      const a = Math.atan2(y - oy, x - ox);
      angles.push(a - 0.0004, a, a + 0.0004);
    }
  }
  const points: { a: number; x: number; y: number }[] = [];
  for (const a of angles) {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let best = Infinity;
    for (const s of segments) {
      const t = raySegment(ox, oy, dx, dy, s);
      if (t !== null && t < best) best = t;
    }
    if (best < Infinity) points.push({ a, x: ox + dx * best, y: oy + dy * best });
  }
  points.sort((p, q) => p.a - q.a);
  return points.map(({ x, y }) => ({ x, y }));
}

/** Smallest signed difference between two angles, in -π..π. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

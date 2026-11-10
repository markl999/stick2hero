import { TILE } from '../config';
import type { FeatureId } from '../core/features';

/**
 * Levels are authored as ASCII grids:
 *   '#'  solid tile
 *   '.'  empty
 *   'P'  player spawn (feet at the bottom of the tile, horizontally centred)
 *   any key of `pickups` → a Feature pickup centred in that tile
 */
export interface LevelDef {
  name: string;
  rows: string[];
  pickups: Record<string, FeatureId>;
}

export interface PickupSpawn {
  feature: FeatureId;
  /** Centre, in world units. */
  x: number;
  y: number;
}

export interface ParsedLevel {
  name: string;
  map: TileMap;
  /** Player feet position, in world units. */
  spawn: { x: number; y: number };
  pickups: PickupSpawn[];
}

export interface SolidQuery {
  isSolid(tx: number, ty: number): boolean;
}

export class TileMap implements SolidQuery {
  constructor(
    readonly width: number,
    readonly height: number,
    private readonly solid: Uint8Array,
  ) {}

  get pixelWidth(): number {
    return this.width * TILE;
  }

  get pixelHeight(): number {
    return this.height * TILE;
  }

  /**
   * Collision rule for out-of-bounds tiles: the left and right edges are walls, while
   * above and below are open (falling out of the bottom is handled as a respawn).
   */
  isSolid(tx: number, ty: number): boolean {
    if (tx < 0 || tx >= this.width) return true;
    if (ty < 0 || ty >= this.height) return false;
    return this.solid[ty * this.width + tx] === 1;
  }

  /** Drawing rule: treat everything outside the map as solid, so edges don't get outlined. */
  isSolidForDraw(tx: number, ty: number): boolean {
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return true;
    return this.solid[ty * this.width + tx] === 1;
  }
}

export function parseLevel(def: LevelDef): ParsedLevel {
  const height = def.rows.length;
  if (height === 0) throw new Error(`Level "${def.name}" has no rows`);
  const width = def.rows[0].length;
  const solid = new Uint8Array(width * height);
  const pickups: PickupSpawn[] = [];
  let spawn: { x: number; y: number } | null = null;

  for (let ty = 0; ty < height; ty++) {
    const row = def.rows[ty];
    if (row.length !== width) {
      throw new Error(`Level "${def.name}" row ${ty} is ${row.length} wide, expected ${width}`);
    }
    for (let tx = 0; tx < width; tx++) {
      const ch = row[tx];
      if (ch === '#') solid[ty * width + tx] = 1;
      else if (ch === 'P') spawn = { x: tx * TILE + TILE / 2, y: (ty + 1) * TILE };
      else if (ch in def.pickups) {
        pickups.push({
          feature: def.pickups[ch],
          x: tx * TILE + TILE / 2,
          y: ty * TILE + TILE / 2,
        });
      } else if (ch !== '.') {
        throw new Error(`Level "${def.name}" has unknown tile '${ch}' at ${tx},${ty}`);
      }
    }
  }

  if (!spawn) throw new Error(`Level "${def.name}" has no spawn 'P'`);
  return { name: def.name, map: new TileMap(width, height, solid), spawn, pickups };
}

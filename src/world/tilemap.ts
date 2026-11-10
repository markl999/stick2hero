import { TILE } from '../config';
import type { Era, FeatureId } from '../core/features';

/**
 * Levels are authored as ASCII grids:
 *   '#'  solid tile
 *   '.'  empty
 *   '^'  spikes (not solid; deadly once DEATH exists)
 *   'P'  player spawn (feet at the bottom of the tile, horizontally centred)
 *   'e'  walker enemy (exists once ENEMIES does)
 *   'B'  the era's boss (feet at the bottom of the tile, horizontally centred)
 *   any key of `pickups` → a Feature pickup centred in that tile
 */
export interface LevelDef {
  name: string;
  /** Which era's look and rules this level uses. Defaults to 0. */
  era?: Era;
  rows: string[];
  pickups: Record<string, FeatureId>;
}

export interface PickupSpawn {
  feature: FeatureId;
  /** Centre, in world units. */
  x: number;
  y: number;
}

export type EntityKind = 'walker' | 'boss';

export interface EntitySpawn {
  kind: EntityKind;
  /** Feet position, in world units. */
  x: number;
  y: number;
}

export interface ParsedLevel {
  name: string;
  era: Era;
  map: TileMap;
  /** Player feet position, in world units. */
  spawn: { x: number; y: number };
  pickups: PickupSpawn[];
  entities: EntitySpawn[];
}

export interface SolidQuery {
  isSolid(tx: number, ty: number): boolean;
}

export const Tile = { Empty: 0, Solid: 1, Spikes: 2 } as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** Spikes only hurt in the bottom part of their tile... */
export const SPIKE_HEIGHT = 9;
/** ...and not right at its edges (the tips are narrower than the tile; it's fairer). */
export const SPIKE_INSET = 4;

export class TileMap implements SolidQuery {
  constructor(
    readonly width: number,
    readonly height: number,
    private readonly tiles: Uint8Array,
  ) {}

  get pixelWidth(): number {
    return this.width * TILE;
  }

  get pixelHeight(): number {
    return this.height * TILE;
  }

  tileAt(tx: number, ty: number): Tile {
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return Tile.Empty;
    return this.tiles[ty * this.width + tx] as Tile;
  }

  /**
   * Collision rule for out-of-bounds tiles: the left and right edges are walls, while
   * above and below are open (falling out of the bottom is handled as a respawn).
   */
  isSolid(tx: number, ty: number): boolean {
    if (tx < 0 || tx >= this.width) return true;
    return this.tileAt(tx, ty) === Tile.Solid;
  }

  /** Drawing rule: treat everything outside the map as solid, so edges don't get outlined. */
  isSolidForDraw(tx: number, ty: number): boolean {
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return true;
    return this.tileAt(tx, ty) === Tile.Solid;
  }

  /** True if the box touches the deadly part of any spike tile. */
  touchesSpikes(box: { x: number; y: number; w: number; h: number }): boolean {
    const tx0 = Math.floor(box.x / TILE);
    const tx1 = Math.floor((box.x + box.w - 1e-6) / TILE);
    const ty0 = Math.floor(box.y / TILE);
    const ty1 = Math.floor((box.y + box.h - 1e-6) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (this.tileAt(tx, ty) !== Tile.Spikes) continue;
        const spikeTop = (ty + 1) * TILE - SPIKE_HEIGHT;
        const left = tx * TILE + SPIKE_INSET;
        const right = (tx + 1) * TILE - SPIKE_INSET;
        if (box.y + box.h > spikeTop && box.x < right && box.x + box.w > left) return true;
      }
    }
    return false;
  }
}

export function parseLevel(def: LevelDef): ParsedLevel {
  const height = def.rows.length;
  if (height === 0) throw new Error(`Level "${def.name}" has no rows`);
  const width = def.rows[0].length;
  const tiles = new Uint8Array(width * height);
  const pickups: PickupSpawn[] = [];
  const entities: EntitySpawn[] = [];
  let spawn: { x: number; y: number } | null = null;

  for (let ty = 0; ty < height; ty++) {
    const row = def.rows[ty];
    if (row.length !== width) {
      throw new Error(`Level "${def.name}" row ${ty} is ${row.length} wide, expected ${width}`);
    }
    for (let tx = 0; tx < width; tx++) {
      const ch = row[tx];
      const feet = { x: tx * TILE + TILE / 2, y: (ty + 1) * TILE };
      if (ch === '#') tiles[ty * width + tx] = Tile.Solid;
      else if (ch === '^') tiles[ty * width + tx] = Tile.Spikes;
      else if (ch === 'P') spawn = feet;
      else if (ch === 'e') entities.push({ kind: 'walker', ...feet });
      else if (ch === 'B') entities.push({ kind: 'boss', ...feet });
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
  return {
    name: def.name,
    era: def.era ?? 0,
    map: new TileMap(width, height, tiles),
    spawn,
    pickups,
    entities,
  };
}

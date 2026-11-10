import { TILE } from '../config';
import type { Era, FeatureId } from '../core/features';

/**
 * Levels are authored as ASCII grids:
 *   '#'  solid tile
 *   '.'  empty
 *   '^'  spikes (not solid; deadly once DEATH exists)
 *   '~'  hot bricks (solid; deadly to stand on once DEATH exists, and only red with COLOUR)
 *   'D'  door (solid until a switch on the same screen is hit)
 *   'w'  water (swim in it)
 *   'h'  a hollow wall: drawn like a wall, but you can walk through it (TRANSPARENCY shows it)
 *   'P'  player spawn (feet at the bottom of the tile, horizontally centred)
 *   'e'  walker enemy (exists once ENEMIES does)
 *   'F'  checkpoint flag (works once CHECKPOINTS exists)
 *   's'  switch (hit it with a thrown pebble)
 *   'k'  knight (Era 3: armoured, takes 3 sword hits)
 *   'g'  ghost (Era 4: floats through walls towards you)
 *   't'  torch (a light),  'b'  brazier (light it by touching it; it's a checkpoint too)
 *   'C'  where the Chase starts,  'X'  the Chase's finish line,  'Z'  where the Deprecator appears
 *   'B'  The Block (Era 1 boss),  'V'  Flicker (Era 2 boss),  'W'  The Warden (Era 3 boss)
 *   any key of `npcs` → a character you can talk to (once NPCS exists)
 *   Entity positions are feet positions: bottom of the tile, horizontally centred.
 *   any key of `pickups` → a Feature pickup centred in that tile
 */
export interface LevelDef {
  name: string;
  /** Which era's look and rules this level uses. Defaults to 0. */
  era?: Era;
  rows: string[];
  pickups: Record<string, FeatureId>;
  /** NPC characters: grid character → their lines of dialogue (one page each). */
  npcs?: Record<string, string[]>;
}

export interface PickupSpawn {
  feature: FeatureId;
  /** Centre, in world units. */
  x: number;
  y: number;
}

export type EntityKind =
  | 'walker'
  | 'knight'
  | 'block'
  | 'flicker'
  | 'warden'
  | 'flag'
  | 'switch'
  | 'npc'
  | 'ghost'
  | 'torch'
  | 'brazier'
  | 'chase'
  | 'exit'
  | 'deprecator';

export interface EntitySpawn {
  kind: EntityKind;
  /** For NPCs: their grid character, which keys their dialogue. */
  id?: string;
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
  /** NPC id → pages of dialogue. */
  dialogue: Record<string, string[]>;
}

export interface SolidQuery {
  isSolid(tx: number, ty: number): boolean;
}

export const Tile = {
  Empty: 0,
  Solid: 1,
  Spikes: 2,
  Hot: 3,
  Door: 4,
  Water: 5,
  Hollow: 6,
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** Spikes only hurt in the bottom part of their tile... */
export const SPIKE_HEIGHT = 9;
/** ...and not right at its edges (the tips are narrower than the tile; it's fairer). */
export const SPIKE_INSET = 4;
/** Standing on the very edge of a hot brick is safe. */
export const HOT_INSET = 3;

const SOLID_TILES: ReadonlySet<number> = new Set([Tile.Solid, Tile.Hot, Tile.Door]);

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

  setTile(tx: number, ty: number, tile: Tile): void {
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return;
    this.tiles[ty * this.width + tx] = tile;
  }

  /**
   * Collision rule for out-of-bounds tiles: the left and right edges are walls, while
   * above and below are open (falling out of the bottom is handled as a respawn).
   */
  isSolid(tx: number, ty: number): boolean {
    if (tx < 0 || tx >= this.width) return true;
    return SOLID_TILES.has(this.tileAt(tx, ty));
  }

  /** Drawing rule: treat everything outside the map as solid, so edges don't get outlined. */
  isSolidForDraw(tx: number, ty: number): boolean {
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return true;
    return SOLID_TILES.has(this.tileAt(tx, ty));
  }

  /** True if the centre of the box is in water. */
  inWater(box: { x: number; y: number; w: number; h: number }): boolean {
    const tx = Math.floor((box.x + box.w / 2) / TILE);
    const ty = Math.floor((box.y + box.h / 2) / TILE);
    return this.tileAt(tx, ty) === Tile.Water;
  }

  /** True if the box is standing on (or touching the top of) a hot brick. */
  standsOnHot(box: { x: number; y: number; w: number; h: number }): boolean {
    const feet = box.y + box.h;
    const ty = Math.floor((feet + 0.5) / TILE);
    if (Math.abs(feet - ty * TILE) > 0.5) return false;
    const tx0 = Math.floor(box.x / TILE);
    const tx1 = Math.floor((box.x + box.w - 1e-6) / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      if (this.tileAt(tx, ty) !== Tile.Hot) continue;
      const left = tx * TILE + HOT_INSET;
      const right = (tx + 1) * TILE - HOT_INSET;
      if (box.x < right && box.x + box.w > left) return true;
    }
    return false;
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

const ENTITY_CHARS: Record<string, EntityKind> = {
  e: 'walker',
  k: 'knight',
  B: 'block',
  W: 'warden',
  g: 'ghost',
  t: 'torch',
  b: 'brazier',
  C: 'chase',
  X: 'exit',
  Z: 'deprecator',
  V: 'flicker',
  F: 'flag',
  s: 'switch',
};

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
      else if (ch === '~') tiles[ty * width + tx] = Tile.Hot;
      else if (ch === 'D') tiles[ty * width + tx] = Tile.Door;
      else if (ch === 'w') tiles[ty * width + tx] = Tile.Water;
      else if (ch === 'h') tiles[ty * width + tx] = Tile.Hollow;
      else if (ch === 'P') spawn = feet;
      else if (ch in ENTITY_CHARS) entities.push({ kind: ENTITY_CHARS[ch], ...feet });
      else if (def.npcs && ch in def.npcs) entities.push({ kind: 'npc', id: ch, ...feet });
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
    dialogue: def.npcs ?? {},
  };
}

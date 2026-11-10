import { describe, expect, it } from 'vitest';
import { TILE } from '../src/config';
import { FEATURE_IDS, FEATURES } from '../src/core/features';
import {
  composeScreens,
  SCREEN_COLS,
  SCREEN_ROWS,
  SOLID_SCREEN,
} from '../src/world/levels/compose';
import { ERA0_LEVEL } from '../src/world/levels/era0';
import { parseLevel } from '../src/world/tilemap';

describe('parseLevel', () => {
  it('parses solids, spawn and pickups', () => {
    const level = parseLevel({
      name: 't',
      rows: ['....', '.P1.', '####'],
      pickups: { '1': 'JUMP' },
    });
    expect(level.map.width).toBe(4);
    expect(level.map.height).toBe(3);
    expect(level.map.isSolid(0, 2)).toBe(true);
    expect(level.map.isSolid(0, 1)).toBe(false);
    expect(level.spawn).toEqual({ x: 1 * TILE + TILE / 2, y: 2 * TILE });
    expect(level.pickups).toEqual([{ feature: 'JUMP', x: 2 * TILE + TILE / 2, y: 1.5 * TILE }]);
  });

  it('treats the sides as walls and above/below as open', () => {
    const { map } = parseLevel({ name: 't', rows: ['P.', '##'], pickups: {} });
    expect(map.isSolid(-1, 0)).toBe(true);
    expect(map.isSolid(2, 0)).toBe(true);
    expect(map.isSolid(0, -1)).toBe(false);
    expect(map.isSolid(0, 2)).toBe(false);
    expect(map.isSolidForDraw(0, 2)).toBe(true);
  });

  it('rejects ragged rows, unknown tiles and missing spawn', () => {
    expect(() => parseLevel({ name: 't', rows: ['P..', '##'], pickups: {} })).toThrow(/row 1/);
    expect(() => parseLevel({ name: 't', rows: ['P?'], pickups: {} })).toThrow(/unknown tile/);
    expect(() => parseLevel({ name: 't', rows: ['..'], pickups: {} })).toThrow(/no spawn/);
  });
});

describe('composeScreens', () => {
  it('lays screens out side by side and stacked', () => {
    const empty = Array.from({ length: SCREEN_ROWS }, () => '.'.repeat(SCREEN_COLS));
    const rows = composeScreens([
      [empty, SOLID_SCREEN],
      [SOLID_SCREEN, empty],
    ]);
    expect(rows).toHaveLength(SCREEN_ROWS * 2);
    expect(rows[0]).toBe('.'.repeat(SCREEN_COLS) + '#'.repeat(SCREEN_COLS));
    expect(rows[SCREEN_ROWS]).toBe('#'.repeat(SCREEN_COLS) + '.'.repeat(SCREEN_COLS));
  });

  it('rejects screens of the wrong size', () => {
    expect(() => composeScreens([[['...']]])).toThrow(/16×9/);
  });
});

describe('Era 0 level', () => {
  it('has exactly one pickup per Era 0 feature', () => {
    const level = parseLevel(ERA0_LEVEL);
    const era0 = FEATURE_IDS.filter((id) => FEATURES[id].era === 0);
    expect(level.pickups.map((p) => p.feature).sort()).toEqual([...era0].sort());
  });

  it('puts every pickup on solid ground (so it works as a checkpoint)', () => {
    const level = parseLevel(ERA0_LEVEL);
    for (const p of level.pickups) {
      const tx = Math.floor(p.x / TILE);
      const ty = Math.floor(p.y / TILE);
      expect(level.map.isSolid(tx, ty + 1), `${p.feature} has ground below`).toBe(true);
    }
  });
});

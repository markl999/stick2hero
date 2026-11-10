import { describe, expect, it } from 'vitest';
import { TILE } from '../src/config';
import { TEST_ROOM } from '../src/world/levels/testRoom';
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

  it('parses the M0 test room with one pickup per Era 0 feature', () => {
    const level = parseLevel(TEST_ROOM);
    expect(level.map.width).toBe(32);
    expect(level.map.height).toBe(9);
    expect(level.pickups.map((p) => p.feature).sort()).toEqual(
      ['ARMS', 'BEEP', 'FRAME_RATE', 'JUMP', 'LEFT', 'SCORE', 'SCREEN_2'].sort(),
    );
  });
});

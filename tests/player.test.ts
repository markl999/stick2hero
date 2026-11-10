import { describe, expect, it } from 'vitest';
import { STEP, TILE } from '../src/config';
import { Player, type PlayerAbilities, type PlayerControls } from '../src/game/player';
import { parseLevel } from '../src/world/tilemap';

const NONE: PlayerControls = { left: false, right: false, jumpPressed: false, jumpHeld: false };
const ALL: PlayerAbilities = { moveLeft: true, jump: true };

// Flat floor with a 1-tile step at column 8.
const level = parseLevel({
  name: 'step',
  rows: ['............', '............', '............', '...P....####', '############'],
  pickups: {},
});

function spawn(): Player {
  const p = new Player(level.spawn.x, level.spawn.y);
  run(p, 5, NONE, ALL); // settle onto the floor
  return p;
}

function run(p: Player, steps: number, c: PlayerControls, a: PlayerAbilities): void {
  for (let i = 0; i < steps; i++) p.update(STEP, c, a, level.map);
}

describe('Player', () => {
  it('lands and stands on the floor', () => {
    const p = spawn();
    expect(p.onGround).toBe(true);
    expect(p.feetY).toBe(4 * TILE);
  });

  it('cannot walk left without LEFT, can with it', () => {
    const p = spawn();
    const x = p.feetX;
    run(p, 20, { ...NONE, left: true }, { moveLeft: false, jump: true });
    expect(p.feetX).toBe(x);
    run(p, 20, { ...NONE, left: true }, ALL);
    expect(p.feetX).toBeLessThan(x);
  });

  it('is blocked by a 1-tile step without JUMP', () => {
    const p = spawn();
    run(
      p,
      120,
      { ...NONE, right: true, jumpPressed: true, jumpHeld: true },
      { moveLeft: true, jump: false },
    );
    expect(p.box.x + p.box.w).toBe(8 * TILE);
    expect(p.feetY).toBe(4 * TILE);
  });

  it('climbs the step with JUMP', () => {
    const p = spawn();
    run(p, 40, { ...NONE, right: true }, ALL);
    p.update(STEP, { right: true, left: false, jumpPressed: true, jumpHeld: true }, ALL, level.map);
    run(p, 60, { ...NONE, right: true, jumpHeld: true }, ALL);
    expect(p.feetX).toBeGreaterThan(8 * TILE);
    expect(p.feetY).toBe(3 * TILE);
  });

  it('jumps higher when jump is held (variable height)', () => {
    const apex = (held: boolean) => {
      const p = spawn();
      p.update(STEP, { ...NONE, jumpPressed: true, jumpHeld: held }, ALL, level.map);
      let top = p.feetY;
      for (let i = 0; i < 60; i++) {
        p.update(STEP, { ...NONE, jumpHeld: held }, ALL, level.map);
        top = Math.min(top, p.feetY);
      }
      return 4 * TILE - top;
    };
    expect(apex(true)).toBeGreaterThan(TILE * 2);
    expect(apex(false)).toBeLessThan(apex(true) / 2);
  });

  it('buffers a jump pressed just before landing', () => {
    const p = new Player(level.spawn.x, level.spawn.y - 6); // slightly in the air
    p.update(STEP, { ...NONE, jumpPressed: true, jumpHeld: true }, ALL, level.map);
    let jumped = false;
    for (let i = 0; i < 6 && !jumped; i++) {
      jumped = p.update(STEP, { ...NONE, jumpHeld: true }, ALL, level.map).jumped;
    }
    expect(jumped).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { STEP, TILE } from '../src/config';
import { Player, type PlayerAbilities, type PlayerControls } from '../src/game/player';
import { parseLevel } from '../src/world/tilemap';

const NONE: PlayerControls = {
  left: false,
  right: false,
  down: false,
  jumpPressed: false,
  jumpHeld: false,
  attackPressed: false,
};
const ALL: PlayerAbilities = {
  moveLeft: true,
  jump: true,
  grab: true,
  punch: true,
  wallJump: true,
};
const NO_GRAB: PlayerAbilities = { ...ALL, grab: false };

// Floor top at row 9. A 1-tile step from column 6 (top row 8), a 3-tile wall from
// column 9 (top row 5), and a 4-tile wall from column 13 (top row 1).
const level = parseLevel({
  name: 'walls',
  rows: [
    '................',
    '.............###',
    '.............###',
    '.............###',
    '.............###',
    '.........#######',
    '.........#######',
    '.........#######',
    '...P..##########',
    '################',
  ],
  pickups: {},
});
const FLOOR_Y = 9 * TILE;
const STEP_Y = 8 * TILE;
const WALL3_Y = 5 * TILE;

function spawn(): Player {
  const p = new Player(level.spawn.x, level.spawn.y);
  run(p, 5, NONE, ALL); // settle onto the floor
  return p;
}

function run(p: Player, steps: number, c: PlayerControls, a: PlayerAbilities): void {
  for (let i = 0; i < steps; i++) p.update(STEP, c, a, level.map);
}

/** Hold `dir`, tap jump once, and keep holding until something happens. */
function jumpAt(p: Player, dir: 'left' | 'right', a: PlayerAbilities, steps = 60): void {
  p.update(STEP, { ...NONE, [dir]: true, jumpPressed: true, jumpHeld: true }, a, level.map);
  for (let i = 0; i < steps && p.state === 'normal'; i++) {
    p.update(STEP, { ...NONE, [dir]: true, jumpHeld: true }, a, level.map);
    if (p.onGround) break;
  }
}

describe('Player movement', () => {
  it('lands and stands on the floor', () => {
    const p = spawn();
    expect(p.onGround).toBe(true);
    expect(p.feetY).toBe(FLOOR_Y);
  });

  it('cannot walk left without LEFT, can with it', () => {
    const p = spawn();
    const x = p.feetX;
    run(p, 20, { ...NONE, left: true }, { ...ALL, moveLeft: false });
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
      { ...ALL, jump: false },
    );
    expect(p.box.x + p.box.w).toBe(6 * TILE);
    expect(p.feetY).toBe(FLOOR_Y);
  });

  it('climbs the 1-tile step with JUMP', () => {
    const p = spawn();
    run(p, 40, { ...NONE, right: true }, ALL);
    jumpAt(p, 'right', NO_GRAB);
    run(p, 30, { ...NONE, right: true }, NO_GRAB);
    expect(p.feetY).toBe(STEP_Y);
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
      return FLOOR_Y - top;
    };
    expect(apex(true)).toBeGreaterThan(TILE * 2);
    expect(apex(true)).toBeLessThan(TILE * 3);
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

describe('Ledge grab (ARMS)', () => {
  /** Stand on the 1-tile step, pressed against the 3-tile wall. */
  function atThreeTileWall(a: PlayerAbilities): Player {
    const p = spawn();
    run(p, 40, { ...NONE, right: true }, a);
    jumpAt(p, 'right', a);
    run(p, 60, { ...NONE, right: true }, a);
    expect(p.feetY).toBe(STEP_Y);
    expect(p.box.x + p.box.w).toBe(9 * TILE);
    return p;
  }

  it('cannot get up a 3-tile wall without ARMS', () => {
    const p = atThreeTileWall(NO_GRAB);
    jumpAt(p, 'right', NO_GRAB);
    run(p, 60, { ...NONE, right: true }, NO_GRAB);
    expect(p.feetY).toBe(STEP_Y);
  });

  it('hangs from a 3-tile wall with ARMS, then climbs onto it', () => {
    const p = atThreeTileWall(ALL);
    jumpAt(p, 'right', ALL);
    expect(p.state).toBe('hang');
    expect(p.box.y).toBe(WALL3_Y + 2);

    // Hanging is stable without input.
    run(p, 30, NONE, ALL);
    expect(p.state).toBe('hang');

    p.update(STEP, { ...NONE, jumpPressed: true, jumpHeld: true }, ALL, level.map);
    expect(p.state).toBe('climb');
    run(p, 30, NONE, ALL);
    expect(p.state).toBe('normal');
    expect(p.onGround).toBe(true);
    expect(p.feetY).toBe(WALL3_Y);
    expect(p.box.x).toBe(9 * TILE);
  });

  it('drops from a hang with down', () => {
    const p = atThreeTileWall(ALL);
    jumpAt(p, 'right', ALL);
    expect(p.state).toBe('hang');
    p.update(STEP, { ...NONE, down: true }, ALL, level.map);
    expect(p.state).toBe('normal');
    run(p, 60, NONE, ALL);
    expect(p.feetY).toBe(STEP_Y);
  });

  it('cannot reach the top of a 4-tile wall even with ARMS', () => {
    const p = atThreeTileWall(ALL);
    jumpAt(p, 'right', ALL);
    p.update(STEP, { ...NONE, jumpPressed: true, jumpHeld: true }, ALL, level.map);
    run(p, 30, NONE, ALL);
    expect(p.feetY).toBe(WALL3_Y); // on top of the 3-tile wall
    run(p, 60, { ...NONE, right: true }, ALL);
    expect(p.box.x + p.box.w).toBe(13 * TILE); // pressed against the 4-tile wall
    jumpAt(p, 'right', ALL);
    run(p, 60, { ...NONE, right: true }, ALL);
    expect(p.state).toBe('normal');
    expect(p.feetY).toBe(WALL3_Y);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { STEP, TILE, VIEW_W } from '../src/config';
import { FEATURE_IDS, FEATURES, FeatureRegistry, type FeatureId } from '../src/core/features';
import type { Action, ActionState } from '../src/core/input';
import { KNIGHT_HP } from '../src/game/enemies';
import { Game } from '../src/game/game';
import { FIST_HP, HEAD_HP } from '../src/game/warden';
import { ERA3_LEVEL } from '../src/world/levels/era3';
import { parseLevel, Tile, type LevelDef } from '../src/world/tilemap';

/** Everything from Eras 0–2. */
const BEFORE_ERA3: FeatureId[] = FEATURE_IDS.filter((id) => FEATURES[id].era < 3);

class FakeInput implements ActionState {
  down = new Set<Action>();
  pressed = new Set<Action>();
  isDown(a: Action) {
    return this.down.has(a);
  }
  wasPressed(a: Action) {
    return this.pressed.has(a);
  }
}

function setup(
  rows: string[],
  extra: FeatureId[] = [],
  hooks = {},
  npcs?: Record<string, string[]>,
) {
  const def: LevelDef = { name: 't', era: 3, rows, pickups: {}, npcs };
  const features = new FeatureRegistry([...BEFORE_ERA3, ...extra]);
  const game = new Game({ features, level: parseLevel(def), hooks });
  const input = new FakeInput();
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      game.update(STEP, input);
      input.pressed.clear();
    }
  };
  return { game, features, input, step };
}

// The knight is within its patrol range of the player.
const KNIGHT_ROOM = ['................', '..P....k........', '################'];

describe('SWORD and knights', () => {
  it('punches clank off armour', () => {
    const { game, input, step } = setup(KNIGHT_ROOM);
    const knight = game.knights[0];
    for (let i = 0; i < 200 && knight.box.x - (game.player.box.x + 10) > 10; i++) step();
    input.pressed.add('attack');
    step(2);
    expect(knight.hp).toBe(KNIGHT_HP);
  });

  it('a three-swing combo beats a knight', () => {
    const { game, input, step } = setup(KNIGHT_ROOM, ['SWORD']);
    const knight = game.knights[0];
    for (let i = 0; i < 200 && knight.box.x - (game.player.box.x + 10) > 16; i++) step();
    for (let swing = 0; swing < 3 && knight.alive; swing++) {
      input.pressed.add('attack');
      step(14);
    }
    expect(knight.alive).toBe(false);
    expect(game.deathT).toBeNull();
  });
});

describe('DASH', () => {
  // A 4-tile spike pit: too wide to jump on its own.
  const PIT = ['................', '..P.............', '#####^^^^#######'];

  function crossPit(extra: FeatureId[]) {
    const { game, input, step } = setup(PIT, extra);
    const p = game.player;
    input.down = new Set(['right', 'jump']);
    for (let i = 0; i < 200 && p.box.x + p.box.w < 5 * TILE - 1; i++) step();
    input.pressed.add('jump');
    step(12);
    input.pressed.add('dash');
    step(60);
    return game.deathT === null && p.feetX > 9 * TILE;
  }

  it('without it, you cannot clear a 4-tile pit', () => {
    expect(crossPit([])).toBe(false);
  });

  it('jump + dash clears it', () => {
    expect(crossPit(['DASH'])).toBe(true);
  });

  it('dashing through an enemy is safe', () => {
    const { game, input, step } = setup(
      ['................', '..P...e.........', '################'],
      ['DASH'],
    );
    const p = game.player;
    input.down = new Set(['right']);
    const walker = game.walkers[0];
    for (let i = 0; i < 200 && walker.box.x - (p.box.x + p.box.w) > 4; i++) step();
    input.pressed.add('dash');
    step(12);
    expect(p.box.x).toBeGreaterThan(walker.box.x + walker.box.w);
    expect(game.deathT).toBeNull();
  });
});

describe('NPCs and dialogue', () => {
  const ROOM = ['................', '..PN............', '################'];
  const LINES = { N: ['HELLO.', 'GOODBYE.'] };

  it('NPCs only exist once NPCS is collected', () => {
    const { game, input, step } = setup(ROOM, [], {}, LINES);
    input.pressed.add('up');
    step();
    expect(game.dialogue).toBeNull();
  });

  it('press up to talk; the game pauses; pages turn; it closes', () => {
    const { game, input, step } = setup(ROOM, ['NPCS'], {}, LINES);
    step(5);
    expect(game.talkableNpc?.id).toBe('N');
    input.pressed.add('up');
    step();
    expect(game.dialogue?.page).toBe(0);
    const time = game.time;
    step(60); // types out the page; the world doesn't move
    expect(game.dialogue?.chars).toBe('HELLO.'.length);
    input.pressed.add('jump');
    step();
    expect(game.dialogue?.page).toBe(1);
    step(60);
    input.pressed.add('jump');
    step();
    expect(game.dialogue).toBeNull();
    expect(game.time).toBeGreaterThan(time);
  });
});

describe('SAMPLES + STEREO', () => {
  it('knights footsteps are positioned so you can hear them off-screen', () => {
    const sound = vi.fn();
    const rows = [
      '................................',
      '..P.....................k.......',
      '################################',
    ];
    const { step } = setup(rows, ['SAMPLES_STEREO'], { sound });
    step(120);
    const steps = sound.mock.calls.filter(([name]) => name === 'step');
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0][1]).toBeGreaterThan(VIEW_W); // off to the right
  });
});

describe('The Warden (boss)', () => {
  const ARENA = [
    '................' + '...............#',
    '................' + '...............#',
    '................' + '...............#',
    '................' + '...............#',
    '................' + '...............#',
    '................' + '...............#',
    '................' + '...............#',
    '................' + '..P.....W......#',
    '################' + '################',
  ];

  it('fists are only hurt while stuck; then the head; then the era ends', () => {
    const { game, step } = setup(ARENA, ['SWORD', 'SCROLLING']);
    const boss = game.warden!;
    step(2);
    expect(boss.state).toBe('fists');
    let id = 1000;
    for (const fist of boss.fists) {
      expect(fist.hit(id++)).toBe('blocked');
    }
    const safe = () => {
      game.invulnerableT = 1;
      game.player.teleport(VIEW_W + 20, 8 * TILE);
    };
    // Break both fists.
    for (let n = 0; n < FIST_HP * 2; n++) {
      let fist = boss.fists.find((f) => f.state === 'stuck');
      for (let s = 0; s < 600 && !fist; s++) {
        step();
        safe();
        fist = boss.fists.find((f) => f.state === 'stuck');
      }
      expect(fist, 'a fist got stuck').toBeDefined();
      fist!.hit(id++);
    }
    expect(boss.fists.every((f) => f.state === 'broken')).toBe(true);
    // Then the head.
    for (let n = 0; n < HEAD_HP; n++) {
      for (let s = 0; s < 900 && !(boss.state === 'head' && boss.headVulnerable); s++) {
        step();
        safe();
      }
      expect(boss.hitHead(id++)).toBe(n === HEAD_HP - 1 ? 'killed' : 'damaged');
      for (let s = 0; s < 400 && boss.headVulnerable && boss.state === 'head'; s++) step();
    }
    for (let s = 0; s < 400 && game.request === null; s++) step();
    expect(game.request).toBe('eraComplete');
  });
});

describe('Era 3 level', () => {
  it('has its eight pickups on solid ground, three NPCs, knights and the Warden', () => {
    const level = parseLevel(ERA3_LEVEL);
    expect(level.pickups.map((p) => p.feature).sort()).toEqual(
      FEATURE_IDS.filter((id) => FEATURES[id].era === 3).sort(),
    );
    for (const p of level.pickups) {
      const below = level.map.isSolid(Math.floor(p.x / TILE), Math.floor(p.y / TILE) + 1);
      expect(below, `${p.feature} has ground below`).toBe(true);
    }
    expect(level.entities.filter((e) => e.kind === 'npc').map((e) => e.id)).toEqual([
      'N',
      'M',
      'O',
    ]);
    expect(level.entities.filter((e) => e.kind === 'warden')).toHaveLength(1);
  });

  it('a simple bot plays it to the boss arena with every Era 3 pickup', () => {
    const features = new FeatureRegistry(BEFORE_ERA3);
    const level = parseLevel(ERA3_LEVEL);
    const game = new Game({ features, level });
    const input = new FakeInput();
    const p = game.player;
    const arenaX = game.warden!.arenaX;
    const tileAhead = (dx: number, dy: number) =>
      level.map.tileAt(
        Math.floor((p.box.x + p.box.w + dx) / TILE),
        Math.floor((p.feetY + dy) / TILE),
      );

    let cooldown = 0;
    let deaths = 0;
    let dashedThisJump = false;
    for (let i = 0; i < 60 * 180 && game.activeArenaX !== arenaX; i++) {
      if (game.request === 'gameOver') {
        game.request = null;
        game.lives = 3;
        p.teleport(game.checkpoint.x, game.checkpoint.y);
      }
      cooldown = Math.max(0, cooldown - 1);
      input.down = new Set(['right', 'jump']);
      if (p.onGround) dashedThisJump = false;

      const front = p.box.x + p.box.w;
      const enemyAhead = [...game.walkers, ...game.knights].find(
        (e) =>
          e.alive &&
          e.box.x + e.box.w > p.box.x &&
          e.box.x - front < 40 &&
          Math.abs(e.box.y + e.box.h - p.feetY) < 4,
      );
      const gap = enemyAhead ? enemyAhead.box.x - front : Infinity;
      const hazard = [1, 4].some((d) => {
        const below = tileAhead(d, 1);
        return tileAhead(d, -1) === Tile.Spikes || below === Tile.Hot || below === Tile.Spikes;
      });
      const pitBelow = [0, 20, 40].some(
        (d) => tileAhead(d, 1) === Tile.Spikes || tileAhead(d, 10) === Tile.Spikes,
      );
      const blocked = p.onGround && p.vx === 0 && game.moment === null;

      // An enemy right next to you (either side): face it and swing.
      const close = [...game.walkers, ...game.knights].find(
        (e) =>
          e.alive &&
          Math.abs(e.box.x + e.box.w / 2 - p.feetX) < 26 &&
          Math.abs(e.box.y + e.box.h - p.feetY) < 4,
      );
      if (close && features.has('SWORD')) {
        // Stand your ground: turn to face it if needed, otherwise stop, and keep swinging.
        const toward = close.box.x + close.box.w / 2 < p.feetX ? -1 : 1;
        input.down = new Set(p.facing === toward ? [] : [toward < 0 ? 'left' : 'right']);
        if (cooldown === 0) {
          input.pressed.add('attack');
          cooldown = 14;
        }
      } else if (enemyAhead && features.has('SWORD') && gap < 18 && cooldown === 0) {
        input.pressed.add('attack');
        cooldown = 12;
      } else if (enemyAhead && !features.has('SWORD') && gap < 10) {
        input.pressed.add('attack');
      } else if (!p.onGround && !dashedThisJump && features.has('DASH') && p.vy > -60 && pitBelow) {
        input.pressed.add('dash');
        dashedThisJump = true;
      } else if (
        cooldown === 0 &&
        p.onGround &&
        (hazard || blocked || (enemyAhead && gap < 26 && !features.has('SWORD')))
      ) {
        input.pressed.add('jump');
        cooldown = 8;
      }

      const wasAlive = game.deathT === null;
      game.update(STEP, input);
      input.pressed.clear();
      if (wasAlive && game.deathT !== null) deaths++;
    }

    expect(
      game.activeArenaX,
      `reached the arena (stuck at ${p.feetX.toFixed(0)},${p.feetY.toFixed(0)})`,
    ).toBe(arenaX);
    for (const f of FEATURE_IDS.filter((id) => FEATURES[id].era === 3)) {
      expect(features.has(f), f).toBe(true);
    }
    expect(deaths).toBeLessThanOrEqual(3);
  });
});

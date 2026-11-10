import { describe, expect, it } from 'vitest';
import { STEP, TILE, VIEW_W } from '../src/config';
import { FeatureRegistry, type FeatureId } from '../src/core/features';
import type { Action, ActionState } from '../src/core/input';
import { FLICKER_HP } from '../src/game/enemies';
import { Game, MOMENT_DURATION } from '../src/game/game';
import { ERA2_LEVEL } from '../src/world/levels/era2';
import { parseLevel, Tile, type LevelDef } from '../src/world/tilemap';

const BEFORE_ERA2: FeatureId[] = [
  'LEFT',
  'JUMP',
  'BEEP',
  'SCREEN_2',
  'ARMS',
  'SCORE',
  'FRAME_RATE',
  'ENEMIES',
  'DEATH',
  'LIVES',
  'PUNCH',
  'SFX',
  'TITLE_SCREEN',
];

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

function setup(rows: string[], extra: FeatureId[] = []) {
  const def: LevelDef = { name: 't', era: 2, rows, pickups: {} };
  const features = new FeatureRegistry([...BEFORE_ERA2, ...extra]);
  const game = new Game({ features, level: parseLevel(def) });
  const input = new FakeInput();
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      game.update(STEP, input);
      input.pressed.clear();
    }
  };
  return { game, features, input, step };
}

describe('HANDS & FEET', () => {
  // A 4-tile block: too high for ARMS, so you need to wall-jump.
  const SHAFT = [
    '................',
    '................',
    '................',
    '................',
    '.........#######',
    '.........#######',
    '.........#######',
    '...P.....#######',
    '################',
  ];

  function climb(extra: FeatureId[]) {
    const { game, input, step } = setup(SHAFT, extra);
    const p = game.player;
    input.down = new Set(['right', 'jump']);
    let cooldown = 0;
    let reachedTop = false;
    for (let i = 0; i < 600 && !reachedTop; i++) {
      cooldown = Math.max(0, cooldown - 1);
      const touching = !p.onGround && p.vx === 0;
      if (cooldown === 0 && (p.onGround || touching || p.state === 'hang')) {
        input.pressed.add('jump');
        cooldown = 8;
      }
      step();
      reachedTop = p.onGround && p.feetY === 4 * TILE;
    }
    return reachedTop;
  }

  it('cannot climb a 4-tile wall without it', () => {
    expect(climb([])).toBe(false);
  });

  it('wall-jumps up a 4-tile wall with it', () => {
    expect(climb(['HANDS_FEET'])).toBe(true);
  });

  it('slides down walls slowly', () => {
    const { game, input, step } = setup(SHAFT, ['HANDS_FEET']);
    const p = game.player;
    input.down = new Set(['right', 'jump']);
    step(80); // walk to the wall
    input.pressed.add('jump');
    let maxFall = 0;
    for (let i = 0; i < 60; i++) {
      step();
      if (!p.onGround && p.wallSliding) maxFall = Math.max(maxFall, p.vy);
    }
    expect(maxFall).toBeGreaterThan(0);
    expect(maxFall).toBeLessThanOrEqual(90);
  });
});

describe('THROW, switches and doors', () => {
  const ROOM = [
    '..........D.....',
    '.......s..D.....',
    '..........D.....',
    '...P......D..e..',
    '################',
  ];

  it('pebbles thrown up hit the switch, which opens the doors on its screen', () => {
    const { game, input, step } = setup(ROOM, ['THROW']);
    const p = game.player;
    const sw = game.switches[0];
    const switchX = sw.box.x + sw.box.w / 2;
    input.down = new Set(['right']);
    for (let i = 0; i < 200 && p.feetX < switchX; i++) step();
    input.down = new Set(['up']);
    input.pressed.add('special');
    step(40);
    expect(sw.hit).toBe(true);
    expect(game.map.tileAt(10, 0)).toBe(Tile.Empty);
  });

  it('pebbles thrown forward hit walkers', () => {
    const { game, input, step } = setup(
      ['................', '..P........e....', '################'],
      ['THROW'],
    );
    const walker = game.walkers[0];
    // Wait until it's in range, then throw.
    for (let i = 0; i < 300 && walker.box.x - game.player.box.x > 70; i++) step();
    input.pressed.add('special');
    for (let i = 0; i < 60 && walker.alive; i++) step();
    expect(walker.alive).toBe(false);
  });
});

describe('CHECKPOINTS', () => {
  const ROOM = ['................', '..P....F........', '################'];

  it('flags do nothing before CHECKPOINTS, then save your position', () => {
    const before = setup(ROOM);
    before.input.down = new Set(['right']);
    before.step(80);
    expect(before.game.flags[0].raised).toBe(false);

    const after = setup(ROOM, ['CHECKPOINTS']);
    after.input.down = new Set(['right']);
    after.step(80);
    expect(after.game.flags[0].raised).toBe(true);
    expect(after.game.checkpoint).toEqual({ x: 7 * TILE + TILE / 2, y: 2 * TILE });
  });
});

describe('Hot bricks', () => {
  it('are only deadly with DEATH, and only when you stand on them', () => {
    const rows = ['................', '..P.............', '####~###########'];
    const { game, input, step } = setup(rows);
    input.down = new Set(['right']);
    step(40);
    expect(game.deathT).not.toBeNull();
  });
});

describe('Flicker (boss)', () => {
  const ARENA = [
    '................' + '...............#',
    '................' + '...............#',
    '................' + '........V......#',
    '................' + '...............#',
    '................' + '...............#',
    '................' + '...............#',
    '................' + '...............#',
    '................' + '..P............#',
    '################' + '################',
  ];

  it('wakes, drops bombs, can only be hurt when not flickering, and awards COLOUR (16)', () => {
    const { game, features, step } = setup(ARENA, ['SCROLLING', 'THROW']);
    const boss = game.flicker!;
    step(2);
    expect(boss.state).toBe('hover');
    expect(game.camera.lockX).toBe(VIEW_W);
    step(120);
    expect(game.camera.x).toBe(VIEW_W); // fully settled on the arena, not halfway

    let sawBomb = false;
    for (let i = 0; i < FLICKER_HP; i++) {
      for (let s = 0; s < 600 && (boss.state !== 'hover' || boss.flickering); s++) {
        step();
        game.invulnerableT = 1; // test the boss, not dodging
        sawBomb ||= game.bombs.length > 0;
      }
      expect(boss.hit()).toBe(i === FLICKER_HP - 1 ? 'killed' : 'damaged');
      expect(boss.hit()).toBe(i === FLICKER_HP - 1 ? 'ignored' : 'blocked');
    }
    expect(sawBomb).toBe(true);

    for (let s = 0; s < 300 && boss.state !== 'dead'; s++) step();
    step(2);
    expect(features.has('COLOUR_16')).toBe(true);
    expect(game.moment?.feature).toBe('COLOUR_16');
    step(Math.ceil(MOMENT_DURATION / STEP) + 2);
    expect(game.request).toBe('eraComplete');
  });
});

describe('Era 2 level', () => {
  it('has its seven pickups on solid ground, flags, a switch and Flicker', () => {
    const level = parseLevel(ERA2_LEVEL);
    expect(level.pickups.map((p) => p.feature).sort()).toEqual(
      ['COLOUR_4', 'SCROLLING', 'ANIMATION', 'MUSIC', 'HANDS_FEET', 'THROW', 'CHECKPOINTS'].sort(),
    );
    for (const p of level.pickups) {
      const below = level.map.isSolid(Math.floor(p.x / TILE), Math.floor(p.y / TILE) + 1);
      expect(below, `${p.feature} has ground below`).toBe(true);
    }
    expect(level.entities.filter((e) => e.kind === 'flicker')).toHaveLength(1);
    expect(level.entities.filter((e) => e.kind === 'flag')).toHaveLength(2);
    expect(level.entities.filter((e) => e.kind === 'switch')).toHaveLength(1);
  });

  it('a simple bot plays it to the boss arena with every Era 2 pickup', () => {
    const features = new FeatureRegistry(BEFORE_ERA2);
    const level = parseLevel(ERA2_LEVEL);
    const game = new Game({ features, level });
    const input = new FakeInput();
    const p = game.player;
    const arenaX = game.flicker!.arenaX;
    const tileAhead = (dx: number, dy: number) =>
      level.map.tileAt(
        Math.floor((p.box.x + p.box.w + dx) / TILE),
        Math.floor((p.feetY + dy) / TILE),
      );

    let cooldown = 0;
    let deaths = 0;
    for (let i = 0; i < 60 * 180 && game.activeArenaX !== arenaX; i++) {
      if (game.request === 'gameOver') {
        game.request = null;
        game.lives = 3;
        p.teleport(game.checkpoint.x, game.checkpoint.y);
      }
      cooldown = Math.max(0, cooldown - 1);
      input.down = new Set(['right', 'jump']);

      const front = p.box.x + p.box.w;
      const sw = game.switches.find((s) => !s.hit && Math.abs(s.box.x - p.box.x) < 160);
      const walker = game.walkers.find(
        (w) =>
          w.alive &&
          w.box.x > p.box.x &&
          w.box.x - front < 70 &&
          Math.abs(w.box.y + w.box.h - p.feetY) < 4,
      );
      const hazard = [1, 4].some((d) => {
        const above = tileAhead(d, -1);
        const below = tileAhead(d, 1);
        return above === Tile.Spikes || below === Tile.Hot || below === Tile.Spikes;
      });
      const edge =
        p.onGround &&
        !level.map.isSolid(Math.floor((front + 3) / TILE), Math.floor((p.feetY + 1) / TILE));
      const blocked = p.onGround && p.vx === 0 && game.moment === null;
      const onWall = !p.onGround && p.vx === 0 && features.has('HANDS_FEET');

      if (sw && features.has('THROW')) {
        // Stand under the switch and throw up.
        const dx = sw.box.x + sw.box.w / 2 - p.feetX;
        input.down = new Set(Math.abs(dx) > 3 ? [dx > 0 ? 'right' : 'left'] : ['up']);
        if (Math.abs(dx) <= 3 && cooldown === 0) {
          input.pressed.add('special');
          cooldown = 30;
        }
      } else if (p.state === 'hang') {
        input.pressed.add('jump');
      } else if (walker && features.has('THROW') && cooldown === 0) {
        input.pressed.add('special');
        cooldown = 25;
      } else if (cooldown === 0 && ((p.onGround && (hazard || edge || blocked)) || onWall)) {
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
    for (const f of [
      'COLOUR_4',
      'SCROLLING',
      'ANIMATION',
      'MUSIC',
      'HANDS_FEET',
      'THROW',
      'CHECKPOINTS',
    ] as const) {
      expect(features.has(f), f).toBe(true);
    }
    expect(deaths).toBeLessThanOrEqual(3);
  });
});

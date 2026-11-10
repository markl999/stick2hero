import { describe, expect, it, vi } from 'vitest';
import { STEP, TILE, VIEW_W } from '../src/config';
import { FeatureRegistry, type FeatureId } from '../src/core/features';
import type { Action, ActionState } from '../src/core/input';
import { BOSS_HP } from '../src/game/enemies';
import { DEATH_TIME, Game, START_LIVES } from '../src/game/game';
import { ERA1_LEVEL } from '../src/world/levels/era1';
import { parseLevel, type LevelDef } from '../src/world/tilemap';

const ERA0_ALL: FeatureId[] = ['LEFT', 'JUMP', 'BEEP', 'SCREEN_2', 'ARMS', 'SCORE', 'FRAME_RATE'];

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

function setup(rows: string[], extra: FeatureId[] = [], hooks = {}) {
  const def: LevelDef = { name: 't', era: 1, rows, pickups: {} };
  const features = new FeatureRegistry([...ERA0_ALL, ...extra]);
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

// A walker two tiles to the right of the player, walking left towards him.
const WALKER_ROOM = ['................', '..P..e..........', '################'];

describe('Enemies, death and lives', () => {
  it('has no enemies until ENEMIES', () => {
    const { game, step } = setup(WALKER_ROOM);
    const x = game.walkers[0].box.x;
    step(60);
    expect(game.enemiesActive).toBe(false);
    expect(game.walkers[0].box.x).toBe(x);
  });

  it('enemies are harmless until DEATH', () => {
    const { game, step } = setup(WALKER_ROOM, ['ENEMIES']);
    step(180); // the walker walks right through him
    expect(game.deathT).toBeNull();
  });

  it('with DEATH, touching an enemy kills and respawns you at the checkpoint', () => {
    const sound = vi.fn();
    const { game, step } = setup(WALKER_ROOM, ['ENEMIES', 'DEATH', 'SFX'], { sound });
    step(120);
    expect(game.deathT).not.toBeNull();
    expect(sound).toHaveBeenCalledWith('die', expect.any(Number));
    step(Math.ceil(DEATH_TIME / STEP) + 1);
    expect(game.deathT).toBeNull();
    expect(game.player.feetX).toBe(game.level.spawn.x);
    expect(game.invulnerableT).toBeGreaterThan(0);
  });

  it('LIVES: three deaths and it is game over', () => {
    const { game, step } = setup(WALKER_ROOM, ['ENEMIES', 'DEATH', 'LIVES']);
    expect(game.lives).toBe(START_LIVES);
    for (let i = 0; i < 2400 && game.request === null; i++) step();
    expect(game.request).toBe('gameOver');
    expect(game.lives).toBe(0);
  });

  it('spikes only hurt once DEATH exists', () => {
    const rows = ['................', '..P^............', '################'];
    const safe = setup(rows, ['ENEMIES']);
    safe.input.down.add('right');
    safe.step(30);
    expect(safe.game.deathT).toBeNull();

    const deadly = setup(rows, ['ENEMIES', 'DEATH']);
    deadly.input.down.add('right');
    deadly.step(30);
    expect(deadly.game.deathT).not.toBeNull();
  });

  it('PUNCH kills a walker in front of you', () => {
    const { game, input, step } = setup(WALKER_ROOM, ['ENEMIES', 'DEATH', 'PUNCH']);
    const walker = game.walkers[0];
    // Wait until it's in reach, then punch.
    for (let i = 0; i < 120 && walker.box.x - (game.player.box.x + 10) > 10; i++) step();
    input.pressed.add('attack');
    step(2);
    expect(walker.alive).toBe(false);
    expect(game.deathT).toBeNull();
  });
});

describe('The Block (boss)', () => {
  // The arena is the second screen; the player starts in the arena.
  const ARENA = [
    '................' + '...............#',
    '................' + '...............#',
    '................' + '...............#',
    '................' + '...............#',
    '................' + '...............#',
    '................' + '...............#',
    '................' + '...............#',
    '................' + '#.P........B...#',
    '################' + '################',
  ];
  const FEATURES: FeatureId[] = ['ENEMIES', 'DEATH', 'PUNCH'];

  it('wakes up when you enter its screen', () => {
    const { game, step } = setup(ARENA, FEATURES);
    step(1);
    expect(game.camera.x).toBe(VIEW_W);
    expect(game.boss?.state).not.toBe('waiting');
    expect(game.bossIntroT).not.toBeNull();
  });

  it('blocks punches unless dazed, and dies after enough dazed hits', () => {
    const sound = vi.fn();
    const { game, step } = setup(ARENA, [...FEATURES, 'SFX'], { sound });
    const boss = game.boss!;
    step(1);
    expect(boss.hit(1)).toBe('blocked');
    for (let i = 0; i < BOSS_HP; i++) {
      for (let s = 0; s < 400 && boss.state !== 'dazed'; s++) {
        step();
        // Stay out of its way: keep the player out of reach (test the boss, not dodging).
        game.player.teleport(VIEW_W + 1.5 * TILE, 8 * TILE);
        game.invulnerableT = 1;
      }
      expect(boss.state).toBe('dazed');
      expect(boss.hit(100 + i)).toBe(i === BOSS_HP - 1 ? 'killed' : 'damaged');
    }
    for (let s = 0; s < 300 && game.request === null; s++) step();
    expect(boss.state).toBe('dead');
    expect(game.request).toBe('eraComplete');
  });
});

describe('Era 1 level', () => {
  it('has its six features and the HIGH SCORES secret on solid ground, and one boss', () => {
    const level = parseLevel(ERA1_LEVEL);
    expect(level.era).toBe(1);
    expect(level.pickups.map((p) => p.feature).sort()).toEqual(
      ['ENEMIES', 'DEATH', 'LIVES', 'PUNCH', 'SFX', 'TITLE_SCREEN', 'HIGH_SCORES'].sort(),
    );
    for (const p of level.pickups) {
      const below = level.map.isSolid(Math.floor(p.x / TILE), Math.floor(p.y / TILE) + 1);
      expect(below, `${p.feature} has ground below`).toBe(true);
    }
    expect(level.entities.filter((e) => e.kind === 'block')).toHaveLength(1);
  });
});

describe('Era 1 is playable', () => {
  it('a simple bot reaches the boss arena with every Era 1 feature', () => {
    const features = new FeatureRegistry(ERA0_ALL);
    const level = parseLevel(ERA1_LEVEL);
    const game = new Game({ features, level });
    const input = new FakeInput();
    const p = game.player;
    const arenaX = game.boss!.arenaX;

    let jumpCooldown = 0;
    let deaths = 0;
    for (let i = 0; i < 60 * 120 && game.camera.x !== arenaX; i++) {
      if (game.request === 'title') game.request = null; // the title scene would show here
      if (game.request === 'gameOver') {
        // "Continue": the game-over scene would restart; just keep the bot going.
        game.request = null;
        game.lives = 3;
        p.teleport(game.checkpoint.x, game.checkpoint.y);
      }
      input.down = new Set(['right', 'jump']);
      jumpCooldown = Math.max(0, jumpCooldown - 1);

      const front = p.box.x + p.box.w;
      const walker = game.enemiesActive
        ? game.walkers.find(
            (w) =>
              w.alive &&
              w.box.x + w.box.w > p.box.x &&
              w.box.x - front < 40 &&
              Math.abs(w.box.y + w.box.h - p.feetY) < 4,
          )
        : undefined;
      const gap = walker ? walker.box.x - front : Infinity;
      const spikeAhead = [1, 4].some(
        (d) =>
          level.map.tileAt(Math.floor((front + d) / TILE), Math.floor((p.feetY - 1) / TILE)) === 2,
      );
      const blocked = p.onGround && p.vx === 0 && game.moment === null;
      // Don't hop over a pickup to dodge a walker: collect it.
      const pickupAhead = game.pickups.some(
        (pk) => !pk.collected && pk.x > front && pk.x - front < 30 && Math.abs(pk.y - p.feetY) < 20,
      );
      const dodge = walker !== undefined && gap < 26 && !pickupAhead;

      if (p.state === 'hang')
        input.pressed.add('jump'); // climb up
      else if (walker && features.has('PUNCH') && gap < 10) input.pressed.add('attack');
      else if (p.onGround && jumpCooldown === 0 && (spikeAhead || blocked || dodge)) {
        input.pressed.add('jump');
        jumpCooldown = 20;
      }
      const wasAlive = game.deathT === null;
      game.update(STEP, input);
      input.pressed.clear();
      if (wasAlive && game.deathT !== null) deaths++;
    }

    expect(game.camera.x).toBe(arenaX);
    // A crude bot, so some deaths are fine, but lots would mean an unfair level.
    expect(deaths).toBeLessThanOrEqual(3);
    for (const f of ['ENEMIES', 'DEATH', 'LIVES', 'PUNCH', 'SFX', 'TITLE_SCREEN'] as const) {
      expect(features.has(f), f).toBe(true);
    }
  });
});

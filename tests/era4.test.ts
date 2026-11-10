import { describe, expect, it } from 'vitest';
import { STEP, TILE } from '../src/config';
import { FEATURE_IDS, FEATURES, FeatureRegistry, type FeatureId } from '../src/core/features';
import type { Action, ActionState } from '../src/core/input';
import { DEPRECATOR_LINES, WAVE_LEAD } from '../src/game/era4';
import { Game, MOMENT_DURATION } from '../src/game/game';
import { ERA4_LEVEL } from '../src/world/levels/era4';
import { parseLevel, Tile, type LevelDef } from '../src/world/tilemap';

const BEFORE_ERA4: FeatureId[] = FEATURE_IDS.filter((id) => FEATURES[id].era < 4);
const ERA4: FeatureId[] = FEATURE_IDS.filter((id) => FEATURES[id].era === 4);

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

function setup(rows: string[], extra: FeatureId[] = [], npcs?: Record<string, string[]>) {
  const def: LevelDef = { name: 't', era: 4, rows, pickups: {}, npcs };
  const features = new FeatureRegistry([...BEFORE_ERA4, ...extra]);
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

describe('TRANSPARENCY: hollow walls', () => {
  it('you can always walk through them (TRANSPARENCY just shows it)', () => {
    const { game, input, step } = setup([
      '....hh..........',
      '..P.hh..........',
      '################',
    ]);
    input.down = new Set(['right']);
    step(90);
    expect(game.player.feetX).toBeGreaterThan(6 * TILE);
  });
});

describe('Water', () => {
  const POOL = [
    '................',
    '................',
    '.....wwwwww.....',
    '..P.#wwwwww#....',
    '################',
  ];

  it('you can swim across and climb out over the far wall', () => {
    const { game, input, step } = setup(POOL);
    const p = game.player;
    input.down = new Set(['right', 'jump']);
    let wasInWater = false;
    for (let i = 0; i < 900 && p.feetX < 13 * TILE; i++) {
      if (i % 12 === 0) input.pressed.add('jump');
      step();
      wasInWater ||= p.inWater;
    }
    expect(wasInWater).toBe(true);
    expect(p.feetX).toBeGreaterThanOrEqual(13 * TILE);
  });
});

describe('Braziers', () => {
  it('light when you touch them and become your checkpoint', () => {
    const { game, input, step } = setup([
      '................',
      '..P...b.........',
      '################',
    ]);
    input.down = new Set(['right']);
    step(60);
    expect(game.lights[0].lit).toBe(true);
    expect(game.checkpoint.x).toBe(6 * TILE + TILE / 2);
  });
});

describe('Ghosts', () => {
  it('float towards you and one sword hit ends them', () => {
    const { game, input, step } = setup([
      '................',
      '................',
      '..P.......g.....',
      '################',
    ]);
    const ghost = game.ghosts[0];
    for (let i = 0; i < 300 && ghost.box.x - (game.player.box.x + 10) > 14; i++) step();
    expect(ghost.box.x).toBeLessThan(10 * TILE);
    input.pressed.add('attack');
    step(3);
    expect(ghost.alive).toBe(false);
    expect(game.deathT).toBeNull();
  });
});

describe('PARTICLES and CAMERA', () => {
  const ROOM = ['................', '..P.............', '################'];

  it('no particles or shake until you have them', () => {
    const { game, input, step } = setup(ROOM);
    input.down = new Set(['right']);
    input.pressed.add('jump');
    step(60);
    expect(game.particles.list.length).toBe(0);
    expect(game.camera.lead).toBe(0);
  });

  it('with them: landing dust, and the camera looks ahead', () => {
    const { game, input, step } = setup(ROOM, ['PARTICLES', 'CAMERA', 'SCROLLING']);
    input.down = new Set(['right']);
    input.pressed.add('jump');
    step(40);
    expect(game.particles.list.length).toBeGreaterThan(0);
    expect(game.camera.lead).toBeGreaterThan(10);
  });
});

describe('The cutscene and the Chase', () => {
  // Pickup... chase mark... floor... exit, with the Deprecator near the end.
  const ROWS = [
    '................................................',
    '..P..8......C......................Z.......X....',
    '################################################',
  ];

  function run(extra: FeatureId[] = []) {
    const def: LevelDef = { name: 't', era: 4, rows: ROWS, pickups: { '8': 'CUTSCENE' } };
    const features = new FeatureRegistry([...BEFORE_ERA4, ...extra]);
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

  it('CUTSCENE plays the Deprecator scene, then the wave starts behind you', () => {
    const { game, input, step } = run();
    input.down = new Set(['right']);
    for (let i = 0; i < 200 && !game.features.has('CUTSCENE'); i++) step();
    step(Math.ceil(MOMENT_DURATION / STEP) + 2);
    expect(game.cutscene).not.toBeNull();
    const x = game.player.feetX;
    // Skip through the lines with jump.
    for (let i = 0; i < 1200 && game.cutscene; i++) {
      if (i % 10 === 0) input.pressed.add('jump');
      step();
    }
    expect(game.cutscene).toBeNull();
    expect(game.wave!.active).toBe(true);
    expect(Math.abs(game.wave!.x - (x - WAVE_LEAD))).toBeLessThan(5);
    expect(DEPRECATOR_LINES.length).toBeGreaterThan(2);
  });

  it('standing still gets you deleted; reaching the exit ends the era', () => {
    const { game, step } = run(['CUTSCENE']);
    game.cutsceneSeen = true;
    game.wave!.start(game.player.feetX);
    let deaths = 0;
    for (let i = 0; i < 4 * 60; i++) {
      const alive = game.deathT === null;
      step();
      if (alive && game.deathT !== null) deaths++;
    }
    expect(deaths).toBeGreaterThan(0);

    const fresh = run(['CUTSCENE']);
    fresh.game.cutsceneSeen = true;
    fresh.game.wave!.start(fresh.game.player.feetX);
    fresh.input.down = new Set(['right']);
    for (let i = 0; i < 60 * 20 && fresh.game.request === null; i++) fresh.step();
    expect(fresh.game.request).toBe('eraComplete');
    expect(fresh.game.deathT).toBeNull();
  });

  it('walking past the chase mark without the cutscene still starts it', () => {
    const def: LevelDef = {
      name: 't',
      era: 4,
      rows: ['........................', '..P.......C.....Z.....X.', '########################'],
      pickups: {},
    };
    const features = new FeatureRegistry(BEFORE_ERA4);
    const game = new Game({ features, level: parseLevel(def) });
    const input = new FakeInput();
    input.down = new Set(['right']);
    for (let i = 0; i < 300 && !game.cutscene; i++) game.update(STEP, input);
    expect(features.has('CUTSCENE')).toBe(true);
    expect(game.cutscene).not.toBeNull();
  });
});

describe('Era 4 level', () => {
  it('has its eight pickups on solid ground, the Chase marks, and Q', () => {
    const level = parseLevel(ERA4_LEVEL);
    expect(level.pickups.map((p) => p.feature).sort()).toEqual([...ERA4].sort());
    for (const p of level.pickups) {
      const below = level.map.isSolid(Math.floor(p.x / TILE), Math.floor(p.y / TILE) + 1);
      expect(below, `${p.feature} has ground below`).toBe(true);
    }
    for (const kind of ['chase', 'exit', 'deprecator'] as const) {
      expect(
        level.entities.filter((e) => e.kind === kind),
        kind,
      ).toHaveLength(1);
    }
    expect(level.entities.find((e) => e.kind === 'npc')?.id).toBe('Q');
  });

  it('a simple bot plays it all the way through the Chase', () => {
    const features = new FeatureRegistry(BEFORE_ERA4);
    const level = parseLevel(ERA4_LEVEL);
    const game = new Game({ features, level });
    const input = new FakeInput();
    const p = game.player;
    const tileAhead = (dx: number, dy: number) =>
      level.map.tileAt(
        Math.floor((p.box.x + p.box.w + dx) / TILE),
        Math.floor((p.feetY + dy) / TILE),
      );

    let cooldown = 0;
    let deaths = 0;
    let dashed = false;
    for (let i = 0; i < 60 * 240 && game.request !== 'eraComplete'; i++) {
      if (game.request === 'gameOver') {
        game.request = null;
        game.lives = 3;
        p.teleport(game.checkpoint.x, game.checkpoint.y);
      }
      cooldown = Math.max(0, cooldown - 1);
      input.down = new Set(['right', 'jump']);
      if (p.onGround) dashed = false;

      if (game.cutscene) {
        if (i % 10 === 0) input.pressed.add('jump');
      } else if (p.state === 'hang') {
        input.pressed.add('jump');
      } else {
        const front = p.box.x + p.box.w;
        const enemy = [...game.walkers, ...game.knights, ...game.ghosts].find(
          (e) =>
            e.alive &&
            e.box.x + e.box.w > p.box.x - 4 &&
            e.box.x - front < 40 &&
            Math.abs(e.box.y + e.box.h - p.feetY) < 24,
        );
        const gap = enemy ? enemy.box.x - front : Infinity;
        const hazard = [1, 4].some((d) => {
          const below = tileAhead(d, 1);
          return tileAhead(d, -1) === Tile.Spikes || below === Tile.Spikes || below === Tile.Hot;
        });
        const pitBelow = [0, 20, 40].some(
          (d) => tileAhead(d, 1) === Tile.Spikes || tileAhead(d, 10) === Tile.Spikes,
        );
        const blocked = p.onGround && p.vx === 0 && game.moment === null;

        if (enemy && gap < 18 && cooldown === 0) {
          input.pressed.add('attack');
          cooldown = 12;
        } else if (p.inWater && cooldown === 0) {
          input.pressed.add('jump');
          cooldown = 14;
        } else if (!p.onGround && !dashed && p.vy > -60 && pitBelow) {
          input.pressed.add('dash');
          dashed = true;
        } else if (cooldown === 0 && p.onGround && (hazard || blocked)) {
          input.pressed.add('jump');
          cooldown = 8;
        }
      }

      const wasAlive = game.deathT === null;
      game.update(STEP, input);
      input.pressed.clear();
      if (wasAlive && game.deathT !== null) deaths++;
    }

    expect(game.request, `finished (stuck at ${p.feetX.toFixed(0)},${p.feetY.toFixed(0)})`).toBe(
      'eraComplete',
    );
    for (const f of ERA4) expect(features.has(f), f).toBe(true);
    expect(game.lights.filter((l) => l.kind === 'brazier' && l.lit).length).toBeGreaterThan(0);
    expect(deaths).toBeLessThanOrEqual(3);
  });
});

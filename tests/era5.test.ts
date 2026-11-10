import { describe, expect, it } from 'vitest';
import { STEP, TILE, VIEW_W } from '../src/config';
import { FEATURE_IDS, FEATURES, FeatureRegistry, type FeatureId } from '../src/core/features';
import type { Action, ActionState } from '../src/core/input';
import { RETRO_ACHIEVEMENTS } from '../src/game/achievements';
import { litBy } from '../src/game/era5';
import { BEAM_W, FINALE_KEEP, FINALE_PHASES } from '../src/game/finale';
import { Game, type GameHooks } from '../src/game/game';
import { lineOfSight, visibilityPolygon } from '../src/world/light';
import { ERA5_LEVEL } from '../src/world/levels/era5';
import { parseLevel, Tile, type LevelDef } from '../src/world/tilemap';

const BEFORE_ERA5: FeatureId[] = FEATURE_IDS.filter((id) => FEATURES[id].era < 5);
const ERA5: FeatureId[] = FEATURE_IDS.filter((id) => FEATURES[id].era === 5);

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

function setup(rows: string[], extra: FeatureId[] = [], hooks: GameHooks = {}) {
  const def: LevelDef = { name: 't', era: 5, rows, pickups: {} };
  const features = new FeatureRegistry([...BEFORE_ERA5, ...extra]);
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

describe('light geometry', () => {
  const map = parseLevel({
    name: 't',
    rows: ['..........', '....#.....', '..P.#.....', '##########'],
    pickups: {},
  }).map;

  it('walls block the line of sight', () => {
    expect(lineOfSight(map, 30, 50, 150, 50)).toBe(false);
    expect(lineOfSight(map, 30, 10, 150, 10)).toBe(true);
  });

  it('a light behind a wall casts a shadow polygon around it', () => {
    const poly = visibilityPolygon(map, { x: 30, y: 30 }, 120);
    expect(poly.length).toBeGreaterThan(6);
    // Nothing in the polygon pokes through the pillar at x 80..100.
    const behind = poly.filter((p) => p.x > 101 && p.y > 25 && p.y < 59);
    expect(behind.length).toBe(0);
  });
});

describe('CAPE: gliding', () => {
  // A 6-tile gap: too far to jump (even with a dash), easy to glide.
  const GAP = [
    '..........................',
    '..........................',
    '..........................',
    '..P.......................',
    '#########......###########',
  ];

  function attempt(extra: FeatureId[], dash = false) {
    const { game, input, step } = setup(GAP, extra);
    const p = game.player;
    input.down = new Set(['right']);
    // Take a run-up, jump off the very edge, and hold it.
    for (let i = 0; i < 300 && p.box.x + p.box.w < 9 * TILE - 1; i++) step();
    input.pressed.add('jump');
    input.down = new Set(['right', 'jump']);
    for (let i = 0; i < 120; i++) {
      if (dash && i === 14) input.pressed.add('dash');
      step();
    }
    return game;
  }

  it('without the cape you fall', () => {
    const game = attempt([], true);
    expect(game.deathT !== null || game.player.feetX < 15 * TILE).toBe(true);
  });

  it('with it you glide across', () => {
    const game = attempt(['CAPE']);
    expect(game.player.feetX).toBeGreaterThan(15 * TILE);
    expect(game.player.glideTime).toBeGreaterThan(0.5);
    expect(game.deathT).toBeNull();
  });

  it("a vent's updraft lifts you while you glide", () => {
    const { game, input, step } = setup(
      [
        '................',
        '................',
        '................',
        '................',
        '................',
        '..P....u........',
        '################',
      ],
      ['CAPE'],
    );
    const p = game.player;
    p.teleport(7 * TILE + 10, 4 * TILE);
    input.down = new Set(['jump']);
    const startY = p.feetY;
    step(40);
    expect(p.feetY).toBeLessThan(startY - 30);
  });
});

describe('DYNAMIC SHADOWS and drones', () => {
  // A lamp on a roof slab above a corridor, a drone inside looking along it.
  const CORRIDOR = [
    '................',
    '................',
    '..........l.....',
    '....############',
    '................',
    '...............<',
    '..P.............',
    '################',
  ];

  it('without shadows the light shines through the slab; with them it does not', () => {
    const { game } = setup(CORRIDOR);
    const x = 11 * TILE;
    const chest = 7 * TILE - 16;
    expect(litBy(game.lamps, game.map, x, chest, false)).not.toBeNull();
    expect(litBy(game.lamps, game.map, x, chest, true)).toBeNull();
  });

  it('a drone zaps you when you walk in the light, not in the dark', () => {
    for (const shadows of [false, true]) {
      const { game, input, step } = setup(CORRIDOR, shadows ? ['DYNAMIC_SHADOWS'] : []);
      input.down = new Set(['right']);
      let deaths = 0;
      for (let i = 0; i < 160; i++) {
        const alive = game.deathT === null;
        step();
        if (alive && game.deathT !== null) deaths++;
      }
      expect(deaths > 0, `shadows ${shadows}`).toBe(!shadows);
    }
  });

  it('one sword hit from the dark takes a drone down', () => {
    const { game, input, step } = setup(CORRIDOR, ['DYNAMIC_SHADOWS']);
    const drone = game.drones[0];
    input.down = new Set(['right']);
    for (let i = 0; i < 400 && drone.x - game.player.feetX > 18; i++) step();
    input.pressed.add('attack');
    step(3);
    expect(drone.alive).toBe(false);
  });
});

describe('PHYSICS', () => {
  const WALL = ['....#.....', '....%.....', '..P.%.....', '##########'];

  it('cracked walls clank until PHYSICS, then smash into debris', () => {
    const sounds: string[] = [];
    const before = setup(WALL, [], { sound: (n) => sounds.push(n) });
    before.input.down = new Set(['right']);
    before.step(40);
    before.input.pressed.add('attack');
    before.step(5);
    expect(before.game.map.tileAt(4, 2)).toBe(Tile.Cracked);
    expect(sounds).toContain('clank');

    const after = setup(WALL, ['PHYSICS']);
    after.input.down = new Set(['right']);
    after.step(40);
    after.input.pressed.add('attack');
    after.step(5);
    expect(after.game.map.tileAt(4, 2)).toBe(Tile.Empty);
    expect(after.game.map.tileAt(4, 1)).toBe(Tile.Empty);
    expect(after.game.map.tileAt(4, 0)).toBe(Tile.Solid);
    expect(after.game.debris.bodies.length).toBeGreaterThan(5);
    after.step(240);
    // Debris settles on the floor.
    for (const b of after.game.debris.bodies) expect(b.y).toBeLessThanOrEqual(3 * TILE);
  });

  it('a hanging lamp can be cut down, and then it is dark', () => {
    const { game, input, step } = setup(
      [
        '................',
        '................',
        '................',
        '....L...........',
        '................',
        '................',
        '..P.............',
        '################',
      ],
      ['PHYSICS', 'DYNAMIC_SHADOWS'],
    );
    const lamp = game.lamps[0];
    expect(lamp.lit).toBe(true);
    input.down = new Set(['right']);
    for (let i = 0; i < 200 && game.player.feetX < lamp.x - 16; i++) step();
    input.down = new Set(['jump']);
    input.pressed.add('jump');
    step(14);
    input.pressed.add('attack');
    step(90);
    expect(lamp.state).toBe('broken');
    expect(litBy(game.lamps, game.map, lamp.x, 6 * TILE, true)).toBeNull();
  });
});

describe('the comedy features', () => {
  const ROOM = ['................', '..P.1.2.3.......', '################'];
  const PLAIN = ['................', '..P.............', '################'];
  const def: LevelDef = {
    name: 't',
    era: 5,
    rows: ROOM,
    pickups: { '1': 'RUMBLE', '2': 'ACHIEVEMENTS', '3': 'PHOTO_MODE' },
  };

  it('RUMBLE apologises to keyboard players; ACHIEVEMENTS awards forty at once', () => {
    const features = new FeatureRegistry(BEFORE_ERA5);
    const game = new Game({ features, level: parseLevel(def), hooks: { hasGamepad: () => false } });
    const input = new FakeInput();
    input.down = new Set(['right']);
    for (let i = 0; i < 300 && !features.has('ACHIEVEMENTS'); i++) game.update(STEP, input);
    expect(game.toasts.some((t) => t.text === 'NO GAMEPAD DETECTED')).toBe(true);
    expect(RETRO_ACHIEVEMENTS).toHaveLength(40);
    expect(game.achievements.earned.size).toBeGreaterThanOrEqual(40);
    expect(game.achievements.popups.length).toBeGreaterThanOrEqual(40);
  });

  it('rumbles a real gamepad', () => {
    const buzz: number[] = [];
    const features = new FeatureRegistry([...BEFORE_ERA5, 'RUMBLE']);
    const game = new Game({
      features,
      level: parseLevel({ ...def, rows: PLAIN, pickups: {} }),
      hooks: { hasGamepad: () => true, rumble: (s) => buzz.push(s) },
    });
    const input = new FakeInput();
    input.pressed.add('jump');
    for (let i = 0; i < 60; i++) {
      game.update(STEP, input);
      input.pressed.clear();
    }
    expect(buzz.length).toBeGreaterThan(0);
  });

  it('PHOTO MODE pauses the game and takes a picture', () => {
    let photos = 0;
    const features = new FeatureRegistry([...BEFORE_ERA5, 'PHOTO_MODE']);
    const game = new Game({
      features,
      level: parseLevel({ ...def, rows: PLAIN, pickups: {} }),
      hooks: { photo: () => photos++ },
    });
    const input = new FakeInput();
    const step = (n = 1) => {
      for (let i = 0; i < n; i++) {
        game.update(STEP, input);
        input.pressed.clear();
      }
    };
    step(30);
    input.pressed.add('photo');
    step();
    expect(game.photo).not.toBeNull();
    const x = game.player.feetX;
    input.down = new Set(['right']);
    step(30);
    expect(game.player.feetX).toBe(x);
    expect(game.photo!.offsetX).toBeGreaterThan(10);
    input.down.clear();
    input.pressed.add('attack');
    step();
    expect(game.photo!.filter).not.toBe('NONE');
    input.pressed.add('jump');
    step();
    expect(photos).toBe(1);
    expect(game.photo!.snapRequested).toBe(true);
    input.pressed.add('photo');
    step();
    expect(game.photo).toBeNull();
  });
});

describe('the Deprecator', () => {
  it('its phases take everything but the basics, each feature once', () => {
    const taken = FINALE_PHASES.flatMap((p) => p.take);
    expect(new Set(taken).size).toBe(taken.length);
    expect([...taken, ...FINALE_KEEP].sort()).toEqual([...FEATURE_IDS].sort());
    for (const phase of FINALE_PHASES) expect(phase.take).toContain(phase.reclaim);
    expect(FINALE_PHASES.at(-1)!.reclaim).toBe('ARMS');
  });
});

/** Everything at once: the full feature set, standing at the arena. */
function arena() {
  const level = parseLevel(ERA5_LEVEL);
  const features = new FeatureRegistry(FEATURE_IDS);
  const sounds: string[] = [];
  const game = new Game({ features, level, hooks: { sound: (n) => sounds.push(n) } });
  const fin = game.finale!;
  game.player.teleport(fin.arenaX - 30, fin.floorY);
  return { game, features, fin, sounds };
}

/** A crude player for the finale: dodge beams, jump waves and bits, hit it, grab the orb. */
function fightBot(game: Game, input: FakeInput, i: number) {
  const fin = game.finale!;
  const p = game.player;
  input.down = new Set();
  input.pressed.clear();
  if (fin.state === 'waiting') {
    input.down.add('right');
    return;
  }
  const px = p.feetX;
  const beam = fin.beams.find((b) => Math.abs(b.x - px) < BEAM_W / 2 + 12);
  const wave = fin.waves.find((w) => {
    const ahead = (px - w.x) * w.dir;
    return ahead > -14 && ahead < 70;
  });
  const bit = game.bombs.find((b) => Math.abs(b.box.x - px) < 12 && b.box.y < p.box.y);
  const orb = fin.orb?.landed ? fin.orb : null;
  const target = orb ? orb.x : fin.vulnerable ? fin.box.x + fin.box.w / 2 : null;
  if (beam) {
    // Run out of the column, away from the nearest wall.
    const away = px < fin.arenaX + VIEW_W / 2 ? 'right' : 'left';
    input.down.add(beam.x > px ? 'left' : beam.x < px ? 'right' : away);
  } else if (bit) {
    input.down.add(px < fin.arenaX + VIEW_W / 2 ? 'right' : 'left');
  } else if (target !== null) {
    const dx = target - px;
    // Walk right onto the orb; stop just short of the Deprecator to swing.
    if (Math.abs(dx) > (orb ? 3 : 14)) input.down.add(dx > 0 ? 'right' : 'left');
    else if (fin.vulnerable && i % 8 === 0) input.pressed.add('attack');
    // Face it before swinging.
    if (fin.vulnerable && Math.abs(dx) <= 14 && Math.sign(dx) !== p.facing && Math.abs(dx) > 2) {
      input.down.add(dx > 0 ? 'right' : 'left');
    }
  }
  if (wave) {
    // Jump it when it's close, and hold the jump until it's gone by.
    if (p.onGround && (px - wave.x) * wave.dir < 46) input.pressed.add('jump');
    input.down.add('jump');
  }
}

describe('the finale', () => {
  it('strips the game down a phase at a time, and gives it all back at the end', () => {
    const { game, features, fin, sounds } = arena();
    const input = new FakeInput();
    let deaths = 0;
    const seen = new Set<string>();
    let lowest = Infinity;
    for (let i = 0; i < 60 * 240 && game.request === null; i++) {
      fightBot(game, input, i);
      if (game.request === 'gameOver') break;
      const alive = game.deathT === null;
      game.update(STEP, input);
      if (alive && game.deathT !== null) deaths++;
      seen.add(fin.state);
      lowest = Math.min(lowest, features.list().length);
    }
    expect(game.request, `ended (stuck in ${fin.state}, phase ${fin.phase})`).toBe('ending');
    expect(seen).toContain('last');
    expect(lowest).toBeLessThanOrEqual(FINALE_KEEP.length + 1);
    // Everything came back at once.
    for (const id of FEATURE_IDS) expect(features.has(id), id).toBe(true);
    expect(sounds).toContain('restore');
    expect(deaths).toBeLessThanOrEqual(4);
  });

  it('in the last phase you are a stick man with no arms, and can still win', () => {
    const { game, features, fin } = arena();
    const input = new FakeInput();
    for (let i = 0; i < 60 * 240 && !fin.final; i++) {
      fightBot(game, input, i);
      game.update(STEP, input);
      if (game.request === 'gameOver') break;
    }
    // Let the last strip happen.
    for (let i = 0; i < 60 * 3; i++) {
      input.down.clear();
      game.update(STEP, input);
    }
    expect(features.has('ARMS')).toBe(false);
    expect(features.has('FRAME_RATE')).toBe(false);
    expect(features.has('DEATH')).toBe(false);
    expect(features.list().sort()).toEqual([...FINALE_KEEP].sort());
  });

  it('a Game Over during the fight puts everything back and retries at the arena', () => {
    const { game, fin } = arena();
    const input = new FakeInput();
    input.down = new Set(['right']);
    for (let i = 0; i < 600 && fin.stripped.length === 0; i++) game.update(STEP, input);
    expect(fin.stripped.length).toBeGreaterThan(0);
    expect(game.retryCheckpoint).not.toBeNull();
    fin.restoreAll();
    for (const id of FEATURE_IDS) expect(game.features.has(id), id).toBe(true);
  });
});

describe('Era 5 level', () => {
  it('has its nine pickups on solid ground, the arena and the NPC', () => {
    const level = parseLevel(ERA5_LEVEL);
    expect(level.pickups.map((p) => p.feature).sort()).toEqual([...ERA5].sort());
    for (const p of level.pickups) {
      const below = level.map.isSolid(Math.floor(p.x / TILE), Math.floor(p.y / TILE) + 1);
      expect(below, `${p.feature} has ground below`).toBe(true);
    }
    expect(level.entities.filter((e) => e.kind === 'finale')).toHaveLength(1);
    expect(level.entities.find((e) => e.kind === 'npc')?.id).toBe('N');
  });

  it('a simple bot plays it from the start to the Deprecator', () => {
    const features = new FeatureRegistry(BEFORE_ERA5);
    const level = parseLevel(ERA5_LEVEL);
    const game = new Game({ features, level });
    const input = new FakeInput();
    const p = game.player;
    const map = level.map;
    const fin = game.finale!;
    const chestAt = (x: number) => {
      let ty = map.height - 1;
      while (ty > 0 && map.isSolid(Math.floor(x / TILE), ty)) ty--;
      return Math.min(p.feetY, (ty + 1) * TILE) - 16;
    };
    /** Would standing here get me seen? */
    const watched = (x: number) => {
      const y = chestAt(x);
      const lit =
        !features.has('LIGHTING') ||
        litBy(game.lamps, map, x, y, features.has('DYNAMIC_SHADOWS')) !== null;
      return lit && game.drones.some((d) => d.inView(map, x, y));
    };

    let cooldown = 0;
    let deaths = 0;
    let waited = 0;
    for (let i = 0; i < 60 * 300 && fin.state === 'waiting'; i++) {
      if (game.request === 'gameOver') {
        game.request = null;
        game.lives = 3;
        p.teleport(game.checkpoint.x, game.checkpoint.y);
      }
      cooldown = Math.max(0, cooldown - 1);
      input.down = new Set(['right', 'jump']);

      if (game.dialogue) {
        if (i % 10 === 0) input.pressed.add('jump');
      } else if (p.state === 'hang') {
        input.pressed.add('jump');
      } else {
        const front = p.box.x + p.box.w;
        const enemy = [...game.knights].find(
          (e) =>
            e.alive &&
            e.box.x + e.box.w > p.box.x - 4 &&
            e.box.x - front < 40 &&
            Math.abs(e.box.y + e.box.h - p.feetY) < 24,
        );
        const drone = game.drones.find(
          (d) => d.alive && d.x - p.feetX > 0 && d.x - p.feetX < 22 && Math.abs(d.y - p.feetY) < 40,
        );
        const lamp = game.lamps.find(
          (l) => l.kind === 'hanging' && l.lit && l.x - p.feetX > -12 && l.x - p.feetX < 22,
        );
        const wall = map.tileAt(Math.floor((front + 4) / TILE), Math.floor((p.feetY - 4) / TILE));
        const tileAhead = (dx: number, dy: number) =>
          map.tileAt(Math.floor((front + dx) / TILE), Math.floor((p.feetY + dy) / TILE));
        const pit = [8, 24].some(
          (d) =>
            !map.isSolid(Math.floor((front + d) / TILE), Math.floor((p.feetY + 4) / TILE)) &&
            tileAhead(d, 4) !== Tile.Cracked,
        );
        const blocked = p.onGround && p.vx === 0 && game.moment === null;
        const hidden = !watched(p.feetX);
        const danger = hidden && [24, 48].some((d) => watched(p.feetX + d));

        if (danger && p.onGround && !lamp) {
          // Wait in the shadow until the drone looks away.
          input.down.delete('right');
          waited++;
        } else if (lamp && p.onGround && cooldown === 0) {
          // Jump straight up under it and slash.
          input.down.delete('right');
          input.pressed.add('jump');
          cooldown = 30;
        } else if (lamp && !p.onGround) {
          input.down.delete('right');
          if (p.vy > -60) input.pressed.add('attack');
        } else if ((enemy || drone) && cooldown === 0) {
          input.pressed.add('attack');
          cooldown = 12;
        } else if (wall === Tile.Cracked && cooldown === 0) {
          input.pressed.add('attack');
          cooldown = 12;
        } else if (cooldown === 0 && p.onGround && (blocked || pit)) {
          input.pressed.add('jump');
          cooldown = 8;
        }
      }

      const wasAlive = game.deathT === null;
      game.update(STEP, input);
      input.pressed.clear();
      if (wasAlive && game.deathT !== null) deaths++;
    }

    expect(
      fin.state,
      `reached the arena (stuck at ${p.feetX.toFixed(0)},${p.feetY.toFixed(0)}) lamps ${game.lamps.map((l) => l.kind + ':' + l.state + '@' + l.x.toFixed(0) + ',' + l.y.toFixed(0)).join(' ')} deaths ${deaths} waited ${waited} watched ${[0, 24, 48].map((d) => watched(p.feetX + d))}`,
    ).not.toBe('waiting');
    for (const f of ERA5) expect(features.has(f), f).toBe(true);
    expect(game.stats.smashed).toBeGreaterThan(0);
    expect(waited).toBeGreaterThan(0);
    expect(deaths).toBeLessThanOrEqual(3);
  });
});

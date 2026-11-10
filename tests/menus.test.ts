import { describe, expect, it } from 'vitest';
import { STEP, TILE, VIEW_W } from '../src/config';
import { defaultComfort, type Comfort } from '../src/core/comfort';
import { FEATURE_IDS, FeatureRegistry, type FeatureId } from '../src/core/features';
import {
  DEFAULT_KEYS,
  MAX_KEYS_PER_ACTION,
  buildKeymap,
  keyName,
  rebind,
  sanitiseBindings,
  type Action,
  type ActionState,
} from '../src/core/input';
import {
  DEFAULT_SCORES,
  TABLE_SIZE,
  parseScores,
  qualifies,
  record,
  runEntry,
} from '../src/core/scores';
import { VOLUME_STEPS, defaultSettings, parseSettings, volumeGain } from '../src/core/settings';
import { CHASE_ZOOM, Game } from '../src/game/game';
import { ERA1_LEVEL } from '../src/world/levels/era1';
import { ERA4_LEVEL } from '../src/world/levels/era4';
import { parseLevel } from '../src/world/tilemap';

describe('key bindings', () => {
  it('maps the defaults, plus the fixed menu keys', () => {
    const map = buildKeymap(DEFAULT_KEYS);
    expect(map.get('Space')).toEqual(expect.arrayContaining(['jump', 'confirm']));
    expect(map.get('ArrowUp')).toEqual(expect.arrayContaining(['up', 'jump', 'menuUp']));
    expect(map.get('Escape')).toEqual(expect.arrayContaining(['pause', 'back']));
    expect(map.get('KeyJ')).toEqual(['attack']);
  });

  it('adds a new key at the front and removes one the action already has', () => {
    const added = rebind(DEFAULT_KEYS, 'attack', 'KeyZ')!;
    expect(added.attack).toEqual(['KeyZ', 'KeyJ', 'KeyX']);
    // Pressing W on JUMP takes it off, so W is only UP: the classic "up shouldn't jump".
    const removed = rebind(DEFAULT_KEYS, 'jump', 'KeyW')!;
    expect(removed.jump).toEqual(['Space', 'ArrowUp']);
    expect(removed.up).toContain('KeyW');
    expect(buildKeymap(removed).get('KeyW')).toEqual(['up']);
    // The defaults themselves are left alone.
    expect(DEFAULT_KEYS.jump).toContain('KeyW');
  });

  it('keeps at most a few keys, and never none', () => {
    let keys = DEFAULT_KEYS;
    for (const code of ['KeyQ', 'KeyE', 'KeyR', 'KeyT']) keys = rebind(keys, 'photo', code)!;
    expect(keys.photo).toHaveLength(MAX_KEYS_PER_ACTION);
    expect(keys.photo[0]).toBe('KeyT');
    let one = DEFAULT_KEYS;
    one = rebind(one, 'photo', 'KeyP') ?? one; // its only key: refused
    expect(one.photo).toEqual(['KeyP']);
    expect(rebind(DEFAULT_KEYS, 'photo', 'KeyP')).toBeNull();
  });

  it("won't bind the menu keys, so you can't lock yourself out", () => {
    for (const code of ['Escape', 'Enter', 'Backspace', 'Backquote']) {
      expect(rebind(DEFAULT_KEYS, 'jump', code)).toBeNull();
    }
  });

  it('cleans up saved bindings', () => {
    const keys = sanitiseBindings({
      jump: ['KeyZ', 'KeyZ', 'Escape', 7],
      attack: [],
      left: 'nope',
      bogus: ['KeyQ'],
    });
    expect(keys.jump).toEqual(['KeyZ']);
    expect(keys.attack).toEqual(DEFAULT_KEYS.attack);
    expect(keys.left).toEqual(DEFAULT_KEYS.left);
    expect(sanitiseBindings(null)).toEqual(DEFAULT_KEYS);
  });

  it('names keys in the pixel font', () => {
    expect(keyName('KeyA')).toBe('A');
    expect(keyName('ArrowUp')).toBe('UP');
    expect(keyName('Digit7')).toBe('7');
    expect(keyName('ShiftLeft')).toBe('L-SHIFT');
    expect(keyName('Numpad4')).toBe('NUM 4');
    expect(keyName('IntlBackslash')).toBe('INTL BACKSLASH');
  });
});

describe('settings', () => {
  it('defaults to full volume (the mix as it was) and the default keys', () => {
    expect(defaultSettings()).toEqual({
      music: VOLUME_STEPS,
      sfx: VOLUME_STEPS,
      keys: DEFAULT_KEYS,
      comfort: defaultComfort(),
    });
    expect(volumeGain(VOLUME_STEPS)).toBe(1);
    expect(volumeGain(0)).toBe(0);
  });

  it('clamps and repairs what was saved', () => {
    const s = parseSettings({ music: 99, sfx: -3, keys: { jump: ['KeyZ'] } });
    expect(s.music).toBe(VOLUME_STEPS);
    expect(s.sfx).toBe(0);
    expect(s.keys.jump).toEqual(['KeyZ']);
    expect(parseSettings('garbage')).toEqual(defaultSettings());
  });
});

describe('high scores', () => {
  it('starts with a full table set by the cast', () => {
    expect(DEFAULT_SCORES).toHaveLength(TABLE_SIZE);
    expect(parseScores(null)).toEqual(DEFAULT_SCORES);
  });

  it('a new score goes in at its place and pushes the last one off', () => {
    expect(qualifies(DEFAULT_SCORES, 2500)).toBe(false); // ties go below
    expect(qualifies(DEFAULT_SCORES, 2501)).toBe(true);
    expect(qualifies(DEFAULT_SCORES, 0)).toBe(false);
    const { table, rank } = record(DEFAULT_SCORES, { initials: 'YOU', score: 30000, run: 7 });
    expect(rank).toBe(3);
    expect(table).toHaveLength(TABLE_SIZE);
    expect(table[3].initials).toBe('YOU');
    expect(table.at(-1)!.initials).toBe('IDK');
  });

  it('gives each run one row, which only goes up', () => {
    let { table } = record(DEFAULT_SCORES, { initials: 'YOU', score: 12000, run: 7 });
    // A Game Over later in the same run: the row rises, no second row.
    ({ table } = record(table, { initials: 'YOU', score: 45000, run: 7 }));
    expect(table.filter((e) => e.run === 7)).toHaveLength(1);
    expect(runEntry(table, 7)!.score).toBe(45000);
    ({ table } = record(table, { initials: 'YOU', score: 100, run: 7 }));
    expect(runEntry(table, 7)!.score).toBe(45000);
    expect(runEntry(table, 0)).toBeUndefined();
  });

  it('throws away broken rows from storage', () => {
    const rows = parseScores([
      { initials: 'ABC', score: 500, run: 3 },
      { initials: 'TOOLONG', score: 9, run: 1 },
      { initials: 'ab!', score: 9, run: 1 },
      { initials: 'XYZ', score: 'lots', run: 1 },
    ]);
    expect(rows).toEqual([{ initials: 'ABC', score: 500, run: 3 }]);
  });
});

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

describe('the HIGH SCORES secret', () => {
  // Era 0's features: ARMS is the one that matters.
  const ERA1_START: FeatureId[] = [
    'LEFT',
    'JUMP',
    'BEEP',
    'SCREEN_2',
    'ARMS',
    'SCORE',
    'FRAME_RATE',
  ];

  it('sits on the ledge in screen C, reachable by climbing (ARMS)', () => {
    const level = parseLevel(ERA1_LEVEL);
    const secret = level.pickups.find((p) => p.feature === 'HIGH_SCORES')!;
    // Off the floor: you have to climb for it.
    expect(level.map.pixelHeight - secret.y).toBeGreaterThan(3 * TILE);
    const features = new FeatureRegistry(ERA1_START);
    const game = new Game({ features, level });
    const input = new FakeInput();
    // Stand on the floor of screen C, left of the ledge, then jump at it and climb.
    const screenX = Math.floor(secret.x / VIEW_W) * VIEW_W;
    const floorY = level.map.pixelHeight - TILE;
    game.player.teleport(screenX + 2 * TILE, floorY);
    const ledgeX = secret.x - 3 * TILE;
    for (let i = 0; i < 60 * 8 && !features.has('HIGH_SCORES'); i++) {
      const p = game.player;
      input.down = new Set(['right', 'jump']);
      const onFloor = p.onGround && p.feetY === floorY;
      if (p.state === 'hang' || (onFloor && p.feetX > ledgeX - 30)) input.pressed.add('jump');
      game.update(STEP, input);
      input.pressed.clear();
    }
    expect(features.has('HIGH_SCORES')).toBe(true);
  });
});

describe('accessibility options', () => {
  it('start reduced when the system asks for reduced motion (colour stays as it is)', () => {
    expect(parseSettings(null, true).comfort).toEqual({
      reduceFlashing: true,
      reduceShake: true,
      reduceMotion: true,
      colourBlind: false,
    });
    expect(parseSettings(null, false).comfort.reduceMotion).toBe(false);
    // What you chose wins over the system.
    const chosen = parseSettings({ comfort: { reduceMotion: false, colourBlind: true } }, true);
    expect(chosen.comfort.reduceMotion).toBe(false);
    expect(chosen.comfort.reduceFlashing).toBe(true);
    expect(chosen.comfort.colourBlind).toBe(true);
  });

  const comfort = (over: Partial<Comfort>): Comfort => ({ ...defaultComfort(), ...over });

  /** The Block lands with a thud and a camera shake (with CAMERA). */
  function blockLanding(c: Comfort): number {
    const level = parseLevel(ERA1_LEVEL);
    const features = new FeatureRegistry(FEATURE_IDS.filter((id) => id !== 'HD'));
    const game = new Game({ features, level, comfort: c });
    const boss = game.boss!;
    // Mid-arena, so the camera settles on it and the Block wakes up.
    game.player.teleport(boss.arenaX + 200, level.map.pixelHeight - TILE);
    let shake = 0;
    const input = new FakeInput();
    for (let i = 0; i < 60 * 4; i++) {
      game.update(STEP, input);
      shake = Math.max(shake, game.camera.shake);
      game.lives = 3;
    }
    return shake;
  }

  it('reduce screen shake: the camera stays still', () => {
    expect(blockLanding(comfort({}))).toBeGreaterThan(0);
    expect(blockLanding(comfort({ reduceShake: true }))).toBe(0);
  });

  it('reduce flashing: no invert flash when a feature unlocks', () => {
    const run = (c: Comfort) => {
      const rows = ['......', '.P1...', '######'];
      const level = parseLevel({ name: 't', rows, pickups: { '1': 'JUMP' } });
      const game = new Game({ features: new FeatureRegistry(['LEFT']), level, comfort: c });
      let flashed = false;
      const input = new FakeInput();
      input.down.add('right');
      for (let i = 0; i < 40; i++) {
        game.update(STEP, input);
        flashed ||= game.flashing;
      }
      return { moment: game.moment?.feature, flashing: flashed };
    };
    expect(run(comfort({}))).toEqual({ moment: 'JUMP', flashing: true });
    expect(run(comfort({ reduceFlashing: true }))).toEqual({ moment: 'JUMP', flashing: false });
  });

  it('reduce motion: the Chase does not zoom in', () => {
    const run = (c: Comfort) => {
      const features = new FeatureRegistry(FEATURE_IDS.filter((id) => id !== 'HD'));
      const game = new Game({ features, level: parseLevel(ERA4_LEVEL), comfort: c });
      game.wave!.start(game.player.feetX - 100);
      game.update(STEP, new FakeInput());
      return game.camera.zoomTarget;
    };
    expect(run(comfort({}))).toBe(CHASE_ZOOM);
    expect(run(comfort({ reduceMotion: true }))).toBe(1);
  });
});

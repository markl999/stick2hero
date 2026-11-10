import { describe, expect, it, vi } from 'vitest';
import { STEP, TILE, VIEW_W } from '../src/config';
import { FEATURE_IDS, FEATURES, FeatureRegistry, type FeatureId } from '../src/core/features';
import type { Action, ActionState } from '../src/core/input';
import { typeCheat } from '../src/core/cheats';
import { SHOP_ITEMS, buy } from '../src/core/shop';
import { Game, TIP_EVERY } from '../src/game/game';
import { HAT_NAMES, hatRects } from '../src/render/hats';
import { BIG_HEAD, stickPose } from '../src/render/stickman';
import { ERA_LEVELS } from '../src/world/levels';
import { parseLevel } from '../src/world/tilemap';

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

const SECRETS = FEATURE_IDS.filter((id) => FEATURES[id].secret);

/**
 * Where each secret's bot starts: a screen and a column on the main path nearby. The bot
 * has everything from the main path up to and including the secret's era (enemies off:
 * this checks the climb, not the fight).
 */
const STARTS: Partial<Record<FeatureId, { screen: number; col: number; row?: number }>> = {
  HIGH_SCORES: { screen: 2, col: 2 },
  CHEAT_CODES: { screen: 3, col: 10, row: 3 }, // on top of the wall-jump climb
  CRT_SCANLINES: { screen: 1, col: 3, row: 6 }, // on the step (a 1-tile hop from the floor)
  TUTORIAL: { screen: 4, col: 3 },
  WILHELM_SCREAM: { screen: 5, col: 1 },
  HATS: { screen: 6, col: 12 },
  LENS_FLARE: { screen: 0, col: 7 },
  MICROTRANSACTIONS: { screen: 10, col: 8 },
};

function reach(secret: FeatureId): { got: boolean; at: string } {
  const era = FEATURES[secret].era;
  const level = parseLevel(ERA_LEVELS[era]);
  const start = STARTS[secret]!;
  const have = FEATURE_IDS.filter(
    (id) => FEATURES[id].era <= era && !FEATURES[id].secret && id !== 'ENEMIES',
  );
  const features = new FeatureRegistry(have);
  const game = new Game({ features, level });
  const target = level.pickups.find((p) => p.feature === secret)!;
  const row = start.row ?? 7;
  game.player.teleport(start.screen * VIEW_W + start.col * TILE + TILE / 2, (row + 1) * TILE);
  const input = new FakeInput();
  let cooldown = 0;
  for (let i = 0; i < 60 * 15 && !features.has(secret); i++) {
    const p = game.player;
    const dx = target.x - p.feetX;
    input.down = new Set();
    const above = target.y < p.feetY - 15;
    cooldown = Math.max(0, cooldown - 1);
    // Close below it: stand still until you can jump (like a person would), then jump at it.
    const waiting = above && p.onGround && Math.abs(dx) < 70 && cooldown > 0;
    // Right under the ledge? Step back out first, so the jump goes up its side.
    const col = (x: number) => Math.floor(x / TILE);
    // Anything solid within a jump's reach above your head counts as a ceiling.
    const rows = [Math.floor((p.feetY - 75) / TILE), Math.floor((p.feetY - 35) / TILE)];
    const ceiling = [p.box.x, p.box.x + p.box.w].some((x) =>
      rows.some((r) => level.map.isSolid(col(x), r)),
    );
    const away = dx > 0 ? 'left' : 'right';
    if (above && p.onGround && ceiling) input.down.add(away);
    else if (Math.abs(dx) > 3 && !waiting) input.down.add(dx > 0 ? 'right' : 'left');
    if (above) input.down.add('jump');
    const blocked = p.onGround && Math.abs(p.vx) < 1 && Math.abs(dx) > 3;
    if (p.state === 'hang') input.pressed.add('jump');
    else if (
      !ceiling &&
      p.onGround &&
      cooldown === 0 &&
      ((above && Math.abs(dx) < 70) || blocked)
    ) {
      input.pressed.add('jump');
      cooldown = 20;
    }
    game.update(STEP, input);
    input.pressed.clear();
    game.moment = null; // the unlock moments of anything else would only slow it down
  }
  const p = game.player;
  return {
    got: features.has(secret),
    at: `${p.feetX.toFixed(0)},${p.feetY.toFixed(0)} ${p.state}`,
  };
}

describe('secrets', () => {
  it("there are eight, as in PRD section 7, each in its era's level once", () => {
    expect(SECRETS).toHaveLength(8);
    for (const id of SECRETS) {
      const level = parseLevel(ERA_LEVELS[FEATURES[id].era]);
      const spots = level.pickups.filter((p) => p.feature === id);
      expect(spots, id).toHaveLength(1);
      // Off the floor: you have to climb for every one.
      expect(spots[0].y, id).toBeLessThan(level.map.pixelHeight - 3 * TILE);
    }
  });

  for (const secret of SECRETS) {
    it(`${secret} can be reached`, () => {
      const result = reach(secret);
      expect(result.got, `stuck at ${result.at}`).toBe(true);
    });
  }
});

describe('what the secrets do', () => {
  it('CHEAT CODES: BIGHEAD, typed in any rhythm, with typos before it', () => {
    expect(typeCheat('', ['B', 'I', 'G'])).toEqual({ buffer: 'BIG', cheat: null });
    expect(typeCheat('BIG', ['H', 'E', 'A', 'D'])).toEqual({ buffer: '', cheat: 'BIGHEAD' });
    expect(typeCheat('', [...'XQBIGHEAD']).cheat).toBe('BIGHEAD');
    expect(typeCheat('', [...'BIGHAED']).cheat).toBeNull();
  });

  it('BIGHEAD: a much bigger head, still sitting on the neck', () => {
    const normal = stickPose({ arms: true, state: 'normal', facing: 1 });
    const big = stickPose({ arms: true, state: 'normal', facing: 1, bigHead: true });
    expect(big.head.r).toBeCloseTo(normal.head.r * BIG_HEAD);
    expect(big.head.y + big.head.r).toBeCloseTo(normal.head.y + normal.head.r);
  });

  it('HATS: several, each facing the way you do', () => {
    expect(HAT_NAMES.length).toBeGreaterThanOrEqual(5);
    HAT_NAMES.forEach((_, i) => {
      const right = hatRects(i, 1, 1, 0);
      const left = hatRects(i, -1, 1, 0);
      expect(right.length).toBeGreaterThan(0);
      // Mirrored: the same widths, flipped across the middle.
      right.forEach((r, j) => expect(left[j].x).toBeCloseTo(-(r.x + r.w)));
    });
  });

  it('MICROTRANSACTIONS: everything is free, and the life and the hat are real', () => {
    const state = { lives: 2, hat: 0, hatCount: HAT_NAMES.length, random: () => 0 };
    expect(buy('life', state)).toMatchObject({ lives: 3 });
    expect(buy('life', { ...state, lives: 9 }).lives).toBeUndefined();
    expect(buy('life', { ...state, lives: null }).lives).toBeUndefined();
    expect(buy('hat', state).hat).toBe(1);
    expect(buy('hat', { ...state, hat: null }).hat).toBeUndefined();
    for (const item of SHOP_ITEMS) expect(buy(item.id, state).message.length).toBeGreaterThan(0);
  });

  /** A walker coming at you, and a punch for it. */
  function walkerRoom(extra: FeatureId[]) {
    const level = parseLevel({
      name: 't',
      rows: ['................', '..P..e..........', '################'],
      pickups: {},
    });
    const features = new FeatureRegistry([
      'LEFT',
      'JUMP',
      'ARMS',
      'ENEMIES',
      'PUNCH',
      'SFX',
      ...extra,
    ]);
    const sounds: string[] = [];
    const game = new Game({ features, level, hooks: { sound: (n) => sounds.push(n) } });
    const input = new FakeInput();
    for (let i = 0; i < 120 && game.walkers[0].alive; i++) {
      if (i % 10 === 0) input.pressed.add('attack');
      game.update(STEP, input);
      input.pressed.clear();
    }
    return { game, sounds };
  }

  it('WILHELM SCREAM: an enemy can go out screaming (heard and seen)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const plain = walkerRoom([]);
      expect(plain.game.walkers[0].alive).toBe(false);
      expect(plain.sounds).not.toContain('scream');
      const { game, sounds } = walkerRoom(['WILHELM_SCREAM']);
      expect(sounds).toContain('scream');
      expect(game.toasts.some((t) => t.text.startsWith('AAAA'))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('TUTORIAL: a tip for what you just did, and not too often', () => {
    const level = parseLevel({ name: 't', rows: ['......', '.P....', '######'], pickups: {} });
    const features = new FeatureRegistry(['LEFT', 'JUMP', 'TUTORIAL']);
    const game = new Game({ features, level });
    const input = new FakeInput();
    const run = (seconds: number, jumpEvery = 0) => {
      for (let i = 0; i < seconds * 60; i++) {
        if (jumpEvery && i % jumpEvery === 0) input.pressed.add('jump');
        game.update(STEP, input);
        input.pressed.clear();
      }
    };
    run(2.5);
    expect(game.toasts).toHaveLength(0); // nothing done yet, so no tip
    run(1, 60);
    expect(game.toasts.map((t) => t.text)).toEqual(['TIP: PRESS JUMP TO JUMP!']);
    run(TIP_EVERY - 4, 60);
    expect(game.toasts.filter((t) => t.text.startsWith('TIP')).length).toBeLessThanOrEqual(1);
  });
});

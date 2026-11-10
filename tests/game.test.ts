import { describe, expect, it, vi } from 'vitest';
import { STEP, TILE, VIEW_H, VIEW_W } from '../src/config';
import { FeatureRegistry, type FeatureId } from '../src/core/features';
import type { Action, ActionState } from '../src/core/input';
import { Game, MOMENT_HITSTOP, SCORE_PICKUP } from '../src/game/game';
import { ERA0_LEVEL } from '../src/world/levels/era0';
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

function newGame(features: FeatureId[] = [], hooks = {}) {
  const registry = new FeatureRegistry(features);
  const game = new Game({ features: registry, level: parseLevel(ERA0_LEVEL), hooks });
  return { game, features: registry };
}

/** A scripted player for walking a route through a level. */
class Bot {
  readonly input = new FakeInput();
  constructor(readonly game: Game) {}

  step(n = 1): void {
    for (let i = 0; i < n; i++) {
      this.game.update(STEP, this.input);
      this.input.pressed.clear();
    }
  }

  hold(...actions: Action[]): void {
    this.input.down = new Set(actions);
  }

  until(label: string, cond: () => boolean, max = 1200): void {
    for (let i = 0; i < max; i++) {
      if (cond()) return;
      this.step();
    }
    const p = this.game.player;
    throw new Error(
      `Bot stuck: ${label} (feet ${p.feetX.toFixed(1)},${p.feetY.toFixed(1)} ` +
        `${p.state} ${p.onGround ? 'ground' : 'air'})`,
    );
  }

  has(feature: FeatureId): boolean {
    return this.game.features.has(feature);
  }

  walkTo(dir: 'left' | 'right', label: string, cond: () => boolean): void {
    this.hold(dir);
    this.until(label, cond);
  }

  /** Walk until stopped by a wall (ignoring the freeze during unlock moments). */
  walkUntilBlocked(dir: 'left' | 'right'): void {
    this.hold(dir);
    let still = 0;
    let lastX = this.game.player.box.x;
    this.until(`walking ${dir} into a wall`, () => {
      const moment = this.game.moment;
      const frozen = moment !== null && moment.t < MOMENT_HITSTOP;
      const x = this.game.player.box.x;
      still = !frozen && this.game.player.onGround && x === lastX ? still + 1 : 0;
      lastX = x;
      return still >= 3;
    });
  }

  /** Jump towards `dir`, catch the ledge, climb up. */
  climb(dir: 'left' | 'right'): void {
    const p = this.game.player;
    this.hold(dir, 'jump');
    this.input.pressed.add('jump');
    this.until(`grabbing a ledge to the ${dir}`, () => p.state === 'hang', 90);
    this.hold();
    this.step();
    this.input.pressed.add('jump');
    this.until('climbing up', () => p.state === 'normal' && p.onGround, 60);
  }
}

describe('Game', () => {
  it('collects ← LEFT by walking right, with score, a moment and a checkpoint', () => {
    const save = vi.fn();
    const { game, features } = newGame([], { save });
    const bot = new Bot(game);
    bot.walkTo('right', 'reach LEFT', () => features.has('LEFT'));
    expect(game.moment?.feature).toBe('LEFT');
    expect(game.score).toBeGreaterThanOrEqual(SCORE_PICKUP);
    expect(game.checkpoint.x).toBe(8 * TILE + TILE / 2);
    expect(save).toHaveBeenCalled();
  });

  it('keeps the player on the first screen until SCREEN 2', () => {
    const { game } = newGame(['LEFT', 'JUMP']);
    const bot = new Bot(game);
    bot.hold('right');
    bot.step(240);
    expect(game.player.box.x + game.player.box.w).toBeLessThanOrEqual(VIEW_W);
  });

  it('beeps on jump only once BEEP is unlocked', () => {
    const sound = vi.fn();
    const { game, features } = newGame(['JUMP'], { sound });
    const bot = new Bot(game);
    bot.step(10);
    bot.input.pressed.add('jump');
    bot.step(60);
    expect(sound).not.toHaveBeenCalled();
    features.unlock('BEEP');
    bot.input.pressed.add('jump');
    bot.step(1);
    expect(sound).toHaveBeenCalledTimes(1);
    expect(sound).toHaveBeenCalledWith('beep', expect.any(Number));
  });

  it('resumes from a saved checkpoint', () => {
    const registry = new FeatureRegistry(['LEFT']);
    const checkpoint = { x: 8 * TILE + TILE / 2, y: 8 * TILE };
    const game = new Game({ features: registry, level: parseLevel(ERA0_LEVEL), checkpoint });
    expect(game.player.feetX).toBe(checkpoint.x);
    expect(game.player.feetY).toBe(checkpoint.y);
  });

  it('ignores a checkpoint outside the level', () => {
    const level = parseLevel(ERA0_LEVEL);
    const game = new Game({
      features: new FeatureRegistry(),
      level,
      checkpoint: { x: -50, y: 99999 },
    });
    expect(game.player.feetX).toBe(level.spawn.x);
  });
});

describe('Era 0 is completable', () => {
  it('plays from the spawn to FRAME RATE and finishes the era', () => {
    const { game } = newGame();
    const bot = new Bot(game);
    const p = game.player;

    // Screen A: only right works, LEFT is ahead, JUMP is behind you.
    bot.walkTo('right', 'collect LEFT', () => bot.has('LEFT'));
    bot.walkTo('left', 'collect JUMP', () => bot.has('JUMP'));
    bot.walkUntilBlocked('right');
    bot.hold('right', 'jump');
    bot.input.pressed.add('jump');
    bot.until('collect BEEP and SCREEN 2', () => bot.has('BEEP') && bot.has('SCREEN_2'));

    // Screen B: ARMS, then the first 3-tile wall.
    bot.walkTo('right', 'collect ARMS', () => bot.has('ARMS'));
    bot.walkUntilBlocked('right');
    bot.climb('right');
    expect(p.feetY).toBe(4 * TILE);

    // Screen C: walk off the edge and drop to screen D.
    bot.walkTo('right', 'drop down the shaft', () => game.camera.y === VIEW_H && p.onGround);
    bot.walkTo('right', 'collect SCORE', () => bot.has('SCORE'));

    // Screen E: two walls.
    bot.walkUntilBlocked('right');
    bot.climb('right');
    bot.walkUntilBlocked('right');
    bot.climb('right');
    expect(p.feetY).toBe(VIEW_H + 2 * TILE);

    // Jump up-left from the top of E and catch the ledge at the bottom of F.
    bot.climb('left');
    expect(game.camera.y).toBe(0);

    // Screen F: the staircase to FRAME RATE.
    bot.walkUntilBlocked('left');
    bot.climb('left');
    bot.walkUntilBlocked('left');
    bot.climb('left');
    bot.walkTo('left', 'collect FRAME RATE', () => bot.has('FRAME_RATE'));

    bot.hold();
    bot.until('era complete', () => game.request === 'eraComplete', 300);
  });
});

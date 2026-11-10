import { describe, expect, it, vi } from 'vitest';
import { STEP, VIEW_W } from '../src/config';
import { FeatureRegistry } from '../src/core/features';
import type { Action, ActionState } from '../src/core/input';
import { Game, SCORE_PICKUP } from '../src/game/game';
import { TEST_ROOM } from '../src/world/levels/testRoom';
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

function play(game: Game, input: FakeInput, steps: number) {
  for (let i = 0; i < steps; i++) {
    game.update(STEP, input);
    input.pressed.clear();
  }
}

describe('Game (test room)', () => {
  it('collects ← LEFT by walking right, with score and an unlock moment', () => {
    const features = new FeatureRegistry();
    const save = vi.fn();
    const game = new Game(features, parseLevel(TEST_ROOM), { save });
    const input = new FakeInput();
    input.down.add('right');
    play(game, input, 60);
    expect(features.has('LEFT')).toBe(true);
    expect(game.moment?.feature).toBe('LEFT');
    expect(game.score).toBeGreaterThanOrEqual(SCORE_PICKUP);
    expect(save).toHaveBeenCalled();
  });

  it('keeps the player on the first screen until SCREEN 2', () => {
    const features = new FeatureRegistry(['LEFT', 'JUMP']);
    const game = new Game(features, parseLevel(TEST_ROOM));
    const input = new FakeInput();
    input.down.add('right');
    input.down.add('jump');
    for (let i = 0; i < 400; i++) {
      if (i % 30 === 0) input.pressed.add('jump');
      game.update(STEP, input);
      input.pressed.clear();
      if (features.has('SCREEN_2')) break;
    }
    // Either it was blocked at the edge or picked up SCREEN 2 right at the edge.
    expect(game.player.box.x + game.player.box.w).toBeLessThanOrEqual(VIEW_W);
    expect(game.camera.x).toBe(0);
  });

  it('beeps on jump only once BEEP is unlocked', () => {
    const beep = vi.fn();
    const features = new FeatureRegistry(['JUMP']);
    const game = new Game(features, parseLevel(TEST_ROOM), { beep });
    const input = new FakeInput();
    play(game, input, 10);
    input.pressed.add('jump');
    play(game, input, 60);
    expect(beep).not.toHaveBeenCalled();
    features.unlock('BEEP');
    input.pressed.add('jump');
    play(game, input, 1);
    expect(beep).toHaveBeenCalledTimes(1);
  });
});

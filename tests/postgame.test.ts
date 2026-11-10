import { describe, expect, it } from 'vitest';
import { STEP } from '../src/config';
import { eraFeatures, featureRows, formatTime, toggleRow } from '../src/core/featureMenu';
import { FEATURE_IDS, FEATURES, FeatureRegistry, type FeatureId } from '../src/core/features';
import type { Action, ActionState } from '../src/core/input';
import { Game } from '../src/game/game';
import { parseLevel } from '../src/world/tilemap';

const ALL = new Set<FeatureId>(FEATURE_IDS);

describe('the Feature Menu', () => {
  it('lists what you own by era, each era under a heading', () => {
    const rows = featureRows(new Set<FeatureId>(['JUMP', 'LEFT', 'COLOUR_4', 'HD']));
    expect(rows).toEqual([
      { kind: 'era', era: 0 },
      { kind: 'feature', id: 'LEFT' },
      { kind: 'feature', id: 'JUMP' },
      { kind: 'era', era: 2 },
      { kind: 'feature', id: 'COLOUR_4' },
      { kind: 'era', era: 5 },
      { kind: 'feature', id: 'HD' },
    ]);
    // Everything: six eras, every feature once.
    const full = featureRows(ALL);
    expect(full.filter((r) => r.kind === 'era')).toHaveLength(6);
    expect(full.filter((r) => r.kind === 'feature')).toHaveLength(FEATURE_IDS.length);
  });

  it('flips a feature, and switches a whole era off (or back on)', () => {
    const features = new FeatureRegistry(FEATURE_IDS);
    const isOn = (id: FeatureId) => features.has(id);
    const apply = (changes: { id: FeatureId; on: boolean }[]) =>
      changes.forEach((c) => features.set(c.id, c.on));

    apply(toggleRow({ kind: 'feature', id: 'BLOOM' }, ALL, isOn));
    expect(features.has('BLOOM')).toBe(false);

    // Era 5 has something on, so its heading turns all of it off...
    apply(toggleRow({ kind: 'era', era: 5 }, ALL, isOn));
    expect(eraFeatures(ALL, 5).some(isOn)).toBe(false);
    // ...and then all back on.
    apply(toggleRow({ kind: 'era', era: 5 }, ALL, isOn));
    expect(eraFeatures(ALL, 5).every(isOn)).toBe(true);
    expect(eraFeatures(ALL, 5)).toEqual(FEATURE_IDS.filter((id) => FEATURES[id].era === 5));
  });

  it('switched-off features keep their pickups collected', () => {
    const rows = ['......', '.P1...', '######'];
    const level = parseLevel({ name: 't', rows, pickups: { '1': 'JUMP' } });
    const features = new FeatureRegistry(['LEFT']);
    const game = new Game({ features, level });
    game.disabled = new Set<FeatureId>(['JUMP']);
    const input: ActionState = {
      isDown: (a: Action) => a === 'right',
      wasPressed: () => false,
    };
    for (let i = 0; i < 60; i++) game.update(STEP, input);
    // Walked right over where the pickup was: nothing to collect, still off.
    expect(game.pickups[0].collected).toBe(true);
    expect(features.has('JUMP')).toBe(false);
    expect(game.moment).toBeNull();
  });
});

describe('the completion screen', () => {
  it('formats play time', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65.9)).toBe('1:05');
    expect(formatTime(3600 + 12 * 60 + 34)).toBe('1:12:34');
  });
});

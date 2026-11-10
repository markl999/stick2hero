import { describe, expect, it, vi } from 'vitest';
import { FEATURE_IDS, FeatureRegistry, isFeatureId } from '../src/core/features';

describe('FeatureRegistry', () => {
  it('starts empty and ignores unknown ids from saves', () => {
    const f = new FeatureRegistry(['JUMP', 'NOT_A_FEATURE', 42]);
    expect(f.list()).toEqual(['JUMP']);
  });

  it('unlocks once and notifies listeners', () => {
    const f = new FeatureRegistry();
    const listener = vi.fn();
    f.onChange(listener);
    expect(f.unlock('LEFT')).toBe(true);
    expect(f.unlock('LEFT')).toBe(false);
    expect(f.has('LEFT')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('LEFT', true);
  });

  it('locks features (debug, Feature Menu, Deprecator)', () => {
    const f = new FeatureRegistry(['BEEP']);
    const listener = vi.fn();
    f.onChange(listener);
    expect(f.lock('BEEP')).toBe(true);
    expect(f.lock('BEEP')).toBe(false);
    expect(f.has('BEEP')).toBe(false);
    expect(listener).toHaveBeenCalledWith('BEEP', false);
  });

  it('lists features in progression order regardless of unlock order', () => {
    const f = new FeatureRegistry();
    f.unlock('SCORE');
    f.unlock('LEFT');
    expect(f.list()).toEqual(['LEFT', 'SCORE']);
  });

  it('stops notifying after unsubscribe', () => {
    const f = new FeatureRegistry();
    const listener = vi.fn();
    const off = f.onChange(listener);
    off();
    f.unlock('JUMP');
    expect(listener).not.toHaveBeenCalled();
  });

  it('recognises every defined id', () => {
    for (const id of FEATURE_IDS) expect(isFeatureId(id)).toBe(true);
    expect(isFeatureId('left')).toBe(false);
  });
});

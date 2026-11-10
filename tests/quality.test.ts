import { describe, expect, it } from 'vitest';
import { HD_WIDTHS, HdQuality } from '../src/render/quality';

const run = (q: HdQuality, ms: number, seconds: number) => {
  let steps = 0;
  for (let t = 0; t < seconds * 1000; t += ms) if (q.frame(ms)) steps++;
  return steps;
};

describe('HD quality', () => {
  it('stays at full resolution at 60fps (and at 50)', () => {
    const q = new HdQuality();
    expect(run(q, 1000 / 60, 30)).toBe(0);
    expect(run(q, 1000 / 50, 30)).toBe(0);
    expect(q.maxWidth).toBe(HD_WIDTHS[0]);
  });

  it('steps down after a few seconds of struggling, one step at a time, to a floor', () => {
    const q = new HdQuality();
    expect(run(q, 1000 / 30, 2)).toBe(0); // a moment's slowness isn't enough
    expect(run(q, 1000 / 30, 2)).toBe(1);
    expect(q.maxWidth).toBe(HD_WIDTHS[1]);
    run(q, 1000 / 20, 60);
    expect(q.maxWidth).toBe(HD_WIDTHS.at(-1));
  });

  it('ignores the long gaps of a hidden tab', () => {
    const q = new HdQuality();
    for (let i = 0; i < 100; i++) q.frame(2000);
    expect(q.maxWidth).toBe(HD_WIDTHS[0]);
  });
});

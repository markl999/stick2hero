import { FEATURE_IDS, FEATURES, type FeatureId } from '../core/features';
import { formatTime } from '../core/featureMenu';
import type { Input } from '../core/input';
import { RESOLUTIONS, type Resolution } from '../render/display';
import type { PixelCanvas } from '../render/pixelCanvas';
import { BLACK, DIM, INK, Page } from './menuDraw';
import type { Scene } from './scene';

export interface CompletionOptions {
  /** Every feature you have (on or off). */
  owned: readonly FeatureId[];
  playTime: number;
  deaths: number;
  score: number;
  onDone: () => void;
}

const GOLD = '#ffd23d';

/**
 * After the ending (PRD §6, post-game): what you collected, how long it took, how many
 * times you died. And the news that the Feature Menu is open.
 */
export class CompletionScene implements Scene {
  readonly name = 'completion';
  private t = 0;
  private readonly lines: [string, string][];

  constructor(private readonly opts: CompletionOptions) {
    const owned = new Set(opts.owned);
    const main = FEATURE_IDS.filter((id) => !FEATURES[id].secret);
    const secrets = FEATURE_IDS.filter((id) => FEATURES[id].secret);
    const count = (ids: readonly FeatureId[]) => ids.filter((id) => owned.has(id)).length;
    this.lines = [
      ['FEATURES', `${count(main)} / ${main.length}`],
      ['SECRETS', `${count(secrets)} / ${secrets.length}`],
      ['TIME', formatTime(opts.playTime)],
      ['DEATHS', String(opts.deaths)],
      ['SCORE', Math.floor(opts.score).toLocaleString('en-GB')],
    ];
  }

  resolution(): Resolution {
    return RESOLUTIONS.ERA1;
  }

  renderCap(): number | null {
    return null;
  }

  update(dt: number, input: Input): void {
    this.t += dt;
    if (this.t > 1.5 && input.wasAnyPressed()) this.opts.onDone();
  }

  render(p: PixelCanvas): void {
    p.clear(BLACK);
    const page = new Page(p);
    page.color(GOLD).center('GAME COMPLETE', 14, 3);
    // The stats count in one at a time.
    this.lines.forEach(([label, value], i) => {
      if (this.t < 0.3 + i * 0.2) return;
      const y = 46 + i * 15;
      page.color(DIM).text(label, 72, y, 2);
      page.color(INK).right(value, 248, y, 2);
    });
    if (this.t < 1.4) return;
    page.color(GOLD).center('FEATURE MENU UNLOCKED', 130, 2);
    page.color(INK).center('PAUSE (ESC) TO SWITCH ANY FEATURE ON OR OFF', 146);
    if (this.t > 1.5 && Math.floor(this.t * 2) % 2 === 0) {
      page.color(DIM).center('PRESS ANY KEY', 166);
    }
  }
}

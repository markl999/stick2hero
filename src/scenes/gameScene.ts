import type { Input } from '../core/input';
import type { Game } from '../game/game';
import { RESOLUTIONS, type Resolution } from '../render/display';
import type { PixelCanvas } from '../render/pixelCanvas';
import { drawEra0 } from '../render/tiers/era0';
import type { Scene } from './scene';

/** Era 0 renders at 15fps until FRAME RATE... and keeps it choppy for a beat after. */
const ERA0_RENDER_CAP = 15;
const FRAME_RATE_LIFT_AT = 0.9;

export class GameScene implements Scene {
  readonly name = 'game';

  constructor(
    readonly game: Game,
    private readonly onEraComplete: () => void,
  ) {}

  resolution(): Resolution {
    return RESOLUTIONS.ERA0;
  }

  renderCap(): number | null {
    const { features, moment } = this.game;
    if (!features.has('FRAME_RATE')) return ERA0_RENDER_CAP;
    if (moment?.feature === 'FRAME_RATE' && moment.t < FRAME_RATE_LIFT_AT) {
      return ERA0_RENDER_CAP;
    }
    return null;
  }

  update(dt: number, input: Input): void {
    this.game.update(dt, input);
    if (this.game.eraComplete) {
      this.game.eraComplete = false;
      this.onEraComplete();
    }
  }

  render(p: PixelCanvas, alpha: number): void {
    drawEra0(p, this.game, alpha);
  }
}

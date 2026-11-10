import type { Input } from '../core/input';
import type { Game, GameRequest } from '../game/game';
import { RESOLUTIONS, type Resolution } from '../render/display';
import type { PixelCanvas } from '../render/pixelCanvas';
import { drawPixelTier } from '../render/tiers/pixelTier';
import type { Scene } from './scene';

/** Era 0 renders at 15fps until FRAME RATE... and keeps it choppy for a beat after. */
const ERA0_RENDER_CAP = 15;
const FRAME_RATE_LIFT_AT = 0.9;

export class GameScene implements Scene {
  readonly name = 'game';

  constructor(
    readonly game: Game,
    private readonly onRequest: (request: GameRequest) => void,
  ) {}

  resolution(): Resolution {
    const era = this.game.level.era;
    if (era === 0) return RESOLUTIONS.ERA0;
    return era >= 3 ? RESOLUTIONS.ERA3 : RESOLUTIONS.ERA1;
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
    const request = this.game.request;
    if (request) {
      this.game.request = null;
      this.onRequest(request);
    }
  }

  render(p: PixelCanvas, alpha: number): void {
    drawPixelTier(p, this.game, alpha);
  }
}

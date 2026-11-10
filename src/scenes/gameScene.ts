import type { Input } from '../core/input';
import type { Game, GameRequest } from '../game/game';
import { RESOLUTIONS, type ResolutionRequest } from '../render/display';
import type { PixelCanvas } from '../render/pixelCanvas';
import type { PostFx } from '../render/postFx';
import { drawHdTier } from '../render/tiers/hdTier';
import { drawPixelTier } from '../render/tiers/pixelTier';
import type { Scene } from './scene';

/** Era 0 renders at 15fps until FRAME RATE... and keeps it choppy for a beat after. */
const ERA0_RENDER_CAP = 15;
const FRAME_RATE_LIFT_AT = 0.9;

/** What gameplay asks the app for: the game's own requests, or the pause menu. */
export type SceneRequest = GameRequest | 'pause';

export class GameScene implements Scene {
  readonly name = 'game';

  constructor(
    readonly game: Game,
    private readonly onRequest: (request: SceneRequest) => void,
  ) {}

  /** HD (Era 5 only) draws vector graphics at native resolution. */
  get hd(): boolean {
    return this.game.features.has('HD') && this.game.level.era === 5;
  }

  resolution(): ResolutionRequest {
    const { level, features } = this.game;
    const era = level.era;
    if (era === 0) return RESOLUTIONS.ERA0;
    if (era < 5) return era >= 3 ? RESOLUTIONS.ERA3 : RESOLUTIONS.ERA1;
    // Era 5's look follows its features, so the finale can roll it all the way back.
    if (features.has('HD')) return 'native';
    if (!features.has('FRAME_RATE')) return RESOLUTIONS.ERA0;
    if (features.has('PARALLAX') || features.has('LIGHTING')) return RESOLUTIONS.ERA3;
    return RESOLUTIONS.ERA1;
  }

  smooth(): boolean {
    return this.hd;
  }

  /** BLOOM / POST-FX: overdone, and more so while it's being unveiled. */
  postFx(): PostFx | null {
    const { features, moment, time } = this.game;
    if (!this.hd || !features.has('BLOOM')) return null;
    // Photo mode's 1978 filter is crisp black and white: no glow.
    if (this.game.photo?.filter === '1978') return null;
    let k = 1;
    const calm = this.game.comfort.reduceFlashing;
    if (!calm && moment?.feature === 'BLOOM' && (moment.kind ?? 'added') === 'added') {
      // It ramps up past "too much", then settles at merely too much.
      const t = moment.t;
      k = t < 0.8 ? t / 0.8 : 1 + Math.max(0, 1 - (t - 0.8) / 1.2) * 0.8;
    }
    return {
      bloom: 1.35 * k,
      aberration: 4 * k,
      vignette: 0.5 * Math.min(1, k),
      grain: 0.05,
      time,
    };
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
    // Esc / Start pauses (in PHOTO MODE it closes photo mode instead, in the game).
    if (input.wasPressed('pause') && !this.game.photo) {
      this.onRequest('pause');
      return;
    }
    this.game.update(dt, input);
    const request = this.game.request;
    if (request) {
      this.game.request = null;
      this.onRequest(request);
    }
  }

  render(p: PixelCanvas, alpha: number): void {
    if (this.hd) drawHdTier(p, this.game, alpha);
    else drawPixelTier(p, this.game, alpha);
  }
}

import type { FeatureId } from '../core/features';
import { overlaps, type Box } from '../world/physics';

export const PICKUP_SIZE = 14;

export class Pickup {
  collected = false;

  constructor(
    readonly feature: FeatureId,
    /** Centre, in world units. */
    readonly x: number,
    readonly y: number,
  ) {}

  get box(): Box {
    const h = PICKUP_SIZE / 2;
    return { x: this.x - h, y: this.y - h, w: PICKUP_SIZE, h: PICKUP_SIZE };
  }

  touches(box: Box): boolean {
    return !this.collected && overlaps(this.box, box);
  }
}

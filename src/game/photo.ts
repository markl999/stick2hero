import { VIEW_H, VIEW_W } from '../config';
import type { ActionState } from '../core/input';

/*
 * PHOTO MODE (Era 5): the game freezes, you move the camera, pick a filter and take a
 * picture. It actually saves a PNG (main.ts does the saving; the game only asks).
 */

export const PHOTO_FILTERS = ['NONE', 'NOIR', 'SEPIA', 'VAPORWAVE', '1978'] as const;
export type PhotoFilter = (typeof PHOTO_FILTERS)[number];

const PAN_SPEED = 160;

export class PhotoMode {
  /** Camera offset from where the game froze. */
  offsetX = 0;
  offsetY = 0;
  filterIndex = 0;
  /** Set when you press the shutter; cleared by whoever saves the picture. */
  snapRequested = false;
  /** The shutter flash, counting down. */
  flashT = 0;
  shots = 0;
  t = 0;

  get filter(): PhotoFilter {
    return PHOTO_FILTERS[this.filterIndex];
  }

  /** Returns true on the step you take a photo. */
  update(dt: number, input: ActionState): boolean {
    this.t += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    const dx = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const dy = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
    this.offsetX = clamp(this.offsetX + dx * PAN_SPEED * dt, -VIEW_W / 2, VIEW_W / 2);
    this.offsetY = clamp(this.offsetY + dy * PAN_SPEED * dt, -VIEW_H / 2, VIEW_H / 2);
    if (input.wasPressed('attack'))
      this.filterIndex = (this.filterIndex + 1) % PHOTO_FILTERS.length;
    // Space takes the picture (up is for panning, so only the jump-only keys count).
    if (input.wasPressed('jump') && !input.isDown('up') && this.t > 0.2) {
      this.snapRequested = true;
      this.flashT = 0.3;
      this.shots++;
      return true;
    }
    return false;
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

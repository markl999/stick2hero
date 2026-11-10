import { VIEW_H, VIEW_W } from '../config';

/**
 * 'fixed'  the starting screen only (before SCREEN 2)
 * 'flip'   jumps a whole screen at a time when the target leaves the current one
 * 'scroll' (Era 2, SCROLLING) will be added later
 */
export type CameraMode = 'fixed' | 'flip';

export class Camera {
  x = 0;
  y = 0;
  mode: CameraMode = 'fixed';

  constructor(
    private levelWidth: number,
    private levelHeight: number,
    /** The screen the fixed camera shows. */
    private home = { x: 0, y: 0 },
  ) {}

  update(targetX: number, targetY: number): void {
    if (this.mode === 'fixed') {
      this.x = this.home.x;
      this.y = this.home.y;
      return;
    }
    const maxX = Math.max(0, this.levelWidth - VIEW_W);
    const maxY = Math.max(0, this.levelHeight - VIEW_H);
    this.x = clamp(Math.floor(targetX / VIEW_W) * VIEW_W, 0, maxX);
    this.y = clamp(Math.floor(targetY / VIEW_H) * VIEW_H, 0, maxY);
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

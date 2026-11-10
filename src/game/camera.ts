import { VIEW_H, VIEW_W } from '../config';

/**
 * 'fixed'  the starting screen only (before SCREEN 2)
 * 'flip'   jumps a whole screen at a time when the target leaves the current one
 * 'scroll' follows the target smoothly (SCROLLING)
 */
export type CameraMode = 'fixed' | 'flip' | 'scroll';

/** How quickly the scrolling camera catches up (fraction of the gap per step). */
const FOLLOW = 0.14;
/** The scrolling camera keeps the player a little below centre: more sky to see. */
const SCROLL_TARGET_Y = 0.6;

export class Camera {
  x = 0;
  y = 0;
  /** Position at the start of the last step, for render interpolation. */
  prevX = 0;
  prevY = 0;
  mode: CameraMode = 'fixed';
  /** When set, the camera stays on this screen (a boss arena). */
  lockX: number | null = null;
  /** CAMERA: how far ahead of the player to look (eased towards `leadTarget`). */
  lead = 0;
  leadTarget = 0;
  /** A cutscene's point of interest: the camera pans to centre it. Beats everything. */
  focusX: number | null = null;
  /** CAMERA: 1 = normal; >1 pulls in close (drawn around the screen centre). */
  zoom = 1;
  zoomTarget = 1;
  /** CAMERA: screen shake strength in world units; decays by itself. */
  shake = 0;

  constructor(
    private levelWidth: number,
    private levelHeight: number,
    /** The screen the fixed camera shows. */
    private home = { x: 0, y: 0 },
  ) {}

  update(targetX: number, targetY: number): void {
    this.prevX = this.x;
    this.prevY = this.y;
    const maxX = Math.max(0, this.levelWidth - VIEW_W);
    const maxY = Math.max(0, this.levelHeight - VIEW_H);

    if (this.mode === 'fixed') {
      this.x = this.home.x;
      this.y = this.home.y;
    } else if (this.mode === 'flip') {
      this.x = this.lockX ?? clamp(Math.floor(targetX / VIEW_W) * VIEW_W, 0, maxX);
      this.y = clamp(Math.floor(targetY / VIEW_H) * VIEW_H, 0, maxY);
    } else {
      // A cutscene focus, then a lock (boss arena), replace the player as the target.
      this.lead += (this.leadTarget - this.lead) * 0.04;
      const focus = this.focusX === null ? null : clamp(this.focusX - VIEW_W / 2, 0, maxX);
      const wantX = focus ?? this.lockX ?? clamp(targetX + this.lead - VIEW_W / 2, 0, maxX);
      const wantY = clamp(targetY - VIEW_H * SCROLL_TARGET_Y, 0, maxY);
      this.x += (wantX - this.x) * FOLLOW;
      this.y += (wantY - this.y) * FOLLOW;
      if (Math.abs(wantX - this.x) < 0.05) this.x = wantX;
      if (Math.abs(wantY - this.y) < 0.05) this.y = wantY;
    }

    this.zoom += (this.zoomTarget - this.zoom) * 0.05;
    this.shake *= 0.88;
    if (this.shake < 0.05) this.shake = 0;

    // Screen flips (and the first frame) shouldn't be interpolated across.
    if (this.mode !== 'scroll' || Math.abs(this.x - this.prevX) > VIEW_W / 2) {
      this.prevX = this.x;
      this.prevY = this.y;
    }
  }

  /** Jump straight to the target (on spawn/respawn) without easing. */
  snap(targetX: number, targetY: number): void {
    const maxX = Math.max(0, this.levelWidth - VIEW_W);
    const maxY = Math.max(0, this.levelHeight - VIEW_H);
    if (this.mode === 'scroll') {
      this.x = clamp(targetX - VIEW_W / 2, 0, maxX);
      this.y = clamp(targetY - VIEW_H * SCROLL_TARGET_Y, 0, maxY);
    }
    this.update(targetX, targetY);
    this.prevX = this.x;
    this.prevY = this.y;
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

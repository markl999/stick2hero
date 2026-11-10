import { moveX, moveY, type Box } from '../world/physics';
import type { SolidQuery } from '../world/tilemap';

export const PLAYER_W = 10;
export const PLAYER_H = 28;

// Tuning, in world units (1 tile = 20) and seconds.
export const RUN_SPEED = 110;
export const GRAVITY = 1400;
export const JUMP_SPEED = 370; // ≈ 49 units (2.4 tiles) apex
export const MAX_FALL = 520;
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER = 0.1;
/** Releasing jump early clamps upward speed to this fraction: variable jump height. */
export const JUMP_CUT = 0.45;

export interface PlayerControls {
  left: boolean;
  right: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
}

/** What the current feature set allows. Inputs are never gated, abilities are. */
export interface PlayerAbilities {
  moveLeft: boolean;
  jump: boolean;
}

export interface Bounds {
  minX: number;
  maxX: number;
}

export interface PlayerEvents {
  jumped: boolean;
  landed: boolean;
}

export class Player {
  readonly box: Box;
  vx = 0;
  vy = 0;
  onGround = false;
  facing: 1 | -1 = 1;
  /** Position at the start of the last step, for render interpolation. */
  prevX: number;
  prevY: number;

  private coyote = 0;
  private buffer = 0;

  constructor(feetX: number, feetY: number) {
    this.box = { x: feetX - PLAYER_W / 2, y: feetY - PLAYER_H, w: PLAYER_W, h: PLAYER_H };
    this.prevX = this.box.x;
    this.prevY = this.box.y;
  }

  get feetX(): number {
    return this.box.x + this.box.w / 2;
  }

  get feetY(): number {
    return this.box.y + this.box.h;
  }

  teleport(feetX: number, feetY: number): void {
    this.box.x = feetX - PLAYER_W / 2;
    this.box.y = feetY - PLAYER_H;
    this.prevX = this.box.x;
    this.prevY = this.box.y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.coyote = 0;
    this.buffer = 0;
  }

  update(
    dt: number,
    controls: PlayerControls,
    abilities: PlayerAbilities,
    map: SolidQuery,
    bounds?: Bounds,
  ): PlayerEvents {
    this.prevX = this.box.x;
    this.prevY = this.box.y;

    // Horizontal: instant velocity (Era 0 has no acceleration curve).
    const dir = (controls.right ? 1 : 0) - (controls.left && abilities.moveLeft ? 1 : 0);
    this.vx = dir * RUN_SPEED;
    if (dir !== 0) this.facing = dir > 0 ? 1 : -1;

    // Jump with buffering (press slightly early) and coyote time (press slightly late).
    this.buffer =
      controls.jumpPressed && abilities.jump ? JUMP_BUFFER : Math.max(0, this.buffer - dt);
    this.coyote = this.onGround ? COYOTE_TIME : Math.max(0, this.coyote - dt);
    let jumped = false;
    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = -JUMP_SPEED;
      this.buffer = 0;
      this.coyote = 0;
      jumped = true;
    }
    if (!controls.jumpHeld && this.vy < -JUMP_SPEED * JUMP_CUT) {
      this.vy = -JUMP_SPEED * JUMP_CUT;
    }

    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);

    if (moveX(this.box, this.vx * dt, map)) this.vx = 0;
    if (bounds) {
      if (this.box.x < bounds.minX) this.box.x = bounds.minX;
      if (this.box.x + this.box.w > bounds.maxX) this.box.x = bounds.maxX - this.box.w;
    }

    const wasOnGround = this.onGround;
    const hitY = moveY(this.box, this.vy * dt, map);
    this.onGround = hitY && this.vy > 0;
    if (hitY) this.vy = 0;

    return { jumped, landed: this.onGround && !wasOnGround };
  }
}

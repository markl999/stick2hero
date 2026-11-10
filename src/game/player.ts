import { TILE } from '../config';
import { moveX, moveY, type Box } from '../world/physics';
import type { SolidQuery } from '../world/tilemap';

export const PLAYER_W = 10;
export const PLAYER_H = 28;

// Tuning, in world units (1 tile = 20) and seconds.
export const RUN_SPEED = 110;
export const GRAVITY = 1400;
export const JUMP_SPEED = 370; // ≈ 49 units (2.4 tiles) apex: 2-tile steps are jumpable
export const MAX_FALL = 520;
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER = 0.1;
/** Releasing jump early clamps upward speed to this fraction: variable jump height. */
export const JUMP_CUT = 0.45;

/**
 * Ledge grab (ARMS). You catch a ledge when the top of your box is within this window
 * of the ledge top. The numbers are chosen so 3-tile walls can be climbed (jump + grab)
 * but 4-tile walls can't. Keep that rule in mind when designing levels.
 */
export const GRAB_ABOVE = 4;
export const GRAB_BELOW = 2;
/** Don't grab while still rising faster than this (feels sticky otherwise). */
export const GRAB_MIN_VY = -150;
/** How far below the ledge top the box's top sits while hanging. */
export const HANG_OFFSET = 2;
export const CLIMB_TIME = 0.22;
export const REGRAB_COOLDOWN = 0.3;

export interface PlayerControls {
  left: boolean;
  right: boolean;
  down: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
}

/** What the current feature set allows. Inputs are never gated, abilities are. */
export interface PlayerAbilities {
  moveLeft: boolean;
  jump: boolean;
  grab: boolean;
}

export interface Bounds {
  minX: number;
  maxX: number;
}

export interface PlayerEvents {
  jumped: boolean;
  landed: boolean;
  grabbed: boolean;
}

export type PlayerState = 'normal' | 'hang' | 'climb';

export class Player {
  readonly box: Box;
  vx = 0;
  vy = 0;
  onGround = false;
  facing: 1 | -1 = 1;
  state: PlayerState = 'normal';
  /** 0..1 progress through a climb. */
  climbT = 0;
  /** Position at the start of the last step, for render interpolation. */
  prevX: number;
  prevY: number;

  private coyote = 0;
  private buffer = 0;
  private regrab = 0;
  private climbFrom = { x: 0, y: 0 };
  private climbTo = { x: 0, y: 0 };

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
    this.state = 'normal';
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
    this.regrab = Math.max(0, this.regrab - dt);
    const events: PlayerEvents = { jumped: false, landed: false, grabbed: false };

    if (this.state === 'climb') {
      this.updateClimb(dt, events);
      return events;
    }
    if (this.state === 'hang') {
      this.updateHang(controls, abilities);
      return events;
    }

    // Horizontal: instant velocity (Era 0 has no acceleration curve).
    const dir = (controls.right ? 1 : 0) - (controls.left && abilities.moveLeft ? 1 : 0);
    this.vx = dir * RUN_SPEED;
    if (dir !== 0) this.facing = dir > 0 ? 1 : -1;

    // Jump with buffering (press slightly early) and coyote time (press slightly late).
    this.buffer =
      controls.jumpPressed && abilities.jump ? JUMP_BUFFER : Math.max(0, this.buffer - dt);
    this.coyote = this.onGround ? COYOTE_TIME : Math.max(0, this.coyote - dt);
    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = -JUMP_SPEED;
      this.buffer = 0;
      this.coyote = 0;
      events.jumped = true;
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
    events.landed = this.onGround && !wasOnGround;

    if (abilities.grab && dir !== 0 && this.tryGrab(dir > 0 ? 1 : -1, map)) events.grabbed = true;
    return events;
  }

  /**
   * Catch a ledge when airborne, pressed against a wall, and the top of the box passes
   * the top of that wall this step (swept, so fast falls can't skip it).
   */
  private tryGrab(dir: 1 | -1, map: SolidQuery): boolean {
    if (this.onGround || this.regrab > 0 || this.vy < GRAB_MIN_VY) return false;

    const b = this.box;
    const face = dir > 0 ? b.x + b.w : b.x;
    const faceTile = Math.round(face / TILE);
    if (Math.abs(face - faceTile * TILE) > 0.01) return false; // not touching a tile edge
    const tx = dir > 0 ? faceTile : faceTile - 1;

    // Ledge tops the box top swept past: ledgeY in [top - GRAB_BELOW, top + GRAB_ABOVE].
    const lo = Math.min(this.prevY, b.y) - GRAB_BELOW;
    const hi = Math.max(this.prevY, b.y) + GRAB_ABOVE;
    for (let ty = Math.ceil(lo / TILE); ty * TILE <= hi; ty++) {
      const isLedge = map.isSolid(tx, ty) && !map.isSolid(tx, ty - 1) && !map.isSolid(tx, ty - 2);
      if (!isLedge) continue;
      const ledgeY = ty * TILE;
      this.state = 'hang';
      this.facing = dir;
      this.vx = 0;
      this.vy = 0;
      b.y = ledgeY + HANG_OFFSET;
      this.climbTo = { x: dir > 0 ? tx * TILE : (tx + 1) * TILE - b.w, y: ledgeY - b.h };
      return true;
    }
    return false;
  }

  private updateHang(controls: PlayerControls, abilities: PlayerAbilities): void {
    const awayPressed = this.facing > 0 ? controls.left && abilities.moveLeft : controls.right;
    if (controls.jumpPressed) {
      this.state = 'climb';
      this.climbT = 0;
      this.climbFrom = { x: this.box.x, y: this.box.y };
    } else if (controls.down || awayPressed || !abilities.grab) {
      this.state = 'normal';
      this.regrab = REGRAB_COOLDOWN;
    }
  }

  private updateClimb(dt: number, events: PlayerEvents): void {
    this.climbT = Math.min(1, this.climbT + dt / CLIMB_TIME);
    // Up first, then over the edge.
    const up = Math.min(1, this.climbT / 0.6);
    const over = Math.max(0, (this.climbT - 0.6) / 0.4);
    this.box.y = this.climbFrom.y + (this.climbTo.y - this.climbFrom.y) * up;
    this.box.x = this.climbFrom.x + (this.climbTo.x - this.climbFrom.x) * over;
    if (this.climbT >= 1) {
      this.state = 'normal';
      this.onGround = true;
      this.vy = 0;
      events.landed = true;
    }
  }
}

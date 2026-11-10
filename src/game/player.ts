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

/** HANDS & FEET: slide down walls slowly, and jump off them. */
export const WALL_SLIDE_SPEED = 90;
export const WALL_JUMP_SPEED = 360;
/** After a wall jump you're pushed away from the wall for a moment, whatever you press. */
export const WALL_JUMP_PUSH_TIME = 0.14;
const WALL_COYOTE = 0.08;

/** ANIMATION: how long the landing squash lasts. */
export const LAND_SQUASH_TIME = 0.12;

/** PUNCH: a short jab in front of you. */
export const PUNCH_TIME = 0.15;
export const PUNCH_COOLDOWN = 0.3;
export const PUNCH_REACH = 14;

export interface PlayerControls {
  left: boolean;
  right: boolean;
  down: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
  attackPressed: boolean;
}

/** What the current feature set allows. Inputs are never gated, abilities are. */
export interface PlayerAbilities {
  moveLeft: boolean;
  jump: boolean;
  grab: boolean;
  punch: boolean;
  wallJump: boolean;
}

export interface Bounds {
  minX: number;
  maxX: number;
}

export interface PlayerEvents {
  jumped: boolean;
  landed: boolean;
  grabbed: boolean;
  punched: boolean;
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
  /** Seconds left on the current punch (0 = not punching). */
  punchT = 0;
  /** Increments with every punch, so a target is only hit once per punch. */
  punchId = 0;
  /** Distance walked on the ground (drives the walk cycle). */
  walkDistance = 0;
  /** Counts down after landing (drives the landing squash). */
  landSquash = 0;
  /** Pressed against a wall in the air, sliding down it (HANDS & FEET). */
  wallSliding = false;
  /** Position at the start of the last step, for render interpolation. */
  prevX: number;
  prevY: number;

  private coyote = 0;
  private buffer = 0;
  private regrab = 0;
  private punchCooldown = 0;
  private wallCoyote = 0;
  private wallDir: 1 | -1 = 1;
  private pushT = 0;
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
    this.punchT = 0;
  }

  /** The punch's hit box while a punch is active, otherwise null. */
  punchBox(): Box | null {
    if (this.punchT <= 0) return null;
    const b = this.box;
    const x = this.facing > 0 ? b.x + b.w : b.x - PUNCH_REACH;
    return { x, y: b.y + 8, w: PUNCH_REACH, h: 10 };
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
    this.punchT = Math.max(0, this.punchT - dt);
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.landSquash = Math.max(0, this.landSquash - dt);
    this.wallCoyote = Math.max(0, this.wallCoyote - dt);
    this.pushT = Math.max(0, this.pushT - dt);
    const events: PlayerEvents = { jumped: false, landed: false, grabbed: false, punched: false };

    if (this.state === 'climb') {
      this.updateClimb(dt, events);
      return events;
    }
    if (this.state === 'hang') {
      this.updateHang(controls, abilities);
      return events;
    }

    // Horizontal: instant velocity (no acceleration curve in the pixel eras).
    const dir = (controls.right ? 1 : 0) - (controls.left && abilities.moveLeft ? 1 : 0);
    if (this.pushT > 0) {
      this.vx = -this.wallDir * RUN_SPEED; // pushed off the wall
    } else {
      this.vx = dir * RUN_SPEED;
      if (dir !== 0) this.facing = dir > 0 ? 1 : -1;
    }

    if (controls.attackPressed && abilities.punch && this.punchCooldown <= 0) {
      this.punchT = PUNCH_TIME;
      this.punchCooldown = PUNCH_COOLDOWN;
      this.punchId++;
      events.punched = true;
    }

    // Jump with buffering (press slightly early) and coyote time (press slightly late).
    this.buffer =
      controls.jumpPressed && abilities.jump ? JUMP_BUFFER : Math.max(0, this.buffer - dt);
    this.coyote = this.onGround ? COYOTE_TIME : Math.max(0, this.coyote - dt);
    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = -JUMP_SPEED;
      this.buffer = 0;
      this.coyote = 0;
      events.jumped = true;
    } else if (this.buffer > 0 && !this.onGround && this.wallCoyote > 0 && abilities.wallJump) {
      // Wall jump: up and away from the wall.
      this.vy = -WALL_JUMP_SPEED;
      this.buffer = 0;
      this.wallCoyote = 0;
      this.pushT = WALL_JUMP_PUSH_TIME;
      this.vx = -this.wallDir * RUN_SPEED;
      this.facing = this.wallDir > 0 ? -1 : 1;
      this.regrab = WALL_JUMP_PUSH_TIME + 0.05;
      events.jumped = true;
    }
    if (!controls.jumpHeld && this.vy < -JUMP_SPEED * JUMP_CUT) {
      this.vy = -JUMP_SPEED * JUMP_CUT;
    }

    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);

    const hitWall = moveX(this.box, this.vx * dt, map);
    if (hitWall) this.vx = 0;
    // Pressing into a wall in the air: remember it for wall jumps, and slide down slowly.
    this.wallSliding = false;
    if (hitWall && dir !== 0 && !this.onGround && this.pushT <= 0) {
      this.wallDir = dir > 0 ? 1 : -1;
      this.wallCoyote = WALL_COYOTE;
      if (abilities.wallJump && this.vy > WALL_SLIDE_SPEED) {
        this.vy = WALL_SLIDE_SPEED;
        this.wallSliding = true;
      } else if (abilities.wallJump && this.vy > 0) {
        this.wallSliding = true;
      }
    }
    if (bounds) {
      if (this.box.x < bounds.minX) this.box.x = bounds.minX;
      if (this.box.x + this.box.w > bounds.maxX) this.box.x = bounds.maxX - this.box.w;
    }

    const wasOnGround = this.onGround;
    const hitY = moveY(this.box, this.vy * dt, map);
    this.onGround = hitY && this.vy > 0;
    if (hitY) this.vy = 0;
    events.landed = this.onGround && !wasOnGround;
    if (events.landed) this.landSquash = LAND_SQUASH_TIME;
    if (this.onGround) this.walkDistance += Math.abs(this.box.x - this.prevX);

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

import { TILE } from '../config';
import { moveX, moveY, type Box } from '../world/physics';
import type { SolidQuery } from '../world/tilemap';

// --- THROW: pebbles --------------------------------------------------------------------

export const PEBBLE_SIZE = 4;
const PEBBLE_GRAVITY = 400;
const PEBBLE_LIFETIME = 1.6;
/**
 * Forward throws skim along at shin height, so they hit walkers anywhere within ~100
 * units. "Up" throws go straight up from hand height, for switches and flying things.
 */
export const PEBBLE_FORWARD = { vx: 240, vy: -60, fromFeet: 8 };
export const PEBBLE_UP = { vx: 0, vy: -430, fromFeet: 20 };

export class Pebble {
  readonly box: Box;
  alive = true;
  prevX: number;
  prevY: number;
  private t = 0;

  constructor(
    x: number,
    y: number,
    private vx: number,
    private vy: number,
  ) {
    this.box = { x: x - PEBBLE_SIZE / 2, y: y - PEBBLE_SIZE / 2, w: PEBBLE_SIZE, h: PEBBLE_SIZE };
    this.prevX = this.box.x;
    this.prevY = this.box.y;
  }

  update(dt: number, map: SolidQuery): void {
    this.prevX = this.box.x;
    this.prevY = this.box.y;
    this.t += dt;
    this.vy += PEBBLE_GRAVITY * dt;
    if (moveX(this.box, this.vx * dt, map) || moveY(this.box, this.vy * dt, map)) {
      this.alive = false;
    }
    if (this.t > PEBBLE_LIFETIME) this.alive = false;
  }
}

// --- Flicker's bombs -------------------------------------------------------------------

export const BOMB_SIZE = 6;
const BOMB_GRAVITY = 420;

export class Bomb {
  readonly box: Box;
  alive = true;
  prevX: number;
  prevY: number;
  private vy = 0;

  constructor(x: number, y: number) {
    this.box = { x: x - BOMB_SIZE / 2, y, w: BOMB_SIZE, h: BOMB_SIZE };
    this.prevX = this.box.x;
    this.prevY = this.box.y;
  }

  update(dt: number, map: SolidQuery): void {
    this.prevX = this.box.x;
    this.prevY = this.box.y;
    this.vy += BOMB_GRAVITY * dt;
    if (moveY(this.box, this.vy * dt, map)) this.alive = false;
  }
}

// --- CHECKPOINTS: flags ----------------------------------------------------------------

export class Flag {
  raised = false;

  constructor(
    /** Feet position: where you respawn. */
    readonly x: number,
    readonly y: number,
  ) {}

  get box(): Box {
    return { x: this.x - 6, y: this.y - 26, w: 12, h: 26 };
  }
}

// --- Switches (hit with a pebble to open the doors on their screen) ----------------------

export class Switch {
  hit = false;
  readonly box: Box;

  constructor(feetX: number, feetY: number) {
    const cx = feetX;
    const cy = feetY - TILE / 2;
    this.box = { x: cx - 5, y: cy - 5, w: 10, h: 10 };
  }
}

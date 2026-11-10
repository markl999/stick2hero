import { TILE } from '../config';
import { angleDiff, lineOfSight } from '../world/light';
import type { Box } from '../world/physics';
import type { SolidQuery } from '../world/tilemap';

/*
 * Era 5 (MODERN): lamps, security drones, vents and physics debris.
 * DYNAMIC SHADOWS: a point is lit if a lamp reaches it with nothing solid in the way.
 * Drones only see you when you're lit.
 */

// --- Lamps -----------------------------------------------------------------------------

export const STREET_LAMP_RADIUS = 175;
export const HANGING_LAMP_RADIUS = 190;
/** Light is soft at its edge: only this fraction of the radius counts as "lit". */
export const LIT_FRACTION = 0.85;
/** How high a street lamp's head is above its foot. */
export const STREET_LAMP_HEIGHT = 64;
const HANG_SWING = 0.16;
const LAMP_GRAVITY = 900;

export type LampState = 'on' | 'falling' | 'broken';

/**
 * Street lamps stand on the ground. Hanging lamps swing gently from the ceiling above
 * them (so their shadows sway), and with PHYSICS you can cut them down.
 */
export class Lamp {
  state: LampState = 'on';
  /** While falling: the lamp's position. */
  fallX = 0;
  fallY = 0;
  private vy = 0;
  private swing = 0;

  constructor(
    readonly kind: 'street' | 'hanging',
    /** Street: the foot of the pole. Hanging: where the chain is attached. */
    readonly anchorX: number,
    readonly anchorY: number,
    /** Hanging: chain length. */
    readonly length = 0,
  ) {
    this.swing = anchorX * 0.37;
  }

  get lit(): boolean {
    return this.state === 'on';
  }

  get radius(): number {
    return this.kind === 'street' ? STREET_LAMP_RADIUS : HANGING_LAMP_RADIUS;
  }

  get angle(): number {
    return this.kind === 'hanging' ? Math.sin(this.swing) * HANG_SWING : 0;
  }

  /** Where the light comes from. */
  get x(): number {
    if (this.state !== 'on' && this.kind === 'hanging') return this.fallX;
    return this.kind === 'street'
      ? this.anchorX
      : this.anchorX + Math.sin(this.angle) * this.length;
  }

  get y(): number {
    if (this.state !== 'on' && this.kind === 'hanging') return this.fallY;
    return this.kind === 'street'
      ? this.anchorY - STREET_LAMP_HEIGHT
      : this.anchorY + Math.cos(this.angle) * this.length;
  }

  /** The lamp's shade, for sword hits. */
  get box(): Box {
    return { x: this.x - 8, y: this.y - 8, w: 16, h: 12 };
  }

  /** The chain, as a thin box (hit anywhere along it to cut it). */
  get chainBox(): Box {
    const x = (this.anchorX + this.x) / 2;
    return { x: x - 5, y: this.anchorY, w: 10, h: Math.max(0, this.y - this.anchorY - 6) };
  }

  cut(): void {
    if (this.kind !== 'hanging' || this.state !== 'on') return;
    this.fallX = this.x;
    this.fallY = this.y;
    this.state = 'falling';
    this.vy = 0;
  }

  /** Returns true on the step it smashes into the ground. */
  update(dt: number, map: SolidQuery): boolean {
    if (this.state === 'on') {
      this.swing += dt * 1.15;
      return false;
    }
    if (this.state !== 'falling') return false;
    this.vy = Math.min(this.vy + LAMP_GRAVITY * dt, 600);
    this.fallY += this.vy * dt;
    const tx = Math.floor(this.fallX / TILE);
    const ty = Math.floor((this.fallY + 4) / TILE);
    if (map.isSolid(tx, ty) || this.fallY > 2000) {
      this.fallY = ty * TILE - 4;
      this.state = 'broken';
      return true;
    }
    return false;
  }
}

/** Is a point lit? Without DYNAMIC SHADOWS light passes through walls. */
export function litBy(
  lamps: readonly Lamp[],
  map: SolidQuery,
  x: number,
  y: number,
  shadows: boolean,
): Lamp | null {
  for (const lamp of lamps) {
    if (!lamp.lit) continue;
    const dist = Math.hypot(x - lamp.x, y - lamp.y);
    if (dist > lamp.radius * LIT_FRACTION) continue;
    if (!shadows || lineOfSight(map, lamp.x, lamp.y, x, y)) return lamp;
  }
  return null;
}

// --- Security drones ---------------------------------------------------------------------

export const DRONE_RANGE = 170;
export const DRONE_HALF_ANGLE = 0.42;
const DRONE_SWEEP = 0.38;
const DRONE_PERIOD = 4.2;
/** How long it has to see you before it fires. Leaving its sight lets the meter drain. */
export const SPOT_TIME = 0.55;
const FORGET_TIME = 0.9;
export const ZAP_TIME = 0.3;
const DRONE_COOLDOWN = 1.4;
const TRACK_RATE = 4;
/** Turning drones look each way for this long. */
export const TURN_TIME = 3.2;

export type DroneState = 'watch' | 'zap' | 'cooldown' | 'dead';

/**
 * A hovering security drone. It sweeps a vision cone over the floor; if it sees you, and
 * you're lit, its alert meter fills and then it zaps you. Hide in shadow and it forgets.
 * One sword hit, from out of its sight, takes it down.
 */
export class Drone {
  state: DroneState = 'watch';
  angle: number;
  /** 0..1: how sure it is that it's seen you. */
  alert = 0;
  t = 0;
  /** Where the last zap went (for drawing the beam). */
  zapX = 0;
  zapY = 0;
  /** Falling when destroyed. */
  fallVy = 0;
  y: number;
  private clock: number;
  /** Turning drones: time looking this way. */
  turnT = 0;

  constructor(
    readonly x: number,
    readonly homeY: number,
    public facing: 1 | -1,
    /** How far below horizontal it looks (radians): low drones look along the floor. */
    readonly tilt = 0.6,
    /** Turning drones look one way, then the other: TURN_TIME each. */
    readonly turns = false,
  ) {
    this.y = homeY;
    this.clock = (x * 0.013) % DRONE_PERIOD;
    this.angle = this.baseAngle;
  }

  get alive(): boolean {
    return this.state !== 'dead';
  }

  /** Looking down and out in front of it. */
  get baseAngle(): number {
    return this.facing > 0 ? this.tilt : Math.PI - this.tilt;
  }

  get box(): Box {
    return { x: this.x - 9, y: this.y - 6, w: 18, h: 12 };
  }

  /** In its cone, in range, nothing in the way. (Whether you're lit is checked separately.) */
  inView(map: SolidQuery, px: number, py: number): boolean {
    if (!this.alive) return false;
    const dx = px - this.x;
    const dy = py - this.y;
    if (Math.hypot(dx, dy) > DRONE_RANGE) return false;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), this.angle)) > DRONE_HALF_ANGLE) return false;
    return lineOfSight(map, this.x, this.y, px, py);
  }

  /** `seen`: it can see you and you're lit. Returns true on the step it fires. */
  update(dt: number, seen: boolean, targetX: number, targetY: number): boolean {
    this.t += dt;
    if (this.state === 'dead') {
      this.fallVy = Math.min(this.fallVy + 900 * dt, 600);
      this.y += this.fallVy * dt;
      return false;
    }
    this.clock += dt;
    if (this.turns && this.state === 'watch' && this.alert === 0) {
      this.turnT += dt;
      if (this.turnT >= TURN_TIME) {
        this.turnT = 0;
        this.facing = this.facing > 0 ? -1 : 1;
      }
    }
    const sweep =
      this.baseAngle + Math.sin((this.clock / DRONE_PERIOD) * Math.PI * 2) * DRONE_SWEEP;
    if (this.state === 'watch' && seen && this.alert > 0.25) {
      // Suspicious: it turns to keep you in view.
      const want = Math.atan2(targetY - this.y, targetX - this.x);
      this.angle += angleDiff(want, this.angle) * Math.min(1, TRACK_RATE * dt);
    } else {
      this.angle += angleDiff(sweep, this.angle) * Math.min(1, 3 * dt);
    }

    switch (this.state) {
      case 'watch':
        this.alert = seen
          ? Math.min(1, this.alert + dt / SPOT_TIME)
          : Math.max(0, this.alert - dt / FORGET_TIME);
        if (this.alert >= 1) {
          this.state = 'zap';
          this.t = 0;
          this.zapX = targetX;
          this.zapY = targetY;
          return true;
        }
        return false;
      case 'zap':
        if (this.t >= ZAP_TIME) {
          this.state = 'cooldown';
          this.t = 0;
          this.alert = 0;
        }
        return false;
      case 'cooldown':
        this.alert = 0;
        if (this.t >= DRONE_COOLDOWN) {
          this.state = 'watch';
          this.t = 0;
        }
        return false;
    }
    return false;
  }

  /** Back to watching, calm (after you respawn). */
  calm(): void {
    if (this.state === 'dead') return;
    this.state = 'watch';
    this.alert = 0;
    this.t = 0;
  }

  destroy(): void {
    this.state = 'dead';
    this.t = 0;
    this.fallVy = -60;
  }
}

// --- Vents -------------------------------------------------------------------------------

/** Vents' updrafts reach up this far at most. */
export const VENT_REACH = 8 * TILE;

/** A rooftop vent. With the CAPE, its updraft lifts you while you glide. */
export class Vent {
  /** Top of the updraft column. */
  readonly top: number;

  constructor(
    readonly x: number,
    /** The floor the vent sits on. */
    readonly y: number,
    map: SolidQuery,
  ) {
    let top = y - TILE;
    const tx = Math.floor(x / TILE);
    while (top > y - VENT_REACH && !map.isSolid(tx, Math.floor((top - 1) / TILE))) top -= TILE;
    this.top = Math.max(-TILE * 2, top);
  }

  get column(): Box {
    return { x: this.x - TILE * 0.75, y: this.top, w: TILE * 1.5, h: this.y - this.top };
  }
}

// --- PHYSICS: debris ----------------------------------------------------------------------

export type DebrisKind = 'concrete' | 'glass' | 'metal' | 'robot';

/** A small rigid body: it tumbles, bounces and settles. It never pushes the player. */
export interface Body {
  kind: DebrisKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  w: number;
  h: number;
  /** Seconds left; bodies fade out at the end. */
  life: number;
}

const MAX_BODIES = 260;
const BODY_GRAVITY = 1100;
const BODY_LIFE = 14;

export class Debris {
  readonly bodies: Body[] = [];

  burst(
    kind: DebrisKind,
    x: number,
    y: number,
    count: number,
    options: { speed?: number; size?: number; up?: number; spread?: number } = {},
  ): void {
    const speed = options.speed ?? 160;
    const size = options.size ?? 5;
    const spread = options.spread ?? TILE / 2;
    for (let i = 0; i < count; i++) {
      if (this.bodies.length >= MAX_BODIES) this.bodies.shift();
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.bodies.push({
        kind,
        x: x + (Math.random() - 0.5) * spread,
        y: y + (Math.random() - 0.5) * spread,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (options.up ?? 120),
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 18,
        w: size * (0.6 + Math.random() * 0.8),
        h: size * (0.5 + Math.random() * 0.6),
        life: BODY_LIFE * (0.7 + Math.random() * 0.3),
      });
    }
  }

  /** Add one body (a ragdoll part, say). */
  add(body: Omit<Body, 'life'>): void {
    if (this.bodies.length >= MAX_BODIES) this.bodies.shift();
    this.bodies.push({ ...body, life: BODY_LIFE });
  }

  /** `kicker`: the player's box and speed; walking through debris nudges it along. */
  update(dt: number, map: SolidQuery, kicker?: { box: Box; vx: number }): void {
    for (const b of this.bodies) {
      b.life -= dt;
      b.vy = Math.min(b.vy + BODY_GRAVITY * dt, 700);
      const r = Math.max(1.5, Math.min(b.w, b.h) / 2);
      // Horizontal, then vertical, each resolved against the tile grid as a small circle.
      b.x += b.vx * dt;
      const ty = Math.floor(b.y / TILE);
      if (b.vx > 0 && map.isSolid(Math.floor((b.x + r) / TILE), ty)) {
        b.x = Math.floor((b.x + r) / TILE) * TILE - r;
        b.vx *= -0.35;
      } else if (b.vx < 0 && map.isSolid(Math.floor((b.x - r) / TILE), ty)) {
        b.x = (Math.floor((b.x - r) / TILE) + 1) * TILE + r;
        b.vx *= -0.35;
      }
      b.y += b.vy * dt;
      const tx = Math.floor(b.x / TILE);
      if (b.vy > 0 && map.isSolid(tx, Math.floor((b.y + r) / TILE))) {
        b.y = Math.floor((b.y + r) / TILE) * TILE - r;
        b.vy = Math.abs(b.vy) > 60 ? -b.vy * 0.3 : 0;
        b.vx *= 0.75;
        // Rolling along the floor.
        b.spin = b.vx / Math.max(2, r * 2);
        if (Math.abs(b.vx) < 3) b.vx = 0;
      } else if (b.vy < 0 && map.isSolid(tx, Math.floor((b.y - r) / TILE))) {
        b.y = (Math.floor((b.y - r) / TILE) + 1) * TILE + r;
        b.vy = 0;
      } else {
        b.angle += b.spin * dt;
      }
      if (kicker && kicker.vx !== 0) {
        const k = kicker.box;
        if (b.x > k.x - 2 && b.x < k.x + k.w + 2 && b.y > k.y && b.y < k.y + k.h + 2) {
          b.vx += kicker.vx * 0.6;
          b.vy -= 70 + Math.random() * 60;
          b.spin += (Math.random() - 0.5) * 10;
        }
      }
    }
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const b = this.bodies[i];
      if (b.life <= 0 || b.y > 3000) this.bodies.splice(i, 1);
    }
  }
}

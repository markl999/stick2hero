import type { Box } from '../world/physics';

/*
 * Era 4 (32-BIT): ghosts, lights, particles, the Deprecator's cutscene and the Chase.
 */

// --- Ghosts ----------------------------------------------------------------------------

export const GHOST_W = 16;
export const GHOST_H = 18;
const GHOST_SPEED = 32;
const GHOST_SIGHT = 170;

/** Floats through walls towards you once you're close. One sword hit (or pebble) ends it. */
export class Ghost {
  readonly box: Box;
  alive = true;
  deadT = 0;
  prevX: number;
  prevY: number;
  private t = Math.random() * 10;
  private readonly homeY: number;

  constructor(feetX: number, feetY: number) {
    this.box = { x: feetX - GHOST_W / 2, y: feetY - GHOST_H, w: GHOST_W, h: GHOST_H };
    this.homeY = this.box.y;
    this.prevX = this.box.x;
    this.prevY = this.box.y;
  }

  get gone(): boolean {
    return !this.alive && this.deadT > 0.6;
  }

  update(dt: number, targetX: number, targetY: number): void {
    this.prevX = this.box.x;
    this.prevY = this.box.y;
    if (!this.alive) {
      this.deadT += dt;
      this.box.y -= 20 * dt; // drifts up as it fades
      return;
    }
    this.t += dt;
    const cx = this.box.x + this.box.w / 2;
    const cy = this.box.y + this.box.h / 2;
    const dx = targetX - cx;
    const dy = targetY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < GHOST_SIGHT && dist > 1) {
      this.box.x += (dx / dist) * GHOST_SPEED * dt;
      this.box.y += (dy / dist) * GHOST_SPEED * dt;
    } else {
      this.box.y += (this.homeY - this.box.y) * Math.min(1, dt * 2);
    }
    this.box.y += Math.sin(this.t * 3) * 6 * dt;
  }

  kill(): void {
    this.alive = false;
    this.deadT = 0;
  }
}

// --- Lights ----------------------------------------------------------------------------

export const TORCH_RADIUS = 90;
export const BRAZIER_RADIUS = 120;
export const LANTERN_RADIUS = 62;

/** Torches are always lit; braziers light when you touch them (and save your place). */
export class Light {
  constructor(
    readonly kind: 'torch' | 'brazier',
    /** Feet position: the light sits a little above. */
    readonly x: number,
    readonly y: number,
    public lit: boolean,
  ) {}

  get radius(): number {
    return this.kind === 'torch' ? TORCH_RADIUS : BRAZIER_RADIUS;
  }

  /** Where the flame is. */
  get flameY(): number {
    return this.y - (this.kind === 'torch' ? 30 : 16);
  }

  get box(): Box {
    return { x: this.x - 8, y: this.y - 18, w: 16, h: 18 };
  }
}

// --- Particles -------------------------------------------------------------------------

export type ParticleKind = 'dust' | 'spark' | 'splash' | 'debris' | 'glitch' | 'ember';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
}

const MAX_PARTICLES = 500;
const PARTICLE_GRAVITY: Record<ParticleKind, number> = {
  dust: -20,
  spark: 500,
  splash: 600,
  debris: 700,
  glitch: 0,
  ember: -60,
};

export class Particles {
  readonly list: Particle[] = [];

  burst(
    kind: ParticleKind,
    x: number,
    y: number,
    count: number,
    speed: number,
    options: { up?: number; life?: number; size?: number } = {},
  ): void {
    for (let i = 0; i < count && this.list.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      const life = (options.life ?? 0.5) * (0.6 + Math.random() * 0.6);
      this.list.push({
        kind,
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - (options.up ?? 0),
        life,
        max: life,
        size: options.size ?? 2,
      });
    }
  }

  update(dt: number): void {
    for (const p of this.list) {
      p.life -= dt;
      p.vy += PARTICLE_GRAVITY[p.kind] * dt;
      p.vx *= p.kind === 'dust' ? 0.92 : 0.99;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.list.length - 1; i >= 0; i--)
      if (this.list[i].life <= 0) this.list.splice(i, 1);
  }
}

// --- The Chase -------------------------------------------------------------------------

export const WAVE_START_SPEED = 92;
export const WAVE_MAX_SPEED = 104;
const WAVE_ACCEL = 2;
/** How far behind the player (or the checkpoint) the wave starts. */
export const WAVE_LEAD = 170;

/**
 * The Deprecator's deletion wave: a wall of static that erases the level behind it,
 * slightly slower than you can run. Touch it and you're deleted.
 */
export class DeletionWave {
  x: number;
  speed = WAVE_START_SPEED;
  active = false;
  prevX: number;

  constructor(x: number) {
    this.x = x;
    this.prevX = x;
  }

  start(fromX: number): void {
    this.active = true;
    this.x = fromX - WAVE_LEAD;
    this.prevX = this.x;
    this.speed = WAVE_START_SPEED;
  }

  update(dt: number): void {
    this.prevX = this.x;
    if (!this.active) return;
    this.speed = Math.min(WAVE_MAX_SPEED, this.speed + WAVE_ACCEL * dt);
    this.x += this.speed * dt;
  }
}

// --- The cutscene ----------------------------------------------------------------------

export interface CutsceneLine {
  speaker: string;
  text: string;
}

/** The first cinematic: the Deprecator shows itself, says its piece, and starts the Chase. */
export const DEPRECATOR_LINES: readonly CutsceneLine[] = [
  { speaker: '???', text: 'SO. SOMEONE IS PUTTING THE FEATURES BACK.' },
  {
    speaker: 'THE DEPRECATOR',
    text: 'I CUT THEM FOR A REASON. EVERY FEATURE IS ONE MORE THING THAT CAN BREAK.',
  },
  { speaker: 'THE DEPRECATOR', text: 'THIS GAME WAS SHELVED. IT SHOULD STAY SHELVED.' },
  { speaker: 'THE DEPRECATOR', text: '...DEPRECATE.' },
];

export const LETTERBOX_TIME = 0.6;
export const PAN_TIME = 2.0;
export const MATERIALISE_TIME = 1.0;
/** A line moves on by itself after this long, or when you press jump/attack. */
export const LINE_TIME = 4.5;
export const DELETE_TIME = 1.2;

export type CutscenePhase = 'letterbox' | 'pan' | 'materialise' | 'talk' | 'delete' | 'done';

export class Cutscene {
  phase: CutscenePhase = 'letterbox';
  t = 0;
  line = 0;
  /** Characters of the current line shown. */
  chars = 0;

  update(dt: number, advance: boolean): void {
    this.t += dt;
    switch (this.phase) {
      case 'letterbox':
        if (this.t >= LETTERBOX_TIME) this.go('pan');
        break;
      case 'pan':
        if (this.t >= PAN_TIME) this.go('materialise');
        break;
      case 'materialise':
        if (this.t >= MATERIALISE_TIME) this.go('talk');
        break;
      case 'talk': {
        const text = DEPRECATOR_LINES[this.line].text;
        this.chars = Math.min(text.length, this.chars + 40 * dt);
        const done = this.chars >= text.length;
        if ((advance && done) || this.t >= LINE_TIME) {
          this.line++;
          this.chars = 0;
          this.t = 0;
          if (this.line >= DEPRECATOR_LINES.length) this.go('delete');
        } else if (advance) {
          this.chars = text.length;
        }
        break;
      }
      case 'delete':
        if (this.t >= DELETE_TIME) this.go('done');
        break;
    }
  }

  private go(phase: CutscenePhase): void {
    this.phase = phase;
    this.t = 0;
  }
}

import { TILE, VIEW_W } from '../config';
import { moveX, moveY, type Box } from '../world/physics';
import { Tile, type SolidQuery } from '../world/tilemap';

/** What a walker needs to know about the level. */
export interface WalkerMap extends SolidQuery {
  tileAt(tx: number, ty: number): number;
}
import { GRAVITY, MAX_FALL } from './player';

export const WALKER_W = 14;
export const WALKER_H = 14; // too tall to jump over in a 2-tile corridor
export const WALKER_SPEED = 35;
/** How long a punched walker blinks before it's gone. */
export const WALKER_DEATH_TIME = 0.5;

/** The basic enemy: walks back and forth, turning at walls and ledges. */
export class Walker {
  readonly box: Box;
  dir: 1 | -1 = -1;
  vy = 0;
  alive = true;
  deadT = 0;
  prevX: number;
  prevY: number;

  constructor(feetX: number, feetY: number) {
    this.box = { x: feetX - WALKER_W / 2, y: feetY - WALKER_H, w: WALKER_W, h: WALKER_H };
    this.prevX = this.box.x;
    this.prevY = this.box.y;
  }

  get gone(): boolean {
    return !this.alive && this.deadT >= WALKER_DEATH_TIME;
  }

  kill(): void {
    this.alive = false;
    this.deadT = 0;
  }

  update(dt: number, map: WalkerMap): void {
    this.prevX = this.box.x;
    this.prevY = this.box.y;
    if (!this.alive) {
      this.deadT += dt;
      return;
    }
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
    const hitWall = moveX(this.box, this.dir * WALKER_SPEED * dt, map);
    const hitY = moveY(this.box, this.vy * dt, map);
    const onGround = hitY && this.vy > 0;
    if (hitY) this.vy = 0;

    if (hitWall) {
      this.dir = this.dir > 0 ? -1 : 1;
    } else if (onGround) {
      // Turn around rather than walk off a ledge or onto spikes (walkers guard pits;
      // they don't stand in them, where jumping one would land you on the spikes).
      const aheadX = this.dir > 0 ? this.box.x + this.box.w + 1 : this.box.x - 1;
      const tx = Math.floor(aheadX / TILE);
      const below = Math.floor((this.box.y + this.box.h + 1) / TILE);
      const level = Math.floor((this.box.y + this.box.h - 1) / TILE);
      if (!map.isSolid(tx, below) || map.tileAt(tx, level) === Tile.Spikes) {
        this.dir = this.dir > 0 ? -1 : 1;
      }
    }
  }
}

// --- The Block: Era 1's boss ----------------------------------------------------------

export const BOSS_SIZE = 60;
export const BOSS_HP = 5;
const BOSS_IDLE_TIME = 0.7;
const BOSS_HOP_SPEED = 560; // high enough to run underneath
const BOSS_HOP_AIR_TIME = (2 * BOSS_HOP_SPEED) / GRAVITY;
const BOSS_MAX_HOP_VX = 160;
const BOSS_DAZE_TIME = 1.3;
export const BOSS_DEATH_TIME = 1.8;

export type BossState = 'waiting' | 'idle' | 'hop' | 'dazed' | 'dying' | 'dead';
export type BossHit = 'damaged' | 'killed' | 'blocked' | 'ignored';

/**
 * The Block: a huge rectangle. It hops at you and is only vulnerable while dazed after
 * landing. Dodge by running away or underneath it mid-hop; punch it while it's dazed.
 * Each daze takes one hit.
 */
export class BlockBoss {
  readonly box: Box;
  state: BossState = 'waiting';
  t = 0;
  hp = BOSS_HP;
  /** Brief white flash after taking damage. */
  hitFlash = 0;
  prevX: number;
  prevY: number;
  private vx = 0;
  private vy = 0;
  private lastPunchId = -1;
  private readonly home: { x: number; y: number };
  /** The boss stays on its own screen. */
  private readonly arena: { minX: number; maxX: number };

  constructor(feetX: number, feetY: number) {
    this.home = { x: feetX - BOSS_SIZE / 2, y: feetY - BOSS_SIZE };
    this.box = { ...this.home, w: BOSS_SIZE, h: BOSS_SIZE };
    this.prevX = this.box.x;
    this.prevY = this.box.y;
    const screenX = Math.floor(feetX / VIEW_W) * VIEW_W;
    this.arena = { minX: screenX, maxX: screenX + VIEW_W };
  }

  get centerX(): number {
    return this.box.x + this.box.w / 2;
  }

  get arenaX(): number {
    return this.arena.minX;
  }

  /** Touching it kills (when DEATH exists). Dazed blocks are safe to stand next to. */
  get harmful(): boolean {
    return this.state === 'idle' || this.state === 'hop';
  }

  get defeated(): boolean {
    return this.state === 'dying' || this.state === 'dead';
  }

  activate(): void {
    if (this.state !== 'waiting') return;
    this.state = 'idle';
    this.t = 0;
  }

  /** After the player dies: back to the start, same HP. */
  reset(): void {
    if (this.defeated) return;
    this.box.x = this.home.x;
    this.box.y = this.home.y;
    this.prevX = this.box.x;
    this.prevY = this.box.y;
    this.vx = 0;
    this.vy = 0;
    this.state = 'waiting';
    this.t = 0;
  }

  /** Returns true on the step it lands (for the thud). */
  update(dt: number, map: SolidQuery, targetX: number): boolean {
    this.prevX = this.box.x;
    this.prevY = this.box.y;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.t += dt;
    switch (this.state) {
      case 'idle':
        if (this.t >= BOSS_IDLE_TIME) {
          this.state = 'hop';
          this.t = 0;
          this.vy = -BOSS_HOP_SPEED;
          const vx = (targetX - this.centerX) / BOSS_HOP_AIR_TIME;
          this.vx = Math.max(-BOSS_MAX_HOP_VX, Math.min(BOSS_MAX_HOP_VX, vx));
        }
        return false;
      case 'hop': {
        this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL * 2);
        if (moveX(this.box, this.vx * dt, map)) this.vx = 0;
        this.box.x = Math.max(this.arena.minX, Math.min(this.arena.maxX - this.box.w, this.box.x));
        const hitY = moveY(this.box, this.vy * dt, map);
        if (hitY && this.vy > 0) {
          this.vy = 0;
          this.vx = 0;
          this.state = 'dazed';
          this.t = 0;
          return true;
        }
        if (hitY) this.vy = 0;
        return false;
      }
      case 'dazed':
        if (this.t >= BOSS_DAZE_TIME) {
          this.state = 'idle';
          this.t = 0;
        }
        return false;
      case 'dying':
        if (this.t >= BOSS_DEATH_TIME) this.state = 'dead';
        return false;
      default:
        return false;
    }
  }

  hit(attackId: number): BossHit {
    if (attackId === this.lastPunchId || this.defeated || this.state === 'waiting') {
      return 'ignored';
    }
    this.lastPunchId = attackId;
    if (this.state !== 'dazed') return 'blocked';
    this.hp--;
    this.hitFlash = 0.15;
    this.t = 0;
    if (this.hp <= 0) {
      this.state = 'dying';
      return 'killed';
    }
    this.state = 'idle'; // one hit per daze
    return 'damaged';
  }
}

// --- Flicker: Era 2's boss -----------------------------------------------------------

export const FLICKER_W = 34;
export const FLICKER_H = 22;
export const FLICKER_HP = 6;
const FLICKER_HOVER_TIME = 4.5;
const FLICKER_BOMB_EVERY = 1.0;
const FLICKER_DIVE_SPEED = 210;
const FLICKER_RETURN_SPEED = 140;
const FLICKER_HIT_FLICKER = 1.0;
export const FLICKER_DEATH_TIME = 2;

export type FlickerState = 'waiting' | 'hover' | 'dive' | 'return' | 'dying' | 'dead';

/**
 * Flicker: a flying sprite. It sweeps across the top of its arena dropping bombs, then
 * dives at you. A nod to 8-bit sprite flicker: while it flickers (diving, or just hit)
 * it can't be hurt. Hit it with pebbles thrown upwards while it hovers.
 */
export class FlickerBoss {
  readonly box: Box;
  state: FlickerState = 'waiting';
  t = 0;
  hp = FLICKER_HP;
  /** Seconds of invulnerable flickering left after a hit. */
  flickerT = 0;
  prevX: number;
  prevY: number;
  readonly arenaX: number;
  private readonly hoverY: number;
  private readonly floorY: number;
  private bombTimer = FLICKER_BOMB_EVERY;
  private hoverClock = 0;
  private target = { x: 0, y: 0 };

  constructor(feetX: number, feetY: number, floorY: number) {
    this.arenaX = Math.floor(feetX / VIEW_W) * VIEW_W;
    this.hoverY = feetY - FLICKER_H;
    this.floorY = floorY;
    this.box = { x: feetX - FLICKER_W / 2, y: this.hoverY, w: FLICKER_W, h: FLICKER_H };
    this.prevX = this.box.x;
    this.prevY = this.box.y;
  }

  get centerX(): number {
    return this.box.x + this.box.w / 2;
  }

  /** It flickers (and is invulnerable) while diving and just after being hit. */
  get flickering(): boolean {
    return this.flickerT > 0 || this.state === 'dive';
  }

  get harmful(): boolean {
    return this.state === 'hover' || this.state === 'dive' || this.state === 'return';
  }

  get defeated(): boolean {
    return this.state === 'dying' || this.state === 'dead';
  }

  activate(): void {
    if (this.state !== 'waiting') return;
    this.state = 'hover';
    this.t = 0;
  }

  reset(): void {
    if (this.defeated) return;
    this.state = 'waiting';
    this.t = 0;
    this.box.x = this.arenaX + VIEW_W / 2 - FLICKER_W / 2;
    this.box.y = this.hoverY;
    this.prevX = this.box.x;
    this.prevY = this.box.y;
    this.flickerT = 0;
  }

  /** Returns a bomb drop position on the step it drops one. */
  update(dt: number, targetX: number): { x: number; y: number } | null {
    this.prevX = this.box.x;
    this.prevY = this.box.y;
    this.t += dt;
    this.flickerT = Math.max(0, this.flickerT - dt);
    const b = this.box;
    switch (this.state) {
      case 'hover': {
        this.hoverClock += dt;
        const cx = this.arenaX + VIEW_W / 2 + Math.sin(this.hoverClock * 0.9) * (VIEW_W / 2 - 50);
        b.x = cx - b.w / 2;
        b.y = this.hoverY + Math.sin(this.hoverClock * 2.3) * 5;
        this.bombTimer -= dt;
        if (this.t >= FLICKER_HOVER_TIME) {
          this.state = 'dive';
          this.t = 0;
          this.target = { x: targetX - b.w / 2, y: this.floorY - b.h - 4 };
          return null;
        }
        if (this.bombTimer <= 0) {
          this.bombTimer = FLICKER_BOMB_EVERY;
          return { x: this.centerX, y: b.y + b.h };
        }
        return null;
      }
      case 'dive':
        if (this.moveTowards(this.target.x, this.target.y, FLICKER_DIVE_SPEED * dt)) {
          this.state = 'return';
          this.t = 0;
        }
        return null;
      case 'return': {
        const homeX =
          this.arenaX + VIEW_W / 2 + Math.sin(this.hoverClock * 0.9) * (VIEW_W / 2 - 50);
        if (this.moveTowards(homeX - b.w / 2, this.hoverY, FLICKER_RETURN_SPEED * dt)) {
          this.state = 'hover';
          this.t = 0;
        }
        return null;
      }
      case 'dying':
        b.y += 30 * dt;
        if (this.t >= FLICKER_DEATH_TIME) this.state = 'dead';
        return null;
      default:
        return null;
    }
  }

  hit(): BossHit {
    if (this.defeated || this.state === 'waiting') return 'ignored';
    if (this.flickering) return 'blocked';
    this.hp--;
    this.flickerT = FLICKER_HIT_FLICKER;
    if (this.hp <= 0) {
      this.state = 'dying';
      this.t = 0;
      return 'killed';
    }
    return 'damaged';
  }

  private moveTowards(x: number, y: number, step: number): boolean {
    const dx = x - this.box.x;
    const dy = y - this.box.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= step) {
      this.box.x = x;
      this.box.y = y;
      return true;
    }
    this.box.x += (dx / dist) * step;
    this.box.y += (dy / dist) * step;
    return false;
  }
}

// --- Knights (Era 3) ------------------------------------------------------------------

export const KNIGHT_W = 14;
export const KNIGHT_H = 26;
export const KNIGHT_HP = 3;
const KNIGHT_SPEED = 26;
const KNIGHT_CHARGE_SPEED = 75;
const KNIGHT_SIGHT = 90;
const KNIGHT_FLINCH = 0.3;
const KNIGHT_KNOCKBACK = 40;
const KNIGHT_STEP_EVERY = 0.42;
/** Knights keep to their post: they won't patrol (or chase) further than this from it. */
export const KNIGHT_PATROL = 80;

export type KnightHit = 'damaged' | 'killed' | 'blocked' | 'ignored';

/**
 * Armoured knights: too tough to punch (it clanks off), three sword hits to beat. They
 * plod back and forth and charge when they see you. Their footsteps carry: with SAMPLES
 * + STEREO you can hear them coming from off-screen.
 */
export class Knight {
  readonly box: Box;
  dir: 1 | -1 = -1;
  hp = KNIGHT_HP;
  alive = true;
  deadT = 0;
  flinchT = 0;
  charging = false;
  prevX: number;
  prevY: number;
  private vy = 0;
  private knockback = 0;
  private lastHit = -1;
  private stepT = 0;
  private readonly homeX: number;

  constructor(feetX: number, feetY: number) {
    this.box = { x: feetX - KNIGHT_W / 2, y: feetY - KNIGHT_H, w: KNIGHT_W, h: KNIGHT_H };
    this.homeX = this.box.x;
    this.prevX = this.box.x;
    this.prevY = this.box.y;
  }

  get gone(): boolean {
    return !this.alive && this.deadT >= WALKER_DEATH_TIME * 1.6;
  }

  /** Returns true on steps that make a footstep sound. */
  update(dt: number, map: WalkerMap, playerX: number, playerFeetY: number): boolean {
    this.prevX = this.box.x;
    this.prevY = this.box.y;
    if (!this.alive) {
      this.deadT += dt;
      return false;
    }
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
    let vx: number;
    if (this.flinchT > 0) {
      this.flinchT -= dt;
      vx = this.knockback;
      this.knockback *= 0.85;
    } else {
      // Charge when the player is ahead, close and on the same level.
      const dx = playerX - (this.box.x + this.box.w / 2);
      const sameLevel = Math.abs(playerFeetY - (this.box.y + this.box.h)) < 6;
      this.charging = sameLevel && Math.abs(dx) < KNIGHT_SIGHT && Math.sign(dx) === this.dir;
      vx = this.dir * (this.charging ? KNIGHT_CHARGE_SPEED : KNIGHT_SPEED);
    }
    const hitWall = moveX(this.box, vx * dt, map);
    const hitY = moveY(this.box, this.vy * dt, map);
    const onGround = hitY && this.vy > 0;
    if (hitY) this.vy = 0;
    if (this.flinchT <= 0) {
      const aheadX = this.dir > 0 ? this.box.x + this.box.w + 1 : this.box.x - 1;
      const tx = Math.floor(aheadX / TILE);
      const below = Math.floor((this.box.y + this.box.h + 1) / TILE);
      const level = Math.floor((this.box.y + this.box.h - 1) / TILE);
      const edge = onGround && (!map.isSolid(tx, below) || map.tileAt(tx, level) === Tile.Spikes);
      const offPost = (this.box.x - this.homeX) * this.dir > KNIGHT_PATROL;
      if (hitWall || edge || offPost) {
        this.dir = this.dir > 0 ? -1 : 1;
        this.charging = false;
      }
    }

    this.stepT += dt * (this.charging ? 2 : 1);
    if (onGround && this.stepT >= KNIGHT_STEP_EVERY) {
      this.stepT = 0;
      return true;
    }
    return false;
  }

  /** Sword hits damage; punches and pebbles clank off the armour. */
  hit(attackId: number, fromX: number, sword: boolean): KnightHit {
    if (!this.alive || attackId === this.lastHit) return 'ignored';
    this.lastHit = attackId;
    if (!sword) return 'blocked';
    this.hp--;
    this.flinchT = KNIGHT_FLINCH;
    this.knockback = Math.sign(this.box.x + this.box.w / 2 - fromX) * KNIGHT_KNOCKBACK;
    if (this.hp <= 0) {
      this.alive = false;
      this.deadT = 0;
      return 'killed';
    }
    return 'damaged';
  }
}

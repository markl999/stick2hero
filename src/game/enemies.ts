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

  hit(punchId: number): BossHit {
    if (punchId === this.lastPunchId || this.defeated || this.state === 'waiting') {
      return 'ignored';
    }
    this.lastPunchId = punchId;
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

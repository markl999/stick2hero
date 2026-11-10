import { VIEW_W } from '../config';
import type { Box } from '../world/physics';
import type { BossHit } from './enemies';

/*
 * The Warden: Era 3's multi-part boss. A giant stone figure in the background, too big
 * for the screen, with two fists in the playfield.
 *
 * Phase 1 (fists): one fist at a time tracks you from above, slams down, and is stuck in
 * the floor for a moment, when you can slash it. Each fist takes 3 hits.
 * Phase 2 (head): with both fists gone, the head comes down to the floor and is open to
 * attack, then rises and drops rocks while it recovers. It takes 4 hits.
 */

export const FIST_W = 40;
export const FIST_H = 30;
export const FIST_HP = 3;
export const HEAD_W = 64;
export const HEAD_H = 48;
export const HEAD_HP = 4;
export const WARDEN_MAX_HP = FIST_HP * 2 + HEAD_HP;

const FIST_TOP = 24;
const TRACK_TIME = 0.9;
const TRACK_SPEED = 160;
const SLAM_SPEED = 520;
const STUCK_TIME = 1.4;
const RISE_SPEED = 150;
const FIST_REST = 0.6;
const HEAD_TOP = 18;
const HEAD_MOVE = 1.0;
const HEAD_OPEN = 2.4;
const HEAD_UP = 2.2;
const HEAD_ROCK_EVERY = 0.7;
export const WARDEN_DEATH_TIME = 2.2;

export type FistState = 'rest' | 'track' | 'slam' | 'stuck' | 'rise' | 'broken';
export type HeadState = 'hidden' | 'lowering' | 'open' | 'raising' | 'up';

export class Fist {
  readonly box: Box;
  state: FistState = 'rest';
  t = 0;
  hp = FIST_HP;
  hitFlash = 0;
  prevX: number;
  prevY: number;
  private lastHit = -1;

  constructor(readonly homeX: number) {
    this.box = { x: homeX - FIST_W / 2, y: FIST_TOP, w: FIST_W, h: FIST_H };
    this.prevX = this.box.x;
    this.prevY = this.box.y;
  }

  get harmful(): boolean {
    return this.state === 'slam';
  }

  get vulnerable(): boolean {
    return this.state === 'stuck';
  }

  hit(attackId: number): BossHit {
    if (this.state === 'broken' || attackId === this.lastHit) return 'ignored';
    this.lastHit = attackId;
    if (!this.vulnerable) return 'blocked';
    this.hp--;
    this.hitFlash = 0.15;
    if (this.hp <= 0) {
      this.state = 'broken';
      this.t = 0;
      return 'killed';
    }
    return 'damaged';
  }
}

export interface WardenEvents {
  slam: boolean;
  rock: { x: number; y: number } | null;
}

export class Warden {
  state: 'waiting' | 'fists' | 'head' | 'dying' | 'dead' = 'waiting';
  t = 0;
  readonly arenaX: number;
  readonly fists: [Fist, Fist];
  readonly head: Box;
  headState: HeadState = 'hidden';
  headT = 0;
  headHp = HEAD_HP;
  headFlash = 0;
  headPrevY: number;
  private next = 0;
  private lastHeadHit = -1;
  private rockT = 0;
  private headFrom = 0;
  private readonly floorY: number;

  constructor(feetX: number, feetY: number) {
    this.arenaX = Math.floor(feetX / VIEW_W) * VIEW_W;
    this.floorY = feetY;
    this.fists = [new Fist(this.arenaX + 80), new Fist(this.arenaX + VIEW_W - 80)];
    this.head = { x: this.arenaX + VIEW_W / 2 - HEAD_W / 2, y: -HEAD_H - 10, w: HEAD_W, h: HEAD_H };
    this.headPrevY = this.head.y;
  }

  get hp(): number {
    return this.fists.reduce((sum, f) => sum + Math.max(0, f.hp), 0) + this.headHp;
  }

  get defeated(): boolean {
    return this.state === 'dying' || this.state === 'dead';
  }

  get headVulnerable(): boolean {
    return this.headState === 'open';
  }

  activate(): void {
    if (this.state !== 'waiting') return;
    this.state = 'fists';
    this.t = 0;
  }

  reset(): void {
    if (this.defeated) return;
    this.state = 'waiting';
    for (const fist of this.fists) {
      if (fist.state === 'broken') continue;
      fist.state = 'rest';
      fist.t = 0;
      fist.box.x = fist.homeX - FIST_W / 2;
      fist.box.y = FIST_TOP;
    }
    if (this.headState !== 'hidden') {
      this.head.y = HEAD_TOP;
      this.setHead('up');
    }
  }

  update(dt: number, playerX: number): WardenEvents {
    const events: WardenEvents = { slam: false, rock: null };
    this.t += dt;
    this.headPrevY = this.head.y;
    this.headFlash = Math.max(0, this.headFlash - dt);
    for (const fist of this.fists) {
      fist.prevX = fist.box.x;
      fist.prevY = fist.box.y;
      fist.hitFlash = Math.max(0, fist.hitFlash - dt);
    }
    if (this.state === 'fists') this.updateFists(dt, playerX, events);
    else if (this.state === 'head') this.updateHead(dt, playerX, events);
    else if (this.state === 'dying' && this.t >= WARDEN_DEATH_TIME) this.state = 'dead';
    return events;
  }

  private updateFists(dt: number, playerX: number, events: WardenEvents): void {
    for (const fist of this.fists) {
      fist.t += dt;
      const b = fist.box;
      switch (fist.state) {
        case 'track': {
          const dx = playerX - (b.x + b.w / 2);
          b.x += Math.sign(dx) * Math.min(Math.abs(dx), TRACK_SPEED * dt);
          b.x = Math.max(this.arenaX, Math.min(this.arenaX + VIEW_W - b.w, b.x));
          if (fist.t >= TRACK_TIME) this.set(fist, 'slam');
          break;
        }
        case 'slam':
          b.y += SLAM_SPEED * dt;
          if (b.y + b.h >= this.floorY) {
            b.y = this.floorY - b.h;
            this.set(fist, 'stuck');
            events.slam = true;
          }
          break;
        case 'stuck':
          if (fist.t >= STUCK_TIME) this.set(fist, 'rise');
          break;
        case 'rise':
          b.y -= RISE_SPEED * dt;
          if (b.y <= FIST_TOP) {
            b.y = FIST_TOP;
            this.set(fist, 'rest');
          }
          break;
        case 'broken':
          b.y += 120 * dt; // crumbles into the floor
          break;
      }
    }
    // One fist at a time: when both are resting, send the next one.
    const active = this.fists.some(
      (f) => f.state === 'track' || f.state === 'slam' || f.state === 'stuck' || f.state === 'rise',
    );
    if (!active) {
      const alive = this.fists.filter((f) => f.state !== 'broken');
      if (alive.length === 0) {
        this.state = 'head';
        this.setHead('lowering');
        return;
      }
      const resting = alive.filter((f) => f.state === 'rest' && f.t >= FIST_REST);
      if (resting.length > 0) {
        const fist = resting[this.next % resting.length];
        this.next++;
        this.set(fist, 'track');
      }
    }
  }

  private set(fist: Fist, state: FistState): void {
    fist.state = state;
    fist.t = 0;
  }

  private updateHead(dt: number, playerX: number, events: WardenEvents): void {
    this.headT += dt;
    const openY = this.floorY - HEAD_H;
    switch (this.headState) {
      case 'lowering':
        this.head.y = lerp(this.headFrom, openY, Math.min(1, this.headT / HEAD_MOVE));
        if (this.headT >= HEAD_MOVE) this.setHead('open');
        break;
      case 'open':
        if (this.headT >= HEAD_OPEN) this.setHead('raising');
        break;
      case 'raising':
        this.head.y = lerp(this.headFrom, HEAD_TOP, Math.min(1, this.headT / HEAD_MOVE));
        if (this.headT >= HEAD_MOVE) this.setHead('up');
        break;
      case 'up':
        // Drops rocks near you while it recovers.
        this.rockT += dt;
        if (this.rockT >= HEAD_ROCK_EVERY) {
          this.rockT = 0;
          const x = Math.max(this.arenaX + 10, Math.min(this.arenaX + VIEW_W - 10, playerX));
          events.rock = { x, y: this.head.y + HEAD_H };
        }
        if (this.headT >= HEAD_UP) this.setHead('lowering');
        break;
    }
  }

  private setHead(state: HeadState): void {
    this.headState = state;
    this.headT = 0;
    this.headFrom = this.head.y;
  }

  /** The head crushes you on the way down; once it's down it's safe to stand next to. */
  get headHarmful(): boolean {
    return this.headState === 'lowering';
  }

  hitHead(attackId: number): BossHit {
    if (this.state !== 'head' || attackId === this.lastHeadHit) return 'ignored';
    this.lastHeadHit = attackId;
    if (!this.headVulnerable) return 'blocked';
    this.headHp--;
    this.headFlash = 0.15;
    if (this.headHp <= 0) {
      this.state = 'dying';
      this.t = 0;
      return 'killed';
    }
    return 'damaged';
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

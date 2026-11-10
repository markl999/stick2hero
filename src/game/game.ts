import { TILE, VIEW_H, VIEW_W } from '../config';
import type { FeatureId, FeatureRegistry } from '../core/features';
import type { ActionState } from '../core/input';
import { overlaps } from '../world/physics';
import type { ParsedLevel, TileMap } from '../world/tilemap';
import { Camera } from './camera';
import { BlockBoss, Walker } from './enemies';
import { Pickup } from './pickup';
import { Player, type Bounds } from './player';

/** How long an unlock "moment" lasts, and how much of it freezes gameplay (hitstop). */
export const MOMENT_DURATION = 2.2;
export const MOMENT_HITSTOP = 0.35;
export const MOMENT_FLASH = 0.12;

export const SCORE_PICKUP = 1000;
export const SCORE_PER_COLUMN = 10;
export const SCORE_WALKER = 100;
export const SCORE_BOSS_HIT = 500;
export const SCORE_BOSS = 5000;

export const START_LIVES = 3;
export const DEATH_TIME = 1.1;
export const RESPAWN_INVULNERABLE = 1.5;
export const BOSS_INTRO_TIME = 1.8;

/** Era 0 has no boss: it ends when this feature's moment has played out. */
export const ERA0_EXIT_FEATURE: FeatureId = 'FRAME_RATE';

export interface Moment {
  feature: FeatureId;
  t: number;
}

export interface Point {
  x: number;
  y: number;
}

export type SoundName =
  | 'beep'
  | 'jump'
  | 'land'
  | 'punch'
  | 'enemyDie'
  | 'die'
  | 'pickup'
  | 'bossHit'
  | 'clank'
  | 'bossLand'
  | 'bossDie';

/** Things the game needs the outside world (scenes) to do. */
export type GameRequest = 'eraComplete' | 'gameOver' | 'title';

/** Side effects the game asks for. Kept as an interface so tests can run headless. */
export interface GameHooks {
  sound?(name: SoundName): void;
  /** Called after anything that should be persisted (a pickup, a checkpoint). */
  save?(): void;
}

export interface GameOptions {
  features: FeatureRegistry;
  level: ParsedLevel;
  hooks?: GameHooks;
  score?: number;
  /** Feet position to resume from (a saved checkpoint). Falls back to the level spawn. */
  checkpoint?: Point | null;
}

/**
 * All game state and rules for one level. No rendering or DOM here: renderers read this
 * state, and `update` advances it by one fixed step.
 */
export class Game {
  readonly features: FeatureRegistry;
  readonly level: ParsedLevel;
  readonly map: TileMap;
  readonly player: Player;
  readonly pickups: Pickup[];
  readonly walkers: Walker[];
  readonly boss: BlockBoss | null;
  readonly camera: Camera;
  score: number;
  /** The HUD's rolling counter, catching up to `score`. */
  displayScore: number;
  /** Feet position to respawn at; moves to each collected pickup. */
  checkpoint: Point;
  lives = START_LIVES;
  time = 0;
  moment: Moment | null = null;
  /** Seconds into the death animation, or null when alive. */
  deathT: number | null = null;
  /** Blinking, untouchable time after respawning. */
  invulnerableT = 0;
  /** Seconds since the boss woke up (for its intro banner), or null. */
  bossIntroT: number | null = null;
  /** Set when a scene change is needed; the game scene consumes and clears it. */
  request: GameRequest | null = null;

  private readonly hooks: GameHooks;
  private furthestColumn: number;
  private readonly homeScreenX: number;
  private livesActive = false;
  private bossFinished = false;

  constructor(options: GameOptions) {
    this.features = options.features;
    this.level = options.level;
    this.hooks = options.hooks ?? {};
    this.map = this.level.map;
    this.checkpoint = this.validCheckpoint(options.checkpoint) ?? { ...this.level.spawn };
    this.player = new Player(this.checkpoint.x, this.checkpoint.y);
    this.pickups = this.level.pickups.map((p) => new Pickup(p.feature, p.x, p.y));
    this.walkers = this.level.entities
      .filter((e) => e.kind === 'walker')
      .map((e) => new Walker(e.x, e.y));
    const boss = this.level.entities.find((e) => e.kind === 'boss');
    this.boss = boss ? new BlockBoss(boss.x, boss.y) : null;
    this.homeScreenX = Math.floor(this.level.spawn.x / VIEW_W) * VIEW_W;
    this.camera = new Camera(this.map.pixelWidth, this.map.pixelHeight, {
      x: this.homeScreenX,
      y: Math.floor((this.level.spawn.y - 1) / VIEW_H) * VIEW_H,
    });
    this.score = options.score ?? 0;
    this.displayScore = this.score;
    this.furthestColumn = Math.floor(this.checkpoint.x / TILE);
    this.syncWithFeatures();
    this.camera.update(this.player.feetX, this.playerCenterY);
  }

  /** True during the brief invert-flash at the start of an unlock moment. */
  get flashing(): boolean {
    return this.moment !== null && this.moment.t < MOMENT_FLASH;
  }

  get playerCenterY(): number {
    return this.player.box.y + this.player.box.h / 2;
  }

  get enemiesActive(): boolean {
    return this.features.has('ENEMIES');
  }

  update(dt: number, input: ActionState): void {
    this.time += dt;
    this.syncWithFeatures();
    this.invulnerableT = Math.max(0, this.invulnerableT - dt);
    if (this.bossIntroT !== null) this.bossIntroT += dt;

    if (this.moment) {
      this.moment.t += dt;
      if (this.moment.t >= MOMENT_DURATION) {
        const feature = this.moment.feature;
        this.moment = null;
        if (feature === ERA0_EXIT_FEATURE && this.level.era === 0) this.request = 'eraComplete';
        if (feature === 'TITLE_SCREEN') this.request = 'title';
      }
    }
    const frozen = this.moment !== null && this.moment.t < MOMENT_HITSTOP;

    if (frozen) {
      // Keep interpolation still during hitstop.
      this.player.prevX = this.player.box.x;
      this.player.prevY = this.player.box.y;
    } else if (this.deathT !== null) {
      this.player.prevX = this.player.box.x;
      this.player.prevY = this.player.box.y;
      this.deathT += dt;
      if (this.deathT >= DEATH_TIME) this.respawn();
    } else {
      this.updatePlayer(dt, input);
      this.collectPickups();
      this.scoreProgress();
    }

    if (!frozen) this.updateEnemies(dt);

    this.camera.update(this.player.feetX, this.playerCenterY);
    const gap = Math.abs(this.score - this.displayScore);
    this.displayScore = approach(this.displayScore, this.score, Math.max(1, gap * 0.08));
  }

  private updatePlayer(dt: number, input: ActionState): void {
    const f = this.features;
    const events = this.player.update(
      dt,
      {
        left: input.isDown('left'),
        right: input.isDown('right'),
        down: input.isDown('down'),
        jumpPressed: input.wasPressed('jump'),
        jumpHeld: input.isDown('jump'),
        attackPressed: input.wasPressed('attack'),
      },
      {
        moveLeft: f.has('LEFT'),
        jump: f.has('JUMP'),
        grab: f.has('ARMS'),
        punch: f.has('PUNCH'),
      },
      this.map,
      this.bounds(),
    );
    if (events.jumped) this.play('jump');
    if (events.landed) this.play('land');
    if (events.punched) this.play('punch');

    const fellOut = this.player.box.y > this.map.pixelHeight + 100;
    if (f.has('DEATH') && (fellOut || this.map.touchesSpikes(this.player.box))) {
      this.die();
    } else if (fellOut) {
      // No DEATH yet: falling out of the world just puts you back.
      this.player.teleport(this.checkpoint.x, this.checkpoint.y);
    }
  }

  private updateEnemies(dt: number): void {
    if (!this.enemiesActive) return;
    const player = this.player;
    const alive = this.deathT === null;
    const punch = alive ? player.punchBox() : null;
    const canHurt = alive && this.features.has('DEATH') && this.invulnerableT <= 0;

    for (const walker of this.walkers) {
      if (walker.gone) continue;
      walker.update(dt, this.map);
      if (!walker.alive) continue;
      if (punch && overlaps(punch, walker.box)) {
        walker.kill();
        this.score += SCORE_WALKER;
        this.play('enemyDie');
      } else if (canHurt && overlaps(player.box, walker.box)) {
        this.die();
      }
    }

    const boss = this.boss;
    if (!boss) return;
    if (boss.state === 'waiting' && this.camera.x === boss.arenaX && alive) {
      boss.activate();
      this.bossIntroT = 0;
    }
    if (boss.update(dt, this.map, player.feetX)) this.play('bossLand');
    if (punch && overlaps(punch, boss.box)) {
      const result = boss.hit(player.punchId);
      if (result === 'damaged') {
        this.score += SCORE_BOSS_HIT;
        this.play('bossHit');
      } else if (result === 'killed') {
        this.score += SCORE_BOSS;
        this.play('bossDie');
      } else if (result === 'blocked') {
        this.play('clank');
      }
    }
    if (canHurt && this.deathT === null && boss.harmful && overlaps(player.box, boss.box)) {
      this.die();
    }
    if (boss.state === 'dead' && !this.bossFinished) {
      this.bossFinished = true;
      this.request = 'eraComplete';
    }
  }

  private die(): void {
    if (this.deathT !== null) return;
    this.deathT = 0;
    this.player.vx = 0;
    this.player.vy = 0;
    this.play('die');
  }

  private respawn(): void {
    this.deathT = null;
    if (this.livesActive) {
      this.lives--;
      if (this.lives <= 0) {
        this.request = 'gameOver';
        return;
      }
    }
    this.player.teleport(this.checkpoint.x, this.checkpoint.y);
    this.invulnerableT = RESPAWN_INVULNERABLE;
    if (this.boss && !this.boss.defeated) {
      this.boss.reset();
      this.bossIntroT = null;
    }
  }

  private collectPickups(): void {
    for (const pickup of this.pickups) {
      if (!pickup.touches(this.player.box)) continue;
      pickup.collected = true;
      if (!this.features.unlock(pickup.feature)) continue;
      this.score += SCORE_PICKUP;
      // SCORE counts up retroactively from zero: "we were keeping score".
      if (pickup.feature === 'SCORE') this.displayScore = 0;
      this.moment = { feature: pickup.feature, t: 0 };
      this.play('pickup');
      // Pickups sit on the ground, so the bottom of their tile is a safe place to resume.
      this.checkpoint = { x: pickup.x, y: pickup.y + TILE / 2 };
      this.hooks.save?.();
    }
  }

  private scoreProgress(): void {
    const column = Math.floor(this.player.feetX / TILE);
    if (column > this.furthestColumn) {
      this.score += (column - this.furthestColumn) * SCORE_PER_COLUMN;
      this.furthestColumn = column;
    }
  }

  /**
   * Sound policy: before SFX the only sound in the game is BEEP's jump beep. After SFX,
   * everything has its own sound.
   */
  private play(name: SoundName): void {
    if (this.features.has('SFX')) this.hooks.sound?.(name);
    else if (name === 'jump' && this.features.has('BEEP')) this.hooks.sound?.('beep');
  }

  /** Before SCREEN 2 the world ends at the edges of the starting screen. */
  private bounds(): Bounds {
    if (this.features.has('SCREEN_2')) return { minX: 0, maxX: this.map.pixelWidth };
    return { minX: this.homeScreenX, maxX: this.homeScreenX + VIEW_W };
  }

  /** Keep derived state in line with the registry (the debug overlay can toggle anything). */
  private syncWithFeatures(): void {
    for (const pickup of this.pickups) pickup.collected = this.features.has(pickup.feature);
    this.camera.mode = this.features.has('SCREEN_2') ? 'flip' : 'fixed';
    const hasLives = this.features.has('LIVES');
    if (hasLives && !this.livesActive) this.lives = START_LIVES;
    this.livesActive = hasLives;
  }

  private validCheckpoint(point: Point | null | undefined): Point | null {
    if (!point) return null;
    const { x, y } = point;
    const inside = x > 0 && y > 0 && x < this.map.pixelWidth && y <= this.map.pixelHeight;
    return Number.isFinite(x) && Number.isFinite(y) && inside ? { x, y } : null;
  }
}

function approach(value: number, target: number, step: number): number {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}

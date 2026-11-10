import { TILE, VIEW_H, VIEW_W } from '../config';
import type { FeatureId, FeatureRegistry } from '../core/features';
import type { ActionState } from '../core/input';
import type { ParsedLevel, TileMap } from '../world/tilemap';
import { Camera } from './camera';
import { Pickup } from './pickup';
import { Player, type Bounds } from './player';

/** How long an unlock "moment" lasts, and how much of it freezes gameplay (hitstop). */
export const MOMENT_DURATION = 2.2;
export const MOMENT_HITSTOP = 0.35;
export const MOMENT_FLASH = 0.12;

export const SCORE_PICKUP = 1000;
export const SCORE_PER_COLUMN = 10;

/** The feature that ends the era once its moment has played out. */
export const ERA_EXIT_FEATURE: FeatureId = 'FRAME_RATE';

export interface Moment {
  feature: FeatureId;
  t: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Side effects the game asks for. Kept as an interface so tests can run headless. */
export interface GameHooks {
  beep?(): void;
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
 * All game state and rules. No rendering or DOM here: renderers read this state,
 * and `update` advances it by one fixed step.
 */
export class Game {
  readonly features: FeatureRegistry;
  readonly level: ParsedLevel;
  readonly map: TileMap;
  readonly player: Player;
  readonly pickups: Pickup[];
  readonly camera: Camera;
  score: number;
  /** The HUD's rolling counter, catching up to `score`. */
  displayScore: number;
  /** Feet position to respawn at; moves to each collected pickup. */
  checkpoint: Point;
  time = 0;
  moment: Moment | null = null;
  /** Set once the era's exit feature has been collected and its moment has finished. */
  eraComplete = false;

  private readonly hooks: GameHooks;
  private furthestColumn: number;
  private readonly homeScreenX: number;

  constructor(options: GameOptions) {
    this.features = options.features;
    this.level = options.level;
    this.hooks = options.hooks ?? {};
    this.map = this.level.map;
    this.checkpoint = this.validCheckpoint(options.checkpoint) ?? { ...this.level.spawn };
    this.player = new Player(this.checkpoint.x, this.checkpoint.y);
    this.pickups = this.level.pickups.map((p) => new Pickup(p.feature, p.x, p.y));
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

  update(dt: number, input: ActionState): void {
    this.time += dt;
    this.syncWithFeatures();

    if (this.moment) {
      this.moment.t += dt;
      if (this.moment.t >= MOMENT_DURATION) {
        if (this.moment.feature === ERA_EXIT_FEATURE) this.eraComplete = true;
        this.moment = null;
      }
    }
    const frozen = this.moment !== null && this.moment.t < MOMENT_HITSTOP;

    if (frozen) {
      // Keep interpolation still during hitstop.
      this.player.prevX = this.player.box.x;
      this.player.prevY = this.player.box.y;
    } else {
      this.updatePlayer(dt, input);
      this.collectPickups();
      this.scoreProgress();
    }

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
      },
      { moveLeft: f.has('LEFT'), jump: f.has('JUMP'), grab: f.has('ARMS') },
      this.map,
      this.bounds(),
    );
    if (events.jumped && f.has('BEEP')) this.hooks.beep?.();

    // Fell out of the world (there's no DEATH yet): back to the checkpoint.
    if (this.player.box.y > this.map.pixelHeight + 100) {
      this.player.teleport(this.checkpoint.x, this.checkpoint.y);
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

  /** Before SCREEN 2 the world ends at the edges of the starting screen. */
  private bounds(): Bounds {
    if (this.features.has('SCREEN_2')) return { minX: 0, maxX: this.map.pixelWidth };
    return { minX: this.homeScreenX, maxX: this.homeScreenX + VIEW_W };
  }

  /** Keep derived state in line with the registry (the debug overlay can toggle anything). */
  private syncWithFeatures(): void {
    for (const pickup of this.pickups) pickup.collected = this.features.has(pickup.feature);
    this.camera.mode = this.features.has('SCREEN_2') ? 'flip' : 'fixed';
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

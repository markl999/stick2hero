import { TILE, VIEW_H, VIEW_W } from '../config';
import type { FeatureId, FeatureRegistry } from '../core/features';
import type { ActionState } from '../core/input';
import type { ParsedLevel, TileMap } from '../world/tilemap';
import { Camera } from './camera';
import { Pickup } from './pickup';
import { Player, type Bounds } from './player';

/** How long an unlock "moment" lasts, and how much of it freezes gameplay (hitstop). */
export const MOMENT_DURATION = 1.8;
export const MOMENT_HITSTOP = 0.3;
export const MOMENT_FLASH = 0.12;

export const SCORE_PICKUP = 1000;
export const SCORE_PER_COLUMN = 10;

export interface Moment {
  feature: FeatureId;
  t: number;
}

/** Side effects the game asks for. Kept as an interface so tests can run headless. */
export interface GameHooks {
  beep?(): void;
  /** Called after anything that should be persisted (a pickup, score). */
  save?(): void;
}

/**
 * All game state and rules. No rendering or DOM here: renderers read this state,
 * and `update` advances it by one fixed step.
 */
export class Game {
  readonly map: TileMap;
  readonly player: Player;
  readonly pickups: Pickup[];
  readonly camera: Camera;
  score: number;
  /** The HUD's rolling counter, catching up to `score`. */
  displayScore: number;
  time = 0;
  moment: Moment | null = null;

  private furthestColumn: number;
  private readonly homeScreenX: number;

  constructor(
    readonly features: FeatureRegistry,
    readonly level: ParsedLevel,
    private readonly hooks: GameHooks = {},
    initialScore = 0,
  ) {
    this.map = level.map;
    this.player = new Player(level.spawn.x, level.spawn.y);
    this.pickups = level.pickups.map((p) => new Pickup(p.feature, p.x, p.y));
    this.homeScreenX = Math.floor(level.spawn.x / VIEW_W) * VIEW_W;
    this.camera = new Camera(this.map.pixelWidth, this.map.pixelHeight, {
      x: this.homeScreenX,
      y: Math.floor((level.spawn.y - 1) / VIEW_H) * VIEW_H,
    });
    this.score = initialScore;
    this.displayScore = initialScore;
    this.furthestColumn = Math.floor(level.spawn.x / TILE);
    this.syncWithFeatures();
    this.camera.update(this.player.feetX, this.player.box.y + this.player.box.h / 2);
  }

  /** True during the brief invert-flash at the start of an unlock moment. */
  get flashing(): boolean {
    return this.moment !== null && this.moment.t < MOMENT_FLASH;
  }

  update(dt: number, input: ActionState): void {
    this.time += dt;
    this.syncWithFeatures();

    if (this.moment) {
      this.moment.t += dt;
      if (this.moment.t >= MOMENT_DURATION) this.moment = null;
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

    const p = this.player;
    this.camera.update(p.feetX, p.box.y + p.box.h / 2);
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
        jumpPressed: input.wasPressed('jump'),
        jumpHeld: input.isDown('jump'),
      },
      { moveLeft: f.has('LEFT'), jump: f.has('JUMP') },
      this.map,
      this.bounds(),
    );
    if (events.jumped && f.has('BEEP')) this.hooks.beep?.();

    // Fell out of the world: back to the spawn point.
    if (this.player.box.y > this.map.pixelHeight + 100) {
      this.player.teleport(this.level.spawn.x, this.level.spawn.y);
    }
  }

  private collectPickups(): void {
    for (const pickup of this.pickups) {
      if (!pickup.touches(this.player.box)) continue;
      pickup.collected = true;
      if (this.features.unlock(pickup.feature)) {
        this.score += SCORE_PICKUP;
        this.moment = { feature: pickup.feature, t: 0 };
        this.hooks.save?.();
      }
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
}

function approach(value: number, target: number, step: number): number {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}

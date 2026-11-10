import { TILE, VIEW_H, VIEW_W } from '../config';
import type { FeatureId, FeatureRegistry } from '../core/features';
import type { ActionState } from '../core/input';
import { overlaps } from '../world/physics';
import { Tile, type ParsedLevel, type TileMap } from '../world/tilemap';
import { Camera } from './camera';
import { BlockBoss, FlickerBoss, Walker } from './enemies';
import { Bomb, Flag, Pebble, PEBBLE_FORWARD, PEBBLE_UP, Switch } from './props';
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
export const THROW_COOLDOWN = 0.35;
export const MAX_PEBBLES = 3;

/** Era 0 has no boss: it ends when this feature's moment has played out. */
export const ERA0_EXIT_FEATURE: FeatureId = 'FRAME_RATE';

export interface Moment {
  feature: FeatureId;
  t: number;
  /** Where it came from in the world (the pickup), for effects like the COLOUR wave. */
  origin?: Point;
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
  | 'bossDie'
  | 'throw'
  | 'switch'
  | 'flag';

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
  /** Era 1's boss. */
  readonly boss: BlockBoss | null;
  /** Era 2's boss. */
  readonly flicker: FlickerBoss | null;
  readonly pebbles: Pebble[] = [];
  readonly bombs: Bomb[] = [];
  readonly flags: Flag[];
  readonly switches: Switch[];
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
  private throwCooldown = 0;

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
    const block = this.level.entities.find((e) => e.kind === 'block');
    this.boss = block ? new BlockBoss(block.x, block.y) : null;
    const flicker = this.level.entities.find((e) => e.kind === 'flicker');
    this.flicker = flicker
      ? new FlickerBoss(flicker.x, flicker.y, this.floorBelow(flicker.x, flicker.y))
      : null;
    this.flags = this.level.entities
      .filter((e) => e.kind === 'flag')
      .map((e) => new Flag(e.x, e.y));
    this.switches = this.level.entities
      .filter((e) => e.kind === 'switch')
      .map((e) => new Switch(e.x, e.y));
    this.homeScreenX = Math.floor(this.level.spawn.x / VIEW_W) * VIEW_W;
    this.camera = new Camera(this.map.pixelWidth, this.map.pixelHeight, {
      x: this.homeScreenX,
      y: Math.floor((this.level.spawn.y - 1) / VIEW_H) * VIEW_H,
    });
    this.score = options.score ?? 0;
    this.displayScore = this.score;
    this.furthestColumn = Math.floor(this.checkpoint.x / TILE);
    this.syncWithFeatures();
    this.camera.snap(this.player.feetX, this.playerCenterY);
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
        // Beating Flicker awards COLOUR (16); the era ends once that's sunk in.
        if (feature === 'COLOUR_16' && this.flicker?.state === 'dead') this.request = 'eraComplete';
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

    if (!frozen) {
      this.updateProps(dt);
      this.updateEnemies(dt);
      this.updateFlicker(dt);
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
        attackPressed: input.wasPressed('attack'),
      },
      {
        moveLeft: f.has('LEFT'),
        jump: f.has('JUMP'),
        grab: f.has('ARMS'),
        punch: f.has('PUNCH'),
        wallJump: f.has('HANDS_FEET'),
      },
      this.map,
      this.bounds(),
    );
    if (events.jumped) this.play('jump');
    if (events.landed) this.play('land');
    if (events.punched) this.play('punch');

    // THROW: forward in an arc, or straight up while holding up.
    this.throwCooldown = Math.max(0, this.throwCooldown - dt);
    if (
      input.wasPressed('special') &&
      f.has('THROW') &&
      this.throwCooldown <= 0 &&
      this.pebbles.length < MAX_PEBBLES &&
      this.player.state === 'normal'
    ) {
      const p = this.player;
      const up = input.isDown('up');
      const v = up ? PEBBLE_UP : { ...PEBBLE_FORWARD, vx: PEBBLE_FORWARD.vx * p.facing };
      const x = p.feetX + (up ? 0 : p.facing * 6);
      this.pebbles.push(new Pebble(x, p.feetY - v.fromFeet, v.vx, v.vy));
      this.throwCooldown = THROW_COOLDOWN;
      this.play('throw');
    }

    const fellOut = this.player.box.y > this.map.pixelHeight + 100;
    const burnt = this.player.onGround && this.map.standsOnHot(this.player.box);
    if (f.has('DEATH') && (fellOut || burnt || this.map.touchesSpikes(this.player.box))) {
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
      const pebble = this.pebbles.find((pb) => pb.alive && overlaps(pb.box, walker.box));
      if (pebble) pebble.alive = false;
      if (pebble || (punch && overlaps(punch, walker.box))) {
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
    // Pebbles just bounce off The Block.
    for (const pb of this.pebbles) {
      if (pb.alive && overlaps(pb.box, boss.box) && !boss.defeated && boss.state !== 'waiting') {
        pb.alive = false;
        this.play('clank');
      }
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

  /** Pebbles, bombs, switches and flags. */
  private updateProps(dt: number): void {
    for (const pebble of this.pebbles) pebble.update(dt, this.map);
    for (const bomb of this.bombs) bomb.update(dt, this.map);

    for (const sw of this.switches) {
      if (sw.hit) continue;
      const pebble = this.pebbles.find((pb) => pb.alive && overlaps(pb.box, sw.box));
      if (!pebble) continue;
      pebble.alive = false;
      sw.hit = true;
      this.openDoors(sw.box.x);
      this.play('switch');
    }

    if (this.features.has('CHECKPOINTS') && this.deathT === null) {
      for (const flag of this.flags) {
        if (flag.raised || !overlaps(flag.box, this.player.box)) continue;
        flag.raised = true;
        this.checkpoint = { x: flag.x, y: flag.y };
        this.play('flag');
        this.hooks.save?.();
      }
    }

    const canHurt = this.deathT === null && this.features.has('DEATH') && this.invulnerableT <= 0;
    for (const bomb of this.bombs) {
      if (bomb.alive && canHurt && overlaps(bomb.box, this.player.box)) {
        bomb.alive = false;
        this.die();
      }
    }
    removeDead(this.pebbles);
    removeDead(this.bombs);
  }

  private updateFlicker(dt: number): void {
    const boss = this.flicker;
    if (!boss || !this.enemiesActive) return;
    const player = this.player;
    const alive = this.deathT === null;

    if (boss.state === 'waiting' && alive && player.box.x > boss.arenaX + 8) {
      boss.activate();
      this.bossIntroT = 0;
    }
    const drop = boss.update(dt, player.feetX);
    if (drop) this.bombs.push(new Bomb(drop.x, drop.y));

    for (const pb of this.pebbles) {
      if (!pb.alive || !overlaps(pb.box, boss.box)) continue;
      const result = boss.hit();
      if (result === 'ignored') continue;
      pb.alive = false;
      if (result === 'damaged') {
        this.score += SCORE_BOSS_HIT;
        this.play('bossHit');
      } else if (result === 'killed') {
        this.score += SCORE_BOSS;
        this.play('bossDie');
        this.bombs.length = 0;
      } else {
        this.play('clank');
      }
    }

    const canHurt = alive && this.features.has('DEATH') && this.invulnerableT <= 0;
    if (canHurt && boss.harmful && overlaps(player.box, boss.box)) this.die();

    if (boss.state === 'dead' && !this.bossFinished) {
      this.bossFinished = true;
      // The reward is a feature: COLOUR (16). Its moment ends the era.
      if (this.features.unlock('COLOUR_16')) {
        const b = boss.box;
        this.moment = { feature: 'COLOUR_16', t: 0, origin: { x: b.x + b.w / 2, y: b.y } };
        this.play('pickup');
        this.hooks.save?.();
      } else {
        this.request = 'eraComplete';
      }
    }
  }

  /** A switch opens every door on its screen. */
  private openDoors(switchX: number): void {
    const screen = Math.floor(switchX / VIEW_W);
    const tx0 = screen * (VIEW_W / TILE);
    for (let ty = 0; ty < this.map.height; ty++) {
      for (let tx = tx0; tx < tx0 + VIEW_W / TILE; tx++) {
        if (this.map.tileAt(tx, ty) === Tile.Door) this.map.setTile(tx, ty, Tile.Empty);
      }
    }
  }

  /** The y of the first solid tile top below a point (for Flicker's dive depth). */
  private floorBelow(x: number, y: number): number {
    const tx = Math.floor(x / TILE);
    for (let ty = Math.floor(y / TILE); ty < this.map.height; ty++) {
      if (this.map.isSolid(tx, ty)) return ty * TILE;
    }
    return this.map.pixelHeight;
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
    for (const boss of [this.boss, this.flicker]) {
      if (boss && !boss.defeated) {
        boss.reset();
        this.bossIntroT = null;
      }
    }
    this.bombs.length = 0;
    this.camera.lockX = null;
    this.camera.snap(this.player.feetX, this.playerCenterY);
  }

  private collectPickups(): void {
    for (const pickup of this.pickups) {
      if (!pickup.touches(this.player.box)) continue;
      pickup.collected = true;
      if (!this.features.unlock(pickup.feature)) continue;
      this.score += SCORE_PICKUP;
      // SCORE counts up retroactively from zero: "we were keeping score".
      if (pickup.feature === 'SCORE') this.displayScore = 0;
      this.moment = { feature: pickup.feature, t: 0, origin: { x: pickup.x, y: pickup.y } };
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

  /** The boss currently fighting, if any: its arena locks the camera and the player in. */
  get activeArenaX(): number | null {
    for (const boss of [this.boss, this.flicker]) {
      if (boss && boss.state !== 'waiting' && boss.state !== 'dead') return boss.arenaX;
    }
    return null;
  }

  /** Before SCREEN 2 the world ends at the edges of the starting screen. */
  private bounds(): Bounds {
    const arena = this.activeArenaX;
    if (arena !== null) return { minX: arena, maxX: arena + VIEW_W };
    if (this.features.has('SCREEN_2')) return { minX: 0, maxX: this.map.pixelWidth };
    return { minX: this.homeScreenX, maxX: this.homeScreenX + VIEW_W };
  }

  /** Keep derived state in line with the registry (the debug overlay can toggle anything). */
  private syncWithFeatures(): void {
    for (const pickup of this.pickups) pickup.collected = this.features.has(pickup.feature);
    this.camera.mode = this.features.has('SCROLLING')
      ? 'scroll'
      : this.features.has('SCREEN_2')
        ? 'flip'
        : 'fixed';
    this.camera.lockX = this.activeArenaX;
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

function removeDead<T extends { alive: boolean }>(list: T[]): void {
  for (let i = list.length - 1; i >= 0; i--) if (!list[i].alive) list.splice(i, 1);
}

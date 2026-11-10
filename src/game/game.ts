import { TILE, VIEW_H, VIEW_W } from '../config';
import type { FeatureId, FeatureRegistry } from '../core/features';
import type { ActionState } from '../core/input';
import { overlaps } from '../world/physics';
import { Tile, type ParsedLevel, type TileMap } from '../world/tilemap';
import { Camera } from './camera';
import { BlockBoss, FlickerBoss, Knight, Walker } from './enemies';
import {
  Bomb,
  Flag,
  Npc,
  Pebble,
  PEBBLE_FORWARD,
  PEBBLE_UP,
  Switch,
  TALK_RANGE,
  type Dialogue,
} from './props';
import { Warden } from './warden';
import { Cutscene, DeletionWave, Ghost, Light, Particles, type ParticleKind } from './era4';
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
export const SCORE_KNIGHT = 300;
export const SCORE_GHOST = 200;
/** CAMERA pulls in during the Chase. */
export const CHASE_ZOOM = 1.2;
const LOOK_AHEAD = 48;
/** Characters per second for typed-out dialogue. */
export const DIALOGUE_SPEED = 45;

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
  | 'flag'
  | 'swing'
  | 'clang'
  | 'step'
  | 'slam'
  | 'dash'
  | 'talk'
  | 'save'
  | 'splash'
  | 'ignite'
  | 'glitch'
  | 'voiceHup'
  | 'voiceHah'
  | 'voiceOof'
  | 'voiceNpc'
  | 'voiceBoss';

/** Things the game needs the outside world (scenes) to do. */
export type GameRequest = 'eraComplete' | 'gameOver' | 'title';

/** Side effects the game asks for. Kept as an interface so tests can run headless. */
export interface GameHooks {
  /** `x` is where in the world the sound came from (for stereo panning). */
  sound?(name: SoundName, x?: number): void;
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
  /** Era 3's boss. */
  readonly warden: Warden | null;
  readonly knights: Knight[];
  readonly npcs: Npc[];
  /** The open conversation, if any (the game pauses while it's open). */
  dialogue: Dialogue | null = null;
  /** Era 4. */
  readonly ghosts: Ghost[];
  readonly lights: Light[];
  readonly particles = new Particles();
  /** The Deprecator's cinematic, while it's playing. */
  cutscene: Cutscene | null = null;
  cutsceneSeen = false;
  /** The Chase: the deletion wave, where it starts, the finish line, and the villain's spot. */
  readonly wave: DeletionWave | null;
  readonly exitX: number | null;
  readonly deprecator: Point | null;
  /** Seconds since the Chase began (for the "RUN!" card), or null. */
  chaseT: number | null = null;
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
  private dustT = 0;
  private jumps = 0;

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
    const warden = this.level.entities.find((e) => e.kind === 'warden');
    this.warden = warden ? new Warden(warden.x, warden.y) : null;
    this.knights = this.level.entities
      .filter((e) => e.kind === 'knight')
      .map((e) => new Knight(e.x, e.y));
    this.npcs = this.level.entities
      .filter((e) => e.kind === 'npc' && e.id)
      .map((e) => new Npc(e.id!, e.x, e.y, this.level.dialogue[e.id!] ?? []));
    this.flags = this.level.entities
      .filter((e) => e.kind === 'flag')
      .map((e) => new Flag(e.x, e.y));
    this.ghosts = this.level.entities
      .filter((e) => e.kind === 'ghost')
      .map((e) => new Ghost(e.x, e.y));
    this.lights = this.level.entities
      .filter((e) => e.kind === 'torch' || e.kind === 'brazier')
      .map((e) => new Light(e.kind as 'torch' | 'brazier', e.x, e.y, e.kind === 'torch'));
    const chase = this.level.entities.find((e) => e.kind === 'chase');
    this.wave = chase ? new DeletionWave(chase.x) : null;
    this.exitX = this.level.entities.find((e) => e.kind === 'exit')?.x ?? null;
    const dep = this.level.entities.find((e) => e.kind === 'deprecator');
    this.deprecator = dep ? { x: dep.x, y: dep.y } : null;
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
        if (feature === 'CUTSCENE' && !this.cutsceneSeen) this.startCutscene();
        // Beating Flicker awards COLOUR (16); the era ends once that's sunk in.
        if (feature === 'COLOUR_16' && this.flicker?.state === 'dead') this.request = 'eraComplete';
      }
    }
    if (this.chaseT !== null) this.chaseT += dt;
    if (this.features.has('PARTICLES')) this.particles.update(dt);

    // Cutscenes and talking pause the game.
    if (this.updateCutscene(dt, input) || this.updateDialogue(dt, input)) {
      this.player.prevX = this.player.box.x;
      this.player.prevY = this.player.box.y;
      this.camera.update(this.player.feetX, this.playerCenterY);
      return;
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
      this.updateKnights(dt);
      this.updateFlicker(dt);
      this.updateWarden(dt);
      this.updateEra4(dt);
    }

    this.camera.leadTarget = this.features.has('CAMERA') ? this.player.facing * LOOK_AHEAD : 0;
    this.camera.zoomTarget = this.features.has('CAMERA') && this.wave?.active ? CHASE_ZOOM : 1;
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
        dashPressed: input.wasPressed('dash'),
      },
      {
        moveLeft: f.has('LEFT'),
        jump: f.has('JUMP'),
        grab: f.has('ARMS'),
        punch: f.has('PUNCH'),
        wallJump: f.has('HANDS_FEET'),
        sword: f.has('SWORD'),
        dash: f.has('DASH'),
      },
      this.map,
      this.bounds(),
      { water: this.map.inWater(this.player.box) },
    );
    const p = this.player;
    if (events.jumped) {
      this.play('jump');
      // VOICE: a grunt now and then (every jump would be a lot).
      if (++this.jumps % 3 === 0) this.voice('voiceHup');
    }
    if (events.landed) {
      this.play('land');
      this.fx('dust', p.feetX, p.feetY, 6, 40, { up: 10 });
    }
    if (events.swam) {
      this.play('splash');
      this.fx('splash', p.feetX, p.box.y + 6, 8, 70, { up: 60 });
    }
    if (events.swung && p.swingStage === 2) this.voice('voiceHah');
    if (events.dashed) this.fx('dust', p.feetX, p.feetY - 4, 8, 60);
    // Running kicks up a little dust.
    this.dustT -= dt;
    if (p.onGround && p.vx !== 0 && this.dustT <= 0) {
      this.dustT = 0.12;
      this.fx('dust', p.feetX - p.facing * 4, p.feetY, 1, 20, { up: 8 });
    }
    if (events.punched) this.play('punch');
    if (events.swung) this.play('swing');
    if (events.dashed) this.play('dash');

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
    const punch = alive ? player.attackBox() : null;
    const canHurt =
      alive && this.features.has('DEATH') && this.invulnerableT <= 0 && !this.player.dashing;

    for (const walker of this.walkers) {
      if (walker.gone) continue;
      walker.update(dt, this.map);
      if (!walker.alive) continue;
      const pebble = this.pebbles.find((pb) => pb.alive && overlaps(pb.box, walker.box));
      if (pebble) pebble.alive = false;
      if (pebble || (punch && overlaps(punch, walker.box))) {
        walker.kill();
        this.fx('debris', walker.box.x + walker.box.w / 2, walker.box.y + 6, 12, 120, { up: 80 });
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
    if (boss.update(dt, this.map, player.feetX)) {
      this.play('bossLand');
      this.shakeCamera(5);
    }
    if (punch && overlaps(punch, boss.box)) {
      const result = boss.hit(player.attackId);
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

    const canHurt =
      this.deathT === null &&
      this.features.has('DEATH') &&
      this.invulnerableT <= 0 &&
      !this.player.dashing;
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

    const canHurt =
      alive && this.features.has('DEATH') && this.invulnerableT <= 0 && !this.player.dashing;
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

  private updateKnights(dt: number): void {
    if (!this.enemiesActive || this.knights.length === 0) return;
    const player = this.player;
    const alive = this.deathT === null;
    const attack = alive ? player.attackBox() : null;
    const canHurt =
      alive && this.features.has('DEATH') && this.invulnerableT <= 0 && !player.dashing;
    const stereo = this.features.has('SAMPLES_STEREO');
    const earshot = this.camera.x + VIEW_W / 2;

    for (const knight of this.knights) {
      if (knight.gone) continue;
      const step = knight.update(dt, this.map, player.feetX, player.feetY);
      // Footsteps carry about a screen and a half: you hear them before you see them.
      if (step && stereo && Math.abs(knight.box.x - earshot) < VIEW_W * 1.5) {
        this.hooks.sound?.('step', knight.box.x);
      }
      if (!knight.alive) continue;

      for (const pb of this.pebbles) {
        if (pb.alive && overlaps(pb.box, knight.box)) {
          pb.alive = false;
          this.play('clank', knight.box.x);
        }
      }
      if (attack && overlaps(attack, knight.box)) {
        const result = knight.hit(player.attackId, player.feetX, player.swinging);
        if (result !== 'ignored') {
          const kx = knight.box.x + knight.box.w / 2;
          this.fx('spark', kx, knight.box.y + 10, result === 'killed' ? 18 : 8, 140, { up: 40 });
          if (result === 'killed') this.shakeCamera(2);
        }
        if (result === 'damaged') this.play('clang', knight.box.x);
        else if (result === 'killed') {
          this.score += SCORE_KNIGHT;
          this.play('enemyDie', knight.box.x);
        } else if (result === 'blocked') this.play('clank', knight.box.x);
      }
      if (canHurt && knight.flinchT <= 0 && overlaps(player.box, knight.box)) this.die();
    }
  }

  private updateWarden(dt: number): void {
    const boss = this.warden;
    if (!boss || !this.enemiesActive) return;
    const player = this.player;
    const alive = this.deathT === null;

    if (boss.state === 'waiting' && alive && player.box.x > boss.arenaX + 8) {
      boss.activate();
      this.bossIntroT = 0;
    }
    const events = boss.update(dt, player.feetX);
    if (events.slam) {
      this.play('slam', player.feetX);
      this.shakeCamera(6);
      for (const fist of boss.fists) {
        if (fist.state === 'stuck' && fist.t === 0) {
          this.fx('debris', fist.box.x + fist.box.w / 2, fist.box.y + fist.box.h, 16, 140, {
            up: 90,
          });
        }
      }
    }
    if (events.rock) this.bombs.push(new Bomb(events.rock.x, events.rock.y));

    const attack = alive ? player.attackBox() : null;
    if (attack) {
      for (const fist of boss.fists) {
        if (overlaps(attack, fist.box)) this.bossHitResult(fist.hit(player.attackId), fist.box.x);
      }
      if (overlaps(attack, boss.head)) {
        this.bossHitResult(boss.hitHead(player.attackId), boss.head.x);
      }
    }

    const canHurt =
      alive && this.features.has('DEATH') && this.invulnerableT <= 0 && !player.dashing;
    if (canHurt) {
      const crushed =
        boss.fists.some((f) => f.harmful && overlaps(player.box, f.box)) ||
        (boss.headHarmful && overlaps(player.box, boss.head));
      if (crushed) this.die();
    }
    if (boss.state === 'dead' && !this.bossFinished) {
      this.bossFinished = true;
      this.request = 'eraComplete';
    }
  }

  private bossHitResult(result: 'damaged' | 'killed' | 'blocked' | 'ignored', x: number): void {
    if (result === 'damaged') {
      this.score += SCORE_BOSS_HIT;
      this.play('bossHit', x);
    } else if (result === 'killed') {
      this.score += SCORE_BOSS_HIT * 2;
      this.play('bossDie', x);
      if (this.warden?.state === 'dying') {
        this.score += SCORE_BOSS;
        this.bombs.length = 0;
      }
    } else if (result === 'blocked') {
      this.play('clank', x);
    }
  }

  /**
   * NPCs + DIALOGUE: press up next to someone to talk. Returns true while a conversation
   * is open (the rest of the game pauses). Jump, attack or up turns the page.
   */
  private updateDialogue(dt: number, input: ActionState): boolean {
    const open = this.dialogue;
    if (open) {
      const turnPage =
        input.wasPressed('jump') || input.wasPressed('attack') || input.wasPressed('up');
      const text = open.npc.pages[open.page] ?? '';
      const before = Math.floor(open.chars);
      open.chars = Math.min(text.length, open.chars + DIALOGUE_SPEED * dt);
      if (Math.floor(open.chars) > before && Math.floor(open.chars) % 3 === 0) {
        // VOICE: characters babble out loud instead of blipping.
        if (this.features.has('VOICE')) {
          if (Math.floor(open.chars) % 6 === 0) this.voice('voiceNpc', open.npc.x);
        } else {
          this.play('talk');
        }
      }
      if (turnPage) {
        if (open.chars < text.length) open.chars = text.length;
        else if (open.page + 1 < open.npc.pages.length) {
          open.page++;
          open.chars = 0;
        } else {
          this.dialogue = null;
        }
      }
      return true;
    }
    if (!input.wasPressed('up') || this.deathT !== null) return false;
    const npc = this.talkableNpc;
    if (!npc || !this.player.onGround || npc.pages.length === 0) return false;
    npc.talked = true;
    this.dialogue = { npc, page: 0, chars: 0 };
    return true;
  }

  /** The NPC you could talk to right now (for the "talk" prompt). */
  get talkableNpc(): Npc | null {
    if (!this.features.has('NPCS') || this.dialogue) return null;
    const p = this.player;
    const near = (n: Npc) => Math.abs(n.x - p.feetX) < TALK_RANGE && Math.abs(n.y - p.feetY) < 8;
    return this.npcs.find(near) ?? null;
  }

  /** Era 4: lights, ghosts, ambient particles and the Chase. */
  private updateEra4(dt: number): void {
    const p = this.player;
    const alive = this.deathT === null;

    // Braziers light when you touch them, and save your place.
    for (const light of this.lights) {
      if (light.kind !== 'brazier' || light.lit || !alive) continue;
      if (!overlaps(light.box, p.box)) continue;
      light.lit = true;
      this.checkpoint = { x: light.x, y: light.y };
      this.play('ignite', light.x);
      this.fx('ember', light.x, light.flameY, 16, 60, { up: 40, life: 1 });
      this.hooks.save?.();
    }
    // Flames give off the odd ember.
    if (this.features.has('PARTICLES')) {
      for (const light of this.lights) {
        if (light.lit && Math.random() < dt * 4 && Math.abs(light.x - p.feetX) < VIEW_W) {
          this.fx('ember', light.x + (Math.random() - 0.5) * 6, light.flameY, 1, 15, {
            up: 30,
            life: 1.2,
          });
        }
      }
    }

    if (this.enemiesActive && this.ghosts.length > 0) {
      const attack = alive ? p.attackBox() : null;
      const canHurt = alive && this.features.has('DEATH') && this.invulnerableT <= 0 && !p.dashing;
      for (const ghost of this.ghosts) {
        if (ghost.gone) continue;
        ghost.update(dt, p.feetX, this.playerCenterY);
        if (!ghost.alive) continue;
        const pebble = this.pebbles.find((pb) => pb.alive && overlaps(pb.box, ghost.box));
        if (pebble) pebble.alive = false;
        if (pebble || (attack && overlaps(attack, ghost.box))) {
          ghost.kill();
          this.score += SCORE_GHOST;
          this.play('enemyDie', ghost.box.x);
          this.fx('glitch', ghost.box.x + 8, ghost.box.y + 9, 14, 60);
        } else if (canHurt && overlaps(p.box, ghost.box)) {
          this.die();
        }
      }
    }

    // The Chase. If you somehow get past the cutscene without it starting, it starts.
    const wave = this.wave;
    if (
      wave &&
      !wave.active &&
      !this.cutsceneSeen &&
      !this.cutscene &&
      alive &&
      p.feetX >= wave.x
    ) {
      if (!this.features.has('CUTSCENE')) {
        this.features.unlock('CUTSCENE');
        this.moment = { feature: 'CUTSCENE', t: 0 };
      } else if (!this.moment) {
        this.startCutscene();
      }
    }
    if (!wave?.active) return;
    wave.update(dt);
    this.shakeCamera(1.2);
    if (this.features.has('PARTICLES') && Math.random() < dt * 30) {
      const y = this.camera.y + Math.random() * VIEW_H;
      this.fx('glitch', wave.x, y, 1, 30);
    }
    if (alive && p.box.x < wave.x && this.features.has('DEATH')) {
      this.fx('glitch', p.feetX, p.box.y + 14, 20, 80);
      this.die();
    }
    if (alive && this.exitX !== null && p.feetX >= this.exitX) {
      wave.active = false;
      this.chaseT = null;
      this.camera.shake = 0;
      this.request = 'eraComplete';
    }
  }

  private startCutscene(): void {
    this.cutscene = new Cutscene();
    this.cutsceneSeen = true;
  }

  /** The Deprecator's cinematic. Returns true while it plays (the game pauses). */
  private updateCutscene(dt: number, input: ActionState): boolean {
    const scene = this.cutscene;
    if (!scene) return false;
    const advance = input.wasPressed('jump') || input.wasPressed('attack');
    const before = Math.floor(scene.chars);
    const phase = scene.phase;
    scene.update(dt, advance);
    if (
      scene.phase === 'talk' &&
      Math.floor(scene.chars) > before &&
      Math.floor(scene.chars) % 5 === 0
    ) {
      if (this.features.has('VOICE')) this.voice('voiceBoss', this.deprecator?.x);
      else this.play('talk');
    }
    // The camera goes to look at it, then comes back to you for the Chase.
    const looking =
      scene.phase !== 'letterbox' && scene.phase !== 'delete' && scene.phase !== 'done';
    this.camera.focusX = looking && this.deprecator ? this.deprecator.x : null;
    if (phase !== 'delete' && scene.phase === 'delete') {
      this.play('glitch');
      this.shakeCamera(10);
    }
    if (scene.phase === 'done') {
      this.cutscene = null;
      this.camera.focusX = null;
      this.wave?.start(this.player.feetX);
      this.chaseT = 0;
      return false;
    }
    this.player.prevX = this.player.box.x;
    this.player.prevY = this.player.box.y;
    this.camera.update(this.player.feetX, this.playerCenterY);
    return true;
  }

  /** PARTICLES: only once you have them. */
  private fx(
    kind: ParticleKind,
    x: number,
    y: number,
    count: number,
    speed: number,
    options?: { up?: number; life?: number; size?: number },
  ): void {
    if (this.features.has('PARTICLES')) this.particles.burst(kind, x, y, count, speed, options);
  }

  /** CAMERA: screen shake, only once you have it. */
  private shakeCamera(amount: number): void {
    if (this.features.has('CAMERA')) this.camera.shake = Math.max(this.camera.shake, amount);
  }

  /** VOICE: grunts and speech, only once you have it. */
  private voice(name: SoundName, x?: number): void {
    if (this.features.has('VOICE')) this.hooks.sound?.(name, x ?? this.player.feetX);
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
    this.voice('voiceOof');
    this.shakeCamera(4);
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
    for (const boss of [this.boss, this.flicker, this.warden]) {
      if (boss && !boss.defeated) {
        boss.reset();
        this.bossIntroT = null;
      }
    }
    this.bombs.length = 0;
    this.camera.lockX = null;
    // The Chase starts over, a little behind where you respawn.
    if (this.wave?.active) this.wave.start(this.checkpoint.x);
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
  private play(name: SoundName, x = this.player.feetX): void {
    if (this.features.has('SFX')) this.hooks.sound?.(name, x);
    else if (name === 'jump' && this.features.has('BEEP')) this.hooks.sound?.('beep', x);
  }

  /** The boss currently fighting, if any: its arena locks the camera and the player in. */
  get activeArenaX(): number | null {
    for (const boss of [this.boss, this.flicker, this.warden]) {
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

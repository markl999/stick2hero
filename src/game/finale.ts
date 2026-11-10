import { VIEW_W } from '../config';
import { FEATURE_IDS, type FeatureId, type FeatureRegistry } from '../core/features';
import { overlaps, type Box } from '../world/physics';

/*
 * The finale: the Deprecator. It takes the game's features away in reverse order, a
 * phase at a time, and the game rolls back with each one: the glow, then CD audio (and HD
 * with it), colour, scrolling and music, the cape, and finally everything but walking and
 * jumping: a stick man with no arms on a white screen, in silence.
 *
 * Each phase you knock the headline feature out of it (hit it while it's exposed) and
 * collect it. Reclaimed features are banked: they all come back at once when it's beaten.
 * The exception is the last phase. It takes your ARMS, and you take them back for real,
 * because the last hit is a punch, thrown in Era 0 graphics.
 */

export type FinaleAttack = 'beam' | 'wave' | 'bits';

export interface FinalePhase {
  /** The feature you win back to end the phase. */
  reclaim: FeatureId;
  /** Everything this phase removes. */
  take: readonly FeatureId[];
  /** What the Deprecator says as it does it. */
  line: string;
  attacks: readonly FinaleAttack[];
}

/** Never taken: you can always walk, jump and (once you have arms) punch. */
export const FINALE_KEEP: readonly FeatureId[] = ['LEFT', 'JUMP', 'SCREEN_2', 'PUNCH'];

const EARLY_PHASES: FinalePhase[] = [
  {
    reclaim: 'BLOOM',
    take: ['BLOOM'],
    line: 'FIRST, THE GLOW. NOBODY NEEDED THE GLOW.',
    attacks: ['beam'],
  },
  {
    reclaim: 'CD_AUDIO',
    take: [
      'CD_AUDIO',
      'ADAPTIVE_MUSIC',
      'VOICE',
      'HD',
      'DYNAMIC_SHADOWS',
      'PHYSICS',
      'RUMBLE',
      'ACHIEVEMENTS',
      'PHOTO_MODE',
      'LIGHTING',
      'TRANSPARENCY',
      'PARTICLES',
      'CAMERA',
      'DEPTH',
      'CUTSCENE',
    ],
    line: 'ROLLING BACK. NO MORE HD. NO MORE CD AUDIO.',
    attacks: ['beam', 'bits'],
  },
  {
    reclaim: 'COLOUR_16',
    take: ['COLOUR_16', 'COLOUR_4', 'PARALLAX', 'SAMPLES_STEREO', 'NPCS', 'SAVE_GAME'],
    line: 'COLOUR WAS ALWAYS A LUXURY.',
    attacks: ['wave', 'beam'],
  },
  {
    reclaim: 'SCROLLING',
    take: ['SCROLLING', 'MUSIC', 'ANIMATION', 'CHECKPOINTS', 'THROW', 'LIVES'],
    line: 'NO SCROLLING. NO MUSIC. NO SECOND CHANCES.',
    attacks: ['wave', 'bits'],
  },
  {
    reclaim: 'CAPE',
    take: ['CAPE', 'OUTFIT', 'FACE', 'SWORD', 'DASH', 'HANDS_FEET'],
    line: 'AND TAKE OFF THAT RIDICULOUS CAPE.',
    attacks: ['beam', 'wave'],
  },
];

export const FINALE_PHASES: readonly FinalePhase[] = [
  ...EARLY_PHASES,
  {
    reclaim: 'ARMS',
    take: FEATURE_IDS.filter(
      (id) => !FINALE_KEEP.includes(id) && !EARLY_PHASES.some((p) => p.take.includes(id)),
    ),
    line: 'BACK TO THE PROTOTYPE.',
    attacks: [],
  },
];

export const INTRO_LINE = 'SO. YOU PUT IT ALL BACK. EVERY LAST FEATURE.';
export const BEATEN_LINE = '...DEPRECATED.';

export const DEP_W = 30;
export const DEP_H = 50;
export const PHASE_HITS = 3;
export const BEAM_W = 22;
export const BEAM_WARN = 0.85;
export const BEAM_TIME = 0.45;
export const WAVE_H = 14;
const WAVE_SPEED = 150;
export const INTRO_TIME = 3.2;
export const STRIP_TIME = 2.6;
/** When, during the strip, the features actually go. */
export const STRIP_AT = 0.5;
const ATTACK_GAP = 1.5;
const ATTACKS_PER_CYCLE = 4;
const LOWER_TIME = 0.5;
export const EXPOSED_TIME = 3.0;
const BITS_PER_ATTACK = 5;
export const RECLAIM_TIME = 1.4;
export const BEATEN_TIME = 1.6;
export const RESTORE_TIME = 4.5;
const HOVER_HEIGHT = 112;
const LAST_SPEED = 26;

export type FinaleState =
  | 'waiting'
  | 'intro'
  | 'strip'
  | 'fight'
  | 'exposed'
  | 'dropped'
  | 'reclaim'
  | 'last'
  | 'beaten'
  | 'restore'
  | 'done';

export interface Beam {
  x: number;
  t: number;
}

export interface FloorWave {
  x: number;
  dir: 1 | -1;
}

/** The feature it dropped, lying in the arena for you to collect. */
export interface Orb {
  feature: FeatureId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  landed: boolean;
}

export interface FinaleEvents {
  /** The features just stripped (for sounds and the moment). */
  stripped?: FinalePhase;
  bits?: { x: number; y: number }[];
  beamStrike?: boolean;
  wave?: boolean;
  exposed?: boolean;
  dropped?: boolean;
  reclaimed?: FeatureId;
  beaten?: boolean;
  restored?: boolean;
  done?: boolean;
}

export class Finale {
  state: FinaleState = 'waiting';
  t = 0;
  phase = 0;
  /** Hits landed this phase. */
  hits = 0;
  hitFlash = 0;
  readonly box: Box;
  prevX: number;
  prevY: number;
  /** Everything currently taken, in the order it went. */
  readonly stripped: FeatureId[] = [];
  /** Won back, waiting to return when it's beaten. */
  readonly reclaimed: FeatureId[] = [];
  readonly beams: Beam[] = [];
  readonly waves: FloorWave[] = [];
  orb: Orb | null = null;
  private attacks = 0;
  private attackT = 0;
  private lastHit = -1;
  private clock = 0;

  constructor(
    /** Left edge of the arena (one screen wide). */
    readonly arenaX: number,
    /** The arena floor. */
    readonly floorY: number,
    private readonly features: FeatureRegistry,
  ) {
    this.box = { x: this.homeX - DEP_W / 2, y: this.hoverY, w: DEP_W, h: DEP_H };
    this.prevX = this.box.x;
    this.prevY = this.box.y;
  }

  get current(): FinalePhase {
    return FINALE_PHASES[Math.min(this.phase, FINALE_PHASES.length - 1)];
  }

  get active(): boolean {
    return this.state !== 'waiting' && this.state !== 'done';
  }

  /** The arena locks while it's being fought (and while everything comes back). */
  get locksArena(): boolean {
    return this.active;
  }

  get homeX(): number {
    return this.arenaX + VIEW_W / 2;
  }

  get hoverY(): number {
    return this.floorY - HOVER_HEIGHT;
  }

  /** It can be hit right now. */
  get vulnerable(): boolean {
    return this.state === 'exposed' || this.state === 'last';
  }

  /** The line it's saying, if any (with how long it's been saying it). */
  get speech(): { text: string; t: number } | null {
    if (this.state === 'intro') return { text: INTRO_LINE, t: this.t };
    if (this.state === 'strip') return { text: this.current.line, t: this.t };
    if (this.state === 'beaten') return { text: BEATEN_LINE, t: this.t };
    return null;
  }

  /** The very last phase: Era 0, no arms, no attacks. */
  get final(): boolean {
    return this.phase === FINALE_PHASES.length - 1;
  }

  start(): void {
    if (this.state !== 'waiting') return;
    this.go('intro');
  }

  update(dt: number, playerX: number): FinaleEvents {
    const events: FinaleEvents = {};
    this.prevX = this.box.x;
    this.prevY = this.box.y;
    this.t += dt;
    this.clock += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.updateHazards(dt, events);
    if (this.orb) this.updateOrb(dt);

    const b = this.box;
    switch (this.state) {
      case 'waiting':
      case 'done':
        break;
      case 'intro':
        this.hover(dt, 0.4);
        if (this.t >= INTRO_TIME) this.go('strip');
        break;
      case 'strip':
        this.moveTowards(this.homeX - DEP_W / 2, this.hoverY, 160 * dt);
        if (this.t >= STRIP_AT && this.t - dt < STRIP_AT) {
          this.strip(this.current);
          events.stripped = this.current;
          if (this.final) this.dropOrb(events);
        }
        if (this.t >= STRIP_TIME) {
          if (this.final) this.go('dropped');
          else this.startFight();
        }
        break;
      case 'fight':
        this.hover(dt, 1);
        this.attackT -= dt;
        if (this.attackT <= 0) {
          if (this.attacks >= ATTACKS_PER_CYCLE) {
            this.go('exposed');
            events.exposed = true;
            break;
          }
          this.attack(
            this.current.attacks[this.attacks % this.current.attacks.length],
            playerX,
            events,
          );
          this.attacks++;
          this.attackT = ATTACK_GAP;
        }
        break;
      case 'exposed':
        // Sinks to the floor, glitching, where you can reach it.
        b.y += (this.floorY - DEP_H - b.y) * Math.min(1, (dt / LOWER_TIME) * 4);
        if (this.t >= EXPOSED_TIME) this.startFight();
        break;
      case 'dropped':
        // Stunned until you've got your feature back. In Era 0 it just wanders about.
        if (this.final) this.wander(dt, playerX, 0.5);
        break;
      case 'reclaim':
        if (this.t >= RECLAIM_TIME) {
          this.phase++;
          this.hits = 0;
          this.go('strip');
        }
        break;
      case 'last':
        this.wander(dt, playerX, 1);
        break;
      case 'beaten':
        if (this.t >= BEATEN_TIME) {
          this.restoreAll();
          events.restored = true;
          this.go('restore');
        }
        break;
      case 'restore':
        if (this.t >= RESTORE_TIME) {
          this.go('done');
          events.done = true;
        }
        break;
    }
    return events;
  }

  /** A hit with the player's attack. */
  hit(attackId: number): 'damaged' | 'killed' | 'blocked' | 'ignored' {
    if (attackId === this.lastHit) return 'ignored';
    if (!this.active || this.state === 'beaten' || this.state === 'restore') return 'ignored';
    this.lastHit = attackId;
    if (!this.vulnerable) return 'blocked';
    this.hitFlash = 0.15;
    if (this.state === 'last') {
      this.beams.length = 0;
      this.waves.length = 0;
      this.go('beaten');
      return 'killed';
    }
    this.hits++;
    if (this.hits >= PHASE_HITS) {
      const events: FinaleEvents = {};
      this.dropOrb(events);
      this.go('dropped');
      return 'killed';
    }
    return 'damaged';
  }

  /** You touched the dropped feature. Returns the feature if this reclaimed it. */
  collect(player: Box): FeatureId | null {
    const orb = this.orb;
    if (!orb || this.state !== 'dropped') return null;
    const box = { x: orb.x - 8, y: orb.y - 8, w: 16, h: 16 };
    if (!overlaps(box, player)) return null;
    this.orb = null;
    if (this.final) {
      // Your arms, back for real: you'll need them for the last hit.
      this.features.unlock(orb.feature);
      const i = this.stripped.indexOf(orb.feature);
      if (i >= 0) this.stripped.splice(i, 1);
      this.go('last');
    } else {
      this.reclaimed.push(orb.feature);
      this.go('reclaim');
    }
    return orb.feature;
  }

  /** Does anything of its hurt this box? */
  hurts(box: Box): boolean {
    for (const beam of this.beams) {
      if (beam.t < BEAM_WARN) continue;
      if (overlaps(box, { x: beam.x - BEAM_W / 2, y: -1000, w: BEAM_W, h: this.floorY + 1000 })) {
        return true;
      }
    }
    for (const wave of this.waves) {
      if (overlaps(box, { x: wave.x - 10, y: this.floorY - WAVE_H, w: 20, h: WAVE_H })) return true;
    }
    return false;
  }

  /** After you die: the attacks stop and it starts its cycle again. Taken things stay taken. */
  reset(): void {
    this.beams.length = 0;
    this.waves.length = 0;
    if (this.state === 'fight' || this.state === 'exposed') this.startFight();
  }

  /** Put back everything it took (when it's beaten, or if you give up and start over). */
  restoreAll(): void {
    for (const id of this.stripped) this.features.unlock(id);
    this.stripped.length = 0;
    this.reclaimed.length = 0;
  }

  private strip(phase: FinalePhase): void {
    for (const id of phase.take) {
      if (this.features.lock(id)) this.stripped.push(id);
    }
  }

  private startFight(): void {
    this.go('fight');
    this.attacks = 0;
    this.attackT = 0.8;
  }

  private attack(kind: FinaleAttack, playerX: number, events: FinaleEvents): void {
    if (kind === 'beam') {
      this.beams.push({ x: playerX, t: 0 });
    } else if (kind === 'wave') {
      const fromLeft = this.box.x + DEP_W / 2 < this.homeX;
      this.waves.push({ x: fromLeft ? this.arenaX : this.arenaX + VIEW_W, dir: fromLeft ? 1 : -1 });
      events.wave = true;
    } else {
      const bits: { x: number; y: number }[] = [];
      for (let i = 0; i < BITS_PER_ATTACK; i++) {
        const x = playerX + (i - (BITS_PER_ATTACK - 1) / 2) * 34 + (Math.random() - 0.5) * 10;
        const clamped = Math.max(this.arenaX + 10, Math.min(this.arenaX + VIEW_W - 10, x));
        bits.push({ x: clamped, y: this.floorY - 175 - i * 22 });
      }
      events.bits = bits;
    }
  }

  private updateHazards(dt: number, events: FinaleEvents): void {
    for (const beam of this.beams) {
      const before = beam.t;
      beam.t += dt;
      if (before < BEAM_WARN && beam.t >= BEAM_WARN) events.beamStrike = true;
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      if (this.beams[i].t >= BEAM_WARN + BEAM_TIME) this.beams.splice(i, 1);
    }
    for (const wave of this.waves) wave.x += wave.dir * WAVE_SPEED * dt;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const x = this.waves[i].x;
      if (x < this.arenaX - 20 || x > this.arenaX + VIEW_W + 20) this.waves.splice(i, 1);
    }
  }

  private dropOrb(events: FinaleEvents): void {
    const b = this.box;
    const cx = b.x + DEP_W / 2;
    const towardMiddle = cx < this.homeX ? 1 : -1;
    this.orb = {
      feature: this.current.reclaim,
      x: cx,
      y: b.y + DEP_H / 2,
      vx: towardMiddle * 70,
      vy: -260,
      landed: false,
    };
    this.beams.length = 0;
    this.waves.length = 0;
    events.dropped = true;
  }

  private updateOrb(dt: number): void {
    const orb = this.orb;
    if (!orb || orb.landed) return;
    orb.vy = Math.min(orb.vy + 900 * dt, 500);
    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt;
    orb.x = Math.max(this.arenaX + 16, Math.min(this.arenaX + VIEW_W - 16, orb.x));
    // It comes to rest just above the floor, like any pickup.
    if (orb.y >= this.floorY - 10) {
      orb.y = this.floorY - 10;
      orb.landed = true;
    }
  }

  private hover(dt: number, speed: number): void {
    const x = this.homeX + Math.sin(this.clock * 0.7) * (VIEW_W / 2 - 60) - DEP_W / 2;
    const y = this.hoverY + Math.sin(this.clock * 2.1) * 6;
    this.moveTowards(x, y, 120 * speed * dt);
  }

  /** Era 0: it shuffles away from you along the floor. */
  private wander(dt: number, playerX: number, speed: number): void {
    const b = this.box;
    b.y += (this.floorY - DEP_H - b.y) * Math.min(1, dt * 4);
    const cx = b.x + DEP_W / 2;
    const away = cx >= playerX ? 1 : -1;
    b.x += away * LAST_SPEED * speed * dt;
    b.x = Math.max(this.arenaX + 4, Math.min(this.arenaX + VIEW_W - DEP_W - 4, b.x));
  }

  private moveTowards(x: number, y: number, step: number): void {
    const b = this.box;
    const dx = x - b.x;
    const dy = y - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= step) {
      b.x = x;
      b.y = y;
    } else {
      b.x += (dx / dist) * step;
      b.y += (dy / dist) * step;
    }
  }

  private go(state: FinaleState): void {
    this.state = state;
    this.t = 0;
  }
}

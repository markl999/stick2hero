/*
 * ACHIEVEMENTS (Era 5). Collecting the feature awards forty at once, for everything you've
 * done to get this far. After that a handful can be earned the normal way.
 */

/** The forty you get the moment ACHIEVEMENTS exists. */
export const RETRO_ACHIEVEMENTS: readonly string[] = [
  'PRESSED A KEY',
  'LISTENED TO A TAPE',
  'TURNED AROUND',
  'JUMPED',
  'HEARD A BEEP',
  'FOUND SCREEN 2',
  'GREW ARMS',
  'KEPT SCORE',
  'SAW 60 FRAMES',
  'MET AN ENEMY',
  'DISCOVERED DEATH',
  'HAD 3 LIVES',
  'THREW A PUNCH',
  'MADE SOME NOISE',
  'SAW THE TITLE SCREEN',
  'BEAT THE BLOCK',
  'SAW RED',
  'SCROLLED',
  'LEARNED TO WALK',
  'HEARD MUSIC',
  'GOT HANDS',
  'THREW A PEBBLE',
  'RAISED A FLAG',
  'BEAT FLICKER',
  'SAW 16 COLOURS',
  'SAW PARALLAX',
  'HEARD IN STEREO',
  'GOT A FACE',
  'MADE A FRIEND',
  'GOT DRESSED',
  'SWUNG A SWORD',
  'DASHED',
  'SAVED (IT ALWAYS COULD)',
  'BEAT THE WARDEN',
  'SAW THROUGH A WALL',
  'LIT A BRAZIER',
  'OUTRAN THE DELETION',
  'WENT HD',
  'HID IN A SHADOW',
  'UNLOCKED ACHIEVEMENTS',
];

/** Earned later, for real. */
export const ACHIEVEMENT = {
  smash: 'SMASHED IT',
  glide: 'FREQUENT FLYER',
  photo: 'SAY CHEESE',
  drone: 'DRONE STRIKE',
  rumble: 'GOOD VIBRATIONS',
  deprecator: 'DEPRECATED THE DEPRECATOR',
  hero: 'HERO',
} as const;

/** Popups stack up one after another: the forty arrive this far apart. */
export const POPUP_STAGGER = 0.045;
export const POPUP_TIME = 3.2;

export interface Popup {
  name: string;
  /** Seconds since it was queued (it appears once t ≥ delay). */
  t: number;
  delay: number;
}

export class Achievements {
  readonly earned = new Set<string>();
  readonly popups: Popup[] = [];

  /** Award a batch at once (the forty). */
  awardAll(names: readonly string[]): void {
    let delay = 0;
    for (const name of names) {
      if (this.earned.has(name)) continue;
      this.earned.add(name);
      this.popups.push({ name, t: 0, delay });
      delay += POPUP_STAGGER;
    }
  }

  /** Returns true if it's new. */
  award(name: string): boolean {
    if (this.earned.has(name)) return false;
    this.earned.add(name);
    // Queue behind anything still waiting to appear.
    const last = this.popups.reduce((d, p) => Math.max(d, p.delay - p.t), 0);
    this.popups.push({ name, t: 0, delay: last > 0 ? last + 0.3 : 0 });
    return true;
  }

  /** Returns how many popups appeared this step (each one gets a ding). */
  update(dt: number): number {
    let appeared = 0;
    for (const p of this.popups) {
      if (p.t <= p.delay && p.t + dt > p.delay) appeared++;
      p.t += dt;
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      if (p.t > p.delay + POPUP_TIME) this.popups.splice(i, 1);
    }
    return appeared;
  }
}

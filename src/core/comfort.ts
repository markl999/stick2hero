/**
 * Accessibility options (PRD §12). Not features: they're there from the start, in the pause
 * menu. Game logic and the renderers read them from `game.comfort`.
 */
export interface Comfort {
  /** No full-screen flashes: unlock inverts, white/red flashes, strobing static. */
  reduceFlashing: boolean;
  /** No camera shake or screen hops. (Gamepad rumble is separate.) */
  reduceShake: boolean;
  /** No zooms, screen flips or scrolling stripes. */
  reduceMotion: boolean;
  /** Hazards and enemies in amber instead of red (red reads as dark to many colour-blind players). */
  colourBlind: boolean;
}

export const COMFORT_KEYS = [
  'reduceFlashing',
  'reduceShake',
  'reduceMotion',
  'colourBlind',
] as const;

/** Flashing, shake and motion start reduced if the system asks for reduced motion. */
export function defaultComfort(systemReducedMotion = false): Comfort {
  return {
    reduceFlashing: systemReducedMotion,
    reduceShake: systemReducedMotion,
    reduceMotion: systemReducedMotion,
    colourBlind: false,
  };
}

export function parseComfort(value: unknown, systemReducedMotion = false): Comfort {
  const out = defaultComfort(systemReducedMotion);
  if (typeof value !== 'object' || value === null) return out;
  const raw = value as Record<string, unknown>;
  for (const key of COMFORT_KEYS) if (typeof raw[key] === 'boolean') out[key] = raw[key];
  return out;
}

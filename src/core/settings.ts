import { defaultComfort, parseComfort, type Comfort } from './comfort';
import { DEFAULT_KEYS, copyBindings, sanitiseBindings, type KeyBindings } from './input';
import { readJson, writeJson } from './storage';

/**
 * Options from the pause menu (PRD §12). Kept apart from the save, so NEW GAME doesn't
 * reset your volume or your keys.
 */
export interface Settings {
  /** 0..VOLUME_STEPS. */
  music: number;
  sfx: number;
  keys: KeyBindings;
  comfort: Comfort;
}

const KEY = 'stick2hero.settings.v1';
export const VOLUME_STEPS = 10;

/** `systemReducedMotion`: the browser's prefers-reduced-motion, for the comfort defaults. */
export function defaultSettings(systemReducedMotion = false): Settings {
  return {
    music: VOLUME_STEPS,
    sfx: VOLUME_STEPS,
    keys: copyBindings(DEFAULT_KEYS),
    comfort: defaultComfort(systemReducedMotion),
  };
}

function volume(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(VOLUME_STEPS, Math.round(value)))
    : VOLUME_STEPS;
}

export function parseSettings(value: unknown, systemReducedMotion = false): Settings {
  if (typeof value !== 'object' || value === null) return defaultSettings(systemReducedMotion);
  const raw = value as Record<string, unknown>;
  return {
    music: volume(raw.music),
    sfx: volume(raw.sfx),
    keys: sanitiseBindings(raw.keys),
    comfort: parseComfort(raw.comfort, systemReducedMotion),
  };
}

export function loadSettings(systemReducedMotion = false): Settings {
  return parseSettings(readJson(KEY), systemReducedMotion);
}

export function writeSettings(settings: Settings): void {
  writeJson(KEY, settings);
}

/** A volume step as a gain: squared, so the steps sound even. */
export function volumeGain(step: number): number {
  return (step / VOLUME_STEPS) ** 2;
}

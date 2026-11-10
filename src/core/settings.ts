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
}

const KEY = 'stick2hero.settings.v1';
export const VOLUME_STEPS = 10;

export function defaultSettings(): Settings {
  return { music: VOLUME_STEPS, sfx: VOLUME_STEPS, keys: copyBindings(DEFAULT_KEYS) };
}

function volume(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(VOLUME_STEPS, Math.round(value)))
    : VOLUME_STEPS;
}

export function parseSettings(value: unknown): Settings {
  if (typeof value !== 'object' || value === null) return defaultSettings();
  const raw = value as Record<string, unknown>;
  return { music: volume(raw.music), sfx: volume(raw.sfx), keys: sanitiseBindings(raw.keys) };
}

export function loadSettings(): Settings {
  return parseSettings(readJson(KEY));
}

export function writeSettings(settings: Settings): void {
  writeJson(KEY, settings);
}

/** A volume step as a gain: squared, so the steps sound even. */
export function volumeGain(step: number): number {
  return (step / VOLUME_STEPS) ** 2;
}

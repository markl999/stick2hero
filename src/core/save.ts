import { isFeatureId, type FeatureId } from './features';
import { storage } from './storage';

const KEY = 'stick2hero.save.v1';

export interface SaveData {
  version: 1;
  features: FeatureId[];
  score: number;
  introSeen: boolean;
  /** Feet position to resume from, or null for the level spawn. */
  checkpoint: { x: number; y: number } | null;
  /** Index of the current era's level. */
  era: number;
  /** The Deprecator has been beaten. */
  cleared: boolean;
  /** This playthrough's id: its row in the high-score table. NEW GAME starts a new one. */
  run: number;
  /** Collected features switched off in the post-game Feature Menu (still yours). */
  disabled: FeatureId[];
  /** Seconds of play, and deaths, over the whole run (for the completion screen). */
  playTime: number;
  deaths: number;
}

export function newRunId(): number {
  return Date.now();
}

export function defaultSave(): SaveData {
  return {
    version: 1,
    features: [],
    score: 0,
    introSeen: false,
    checkpoint: null,
    era: 0,
    cleared: false,
    run: newRunId(),
    disabled: [],
    playTime: 0,
    deaths: 0,
  };
}

export function loadSave(): SaveData {
  const store = storage();
  if (!store) return defaultSave();
  try {
    const raw = store.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (data.version !== 1) return defaultSave();
    return {
      version: 1,
      features: Array.isArray(data.features) ? data.features.filter(isFeatureId) : [],
      score: typeof data.score === 'number' && Number.isFinite(data.score) ? data.score : 0,
      introSeen: data.introSeen === true,
      checkpoint: isPoint(data.checkpoint) ? data.checkpoint : null,
      era: Number.isInteger(data.era) && (data.era as number) >= 0 ? (data.era as number) : 0,
      cleared: data.cleared === true,
      run:
        typeof data.run === 'number' && Number.isFinite(data.run) && data.run > 0
          ? data.run
          : newRunId(),
      disabled: Array.isArray(data.disabled) ? data.disabled.filter(isFeatureId) : [],
      playTime: count(data.playTime),
      deaths: Math.floor(count(data.deaths)),
    };
  } catch {
    return defaultSave();
  }
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function isPoint(value: unknown): value is { x: number; y: number } {
  if (typeof value !== 'object' || value === null) return false;
  const { x, y } = value as Record<string, unknown>;
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y);
}

export function writeSave(data: SaveData): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked: the game keeps running, progress just isn't persisted.
  }
}

export function clearSave(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // Ignore.
  }
}

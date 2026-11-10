import { readJson, writeJson } from './storage';

/**
 * HIGH SCORES (Era 1's secret): a top-ten table with three-letter initials. Each
 * playthrough ("run") gets one row, which goes up as your score does: a Game Over keeps
 * your score here, so entering it again would only fill the table with yourself.
 */
export interface ScoreEntry {
  initials: string;
  score: number;
  /** Which playthrough it was (the save's run id). 0 for the table's built-in scores. */
  run: number;
}

const KEY = 'stick2hero.scores.v1';
export const TABLE_SIZE = 10;
export const INITIALS_LENGTH = 3;
/** What initials can be made of, in the order up/down cycles through them. */
export const INITIAL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';

/** Arcade tables never start empty. These ones were set by the game's own cast. */
export const DEFAULT_SCORES: readonly ScoreEntry[] = [
  { initials: 'DEP', score: 90000, run: 0 },
  { initials: 'WRD', score: 60000, run: 0 },
  { initials: 'FLK', score: 40000, run: 0 },
  { initials: 'BLK', score: 25000, run: 0 },
  { initials: 'DEV', score: 20000, run: 0 },
  { initials: 'CPU', score: 15000, run: 0 },
  { initials: 'ACE', score: 10000, run: 0 },
  { initials: 'ZZZ', score: 7500, run: 0 },
  { initials: 'IDK', score: 5000, run: 0 },
  { initials: 'AAA', score: 2500, run: 0 },
];

function byScore(a: ScoreEntry, b: ScoreEntry): number {
  return b.score - a.score;
}

/** This run's row, if it has one. */
export function runEntry(table: readonly ScoreEntry[], run: number): ScoreEntry | undefined {
  return run > 0 ? table.find((e) => e.run === run) : undefined;
}

/** Would a new row with this score make the table? (Ties go below the existing score.) */
export function qualifies(table: readonly ScoreEntry[], score: number): boolean {
  if (score <= 0) return false;
  return table.length < TABLE_SIZE || score > table[table.length - 1].score;
}

/**
 * Put a run's score in the table: a new row, or its existing row raised (never lowered).
 * Returns the new table and the row's place (0-based), or -1 if it didn't make it.
 */
export function record(
  table: readonly ScoreEntry[],
  entry: ScoreEntry,
): { table: ScoreEntry[]; rank: number } {
  const existing = runEntry(table, entry.run);
  const row = existing ? { ...existing, score: Math.max(existing.score, entry.score) } : entry;
  // Stable: an equal score that was there first stays above.
  const next = [...table.filter((e) => e !== existing), row].sort(byScore).slice(0, TABLE_SIZE);
  return { table: next, rank: next.indexOf(row) };
}

function isEntry(value: unknown): value is ScoreEntry {
  if (typeof value !== 'object' || value === null) return false;
  const { initials, score, run } = value as Record<string, unknown>;
  return (
    typeof initials === 'string' &&
    initials.length === INITIALS_LENGTH &&
    [...initials].every((c) => INITIAL_CHARS.includes(c)) &&
    typeof score === 'number' &&
    Number.isFinite(score) &&
    score >= 0 &&
    typeof run === 'number' &&
    Number.isFinite(run)
  );
}

export function parseScores(value: unknown): ScoreEntry[] {
  if (!Array.isArray(value)) return [...DEFAULT_SCORES];
  const rows = value.filter(isEntry).sort(byScore).slice(0, TABLE_SIZE);
  return rows.length > 0 ? rows : [...DEFAULT_SCORES];
}

export function loadScores(): ScoreEntry[] {
  return parseScores(readJson(KEY));
}

export function writeScores(table: readonly ScoreEntry[]): void {
  writeJson(KEY, table);
}

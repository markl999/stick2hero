/**
 * CHEAT CODES (a secret): typed on the title screen. One code for now; the list is here so
 * more are easy to add.
 */
export const CHEATS = ['BIGHEAD'] as const;
export type Cheat = (typeof CHEATS)[number];

/** Keep only as much typing as the longest code needs. */
const MAX = Math.max(...CHEATS.map((c) => c.length));

/** Add typed letters; returns the new buffer and any code it just completed. */
export function typeCheat(
  buffer: string,
  typed: readonly string[],
): { buffer: string; cheat: Cheat | null } {
  let next = buffer;
  for (const ch of typed) {
    next = (next + ch).slice(-MAX);
    const cheat = CHEATS.find((c) => next.endsWith(c));
    if (cheat) return { buffer: '', cheat };
  }
  return { buffer: next, cheat: null };
}

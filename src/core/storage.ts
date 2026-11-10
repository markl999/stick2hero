/** localStorage, or null where it's missing or blocked (some privacy modes throw on access). */
export function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Read and parse a JSON value, or null if it's missing or unreadable. */
export function readJson(key: string): unknown {
  try {
    const raw = storage()?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the game keeps running, it just isn't remembered.
  }
}

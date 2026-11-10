/**
 * MICROTRANSACTIONS (a secret): a shop in the pause menu. Everything costs 0 coins, and
 * you have 0 coins. Satire, but the extra life and the hat are real.
 */
export const SHOP_ITEMS = [
  { id: 'life', name: 'EXTRA LIFE', blurb: 'ONE MORE GO. LIMITED TIME ONLY!' },
  { id: 'hat', name: 'MYSTERY HAT', blurb: 'A HAT. PROBABLY.' },
  { id: 'lootbox', name: 'LOOT BOX', blurb: 'COULD BE ANYTHING!' },
  { id: 'pass', name: 'SEASON PASS', blurb: 'ALL FUTURE CONTENT! (SEE BELOW)' },
  { id: 'coins', name: '1,000,000 COINS', blurb: 'BEST VALUE!' },
] as const;
export type ShopItemId = (typeof SHOP_ITEMS)[number]['id'];

export const MAX_LIVES = 9;

const LOOT = [
  "IT'S... A SMALLER LOOT BOX.",
  'YOU GOT: NOTHING. TRY AGAIN?',
  'A FEELING OF MILD REGRET.',
  'COMMON: ONE (1) PIXEL.',
  "LEGENDARY!!! (IT'S A ROCK.)",
];

export interface ShopState {
  /** Lives, or null if there aren't any yet (before LIVES). */
  lives: number | null;
  /** HATS: null if you haven't found them, else the hat you're wearing. */
  hat: number | null;
  hatCount: number;
  random: () => number;
}

/** Buy something (for 0 coins). What it says, and what changes. */
export function buy(
  id: ShopItemId,
  state: ShopState,
): { message: string; lives?: number; hat?: number } {
  switch (id) {
    case 'life':
      if (state.lives === null) return { message: "YOU DON'T HAVE LIVES YET. NO REFUNDS." };
      if (state.lives >= MAX_LIVES) return { message: 'LIVES ARE FULL. CHARGED ANYWAY: 0 COINS.' };
      return { message: 'PURCHASE COMPLETE: +1 LIFE!', lives: state.lives + 1 };
    case 'hat': {
      if (state.hat === null) return { message: "YOU NEED HATS FIRST. (THEY'RE FREE TOO.)" };
      const shift = 1 + Math.floor(state.random() * (state.hatCount - 1));
      return { message: 'MYSTERY HAT UNLOCKED!', hat: (state.hat + shift) % state.hatCount };
    }
    case 'lootbox':
      return { message: LOOT[Math.floor(state.random() * LOOT.length)] };
    case 'pass':
      return { message: 'THANK YOU! (THERE IS NO FUTURE CONTENT.)' };
    case 'coins':
      return { message: 'YOU NOW HAVE 0 COINS. PRICES HAVE GONE UP TO 0.' };
  }
}

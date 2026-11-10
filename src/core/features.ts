/**
 * The feature registry: the single source of truth for what the game currently "has".
 * Every system (renderer, audio, input, physics, HUD, level logic) asks `features.has(id)`;
 * nothing else decides whether a feature is active.
 */

export type Era = 0 | 1 | 2 | 3 | 4 | 5;

export const FEATURE_IDS = [
  'LEFT',
  'JUMP',
  'BEEP',
  'SCREEN_2',
  'ARMS',
  'SCORE',
  'FRAME_RATE',
  // Era 1 — ARCADE
  'ENEMIES',
  'DEATH',
  'LIVES',
  'PUNCH',
  'SFX',
  'TITLE_SCREEN',
  // Era 2 — 8-BIT
  'COLOUR_4',
  'SCROLLING',
  'ANIMATION',
  'MUSIC',
  'HANDS_FEET',
  'THROW',
  'CHECKPOINTS',
  'COLOUR_16',
] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];

export interface FeatureDef {
  id: FeatureId;
  /** What's printed on the pickup and in the unlock banner. */
  label: string;
  era: Era;
  description: string;
  /** Second line of the unlock banner: a nudge on how to use it, or a joke. */
  hint: string;
}

export const FEATURES: Record<FeatureId, FeatureDef> = {
  LEFT: { id: 'LEFT', label: '< LEFT', era: 0, description: 'Walk left.', hint: 'THE OTHER WAY' },
  JUMP: { id: 'JUMP', label: 'JUMP', era: 0, description: 'Jump.', hint: 'PRESS SPACE' },
  BEEP: {
    id: 'BEEP',
    label: 'BEEP',
    era: 0,
    description: 'A single beep when you jump.',
    hint: 'TRY JUMPING',
  },
  SCREEN_2: {
    id: 'SCREEN_2',
    label: 'SCREEN 2',
    era: 0,
    description: 'Flip-screen: walk off the edge to the next screen.',
    hint: 'THE WORLD GOT BIGGER',
  },
  ARMS: {
    id: 'ARMS',
    label: 'ARMS',
    era: 0,
    description: 'Arms. Grab ledges and climb.',
    hint: 'JUMP AT A WALL AND HOLD ON',
  },
  SCORE: {
    id: 'SCORE',
    label: 'SCORE',
    era: 0,
    description: 'A score HUD.',
    hint: 'WE WERE KEEPING SCORE',
  },
  FRAME_RATE: {
    id: 'FRAME_RATE',
    label: 'FRAME RATE',
    era: 0,
    description: '15fps becomes smooth 60fps.',
    hint: 'SMOOOOOOTH',
  },
  ENEMIES: {
    id: 'ENEMIES',
    label: 'ENEMIES',
    era: 1,
    description: 'Enemies appear. Harmless until DEATH exists.',
    hint: 'WHY WOULD YOU DO THAT',
  },
  DEATH: {
    id: 'DEATH',
    label: 'DEATH',
    era: 1,
    description: 'Enemies and spikes can now kill you.',
    hint: 'OH NO',
  },
  LIVES: {
    id: 'LIVES',
    label: 'LIVES',
    era: 1,
    description: 'Three lives and a Game Over screen.',
    hint: 'YOU HAVE 3. PHEW',
  },
  PUNCH: {
    id: 'PUNCH',
    label: 'PUNCH',
    era: 1,
    description: 'Your arms become a weapon.',
    hint: 'PRESS X OR J',
  },
  SFX: {
    id: 'SFX',
    label: 'SFX',
    era: 1,
    description: 'Sounds for everything, not just jumping.',
    hint: 'BLIP BLOOP',
  },
  TITLE_SCREEN: {
    id: 'TITLE_SCREEN',
    label: 'TITLE SCREEN',
    era: 1,
    description: 'The game gets a title screen.',
    hint: 'EVERY GAME NEEDS ONE',
  },
  COLOUR_4: {
    id: 'COLOUR_4',
    label: 'COLOUR (4)',
    era: 2,
    description: 'The first 4-colour palette. Red means danger.',
    hint: 'RED MEANS DANGER',
  },
  SCROLLING: {
    id: 'SCROLLING',
    label: 'SCROLLING',
    era: 2,
    description: 'Smooth scrolling replaces flip-screen.',
    hint: 'NO MORE SCREEN FLIPS',
  },
  ANIMATION: {
    id: 'ANIMATION',
    label: 'ANIMATION',
    era: 2,
    description: 'A walk cycle, a jump pose and a landing squash.',
    hint: 'NO MORE SLIDING',
  },
  MUSIC: {
    id: 'MUSIC',
    label: 'MUSIC',
    era: 2,
    description: 'A 3-channel chiptune.',
    hint: 'FINALLY',
  },
  HANDS_FEET: {
    id: 'HANDS_FEET',
    label: 'HANDS & FEET',
    era: 2,
    description: 'Wall slide and wall jump.',
    hint: 'JUMP OFF WALLS',
  },
  THROW: {
    id: 'THROW',
    label: 'THROW',
    era: 2,
    description: 'Throw pebbles at enemies and switches. Hold up to throw upwards.',
    hint: 'C OR K. HOLD UP TO AIM UP',
  },
  CHECKPOINTS: {
    id: 'CHECKPOINTS',
    label: 'CHECKPOINTS',
    era: 2,
    description: 'Flags save your progress.',
    hint: 'TOUCH THE FLAGS',
  },
  COLOUR_16: {
    id: 'COLOUR_16',
    label: 'COLOUR (16)',
    era: 2,
    description: 'The full 16-colour palette. Awarded for beating Flicker.',
    hint: 'ALL SIXTEEN OF THEM',
  },
};

/** Era display names, for transitions and the title screen. */
export const ERA_NAMES: Record<Era, string> = {
  0: 'BOOT',
  1: 'ARCADE',
  2: '8-BIT',
  3: '16-BIT',
  4: '32-BIT',
  5: 'MODERN',
};

export function isFeatureId(value: unknown): value is FeatureId {
  return typeof value === 'string' && (FEATURE_IDS as readonly string[]).includes(value);
}

export type FeatureListener = (id: FeatureId, active: boolean) => void;

export class FeatureRegistry {
  private readonly active = new Set<FeatureId>();
  private readonly listeners = new Set<FeatureListener>();

  constructor(initial: Iterable<unknown> = []) {
    for (const id of initial) if (isFeatureId(id)) this.active.add(id);
  }

  has(id: FeatureId): boolean {
    return this.active.has(id);
  }

  /** Returns true if the feature was newly unlocked. */
  unlock(id: FeatureId): boolean {
    if (this.active.has(id)) return false;
    this.active.add(id);
    this.emit(id, true);
    return true;
  }

  /** Used by the debug overlay, the post-game Feature Menu and the Deprecator. */
  lock(id: FeatureId): boolean {
    if (!this.active.delete(id)) return false;
    this.emit(id, false);
    return true;
  }

  set(id: FeatureId, active: boolean): boolean {
    return active ? this.unlock(id) : this.lock(id);
  }

  /** Active features in canonical (progression) order. */
  list(): FeatureId[] {
    return FEATURE_IDS.filter((id) => this.active.has(id));
  }

  onChange(listener: FeatureListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(id: FeatureId, active: boolean): void {
    for (const listener of this.listeners) listener(id, active);
  }
}

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
  'HIGH_SCORES',
  // Era 2 — 8-BIT
  'COLOUR_4',
  'SCROLLING',
  'ANIMATION',
  'MUSIC',
  'HANDS_FEET',
  'THROW',
  'CHECKPOINTS',
  'COLOUR_16',
  'CHEAT_CODES',
  // Era 3 — 16-BIT
  'PARALLAX',
  'SAMPLES_STEREO',
  'FACE',
  'NPCS',
  'OUTFIT',
  'SWORD',
  'DASH',
  'SAVE_GAME',
  'TUTORIAL',
  'CRT_SCANLINES',
  // Era 4 — 32-BIT
  'TRANSPARENCY',
  'PARTICLES',
  'LIGHTING',
  'CAMERA',
  'CD_AUDIO',
  'VOICE',
  'DEPTH',
  'CUTSCENE',
  'WILHELM_SCREAM',
  'HATS',
  // Era 5 — MODERN
  'HD',
  'DYNAMIC_SHADOWS',
  'PHYSICS',
  'CAPE',
  'BLOOM',
  'ADAPTIVE_MUSIC',
  'RUMBLE',
  'ACHIEVEMENTS',
  'PHOTO_MODE',
  'LENS_FLARE',
  'MICROTRANSACTIONS',
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
  /** An optional extra hidden off the main path (PRD section 7). The finale leaves these be. */
  secret?: boolean;
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
  HIGH_SCORES: {
    id: 'HIGH_SCORES',
    label: 'HIGH SCORES',
    era: 1,
    description: 'A high-score table with three-letter initials.',
    hint: 'SECRET! YOUR NAME IN LIGHTS',
    secret: true,
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
  PARALLAX: {
    id: 'PARALLAX',
    label: 'PARALLAX',
    era: 3,
    description: 'Layered, scrolling backgrounds with 256-colour gradients.',
    hint: 'AND 256 COLOURS',
  },
  SAMPLES_STEREO: {
    id: 'SAMPLES_STEREO',
    label: 'SAMPLES + STEREO',
    era: 3,
    description: 'Sampled sound effects, panned left and right. Hear enemies off-screen.',
    hint: 'LISTEN FOR FOOTSTEPS',
  },
  FACE: {
    id: 'FACE',
    label: 'FACE',
    era: 3,
    description: 'Eyes and expressions. He looks worried near danger.',
    hint: 'HE CAN SEE NOW',
  },
  NPCS: {
    id: 'NPCS',
    label: 'NPCS + DIALOGUE',
    era: 3,
    description: 'Other characters to talk to.',
    hint: 'PRESS UP TO TALK',
  },
  OUTFIT: {
    id: 'OUTFIT',
    label: 'OUTFIT',
    era: 3,
    description: 'A tunic. The first sign of the hero look.',
    hint: 'LOOKING SHARP',
  },
  SWORD: {
    id: 'SWORD',
    label: 'SWORD',
    era: 3,
    description: 'A sword with a 3-hit combo. Replaces the punch.',
    hint: 'X OR J. TAP FOR A COMBO',
  },
  DASH: {
    id: 'DASH',
    label: 'DASH',
    era: 3,
    description: 'A quick burst through gaps and enemies.',
    hint: 'SHIFT OR L',
  },
  SAVE_GAME: {
    id: 'SAVE_GAME',
    label: 'SAVE GAME',
    era: 3,
    description: 'The game can now save! (It always could.)',
    hint: 'IT ALWAYS COULD. SHH',
  },
  TRANSPARENCY: {
    id: 'TRANSPARENCY',
    label: 'TRANSPARENCY',
    era: 4,
    description: 'Alpha blending: water, ghosts and walls you can see through.',
    hint: 'THAT WALL LOOKS THIN',
  },
  PARTICLES: {
    id: 'PARTICLES',
    label: 'PARTICLES',
    era: 4,
    description: 'Dust, sparks, splashes and debris.',
    hint: 'SO MANY PARTICLES',
  },
  LIGHTING: {
    id: 'LIGHTING',
    label: 'LIGHTING',
    era: 4,
    description: 'Real lights, so real darkness. Light the braziers.',
    hint: 'TOUCH BRAZIERS TO LIGHT THEM',
  },
  CAMERA: {
    id: 'CAMERA',
    label: 'CAMERA',
    era: 4,
    description: 'A camera that looks ahead and shakes on impact.',
    hint: 'CINEMATIC',
  },
  CD_AUDIO: {
    id: 'CD_AUDIO',
    label: 'CD AUDIO',
    era: 4,
    description: 'A full soundtrack instead of the chiptune.',
    hint: 'CD QUALITY',
  },
  VOICE: {
    id: 'VOICE',
    label: 'VOICE',
    era: 4,
    description: 'Grunts, shouts and characters who talk out loud.',
    hint: 'HUP! HAH!',
  },
  DEPTH: {
    id: 'DEPTH',
    label: 'DEPTH',
    era: 4,
    description: 'Pseudo-3D backgrounds and foreground layers.',
    hint: 'TWO AND A HALF D',
  },
  CUTSCENE: {
    id: 'CUTSCENE',
    label: 'CUTSCENE',
    era: 4,
    description: 'An in-engine cinematic.',
    hint: 'GRAB SOME POPCORN',
  },
  HD: {
    id: 'HD',
    label: 'HD',
    era: 5,
    description: 'Native resolution: crisp, anti-aliased vector graphics.',
    hint: 'ENHANCE',
  },
  DYNAMIC_SHADOWS: {
    id: 'DYNAMIC_SHADOWS',
    label: 'DYNAMIC SHADOWS',
    era: 5,
    description: 'Lights cast real shadows. Drones cannot see you in the dark.',
    hint: 'STAY IN THE DARK',
  },
  PHYSICS: {
    id: 'PHYSICS',
    label: 'PHYSICS',
    era: 5,
    description: 'Destructible scenery: smash cracked walls and cut down lamps.',
    hint: 'HIT THE CRACKED WALL',
  },
  CAPE: {
    id: 'CAPE',
    label: 'CAPE',
    era: 5,
    description: 'The last body part. Hold jump in the air to glide. Vents lift you.',
    hint: 'HOLD JUMP TO GLIDE',
  },
  BLOOM: {
    id: 'BLOOM',
    label: 'BLOOM / POST-FX',
    era: 5,
    description: 'Glow, chromatic aberration, vignette and film grain. Far too much of it.',
    hint: 'IS IT TOO MUCH? YES',
  },
  ADAPTIVE_MUSIC: {
    id: 'ADAPTIVE_MUSIC',
    label: 'ADAPTIVE MUSIC',
    era: 5,
    description: 'The soundtrack builds up when there is danger.',
    hint: 'IT KNOWS WHEN YOU FIGHT',
  },
  RUMBLE: {
    id: 'RUMBLE',
    label: 'RUMBLE',
    era: 5,
    description: 'Gamepad haptics. Keyboard players get the next best thing.',
    hint: 'FEEL EVERYTHING',
  },
  ACHIEVEMENTS: {
    id: 'ACHIEVEMENTS',
    label: 'ACHIEVEMENTS',
    era: 5,
    description: 'Achievements, including forty for things you have already done.',
    hint: 'YOU ARE DOING GREAT',
  },
  PHOTO_MODE: {
    id: 'PHOTO_MODE',
    label: 'PHOTO MODE',
    era: 5,
    description: 'Freeze the game, frame a shot, pick a filter and save it as a PNG.',
    hint: 'PRESS P',
  }, // --- Secrets (PRD section 7): optional extras, hidden off the main path ---
  CHEAT_CODES: {
    id: 'CHEAT_CODES',
    label: 'CHEAT CODES',
    era: 2,
    description: 'Type a code on the title screen. Try BIGHEAD.',
    hint: 'TYPE BIGHEAD ON THE TITLE SCREEN',
    secret: true,
  },
  TUTORIAL: {
    id: 'TUTORIAL',
    label: 'TUTORIAL',
    era: 3,
    description: 'Helpful tips for things you can already do.',
    hint: 'PRESS JUMP TO JUMP!',
    secret: true,
  },
  CRT_SCANLINES: {
    id: 'CRT_SCANLINES',
    label: 'CRT SCANLINES',
    era: 3,
    description: 'An old telly: scanlines, a curved screen, dark corners.',
    hint: 'SWITCH IT OFF IN PAUSE: EXTRAS',
    secret: true,
  },
  WILHELM_SCREAM: {
    id: 'WILHELM_SCREAM',
    label: 'WILHELM SCREAM',
    era: 4,
    description: 'Enemies sometimes scream as they go. A famous-sounding scream.',
    hint: 'AAAAAAAAAH!',
    secret: true,
  },
  HATS: {
    id: 'HATS',
    label: 'HATS',
    era: 4,
    description: 'Hats. Several of them. Pick one in pause: extras.',
    hint: 'PICK ONE IN PAUSE: EXTRAS',
    secret: true,
  },
  LENS_FLARE: {
    id: 'LENS_FLARE',
    label: 'LENS FLARE',
    era: 5,
    description: 'Every light flares. Cinematic.',
    hint: 'SO CINEMATIC',
    secret: true,
  },
  MICROTRANSACTIONS: {
    id: 'MICROTRANSACTIONS',
    label: 'MICROTRANSACTIONS',
    era: 5,
    description: 'A shop opens. Everything costs 0.',
    hint: 'THE SHOP IS OPEN (PAUSE MENU)',
    secret: true,
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

/**
 * Is anything from this era on (secrets aside)? Era 5's look follows its features, and an
 * era's look comes with its features: with nothing from Era 1 on (the Feature Menu can do
 * that), it's still Era 0's white void.
 */
export function hasEraFeature(features: FeatureRegistry, era: Era): boolean {
  return FEATURE_IDS.some(
    (id) => FEATURES[id].era === era && !FEATURES[id].secret && features.has(id),
  );
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

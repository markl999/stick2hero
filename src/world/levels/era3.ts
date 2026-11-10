import type { LevelDef } from '../tilemap';
import { composeScreens } from './compose';

/*
 * Era 3 — 16-BIT. Nine screens of scrolling adventure: exploration, people to talk to,
 * and sword fights.
 *
 *   [A parallax] [B stereo] [C face] [D npcs] [E outfit] [F sword] [G dash] [H save] [I boss]
 *
 * - A: PARALLAX first: the flat sky splits into layers.
 * - B: SAMPLES + STEREO. A walker ahead: with stereo you hear it before you see it.
 * - C: FACE, then a little hill.
 * - D: NPCS + DIALOGUE, then the first character: a placeholder that was never finished.
 * - E: The "TODO" wizard, then OUTFIT.
 * - F: SWORD, then two knights, far enough apart to fight one at a time (punches clank
 *   off their armour).
 * - G: DASH, then a 4-tile spike pit (too wide to jump; jump and dash), then a knight.
 * - H: SAVE GAME (it always could), an elder with a warning, a flag.
 * - I: The Warden. Slash its fists while they're stuck in the floor, then its head.
 */

// prettier-ignore
const A_PARALLAX = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..........###...',
  '..P.1...........',
  '################',
];

// prettier-ignore
const B_STEREO = [
  '................',
  '................',
  '................',
  '................',
  '.....####.......',
  '................',
  '................',
  '.2.........e....',
  '################',
];

// prettier-ignore
const C_FACE = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.........##.....',
  '........####....',
  '..3.............',
  '################',
];

// prettier-ignore
const D_NPCS = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.4.....N........',
  '################',
];

// prettier-ignore
const E_OUTFIT = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......###......',
  '................',
  '..M.......5.....',
  '################',
];

// prettier-ignore
const F_SWORD = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.6....k.......k.',
  '################',
];

// prettier-ignore
const G_DASH = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.7...........k..',
  '#####^^^^#######',
];

// prettier-ignore
const H_SAVE = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.8....O....F....',
  '################',
];

// prettier-ignore
const I_BOSS = [
  '...............#',
  '...............#',
  '...............#',
  '...............#',
  '...............#',
  '...............#',
  '...............#',
  '........W......#',
  '################',
];

export const ERA3_LEVEL: LevelDef = {
  name: 'era3-16bit',
  era: 3,
  rows: composeScreens([
    [A_PARALLAX, B_STEREO, C_FACE, D_NPCS, E_OUTFIT, F_SWORD, G_DASH, H_SAVE, I_BOSS],
  ]),
  pickups: {
    '1': 'PARALLAX',
    '2': 'SAMPLES_STEREO',
    '3': 'FACE',
    '4': 'NPCS',
    '5': 'OUTFIT',
    '6': 'SWORD',
    '7': 'DASH',
    '8': 'SAVE_GAME',
  },
  npcs: {
    // A placeholder who was never finished.
    N: [
      'OH! A PLAYER! NOBODY HAS COME THIS WAY IN YEARS.',
      "I'M A PLACEHOLDER. MY SPRITE WAS NEVER FINISHED. AS YOU CAN SEE.",
      'THE DEVELOPER WALKED AWAY. THE WHOLE GAME WAS SHELVED, HALF BUILT.',
      "BUT LOOK AT YOU. YOU'RE PUTTING IT BACK TOGETHER.",
    ],
    // A wizard who was only ever a TODO.
    M: [
      'TODO: WRITE DIALOGUE FOR THE WIZARD.',
      "...SORRY. THAT'S ALL I WAS GIVEN.",
      'BUT I HEARD SOMETHING CUT THE FEATURES OUT, ONE BY ONE. THEY CALL IT THE DEPRECATOR.',
      'TAKE THAT TUNIC UP AHEAD. A HERO SHOULD LOOK THE PART.',
    ],
    // An elder at the gate.
    O: [
      'THE WARDEN GUARDS THE ROAD TO THE 32-BIT LANDS.',
      "IT'S ALL FISTS. STRIKE THEM WHEN THEY'RE STUCK IN THE GROUND.",
      "AND IF YOU EVER MEET THE DEPRECATOR... DON'T LET IT TAKE YOUR COLOURS.",
    ],
  },
};

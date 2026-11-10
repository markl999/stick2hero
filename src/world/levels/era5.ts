import type { LevelDef } from '../tilemap';
import { composeScreens } from './compose';

/*
 * Era 5 — MODERN. Rooftops in a rainy neon city at night. Thirteen screens, built around
 * DYNAMIC SHADOWS, PHYSICS and the CAPE; the rest arrive quickly, as comedy. Then the
 * Deprecator, on the highest roof.
 *
 *   [A hd] [B shadows] [C cover] [D physics] [E lamp] [F bloom] [G cape] [H vents]
 *   [I fight] [J rumble + achievements] [K photo] [L approach] [M the Deprecator]
 *
 * - A: still in 32-bit pixels, until HD.
 * - B: DYNAMIC SHADOWS. A corridor under a roof slab with a lamp on top: without shadows
 *   the light shines straight through the slab and the drone inside sees you. With them,
 *   the corridor is dark.
 * - C: a turning drone over a lit yard. Wait in the shadow behind the low wall until it
 *   looks the other way, then run.
 * - D: PHYSICS. A wall to the sky with a cracked doorway: smash it.
 * - E: a hanging lamp lights the drone's patch. Cut it down (jump and slash) to go dark.
 * - F: BLOOM / POST-FX. Far too much of it.
 * - G: CAPE at the edge of a roof, then a gap too wide to jump: glide.
 * - H: a vent's updraft lifts you up the side of a tower. ADAPTIVE MUSIC on top.
 * - I: glide down into two security robots: the music builds.
 * - J: RUMBLE, a cracked wall to feel, and ACHIEVEMENTS (forty of them).
 * - K: PHOTO MODE at the best view in town, and an old friend.
 * - L: a checkpoint, then the way up.
 * - M: the Deprecator.
 */

// prettier-ignore
const A_HD = [
  '................',
  '................',
  '................',
  '................',
  '............0...',
  '...........###..',
  '................',
  '..P....1........',
  '################',
];

// prettier-ignore
const B_SHADOWS = [
  '................',
  '................',
  '................',
  '..........l.....',
  '....############',
  '................',
  '...............<',
  '..2.............',
  '################',
];

// prettier-ignore
const C_COVER = [
  '................',
  '................',
  '................',
  '................',
  '..............*.',
  '................',
  '.....##.........',
  '.....##..l......',
  '################',
];

// prettier-ignore
const D_PHYSICS = [
  '........#.......',
  '........#.......',
  '........#.......',
  '........#.......',
  '........#.......',
  '........%.......',
  '........%.......',
  '..3.....%.......',
  '################',
];

// prettier-ignore
const E_LAMP = [
  '................',
  '................',
  '................',
  '................',
  '....L...........',
  '...............<',
  '................',
  '................',
  '################',
];

// prettier-ignore
const F_BLOOM = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..........####..',
  '..4......#####..',
  '################',
];

// prettier-ignore
const G_CAPE = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '...5....l.......',
  '##########......',
];

// prettier-ignore
const H_VENTS = [
  '................',
  '.............6..',
  '..........######',
  '..........######',
  '..........######',
  '..........######',
  '..........######',
  '.........u######',
  '################',
];

// prettier-ignore
const I_FIGHT = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.........k....k.',
  '################',
];

// prettier-ignore
const J_RUMBLE = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......%........',
  '.......%........',
  '..7....%.....8..',
  '################',
];

// prettier-ignore
const K_PHOTO = [
  '................',
  '................',
  '................',
  '................',
  '.............a..',
  '............###.',
  '................',
  '..N....9...l....',
  '################',
];

// prettier-ignore
const L_APPROACH = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '..........######',
  '.......###......',
  '..F.###.........',
  '################',
];

// prettier-ignore
const M_ARENA = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '........R.......',
  '################',
];

export const ERA5_LEVEL: LevelDef = {
  name: 'era5-modern',
  era: 5,
  rows: composeScreens([
    [
      A_HD,
      B_SHADOWS,
      C_COVER,
      D_PHYSICS,
      E_LAMP,
      F_BLOOM,
      G_CAPE,
      H_VENTS,
      I_FIGHT,
      J_RUMBLE,
      K_PHOTO,
      L_APPROACH,
      M_ARENA,
    ],
  ]),
  pickups: {
    '1': 'HD',
    '2': 'DYNAMIC_SHADOWS',
    '3': 'PHYSICS',
    '4': 'BLOOM',
    '5': 'CAPE',
    '6': 'ADAPTIVE_MUSIC',
    '7': 'RUMBLE',
    '8': 'ACHIEVEMENTS',
    '9': 'PHOTO_MODE',
    '0': 'LENS_FLARE',
    a: 'MICROTRANSACTIONS',
  },
  npcs: {
    N: [
      'OH, HELLO AGAIN. THEY GAVE EVERYONE HD TEXTURES. EXCEPT ME.',
      'THE DEPRECATOR IS ON THE ROOF. IT WANTS TO ROLL THE WHOLE GAME BACK TO THE PROTOTYPE.',
      'IT WILL TAKE YOUR FEATURES ONE BY ONE. KNOCK THEM LOOSE AND GRAB THEM BACK.',
      'YOU WERE ONLY EVER A PLACEHOLDER. SO WAS I. GO AND BE A HERO ANYWAY.',
    ],
  },
};

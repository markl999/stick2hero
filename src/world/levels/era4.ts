import type { LevelDef } from '../tilemap';
import { composeScreens } from './compose';

/*
 * Era 4 — 32-BIT. A ruined temple at night. Eleven screens: eight of atmosphere and
 * set pieces, then the Chase.
 *
 *   [A transp] [B particles] [C lighting] [D camera] [E cd] [F voice] [G depth] [H cutscene]
 *   [I chase] [J chase] [K chase → exit]
 *
 * - A: TRANSPARENCY in front of what looks like a dead end. The wall is hollow.
 * - B: PARTICLES, then a pool between two low walls: swim across (jump strokes upward).
 * - C: LIGHTING: everything goes dark. Light the braziers (they're checkpoints too) to see
 *   the spikes between them.
 * - D: CAMERA (look-ahead, shake), ghosts and a knight.
 * - E: CD AUDIO in a big hall with steps.
 * - F: VOICE, and someone who finally has one.
 * - G: DEPTH, then a spike pit and a knight.
 * - H: CUTSCENE, under a low ceiling so you can't hop over it. The Deprecator appears and
 *   starts the Chase. (Passing the 'C' mark also starts it, just in case.)
 * - I–K: Outrun the deletion wave (torches light the hazards): spike pits, steps, then a run-up to a 4-tile pit
 *   (jump + dash), then the exit.
 */

// prettier-ignore
const A_TRANSPARENCY = [
  '............hh..',
  '............hh..',
  '............hh..',
  '............hh..',
  '............hh..',
  '............hh..',
  '............hh..',
  '..P...1..t..hh..',
  '################',
];

// prettier-ignore
const B_PARTICLES = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '......wwwwww....',
  '..2..#wwwwww#.t.',
  '################',
];

// prettier-ignore
const C_LIGHTING = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..3...b..^^..b..',
  '################',
];

// prettier-ignore
const D_CAMERA = [
  '................',
  '................',
  '................',
  '................',
  '.........g......',
  '................',
  '................',
  '..4...t...k...g.',
  '################',
];

// prettier-ignore
const E_CD = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '..........##....',
  '.........####...',
  '...5..b.######..',
  '################',
];

// prettier-ignore
const F_VOICE = [
  '................',
  '................',
  '................',
  '..............g.',
  '................',
  '................',
  '................',
  '..6.....Q...b...',
  '################',
];

// prettier-ignore
const G_DEPTH = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......###......',
  '................',
  '..7..........k..',
  '#####^^#########',
];

// prettier-ignore
const H_CUTSCENE = [
  '...#######......',
  '...#######......',
  '...#######......',
  '...#######......',
  '...#######......',
  '...#######......',
  '................',
  '.F....8.....C...',
  '################',
];

// prettier-ignore
const I_CHASE = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '...t....t.##....',
  '####^^##########',
];

// prettier-ignore
const J_CHASE = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '...###..........',
  '..####..t......t',
  '##########^^^^##',
];

// prettier-ignore
const K_EXIT = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '....t...Z.....X.',
  '################',
];

export const ERA4_LEVEL: LevelDef = {
  name: 'era4-32bit',
  era: 4,
  rows: composeScreens([
    [
      A_TRANSPARENCY,
      B_PARTICLES,
      C_LIGHTING,
      D_CAMERA,
      E_CD,
      F_VOICE,
      G_DEPTH,
      H_CUTSCENE,
      I_CHASE,
      J_CHASE,
      K_EXIT,
    ],
  ]),
  pickups: {
    '1': 'TRANSPARENCY',
    '2': 'PARTICLES',
    '3': 'LIGHTING',
    '4': 'CAMERA',
    '5': 'CD_AUDIO',
    '6': 'VOICE',
    '7': 'DEPTH',
    '8': 'CUTSCENE',
  },
  npcs: {
    Q: [
      'CAN YOU HEAR ME? I FINALLY HAVE A VOICE!',
      'THE DEPRECATOR CAME THROUGH HERE. IT TOOK THE LIGHT AND LEFT THE GHOSTS.',
      'KEEP THE BRAZIERS BURNING. AND IF THE WORLD STARTS TO TEAR... RUN.',
    ],
  },
};

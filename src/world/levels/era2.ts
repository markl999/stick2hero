import type { LevelDef } from '../tilemap';
import { composeScreens } from './compose';

/*
 * Era 2 — 8-BIT. Eight screens in a row. Flip-screen until SCROLLING (the second pickup),
 * then one long scrolling level.
 *
 *   [A colour] [B anim] [C music] [D wall-jump] [E throw] [F checkpoints] [G gauntlet] [H boss]
 *
 * - A: COLOUR (4) first. Then two hot bricks in the floor: red now, but in monochrome
 *   they'd look exactly like normal bricks. Then SCROLLING at the screen edge.
 * - B: ANIMATION, then a wide step (a full jump lands on it rather than overshooting into
 *   the hot floor), then two floating platforms over the hot floor.
 * - C: Quiet. A long, calm walk up some steps to MUSIC on a plinth.
 * - D: HANDS & FEET, then a shaft. The block on the right is 4 tiles high (too high to
 *   climb with ARMS), so you wall-jump between it and the pillar on the left.
 * - E: THROW. A 4-tile door blocks the way; the switch floating above opens it (throw
 *   up from underneath it, or arc a pebble into it).
 * - F: CHECKPOINTS, then spikes, a flag, hot bricks and a walker.
 * - G: A flag, then spike pits with a walker between them. Pebbles help.
 * - H: Drop into Flicker's arena. Throw up at it while it hovers; avoid its bombs.
 */

// prettier-ignore
const A_COLOUR = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..P..1.........2',
  '#########~~#####',
];

// prettier-ignore
const B_ANIMATION = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......###..###.',
  '................',
  '.3.###..........',
  '######~~~~~~~~~#',
];

// prettier-ignore
const C_MUSIC = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '..............4.',
  '............####',
  '.........#######',
  '################',
];

// prettier-ignore
const D_WALLJUMP = [
  '................',
  '......#.........',
  '......#.........',
  '......#.........',
  '......#..#######',
  '......#..#######',
  '.........#######',
  '..5......#######',
  '################',
];

// prettier-ignore
const E_THROW = [
  '..........D.....',
  '.......s..D.....',
  '..........D.....',
  '..6.......D..e..',
  '################',
  '################',
  '################',
  '################',
  '################',
];

// prettier-ignore
const F_CHECKPOINTS = [
  '................',
  '................',
  '................',
  '.7..F.......e...',
  '######^^##~~####',
  '################',
  '################',
  '################',
  '################',
];

// prettier-ignore
const G_GAUNTLET = [
  '................',
  '................',
  '................',
  '.F.....e.....e..',
  '####^^####^^####',
  '################',
  '################',
  '################',
  '################',
];

// prettier-ignore
const H_BOSS = [
  '...............#',
  '...............#',
  '........V......#',
  '...............#',
  '...............#',
  '...............#',
  '...............#',
  '...............#',
  '################',
];

export const ERA2_LEVEL: LevelDef = {
  name: 'era2-8bit',
  era: 2,
  rows: composeScreens([
    [A_COLOUR, B_ANIMATION, C_MUSIC, D_WALLJUMP, E_THROW, F_CHECKPOINTS, G_GAUNTLET, H_BOSS],
  ]),
  pickups: {
    '1': 'COLOUR_4',
    '2': 'SCROLLING',
    '3': 'ANIMATION',
    '4': 'MUSIC',
    '5': 'HANDS_FEET',
    '6': 'THROW',
    '7': 'CHECKPOINTS',
  },
};

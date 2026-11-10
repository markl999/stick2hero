import type { LevelDef } from '../tilemap';
import { composeScreens } from './compose';

/*
 * Era 1 — ARCADE. Six flip-screens in a row. Survival and combat on single screens.
 *
 *   [A enemies] [B death] [C lives] [D punch] [E sfx+title] [F boss]
 *
 * Each screen starts with a 1-tile bump on its left edge, so walkers stay on their own
 * screen (they turn at walls). The player just hops over it.
 *
 * - A: ENEMIES. A walker appears, and it's harmless.
 * - B: DEATH. Now the walker and a 2-tile spike pit are deadly.
 * - C: LIVES, then two walkers to jump. The secret HIGH SCORES sits on the ledge above
 *   (3 tiles up, so it takes ARMS: optional, and off the path).
 * - D: PUNCH, then a 2-tile-high corridor where walkers can't be jumped (they're 14
 *   tall, and the corridor leaves only 12 units of jump), so you have to punch.
 * - E: SFX, then TITLE SCREEN (boots you to the title screen and back). Last checkpoint.
 * - F: The Block. Dodge its hops, punch it while it's dazed.
 */

// prettier-ignore
const A_ENEMIES = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..P...1.....e...',
  '################',
];

// prettier-ignore
const B_DEATH = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '#..2...^^...e...',
  '################',
];

// prettier-ignore
const C_LIVES = [
  '................',
  '................',
  '................',
  '................',
  '.......7........',
  '.....####.......',
  '................',
  '#..3....e....e..',
  '################',
];

// prettier-ignore
const D_PUNCH = [
  '................',
  '................',
  '................',
  '................',
  '......##########',
  '......##########',
  '................',
  '#.4.......e..e..',
  '################',
];

// prettier-ignore
const E_SFX_TITLE = [
  '................',
  '................',
  '................',
  '................',
  '###.............',
  '###.............',
  '................',
  '....#5...e...6..',
  '################',
];

// prettier-ignore
const F_BOSS = [
  '...............#',
  '...............#',
  '...............#',
  '...............#',
  '...............#',
  '...............#',
  '...............#',
  '#..........B...#',
  '################',
];

export const ERA1_LEVEL: LevelDef = {
  name: 'era1-arcade',
  era: 1,
  rows: composeScreens([[A_ENEMIES, B_DEATH, C_LIVES, D_PUNCH, E_SFX_TITLE, F_BOSS]]),
  pickups: {
    '1': 'ENEMIES',
    '2': 'DEATH',
    '3': 'LIVES',
    '4': 'PUNCH',
    '5': 'SFX',
    '6': 'TITLE_SCREEN',
    '7': 'HIGH_SCORES',
  },
};

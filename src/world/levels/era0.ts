import type { LevelDef } from '../tilemap';
import { composeScreens, SOLID_SCREEN } from './compose';

/*
 * Era 0 — BOOT. A 4×2 grid of flip-screens.
 *
 * Movement rules this layout relies on (see player.ts):
 *   - a 1–2 tile rise can be jumped
 *   - a 3-tile rise needs ARMS (jump, hold towards the wall, catch the ledge, press jump)
 *   - 4+ tiles can't be climbed at all
 *
 *   [A start] [B arms ] [C drop ] [F summit]
 *   [ rock  ] [ rock  ] [D score] [E climb ]
 *
 * Route: walk right → ← LEFT → back to JUMP → jump the step → BEEP → SCREEN 2 at the edge →
 * ARMS → climb the wall → drop down the shaft → SCORE → climb two walls → jump up into the
 * summit → climb the staircase → FRAME RATE (era exit).
 */

// prettier-ignore
const A_START = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '...........3...4',
  '..2..P..1.######',
  '################',
];

// prettier-ignore
const B_ARMS = [
  '................',
  '................',
  '................',
  '................',
  '.........#######',
  '.........#######',
  '...5.....#######',
  '################',
  '################',
];

// prettier-ignore
const C_DROP = [
  '...............#',
  '...............#',
  '...............#',
  '...............#',
  '####...........#',
  '####...........#',
  '####...........#',
  '####...........#',
  '####...........#',
];

// prettier-ignore
const D_SCORE = [
  '#...............',
  '#...............',
  '#...............',
  '#...............',
  '#...............',
  '#...............',
  '#...............',
  '#............6..',
  '################',
];

// prettier-ignore
const E_CLIMB = [
  '##########.....#',
  '...............#',
  '...........#####',
  '...........#####',
  '...........#####',
  '......##########',
  '......##########',
  '......##########',
  '################',
];

// prettier-ignore
const F_SUMMIT = [
  '................',
  '..7.............',
  '#####...........',
  '#####...........',
  '#####...........',
  '########........',
  '########........',
  '########........',
  '##########......',
];

export const ERA0_LEVEL: LevelDef = {
  name: 'era0-boot',
  rows: composeScreens([
    [A_START, B_ARMS, C_DROP, F_SUMMIT],
    [SOLID_SCREEN, SOLID_SCREEN, D_SCORE, E_CLIMB],
  ]),
  pickups: {
    '1': 'LEFT',
    '2': 'JUMP',
    '3': 'BEEP',
    '4': 'SCREEN_2',
    '5': 'ARMS',
    '6': 'SCORE',
    '7': 'FRAME_RATE',
  },
};

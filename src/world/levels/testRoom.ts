import type { LevelDef } from '../tilemap';

/**
 * M0 test room: two screens (32 × 9 tiles) covering all seven Era 0 features.
 * Not the final Era 0 level design, just enough to exercise every system.
 *
 * Route: you can only walk right → ← LEFT sits before a step you can't climb →
 * walk back to JUMP behind the start → jump the step → BEEP → SCREEN 2 at the
 * screen edge → ARMS → SCORE on the floating platform → hop the wall → FRAME RATE.
 */
export const TEST_ROOM: LevelDef = {
  name: 'test-room',
  rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '......................6.........',
    '.....................###........',
    '...........3...4..5........#....',
    '..2..P..1.###########......#.7..',
    '################################',
  ],
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

/** Screen size in tiles. One screen = one flip-screen camera view. */
export const SCREEN_COLS = 16;
export const SCREEN_ROWS = 9;

/** A screen of solid rock, for unreachable parts of the grid. */
export const SOLID_SCREEN: readonly string[] = Array.from({ length: SCREEN_ROWS }, () =>
  '#'.repeat(SCREEN_COLS),
);

/**
 * Build a level's rows from a grid of 16×9 screens: grid[screenY][screenX].
 * Authoring screen by screen keeps flip-screen levels readable.
 */
export function composeScreens(grid: readonly (readonly (readonly string[])[])[]): string[] {
  const rows: string[] = [];
  grid.forEach((screenRow, sy) => {
    screenRow.forEach((screen, sx) => {
      if (screen.length !== SCREEN_ROWS || screen.some((r) => r.length !== SCREEN_COLS)) {
        throw new Error(`Screen ${sx},${sy} must be ${SCREEN_COLS}×${SCREEN_ROWS} tiles`);
      }
    });
    for (let r = 0; r < SCREEN_ROWS; r++) {
      rows.push(screenRow.map((screen) => screen[r]).join(''));
    }
  });
  return rows;
}

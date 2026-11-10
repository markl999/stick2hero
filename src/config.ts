/**
 * World-space constants. The world is measured in "world units", independent of the
 * render resolution. One screen is always VIEW_W × VIEW_H world units (16 × 9 tiles);
 * the era's internal resolution only decides how many pixels that screen is drawn with.
 */
export const TILE = 20;
export const VIEW_W = 320;
export const VIEW_H = 180;

/** Fixed simulation rate. Rendering may run slower (Era 0 is capped at 15fps). */
export const STEP_HZ = 60;
export const STEP = 1 / STEP_HZ;

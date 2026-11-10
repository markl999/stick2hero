/**
 * The stick man's skeleton, in world units, relative to his feet (0, 0), +y down.
 * Every visual tier draws from this same pose; only the drawing style changes (PRD §8).
 */
export type Segment = readonly [x0: number, y0: number, x1: number, y1: number];

export interface StickPose {
  head: { x: number; y: number; r: number };
  segments: Segment[];
}

export interface PoseOptions {
  arms: boolean;
  /** 'hang' and 'climb' are fixed poses, not animation (that's the ANIMATION feature). */
  state: 'normal' | 'hang' | 'climb';
  facing: 1 | -1;
}

const HEAD = { x: 0, y: -23.5, r: 4.5 };
const BODY: Segment = [0, -19, 0, -9];

/** Era 0 poses: no animation yet, so each state is one fixed pose. */
export function era0Pose({ arms, state, facing }: PoseOptions): StickPose {
  if (state === 'hang') {
    // Dangling from a ledge: head tilted away from the wall so the arms can reach up
    // beside it to the ledge, legs together.
    const segments: Segment[] = [BODY, [0, -9, -1, 0], [0, -9, 1, 0]];
    if (arms) segments.push([0, -18, facing * 5, -29], [0, -18, facing * 3, -29]);
    return { head: { ...HEAD, x: -facing * 2.5 }, segments };
  }
  if (state === 'climb') {
    // Hauling up: one knee raised, arms pushing down on the ledge.
    const segments: Segment[] = [BODY, [0, -9, facing * 4, -6], [0, -9, -1, 0]];
    if (arms) segments.push([0, -17, facing * 5, -12], [0, -17, facing * 3, -12]);
    return { head: HEAD, segments };
  }
  // Feet stay inside the 10-unit-wide collision box so they never overlap walls.
  const segments: Segment[] = [BODY, [0, -9, -3.5, 0], [0, -9, 3.5, 0]];
  if (arms) segments.push([0, -17, -5, -10], [0, -17, 5, -10]);
  return { head: HEAD, segments };
}

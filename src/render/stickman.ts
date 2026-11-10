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
}

/** Era 0 pose: no animation yet (that's the ANIMATION feature), so it's one fixed pose. */
export function era0Pose(options: PoseOptions): StickPose {
  const segments: Segment[] = [
    [0, -19, 0, -9], // body
    // Feet stay inside the 10-unit-wide collision box so they never overlap walls.
    [0, -9, -3.5, 0], // left leg
    [0, -9, 3.5, 0], // right leg
  ];
  if (options.arms) {
    segments.push([0, -17, -5, -10], [0, -17, 5, -10]);
  }
  return { head: { x: 0, y: -23.5, r: 4.5 }, segments };
}

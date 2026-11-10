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
  punching?: boolean;
  /** Lying flat (the death animation). */
  dead?: boolean;
}

const HEAD = { x: 0, y: -23.5, r: 4.5 };
const BODY: Segment = [0, -19, 0, -9];

/** Fixed poses (no animation until the ANIMATION feature). */
export function stickPose(options: PoseOptions): StickPose {
  const pose = basePose(options);
  return options.dead ? lieDown(pose, options.facing) : pose;
}

function basePose({ arms, state, facing, punching }: PoseOptions): StickPose {
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
  if (arms && punching) {
    // One arm jabbing straight out, the other pulled back.
    segments.push([0, -17, facing * 14, -16], [0, -17, -facing * 4, -12]);
  } else if (arms) {
    segments.push([0, -17, -5, -10], [0, -17, 5, -10]);
  }
  return { head: HEAD, segments };
}

/** Rotate the pose 90° so he lies on the floor, head away from where he was facing. */
function lieDown(pose: StickPose, facing: 1 | -1): StickPose {
  const rotate = (x: number, y: number): [number, number] => [-facing * y * 0.95, x * 0.4 - 3];
  const segments = pose.segments.map(([x0, y0, x1, y1]): Segment => {
    const [a, b] = rotate(x0, y0);
    const [c, d] = rotate(x1, y1);
    return [a, b, c, d];
  });
  const [hx, hy] = rotate(pose.head.x, pose.head.y);
  return { head: { ...pose.head, x: hx, y: hy }, segments };
}

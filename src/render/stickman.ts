/**
 * The stick man's skeleton, in world units, relative to his feet (0, 0), +y down.
 * Every visual tier draws from this same pose; only the drawing style changes (PRD §8).
 */
export type Segment = readonly [x0: number, y0: number, x1: number, y1: number];
export type Joint = readonly [x: number, y: number];

export interface StickPose {
  head: { x: number; y: number; r: number };
  segments: Segment[];
  /** End points of the arms and legs, for drawing hands and feet (HANDS & FEET). */
  hands: Joint[];
  feet: Joint[];
}

export interface PoseOptions {
  arms: boolean;
  state: 'normal' | 'hang' | 'climb';
  facing: 1 | -1;
  punching?: boolean;
  /** Lying flat (the death animation). */
  dead?: boolean;
  /**
   * ANIMATION. Without it every state is one fixed pose (he slides around). With it:
   * a walk cycle, jump and fall poses, a landing squash and a wall-slide pose.
   */
  animated?: {
    /** Distance walked: drives the walk cycle. */
    walkDistance: number;
    moving: boolean;
    onGround: boolean;
    vy: number;
    /** 0..1: how squashed from landing. */
    squash: number;
    wallSliding: boolean;
  };
}

const HEAD_R = 4.5;
const NECK = -19;
const SHOULDER = -17;
const HIP = -9;
const HEAD_Y = -23.5;

export function stickPose(options: PoseOptions): StickPose {
  const pose = basePose(options);
  return options.dead ? lieDown(pose, options.facing) : pose;
}

function basePose(o: PoseOptions): StickPose {
  const f = o.facing;
  if (o.state === 'hang') {
    // Dangling from a ledge: head tilted away from the wall so the arms reach up beside it.
    return build(
      o,
      -f * 2.5,
      0,
      [
        [-1, 0],
        [1, 0],
      ],
      [
        [f * 5, -29],
        [f * 3, -29],
      ],
      -18,
    );
  }
  if (o.state === 'climb') {
    return build(
      o,
      0,
      0,
      [
        [f * 4, -6],
        [-1, 0],
      ],
      [
        [f * 5, -12],
        [f * 3, -12],
      ],
    );
  }

  const a = o.animated;
  let legs: Joint[] = [
    [-3.5, 0],
    [3.5, 0],
  ];
  let hands: Joint[] = [
    [-5, -10],
    [5, -10],
  ];
  let drop = 0; // landing squash lowers the body

  if (a) {
    drop = a.squash * 3;
    if (a.wallSliding) {
      legs = [
        [f * 3, -2],
        [f * 1, 0],
      ];
      hands = [
        [f * 6, -24],
        [f * 6, -20],
      ];
    } else if (!a.onGround) {
      if (a.vy < 0) {
        // Rising: knees tucked, arms up.
        legs = [
          [-f * 2, -4],
          [f * 4, -6],
        ];
        hands = [
          [-f * 4, -24],
          [f * 6, -25],
        ];
      } else {
        // Falling: legs apart, arms out.
        legs = [
          [-5, 0],
          [5, -1],
        ];
        hands = [
          [-8, -18],
          [8, -18],
        ];
      }
    } else if (a.moving) {
      // Walk cycle: legs swing, feet lift, arms swing the other way.
      const phase = a.walkDistance / 6;
      const swing = Math.sin(phase);
      legs = [
        [swing * 5, -Math.max(0, Math.cos(phase)) * 2.5],
        [-swing * 5, -Math.max(0, -Math.cos(phase)) * 2.5],
      ];
      hands = [
        [-swing * 5, -10],
        [swing * 5, -10],
      ];
    }
  }
  if (o.punching)
    hands = [
      [f * 14, -16],
      [-f * 4, -12],
    ];
  return build(o, 0, drop, legs, hands);
}

function build(
  o: PoseOptions,
  headX: number,
  drop: number,
  legs: Joint[],
  hands: Joint[],
  shoulderY = SHOULDER,
): StickPose {
  const hip = HIP + drop;
  const neck = NECK + drop;
  const shoulder = shoulderY + drop;
  const segments: Segment[] = [[0, neck, 0, hip]];
  for (const [x, y] of legs) segments.push([0, hip, x, y]);
  if (o.arms) for (const [x, y] of hands) segments.push([0, shoulder, x, y + drop * 0.5]);
  return {
    head: { x: headX, y: HEAD_Y + drop, r: HEAD_R },
    segments,
    hands: o.arms ? hands.map(([x, y]) => [x, y + drop * 0.5] as Joint) : [],
    feet: legs,
  };
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
  return {
    head: { ...pose.head, x: hx, y: hy },
    segments,
    hands: pose.hands.map(([x, y]) => rotate(x, y)),
    feet: pose.feet.map(([x, y]) => rotate(x, y)),
  };
}

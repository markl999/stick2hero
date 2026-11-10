/**
 * HATS (a secret): several of them. Each hat is a few rectangles in world units, relative
 * to the top-middle of the head (y up is negative), drawn on the side the stick man faces.
 * Rectangles only, so the pixel tiers draw them crisp and HD draws the very same shapes.
 */
export const HAT_NAMES = ['TOP HAT', 'PARTY HAT', 'CROWN', 'CAP', 'PROPELLER', 'COWBOY'] as const;

export interface HatRect {
  x: number;
  y: number;
  w: number;
  h: number;
  colour: string;
}

const BLACK = '#1b1b1f';
const RED = '#d7263d';
const GOLD = '#ffd23d';
const PINK = '#ff4fd8';
const BLUE = '#2f6fe4';
const BROWN = '#8b5a2b';

function hatShape(index: number, time: number): HatRect[] {
  switch (index % HAT_NAMES.length) {
    case 0: // top hat
      return [
        { x: -5.5, y: -0.5, w: 11, h: 1.5, colour: BLACK },
        { x: -3.5, y: -7.5, w: 7, h: 7, colour: BLACK },
        { x: -3.5, y: -2.2, w: 7, h: 1.2, colour: RED },
      ];
    case 1: {
      // party hat: a striped cone (stacked bars) with a pompom
      const bars = [7, 5.6, 4.2, 2.8, 1.4].map((w, i) => ({
        x: -w / 2,
        y: -1.6 * (i + 1) + 1,
        w,
        h: 1.7,
        colour: i % 2 ? GOLD : PINK,
      }));
      return [...bars, { x: -1, y: -9.6, w: 2, h: 2, colour: '#ffffff' }];
    }
    case 2: // crown
      return [
        { x: -4, y: -3, w: 8, h: 3, colour: GOLD },
        { x: -4, y: -5.5, w: 2, h: 2.6, colour: GOLD },
        { x: -1, y: -6, w: 2, h: 3.1, colour: GOLD },
        { x: 2, y: -5.5, w: 2, h: 2.6, colour: GOLD },
        { x: -0.6, y: -2.2, w: 1.2, h: 1.2, colour: RED },
      ];
    case 3: // cap, peak forward
      return [
        { x: -4.5, y: -3, w: 9, h: 3.5, colour: BLUE },
        { x: 2.5, y: -0.6, w: 5, h: 1.3, colour: BLUE },
      ];
    case 4: {
      // propeller beanie: the blades spin
      const spin = Math.abs(Math.cos(time * 18)) * 9 + 1;
      return [
        { x: -4.5, y: -2.6, w: 9, h: 3.1, colour: GOLD },
        { x: -4.5, y: -1.2, w: 9, h: 1, colour: RED },
        { x: -0.5, y: -4.2, w: 1, h: 1.7, colour: '#666677' },
        { x: -spin / 2, y: -5, w: spin, h: 1, colour: RED },
      ];
    }
    default: // cowboy
      return [
        { x: -7, y: -0.6, w: 14, h: 1.6, colour: BROWN },
        { x: -3.5, y: -5, w: 7, h: 4.6, colour: BROWN },
        { x: -1, y: -5, w: 2, h: 1, colour: '#5e3b1a' },
      ];
  }
}

/** The hat's rectangles, scaled (for a big head) and turned the way you face. */
export function hatRects(index: number, facing: 1 | -1, scale: number, time: number): HatRect[] {
  return hatShape(index, time).map((r) => ({
    x: (facing > 0 ? r.x : -(r.x + r.w)) * scale,
    y: r.y * scale,
    w: r.w * scale,
    h: r.h * scale,
    colour: r.colour,
  }));
}

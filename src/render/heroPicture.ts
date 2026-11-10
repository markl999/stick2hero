import { textWidth } from './font3x5';
import { PixelCanvas } from './pixelCanvas';

export const PICTURE_W = 256;
export const PICTURE_H = 144;

/** A 1-bit image: 1 = white (ink), 0 = black (paper). Row-major. */
export interface Bitmap {
  width: number;
  height: number;
  bits: Uint8Array;
}

/**
 * The tape-loading picture: the hero the game *promises*. A muscular, caped, masked
 * hero on a rocky peak with a sunburst, plus the title. Drawn with canvas paths at
 * full size, then thresholded to 1-bit, so it looks like a real loading screen. It's
 * deliberately far more detailed than the stick man you actually get.
 */
export function renderHeroPicture(): Bitmap {
  const canvas = document.createElement('canvas');
  canvas.width = PICTURE_W;
  canvas.height = PICTURE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas not supported');

  const W = '#fff';
  const B = '#000';
  ctx.fillStyle = B;
  ctx.fillRect(0, 0, PICTURE_W, PICTURE_H);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const path = (pts: number[]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  };
  /** Filled polygon with an optional outline in the other colour. */
  const shape = (pts: number[], fill: string, outline?: { color: string; width: number }) => {
    path(pts);
    ctx.closePath();
    if (outline) {
      ctx.strokeStyle = outline.color;
      ctx.lineWidth = outline.width;
      ctx.stroke();
    }
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const line = (x0: number, y0: number, x1: number, y1: number, color = B, width = 1.5) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  // Sunburst, kept to the left half so the title panel stays clean.
  const sun = { x: 80, y: 60 };
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 146, PICTURE_H);
  ctx.clip();
  ctx.fillStyle = W;
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + 0.08;
    const spread = 0.07;
    path([
      sun.x,
      sun.y,
      sun.x + Math.cos(a - spread) * 300,
      sun.y + Math.sin(a - spread) * 300,
      sun.x + Math.cos(a + spread) * 300,
      sun.y + Math.sin(a + spread) * 300,
    ]);
    ctx.fill();
  }
  // The sun itself: a big white disc for the hero to stand against.
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Rocky peak.
  shape([0, 144, 20, 124, 38, 127, 56, 113, 80, 117, 104, 109, 122, 121, 146, 118, 146, 144], W);
  line(28, 132, 38, 141);
  line(46, 122, 50, 130);
  line(118, 126, 128, 137);

  // The hero as a solid black silhouette. The negative space (between the arms and the
  // body, between the legs) is what makes the pose read.
  // Cape, billowing out to the left behind him.
  shape([66, 46, 44, 56, 26, 78, 12, 108, 26, 102, 30, 114, 44, 100, 52, 110, 60, 88, 70, 70], B);
  // Legs: a wide, planted stance.
  shape([70, 82, 80, 82, 75, 99, 71, 114, 58, 114, 64, 98], B);
  shape([80, 82, 90, 82, 96, 98, 103, 112, 90, 113, 85, 99], B);
  // Torso: broad shoulders tapering to the waist.
  shape([59, 46, 101, 46, 97, 60, 89, 84, 71, 84, 63, 60], B);
  // Arms: elbows out, fists on hips.
  ctx.strokeStyle = B;
  ctx.lineWidth = 7;
  path([62, 49, 49, 66, 69, 80]);
  ctx.stroke();
  path([98, 49, 111, 66, 91, 80]);
  ctx.stroke();
  // Head and neck.
  ctx.fillStyle = B;
  ctx.fillRect(76, 42, 8, 6);
  ctx.beginPath();
  ctx.arc(80, 36, 8, 0, Math.PI * 2);
  ctx.fill();

  // White details on the silhouette: glowing eyes, emblem, muscles, belt, cape fold.
  ctx.fillStyle = W;
  ctx.fillRect(75, 35, 3, 2);
  ctx.fillRect(82, 35, 3, 2);
  path([80, 52, 85, 58, 80, 64, 75, 58]);
  ctx.fill();
  line(67, 61, 77, 63, W, 1);
  line(93, 61, 83, 63, W, 1);
  for (const y of [69, 74]) {
    line(75, y, 78, y, W, 1);
    line(82, y, 85, y, W, 1);
  }
  line(71, 81, 89, 81, W, 1);
  line(52, 62, 32, 100, W, 1);

  // Threshold to 1-bit.
  const data = ctx.getImageData(0, 0, PICTURE_W, PICTURE_H).data;
  const bits = new Uint8Array(PICTURE_W * PICTURE_H);
  for (let i = 0; i < bits.length; i++) bits[i] = data[i * 4] > 127 ? 1 : 0;

  // Title, in the game's own pixel font (on a black panel so the rays don't cut through).
  const title = new PixelCanvas(PICTURE_W, PICTURE_H);
  const panel = { x: 150, y: 22, w: 98, h: 96 };
  stamp(bits, { x: 146, y: 0, w: PICTURE_W - 146, h: PICTURE_H }, 0);
  title.clear('#000');
  title.color('#fff');
  const cx = panel.x + panel.w / 2;
  title.textCentered('STICK', cx, 30, 4);
  title.textCentered('2', cx, 56, 4);
  title.textCentered('HERO', cx, 82, 5);
  const line2 = '1978';
  title.text(line2, cx - Math.floor(textWidth(line2) / 2), 111, 1);
  const titleData = title.imageData();
  for (let y = panel.y; y < panel.y + panel.h; y++) {
    for (let x = panel.x; x < panel.x + panel.w; x++) {
      const i = y * PICTURE_W + x;
      if (titleData.data[i * 4] > 127) bits[i] = 1;
    }
  }

  return { width: PICTURE_W, height: PICTURE_H, bits };
}

function stamp(
  bits: Uint8Array,
  rect: { x: number; y: number; w: number; h: number },
  value: 0 | 1,
): void {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    bits.fill(value, y * PICTURE_W + rect.x, y * PICTURE_W + rect.x + rect.w);
  }
}

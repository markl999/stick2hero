import { VIEW_W } from '../../config';
import type { Knight } from '../../game/enemies';
import type { Game } from '../../game/game';
import { SWING_TIME, type Player } from '../../game/player';
import type { Dialogue, Npc } from '../../game/props';
import type { Warden } from '../../game/warden';
import { GLYPH_H, textWidth } from '../font3x5';
import type { StickPose } from '../stickman';
import type { Frame } from './pixelTier';

/*
 * Era 3 (16-BIT) drawing: parallax backgrounds, knights, The Warden, NPCs and dialogue,
 * and the stick man's face, outfit, sword and dash.
 */

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(lerp((pa >> shift) & 255, (pb >> shift) & 255, t));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// --- PARALLAX ------------------------------------------------------------------------

const SKY_TOP = '#1b1f5e';
const SKY_MID = '#7b3f8c';
const SKY_LOW = '#ff9a5a';

/**
 * A 256-colour sunset (one colour per scanline) with three layers moving at different
 * speeds. During the PARALLAX moment the layers rise into place one after another.
 */
export function drawParallax(f: Frame, introT: number | null): void {
  const { p, s } = f;
  const h = p.height;
  for (let y = 0; y < h; y++) {
    const k = y / h;
    p.color(k < 0.55 ? mix(SKY_TOP, SKY_MID, k / 0.55) : mix(SKY_MID, SKY_LOW, (k - 0.55) / 0.45));
    p.rect(0, y, p.width, 1);
  }
  // The sun, low and big, barely moving.
  p.color('#ffd27a');
  p.disc(p.width * 0.72 - f.camX * 0.02 * s, h * 0.62, 34 * s);

  const rise = (layer: number) => {
    if (introT === null) return 0;
    const k = Math.min(1, Math.max(0, (introT - 0.15 - layer * 0.18) / 0.5));
    return Math.round((1 - k * (2 - k)) * h * 0.5);
  };

  const layer = (
    factor: number,
    base: number,
    colour: string,
    height: (x: number) => number,
    offset: number,
  ) => {
    p.color(colour);
    const step = Math.max(1, Math.round(s));
    for (let x = 0; x < p.width; x += step) {
      const wx = f.camX * factor + x / s;
      const top = Math.round(h * base - height(wx) * s) + offset;
      p.rect(x, top, step, h - top);
    }
  };
  // Far mountains, rolling hills, then a near line of trees.
  layer(
    0.12,
    0.8,
    '#4b3a7a',
    (x) =>
      62 + 26 * Math.sin(x * 0.012) + 16 * Math.sin(x * 0.033 + 1) + 7 * Math.sin(x * 0.081 + 2),
    rise(0),
  );
  layer(
    0.3,
    0.86,
    '#2f5d55',
    (x) => 30 + 12 * Math.sin(x * 0.021) + 8 * Math.sin(x * 0.055 + 3),
    rise(1),
  );
  layer(
    0.55,
    0.92,
    '#1d3d33',
    (x) => {
      // Conifers: a sawtooth of triangles.
      const spacing = 23;
      const local = ((x % spacing) + spacing) % spacing;
      const tree = Math.floor(x / spacing);
      const tall = 22 + ((tree * 37) % 17);
      return 6 + Math.max(0, tall - Math.abs(local - spacing / 2) * 2.6);
    },
    rise(2),
  );
}

// --- Knights ---------------------------------------------------------------------------

export function drawKnight(f: Frame, knight: Knight): void {
  const { p, style, alpha, s, X, Y } = f;
  if (knight.gone) return;
  if (!knight.alive && Math.floor(knight.deadT * 16) % 2 === 0) return;
  const b = knight.box;
  const x = lerp(knight.prevX, b.x, alpha);
  const y = lerp(knight.prevY, b.y, alpha);
  const left = X(x);
  const top = Y(y);
  const w = X(x + b.w) - left;
  const h = Y(y + b.h) - top;
  const flash = knight.flinchT > 0 && Math.floor(knight.flinchT * 30) % 2 === 0;
  const steel = flash ? '#ffffff' : style.rich ? '#b8c0cc' : style.enemy;
  const shade = style.rich ? '#6c7686' : style.paper;
  const dir = knight.dir;
  const lean = knight.charging ? dir * Math.round(2 * s) : 0;

  // Legs (stepping), body, helmet with a visor slit, a plume, and a shield in front.
  const stride = knight.alive ? Math.floor(x / 4) % 2 : 0;
  p.color(shade);
  p.rect(left + w * 0.2, top + h * 0.72 - stride * s, w * 0.25, h * 0.28 + stride * s);
  p.rect(left + w * 0.55, top + h * 0.72 - (1 - stride) * s, w * 0.25, h * 0.28);
  p.color(steel);
  p.rect(left + lean, top + h * 0.32, w, h * 0.42);
  p.rect(left + w * 0.1 + lean, top, w * 0.8, h * 0.34);
  p.color(shade);
  p.rect(left + w * (dir > 0 ? 0.45 : 0.1) + lean, top + h * 0.12, w * 0.45, Math.max(1, h * 0.05));
  p.color(style.rich ? '#d64045' : style.enemy);
  p.rect(left + w * 0.4 + lean, top - h * 0.12, w * 0.2, h * 0.14);
  // Shield.
  const sx = dir > 0 ? left + w * 0.75 : left - w * 0.15;
  p.color(style.rich ? '#3d5a99' : style.enemy);
  p.rect(sx + lean, top + h * 0.3, w * 0.4, h * 0.42);
  p.color(style.rich ? '#f2c14e' : style.paper);
  p.rect(sx + w * 0.12 + lean, top + h * 0.42, w * 0.16, h * 0.16);
}

// --- The Warden ------------------------------------------------------------------------

const STONE = '#8f8473';
const STONE_DARK = '#5a5247';
const GLOW = '#ffcf3f';

export function drawWarden(f: Frame, boss: Warden): void {
  const { p, game, style, alpha, s, X, Y } = f;
  if (boss.state === 'waiting' || boss.state === 'dead') return;
  if (boss.state === 'dying' && Math.floor(boss.t * 12) % 2 === 0) return;
  const stone = style.rich ? STONE : style.enemy;
  const dark = style.rich ? STONE_DARK : style.paper;

  // The body, far too big for the screen, looming in the background: two great
  // shoulders, a tapering chest, and (until it comes down) a head with glowing eyes.
  const cx = X(boss.arenaX + VIEW_W / 2);
  const bodyTop = Y(6);
  const body = style.rich ? '#4a3f5c' : style.paper;
  const rim = style.rich ? '#64587a' : style.enemy;
  const crack = style.rich ? '#352c44' : style.enemy;
  const shoulderY = bodyTop + 46 * s;
  p.color(body);
  for (let y = 0; y < 70 * s; y++) {
    const half = lerp(115, 70, y / (70 * s)) * s;
    p.hline(cx - half, cx + half, shoulderY + y);
  }
  p.disc(cx - 92 * s, shoulderY, 34 * s);
  p.disc(cx + 92 * s, shoulderY, 34 * s);
  p.color(rim);
  p.circle(cx - 92 * s, shoulderY, 34 * s);
  p.circle(cx + 92 * s, shoulderY, 34 * s);
  p.color(crack);
  p.line(cx - 40 * s, shoulderY + 10 * s, cx - 20 * s, shoulderY + 50 * s);
  p.line(cx + 30 * s, shoulderY + 20 * s, cx + 50 * s, shoulderY + 60 * s);
  p.line(cx - 100 * s, shoulderY - 10 * s, cx - 80 * s, shoulderY + 12 * s);
  if (boss.headState === 'hidden') {
    // Still attached: its eyes watch from the dark.
    p.color(body);
    p.disc(cx, bodyTop + 22 * s, 30 * s);
    p.color(rim);
    p.circle(cx, bodyTop + 22 * s, 30 * s);
    p.color(GLOW);
    p.rect(cx - 16 * s, bodyTop + 16 * s, 9 * s, 4 * s);
    p.rect(cx + 7 * s, bodyTop + 16 * s, 9 * s, 4 * s);
  }

  // Arms reaching down to the fists: solid stone, as thick as a tile.
  for (const [i, fist] of boss.fists.entries()) {
    if (fist.state === 'broken' && fist.t > 0.8) continue;
    const fx = lerp(fist.prevX, fist.box.x, alpha);
    const fy = lerp(fist.prevY, fist.box.y, alpha);
    const shoulderX = cx + (i === 0 ? -92 : 92) * s;
    const wristX = X(fx + fist.box.w / 2);
    const wristY = Y(fy);
    const thick = Math.round(9 * s);
    p.color(style.rich ? '#55496a' : stone);
    for (let k = -thick; k <= thick; k++)
      p.line(shoulderX + k, shoulderY, wristX + k * 0.7, wristY);
    p.color(rim);
    p.line(shoulderX - thick, shoulderY, wristX - thick * 0.7, wristY);
    if (fist.state === 'broken' && Math.floor(fist.t * 16) % 2 === 0) continue;
    const left = X(fx);
    const top = Y(fy);
    const w = X(fx + fist.box.w) - left;
    const h = Y(fy + fist.box.h) - top;
    p.color(fist.hitFlash > 0 ? '#ffffff' : stone);
    p.rect(left, top, w, h);
    // Knuckles, and cracks once it's been hit.
    p.color(dark);
    for (let k = 1; k < 4; k++) p.vline(left + (w * k) / 4, top + h * 0.55, top + h - 1);
    p.hline(left, left + w - 1, top + h * 0.55);
    if (fist.hp < 3) p.line(left + w * 0.2, top + 2, left + w * 0.5, top + h * 0.5);
    if (fist.hp < 2) p.line(left + w * 0.8, top + 2, left + w * 0.55, top + h * 0.45);
    // A warning shadow under a fist that's about to slam.
    if (fist.state === 'track') {
      p.color(style.hazard);
      const floor = Y(game.map.pixelHeight - 20);
      p.rect(left + w * 0.1, floor - 2 * s, w * 0.8, 2 * s);
    }
  }

  // The head, once it comes down.
  if (boss.headState !== 'hidden') {
    const hb = boss.head;
    const hy = lerp(boss.headPrevY, hb.y, alpha);
    const left = X(hb.x);
    const top = Y(hy);
    const w = X(hb.x + hb.w) - left;
    const h = Y(hy + hb.h) - top;
    p.color(boss.headFlash > 0 ? '#ffffff' : stone);
    p.rect(left, top, w, h);
    p.color(dark);
    p.rect(left + w * 0.1, top + h * 0.22, w * 0.8, h * 0.08); // brow
    p.rect(left + w * 0.3, top + h * 0.7, w * 0.4, h * 0.08); // mouth
    p.color(boss.headVulnerable ? '#ff5555' : GLOW);
    const eye = boss.headVulnerable ? 0.5 : 1;
    p.rect(left + w * 0.22, top + h * 0.38, w * 0.16, h * 0.14 * eye);
    p.rect(left + w * 0.62, top + h * 0.38, w * 0.16, h * 0.14 * eye);
  }
}

// --- NPCs and dialogue -----------------------------------------------------------------

export function drawNpc(f: Frame, npc: Npc): void {
  const { p, game, style, s, X, Y } = f;
  const x = X(npc.x);
  const y = Y(npc.y);
  const bob = Math.round(Math.sin(game.time * 2 + npc.x) * s);
  const ink = style.rich ? '#fff1e8' : style.text;

  if (npc.id === 'N') {
    // A placeholder: an unfinished sprite with the classic "missing texture" check.
    const w = 14 * s;
    const h = 24 * s;
    const cell = 3 * s;
    for (let cy = 0; cy < h; cy += cell) {
      for (let cx = 0; cx < w; cx += cell) {
        p.color((cx / cell + cy / cell) % 2 === 0 ? '#ff00dc' : '#111111');
        p.rect(x - w / 2 + cx, y - h + cy + bob, Math.min(cell, w - cx), Math.min(cell, h - cy));
      }
    }
    p.color('#ffffff');
    p.rect(x - 4 * s, y - h + 5 * s + bob, 2 * s, 2 * s);
    p.rect(x + 2 * s, y - h + 5 * s + bob, 2 * s, 2 * s);
    return;
  }
  if (npc.id === 'M') {
    // A wizard who was only ever a TODO: stick figure, pointy hat, a sign.
    p.color(ink);
    p.line(x, y - 9 * s, x, y - 19 * s);
    p.line(x, y - 9 * s, x - 3 * s, y);
    p.line(x, y - 9 * s, x + 3 * s, y);
    p.disc(x, y - 23 * s + bob, 4.5 * s);
    p.color(style.rich ? '#7d4cdb' : style.enemy);
    for (let i = 0; i < 12 * s; i++) {
      p.hline(x - (i / (12 * s)) * 7 * s, x + (i / (12 * s)) * 7 * s, y - 38 * s + i + bob);
    }
    p.color(style.rich ? '#e8d5a3' : style.text);
    p.rect(x + 3 * s, y - 20 * s, 18 * s, 9 * s);
    p.color(style.rich ? '#5a3e1b' : style.paper);
    p.text('TODO', x + 4 * s, y - 18 * s, Math.max(1, Math.round(s)));
    return;
  }
  // A hooded elder with a staff.
  p.color(style.rich ? '#6b4e9e' : style.enemy);
  const h = 28 * s;
  for (let i = 0; i < h; i++) p.hline(x - (i / h) * 8 * s, x + (i / h) * 8 * s, y - h + i);
  p.color(style.rich ? '#1a1030' : style.paper);
  p.disc(x, y - h + 7 * s + bob, 3 * s);
  p.color(style.rich ? '#ffe08a' : style.text);
  p.rect(x - 2 * s, y - h + 6 * s + bob, s, s);
  p.rect(x + s, y - h + 6 * s + bob, s, s);
  p.color(style.rich ? '#a07040' : style.text);
  p.vline(x + 10 * s, y - 32 * s, y - 1);
}

export function drawTalkPrompt(f: Frame, npc: Npc): void {
  const { p, style, s, fs, X, Y } = f;
  if (Math.floor(f.game.time * 3) % 3 === 0) return;
  const text = 'UP: TALK';
  const x = X(npc.x);
  const y = Y(npc.y) - Math.round(46 * s);
  const w = (textWidth(text) + 2) * fs;
  p.color(style.paper);
  p.rect(x - w / 2, y - fs, w, (GLYPH_H + 2) * fs);
  p.color(style.text);
  p.textCentered(text, x, y, fs);
}

/** Split text into lines that fit `width` font pixels. */
export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next) > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawDialogue(f: Frame, dialogue: Dialogue): void {
  const { p, style, fs } = f;
  const pad = 4 * fs;
  const box = {
    x: pad,
    y: Math.round(p.height * 0.66),
    w: p.width - pad * 2,
    h: Math.round(p.height * 0.3),
  };
  p.color(style.paper);
  p.rect(box.x, box.y, box.w, box.h);
  p.color(style.text);
  p.strokeRect(box.x, box.y, box.w, box.h);
  p.strokeRect(box.x + fs, box.y + fs, box.w - 2 * fs, box.h - 2 * fs);

  const text = dialogue.npc.pages[dialogue.page] ?? '';
  const shown = text.slice(0, Math.floor(dialogue.chars));
  const lines = wrap(text, Math.floor((box.w - pad * 2) / fs));
  // Type out across the wrapped lines.
  let remaining = shown.length;
  lines.forEach((line, i) => {
    const visible = line.slice(0, Math.max(0, remaining));
    remaining -= line.length + 1;
    p.text(visible, box.x + pad, box.y + pad + i * (GLYPH_H + 3) * fs, fs);
  });
  if (shown.length >= text.length && Math.floor(f.game.time * 3) % 2 === 0) {
    const more = dialogue.page + 1 < dialogue.npc.pages.length;
    p.text(more ? '>' : 'X', box.x + box.w - pad - 3 * fs, box.y + box.h - pad - GLYPH_H * fs, fs);
  }
}

// --- The stick man's upgrades ----------------------------------------------------------

export type Expression = 'neutral' | 'worried' | 'determined' | 'happy';

/** FACE: what his face shows. Expressions hint at danger. */
export function expressionFor(game: Game): Expression {
  const p = game.player;
  if (game.deathT !== null) return 'worried';
  if (game.moment) return 'happy';
  if (p.punchT > 0 || p.dashing) return 'determined';
  const near = (b: { x: number; y: number; w: number; h: number }) =>
    Math.abs(b.x + b.w / 2 - p.feetX) < 70 && Math.abs(b.y + b.h - p.feetY) < 50;
  const danger =
    p.vy > 380 ||
    game.walkers.some((w) => w.alive && near(w.box)) ||
    game.knights.some((k) => k.alive && near(k.box)) ||
    game.bombs.some((b) => near(b.box)) ||
    (game.warden?.fists.some((fist) => fist.state === 'track' || fist.state === 'slam') ?? false);
  return danger ? 'worried' : 'neutral';
}

export function drawFace(
  f: Frame,
  hx: number,
  hy: number,
  r: number,
  facing: 1 | -1,
  expression: Expression,
): void {
  const { p, style, s } = f;
  const u = Math.max(1, Math.round(s));
  const eyeX = hx + facing * r * 0.35;
  const eyeY = hy - r * 0.15;
  const size = expression === 'worried' ? 2 * u : u + 1;
  p.color(style.paper);
  p.rect(eyeX - r * 0.3 - size / 2, eyeY - size / 2, size, size);
  p.rect(eyeX + r * 0.3 - size / 2, eyeY - size / 2, size, size);
  const mouthY = hy + r * 0.45;
  if (expression === 'worried') {
    p.rect(eyeX - u, mouthY - u, 2 * u, 2 * u);
  } else if (expression === 'happy') {
    p.hline(eyeX - r * 0.35, eyeX + r * 0.35, mouthY);
    p.rect(eyeX - r * 0.45, mouthY - u, u, u);
    p.rect(eyeX + r * 0.35, mouthY - u, u, u);
  } else if (expression === 'determined') {
    p.line(eyeX - r * 0.5, eyeY - r * 0.4, eyeX - r * 0.1, eyeY - r * 0.2);
    p.line(eyeX + r * 0.5, eyeY - r * 0.4, eyeX + r * 0.1, eyeY - r * 0.2);
    p.hline(eyeX - r * 0.25, eyeX + r * 0.25, mouthY);
  } else {
    p.hline(eyeX - r * 0.2, eyeX + r * 0.2, mouthY);
  }
}

/** OUTFIT: a tunic and belt over the body. */
export function drawOutfit(f: Frame, px: number, py: number, pose: StickPose): void {
  const { p, style, X, Y } = f;
  const [, neckY, , hipY] = pose.segments[0];
  const top = Y(py + neckY + 1);
  const bottom = Y(py + hipY + 3);
  for (let y = top; y <= bottom; y++) {
    const k = (y - top) / Math.max(1, bottom - top);
    const half = (3 + k * 2.5) * f.s;
    p.color(style.rich ? '#2e86de' : style.player);
    p.hline(X(px) - half, X(px) + half, y);
  }
  p.color(style.rich ? '#8d5524' : style.paper);
  p.rect(X(px) - 3.5 * f.s, Y(py + hipY - 1), 7 * f.s, Math.max(1, 1.5 * f.s));
}

/** SWORD: slashes sweep an arc, the third swing is a thrust. Sheathed on the back otherwise. */
export function drawSword(f: Frame, px: number, py: number, player: Player): void {
  const { p, style, s, X, Y } = f;
  const blade = style.rich ? '#e8ecf4' : style.player;
  const hilt = style.rich ? '#d4a017' : style.player;
  const dir = player.facing;
  const hand = { x: px + dir * 10, y: py - 16 };
  if (player.punchT > 0 && player.swinging) {
    const k = 1 - player.punchT / SWING_TIME;
    let angle: number;
    let length = 20;
    if (player.swingStage === 2) {
      angle = 0;
      length = 26;
    } else {
      const [from, to] = player.swingStage === 0 ? [-70, 45] : [45, -70];
      angle = lerp(from, to, Math.min(1, k * 1.4));
      // The swoosh: a faint trail of where the blade has been.
      p.color(style.rich ? '#9fd3ff' : style.text);
      for (let a = from; Math.abs(a - from) < Math.abs(angle - from); a += (to - from) / 6) {
        const r = (a * Math.PI) / 180;
        p.pset(X(hand.x + dir * Math.cos(r) * length), Y(hand.y + Math.sin(r) * length));
      }
    }
    const r = (angle * Math.PI) / 180;
    const tipX = hand.x + dir * Math.cos(r) * length;
    const tipY = hand.y + Math.sin(r) * length;
    p.color(blade);
    p.line(X(hand.x), Y(hand.y), X(tipX), Y(tipY));
    p.line(X(hand.x), Y(hand.y) + 1, X(tipX), Y(tipY) + 1);
    p.color(hilt);
    p.rect(X(hand.x) - s, Y(hand.y) - 2 * s, 2 * s, 4 * s);
    return;
  }
  // Sheathed: a blade across the back.
  p.color(hilt);
  p.line(X(px - dir * 4), Y(py - 22), X(px + dir * 2), Y(py - 10));
  p.color(blade);
  p.line(X(px - dir * 6), Y(py - 26), X(px - dir * 4), Y(py - 22));
}

/** DASH: afterimages trailing behind. */
export function dashGhosts(player: Player): number[] {
  return player.dashing ? [-22, -12] : [];
}

/** SAVE GAME: a floppy disk and "SAVING..." for the length of the moment. */
export function drawSaveIcon(f: Frame, t: number): void {
  const { p, style, fs } = f;
  const size = 9 * fs;
  const x = p.width - size - 4 * fs;
  const y = 12 * fs;
  p.color(style.rich ? '#2f3542' : style.text);
  p.rect(x, y, size, size);
  p.color(style.rich ? '#dfe4ea' : style.paper);
  p.rect(x + size * 0.2, y, size * 0.6, size * 0.35);
  p.rect(x + size * 0.15, y + size * 0.55, size * 0.7, size * 0.45);
  if (Math.floor(t * 3) % 2 === 0) {
    p.color(style.text);
    const text = 'SAVING...';
    p.text(text, x - (textWidth(text) + 2) * fs, y + size / 2 - (GLYPH_H * fs) / 2, fs);
  }
}

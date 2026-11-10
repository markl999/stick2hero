import { TILE, VIEW_H, VIEW_W } from '../../config';
import { FEATURES } from '../../core/features';
import { BOSS_HP, type BlockBoss, type Walker } from '../../game/enemies';
import {
  BOSS_INTRO_TIME,
  DEATH_TIME,
  MOMENT_DURATION,
  MOMENT_FLASH,
  MOMENT_HITSTOP,
  type Game,
} from '../../game/game';
import { PICKUP_SIZE } from '../../game/pickup';
import { SPIKE_HEIGHT, Tile } from '../../world/tilemap';
import { GLYPH_H, textWidth } from '../font3x5';
import type { PixelCanvas } from '../pixelCanvas';
import { stickPose } from '../stickman';

/**
 * The low-res pixel eras. Era 0 ("BOOT"): a white void, 1px black outlines.
 * Era 1 ("ARCADE"): the screen inverts to black, with filled phosphor-green pixels,
 * brick tiles, a bold stick man and coin pickups.
 */
interface PixelStyle {
  paper: string;
  tiles: string;
  hazard: string;
  player: string;
  enemy: string;
  pickup: string;
  text: string;
  /** Filled shapes and 2px lines (Era 1+) vs 1px outlines (Era 0). */
  filled: boolean;
}

const ERA0_STYLE: PixelStyle = {
  paper: '#ffffff',
  tiles: '#000000',
  hazard: '#000000',
  player: '#000000',
  enemy: '#000000',
  pickup: '#000000',
  text: '#000000',
  filled: false,
};

const PHOSPHOR = '#33ff66';
const ERA1_STYLE: PixelStyle = {
  paper: '#020a04',
  tiles: PHOSPHOR,
  hazard: PHOSPHOR,
  player: PHOSPHOR,
  enemy: PHOSPHOR,
  pickup: PHOSPHOR,
  text: PHOSPHOR,
  filled: true,
};

function styleFor(game: Game): PixelStyle {
  const base = game.level.era === 0 ? ERA0_STYLE : ERA1_STYLE;
  if (!game.flashing) return base;
  // Unlock flash: everything inverts.
  const ink = base.text;
  return {
    ...base,
    paper: ink,
    tiles: base.paper,
    hazard: base.paper,
    player: base.paper,
    enemy: base.paper,
    pickup: base.paper,
    text: base.paper,
  };
}

/** Everything the drawing helpers need for one frame. */
interface Frame {
  p: PixelCanvas;
  game: Game;
  style: PixelStyle;
  alpha: number;
  /** Pixels per world unit. */
  s: number;
  /** Font scale: one font pixel = 2 world units (1px at 160×90, 2px at 320×180). */
  fs: number;
  X(wx: number): number;
  Y(wy: number): number;
}

export function drawPixelTier(p: PixelCanvas, game: Game, alpha: number): void {
  const style = styleFor(game);
  const s = p.width / VIEW_W;
  const moment = game.moment;
  const t = moment?.t ?? Infinity;

  // JUMP: the screen itself hops.
  const hop =
    moment?.feature === 'JUMP' && t >= MOMENT_FLASH && t < 0.6
      ? -Math.round(Math.sin((Math.PI * (t - MOMENT_FLASH)) / (0.6 - MOMENT_FLASH)) * 8 * s)
      : 0;
  const cam = game.camera;
  const f: Frame = {
    p,
    game,
    style,
    alpha,
    s,
    fs: Math.max(1, Math.round(2 * s)),
    X: (wx) => Math.round((wx - cam.x) * s),
    Y: (wy) => Math.round((wy - cam.y) * s) + hop,
  };

  p.clear(style.paper);
  // ← LEFT: the world briefly turns around.
  const mirror = moment?.feature === 'LEFT' && t >= MOMENT_FLASH && t < MOMENT_HITSTOP;
  const world = () => {
    drawTiles(f);
    drawPickups(f);
    if (game.enemiesActive) {
      for (const walker of game.walkers) drawWalker(f, walker);
      if (game.boss) drawBoss(f, game.boss);
    }
    drawPlayer(f);
  };
  if (mirror) p.mirrored(world);
  else world();

  drawHud(f);
  drawMoment(f);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** A line in the current style: 1px, or 2px when filled. */
function stroke(f: Frame, x0: number, y0: number, x1: number, y1: number): void {
  f.p.line(x0, y0, x1, y1);
  if (f.style.filled) {
    f.p.line(x0 + 1, y0, x1 + 1, y1);
    f.p.line(x0, y0 + 1, x1, y1 + 1);
  }
}

function drawTiles(f: Frame): void {
  const { p, game, style, X, Y } = f;
  const cam = game.camera;
  const map = game.map;
  const tx0 = Math.floor(cam.x / TILE);
  const tx1 = Math.floor((cam.x + VIEW_W - 1) / TILE);
  const ty0 = Math.floor(cam.y / TILE);
  const ty1 = Math.floor((cam.y + VIEW_H - 1) / TILE);

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const left = X(tx * TILE);
      const right = X((tx + 1) * TILE) - 1;
      const top = Y(ty * TILE);
      const bottom = Y((ty + 1) * TILE) - 1;
      const tile = map.tileAt(tx, ty);

      if (tile === Tile.Spikes) {
        p.color(style.hazard);
        const spikeTop = Y((ty + 1) * TILE - SPIKE_HEIGHT);
        const n = 4;
        const w = (right - left + 1) / n;
        for (let i = 0; i < n; i++) {
          const a = left + i * w;
          const tip = a + w / 2;
          p.line(a, bottom, tip, spikeTop);
          p.line(tip, spikeTop, a + w - 1, bottom);
        }
        continue;
      }
      if (!map.isSolidForDraw(tx, ty)) continue;
      p.color(style.tiles);

      if (style.filled) {
        // Solid bricks with paper-coloured mortar lines.
        p.rect(left, top, right - left + 1, bottom - top + 1);
        p.color(style.paper);
        const mid = Math.round((top + bottom) / 2);
        p.hline(left, right, mid);
        p.hline(left, right, bottom);
        p.vline(Math.round((left + right) / 2), top, mid);
        p.vline(right, mid, bottom);
        continue;
      }
      // Outline only the edges that face empty space, so solid regions read as line art.
      if (!map.isSolidForDraw(tx, ty - 1)) p.hline(left, right, top);
      if (!map.isSolidForDraw(tx, ty + 1)) p.hline(left, right, bottom);
      if (!map.isSolidForDraw(tx - 1, ty)) p.vline(left, top, bottom);
      if (!map.isSolidForDraw(tx + 1, ty)) p.vline(right, top, bottom);
    }
  }
}

function onScreen(f: Frame, x: number, y: number): boolean {
  const cam = f.game.camera;
  return x >= cam.x && x < cam.x + VIEW_W && y >= cam.y && y < cam.y + VIEW_H;
}

function drawPickups(f: Frame): void {
  const { p, game, style, s, fs, X, Y } = f;
  const half = Math.max(3, Math.round((PICKUP_SIZE / 2) * s));
  for (const pickup of game.pickups) {
    if (pickup.collected || !onScreen(f, pickup.x, pickup.y)) continue;
    const bob = Math.round(Math.sin(game.time * 3 + pickup.x * 0.1) * 1.5 * s);
    const cx = X(pickup.x);
    const cy = Y(pickup.y) + bob;
    p.color(style.pickup);
    const glyphTop = cy - Math.floor((GLYPH_H * fs) / 2);
    if (style.filled) {
      // An arcade token: a solid coin with the "?" cut out.
      p.disc(cx, cy, half + 1);
      p.color(style.paper);
      p.textCentered('?', cx, glyphTop, fs);
    } else {
      // Odd-sized box so the glyph sits exactly in the middle.
      p.strokeRect(cx - half, cy - half, half * 2 + 1, half * 2 + 1);
      p.textCentered('?', cx, glyphTop, fs);
    }
    // Label, kept fully on screen near the edges.
    const label = FEATURES[pickup.feature].label;
    const halfW = Math.ceil((textWidth(label) * fs) / 2);
    const labelX = Math.min(Math.max(cx, halfW + fs), p.width - halfW - fs);
    p.color(style.text);
    p.textCentered(label, labelX, cy - half - (GLYPH_H + 3) * fs, fs);
  }
}

function drawWalker(f: Frame, walker: Walker): void {
  const { p, style, alpha, X, Y } = f;
  if (walker.gone) return;
  if (!walker.alive && Math.floor(walker.deadT * 16) % 2 === 0) return; // death blink
  const b = walker.box;
  const x = lerp(walker.prevX, b.x, alpha);
  const y = lerp(walker.prevY, b.y, alpha);
  const left = X(x);
  const top = Y(y);
  const right = X(x + b.w) - 1;
  const bottom = Y(y + b.h) - 1;
  p.color(style.enemy);
  if (style.filled) {
    // Blocky body on two stubby legs, eyes looking where it's going.
    const legs = Math.max(1, Math.round((bottom - top) * 0.2));
    p.rect(left, top, right - left + 1, bottom - top + 1 - legs);
    p.rect(left + 1, bottom - legs + 1, 2, legs);
    p.rect(right - 2, bottom - legs + 1, 2, legs);
    p.color(style.paper);
    const eyeY = top + Math.round((bottom - top) * 0.25);
    const eyeX = walker.dir > 0 ? right - 5 : left + 2;
    p.rect(eyeX, eyeY, 2, 2);
    p.rect(eyeX + (walker.dir > 0 ? -4 : 4), eyeY, 2, 2);
  } else {
    p.strokeRect(left, top, right - left + 1, bottom - top + 1);
  }
}

function drawBoss(f: Frame, boss: BlockBoss): void {
  const { p, style, alpha, X, Y } = f;
  if (boss.state === 'dead') return;
  if (boss.state === 'dying' && Math.floor(boss.t * 12) % 2 === 0) return;
  const b = boss.box;
  const x = lerp(boss.prevX, b.x, alpha);
  const y = lerp(boss.prevY, b.y, alpha);
  const left = X(x);
  const top = Y(y);
  const w = X(x + b.w) - left;
  const h = Y(y + b.h) - top;
  const flash = boss.hitFlash > 0;
  const body = flash ? style.paper : style.enemy;
  const detail = flash ? style.enemy : style.paper;

  p.color(body);
  if (style.filled || flash) p.rect(left, top, w, h);
  else p.strokeRect(left, top, w, h);
  if (flash) {
    p.color(style.enemy);
    p.strokeRect(left, top, w, h);
  }

  // Face: angry brows and eyes, or X eyes when dazed.
  p.color(style.filled ? detail : style.enemy);
  const ex = Math.round(w * 0.22);
  const ey = top + Math.round(h * 0.3);
  const es = Math.max(2, Math.round(w * 0.12));
  for (const cx of [left + ex, left + w - ex - es]) {
    if (boss.state === 'dazed' || boss.state === 'dying') {
      p.line(cx, ey, cx + es, ey + es);
      p.line(cx + es, ey, cx, ey + es);
    } else {
      p.rect(cx, ey, es, es);
    }
  }
  p.line(left + ex - 2, ey - 4, left + ex + es, ey - 2);
  p.line(left + w - ex - es, ey - 2, left + w - ex + 2, ey - 4);
  const mouthY = top + Math.round(h * 0.72);
  p.hline(left + Math.round(w * 0.3), left + Math.round(w * 0.7), mouthY);
}

function drawPlayer(f: Frame): void {
  const { p, game, style, alpha, s, X, Y } = f;
  const player = game.player;
  // Blink while invulnerable after respawning.
  if (game.invulnerableT > 0 && Math.floor(game.invulnerableT * 12) % 2 === 0) return;
  const dying = game.deathT !== null;
  if (dying && game.deathT! > DEATH_TIME * 0.6 && Math.floor(game.deathT! * 16) % 2 === 0) return;

  const px = lerp(player.prevX, player.box.x, alpha) + player.box.w / 2;
  const py = lerp(player.prevY, player.box.y, alpha) + player.box.h;
  const moment = game.moment;
  // ARMS: the new arms blink in.
  const armsBlinking =
    moment?.feature === 'ARMS' && moment.t < 1.2 && Math.floor(moment.t * 10) % 2 === 0;
  const pose = stickPose({
    arms: game.features.has('ARMS') && !armsBlinking,
    state: player.state,
    facing: player.facing,
    punching: player.punchT > 0,
    dead: dying,
  });
  p.color(style.player);
  for (const [x0, y0, x1, y1] of pose.segments) {
    stroke(f, X(px + x0), Y(py + y0), X(px + x1), Y(py + y1));
  }
  const hx = X(px + pose.head.x);
  const hy = Y(py + pose.head.y);
  if (style.filled) p.disc(hx, hy, pose.head.r * s);
  else p.circle(hx, hy, pose.head.r * s);
}

function drawHud(f: Frame): void {
  const { p, game, style, fs } = f;
  /** HUD text on a paper-coloured backing, so it reads over walls too. */
  const label = (text: string, x: number, y: number) => {
    p.color(style.paper);
    p.rect(x - fs, y - fs, (textWidth(text) + 2) * fs, (GLYPH_H + 2) * fs);
    p.color(style.text);
    p.text(text, x, y, fs);
  };
  if (game.features.has('SCORE')) {
    const score = Math.floor(game.displayScore).toString().padStart(6, '0');
    label(`SCORE ${score}`, 2 * fs, 2 * fs);
  }
  if (game.features.has('LIVES')) {
    const text = `LIVES ${Math.max(0, game.lives)}`;
    label(text, p.width - (textWidth(text) + 2) * fs, 2 * fs);
  }
  p.color(style.text);

  // SCREEN 2: point at the exit.
  const moment = game.moment;
  if (
    moment?.feature === 'SCREEN_2' &&
    moment.t > MOMENT_HITSTOP &&
    Math.floor(moment.t * 4) % 2 === 0
  ) {
    p.text('>>', p.width - (textWidth('>>') + 2) * fs, Math.round(p.height * 0.62), fs);
  }

  // Boss: name card when it wakes, then health pips.
  const boss = game.boss;
  if (boss && boss.state !== 'waiting' && boss.state !== 'dead' && game.enemiesActive) {
    const pip = 3 * fs;
    const total = BOSS_HP * (pip + fs) - fs;
    const x0 = Math.round(p.width / 2 - total / 2);
    for (let i = 0; i < BOSS_HP; i++) {
      const x = x0 + i * (pip + fs);
      if (i < boss.hp) p.rect(x, 2 * fs, pip, pip);
      else p.strokeRect(x, 2 * fs, pip, pip);
    }
    if (game.bossIntroT !== null && game.bossIntroT < BOSS_INTRO_TIME) {
      p.textCentered('THE BLOCK', p.width / 2, Math.round(p.height * 0.18), fs * 2);
    }
  }
}

/** Unlock banner: what you got, and a nudge on how to use it. */
function drawMoment(f: Frame): void {
  const { p, game, style, fs } = f;
  const moment = game.moment;
  if (!moment || moment.t < MOMENT_FLASH) return;
  if (moment.t > MOMENT_DURATION - 0.5 && Math.floor(moment.t * 8) % 2 === 0) return;

  const def = FEATURES[moment.feature];
  // Whichever half of the screen the player isn't in.
  const playerY = (game.playerCenterY - game.camera.y) / VIEW_H;
  const top = Math.round(p.height * (playerY < 0.5 ? 0.58 : 0.15));
  // A plain outlined box so level lines never run through the text.
  const width =
    Math.max(textWidth('FEATURE ADDED'), textWidth(def.label) * 2, textWidth(def.hint)) * fs;
  const pad = 3 * fs;
  const box = {
    x: Math.round(p.width / 2 - width / 2) - pad,
    y: top - pad,
    w: width + pad * 2,
    h: (GLYPH_H * 4 + 6) * fs + pad * 2,
  };
  p.color(style.paper);
  p.rect(box.x, box.y, box.w, box.h);
  p.color(style.text);
  p.strokeRect(box.x, box.y, box.w, box.h);
  p.textCentered('FEATURE ADDED', p.width / 2, top, fs);
  p.textCentered(def.label, p.width / 2, top + (GLYPH_H + 3) * fs, fs * 2);
  p.textCentered(def.hint, p.width / 2, top + (GLYPH_H * 3 + 6) * fs, fs);
}

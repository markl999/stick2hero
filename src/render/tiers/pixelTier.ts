import { TILE, VIEW_H, VIEW_W } from '../../config';
import { FEATURES } from '../../core/features';
import {
  BOSS_HP,
  FLICKER_HP,
  type BlockBoss,
  type FlickerBoss,
  type Walker,
} from '../../game/enemies';
import {
  BOSS_INTRO_TIME,
  DEATH_TIME,
  MOMENT_DURATION,
  MOMENT_FLASH,
  MOMENT_HITSTOP,
  type Game,
} from '../../game/game';
import { PICKUP_SIZE } from '../../game/pickup';
import { LAND_SQUASH_TIME } from '../../game/player';
import type { Flag, Switch } from '../../game/props';
import { SPIKE_HEIGHT, Tile } from '../../world/tilemap';
import { GLYPH_H, textWidth } from '../font3x5';
import type { PixelCanvas } from '../pixelCanvas';
import { stickPose } from '../stickman';

/**
 * The low-res pixel eras, one renderer with a palette per stage:
 *   Era 0 (BOOT)    a white void, 1px black outlines
 *   Era 1 (ARCADE)  black screen, filled phosphor-green pixels, bricks, a bold stick man
 *   Era 2 (8-BIT)   the same, until COLOUR (4) floods in, then COLOUR (16)
 */
interface PixelStyle {
  paper: string;
  tiles: string;
  /** Brick mortar lines. */
  mortar: string;
  /** Grass on top of exposed tiles (16 colours only). */
  grass: string | null;
  hazard: string;
  /** Hot bricks: only distinguishable from normal bricks once there's colour. */
  hot: string;
  hotMortar: string;
  door: string;
  player: string;
  /** Hands and feet. */
  skin: string;
  enemy: string;
  /** Eyes and small details on enemies. */
  detail: string;
  pickup: string;
  text: string;
  /** Filled shapes and 2px lines (Era 1+) vs 1px outlines (Era 0). */
  filled: boolean;
}

const ERA0: PixelStyle = {
  paper: '#ffffff',
  tiles: '#000000',
  mortar: '#ffffff',
  grass: null,
  hazard: '#000000',
  hot: '#000000',
  hotMortar: '#ffffff',
  door: '#000000',
  player: '#000000',
  skin: '#000000',
  enemy: '#000000',
  detail: '#ffffff',
  pickup: '#000000',
  text: '#000000',
  filled: false,
};

const PHOSPHOR = '#33ff66';
const MONO: PixelStyle = {
  paper: '#020a04',
  tiles: PHOSPHOR,
  mortar: '#020a04',
  grass: null,
  hazard: PHOSPHOR,
  hot: PHOSPHOR, // identical to bricks: you can't tell without colour
  hotMortar: '#020a04',
  door: PHOSPHOR,
  player: PHOSPHOR,
  skin: PHOSPHOR,
  enemy: PHOSPHOR,
  detail: '#020a04',
  pickup: PHOSPHOR,
  text: PHOSPHOR,
  filled: true,
};

/** COLOUR (4): black, white, cyan, red. Red means danger. */
const COLOUR4: PixelStyle = {
  paper: '#000000',
  tiles: '#55ffff',
  mortar: '#000000',
  grass: null,
  hazard: '#ff5555',
  hot: '#ff5555',
  hotMortar: '#000000',
  door: '#55ffff',
  player: '#ffffff',
  skin: '#ffffff',
  enemy: '#ff5555',
  detail: '#000000',
  pickup: '#ffffff',
  text: '#ffffff',
  filled: true,
};

/** COLOUR (16): a full 8-bit palette. */
const COLOUR16: PixelStyle = {
  paper: '#1d2b53',
  tiles: '#ab5236',
  mortar: '#5f2a1a',
  grass: '#00e436',
  hazard: '#ff004d',
  hot: '#ff6c24',
  hotMortar: '#a8231c',
  door: '#c2c3c7',
  player: '#fff1e8',
  skin: '#ffccaa',
  enemy: '#ff004d',
  detail: '#fff1e8',
  pickup: '#ffec27',
  text: '#fff1e8',
  filled: true,
};

function baseStyle(game: Game, colour: 0 | 4 | 16): PixelStyle {
  if (game.level.era === 0) return ERA0;
  if (colour === 16) return COLOUR16;
  if (colour === 4) return COLOUR4;
  return MONO;
}

function colourLevel(game: Game): 0 | 4 | 16 {
  if (game.features.has('COLOUR_16')) return 16;
  if (game.features.has('COLOUR_4')) return 4;
  return 0;
}

/** The unlock flash: everything inverts. */
function inverted(style: PixelStyle): PixelStyle {
  const out = { ...style };
  for (const key of Object.keys(out) as (keyof PixelStyle)[]) {
    if (key !== 'filled' && key !== 'grass') (out[key] as string) = style.paper;
  }
  out.paper = style.text;
  out.grass = null;
  return out;
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
  camX: number;
  camY: number;
  X(wx: number): number;
  Y(wy: number): number;
}

export function drawPixelTier(p: PixelCanvas, game: Game, alpha: number): void {
  const s = p.width / VIEW_W;
  const moment = game.moment;
  const t = moment?.t ?? Infinity;
  const cam = game.camera;
  const camX = lerp(cam.prevX, cam.x, alpha);
  const camY = lerp(cam.prevY, cam.y, alpha);

  // JUMP: the screen itself hops.
  const hop =
    moment?.feature === 'JUMP' && t >= MOMENT_FLASH && t < 0.6
      ? -Math.round(Math.sin((Math.PI * (t - MOMENT_FLASH)) / (0.6 - MOMENT_FLASH)) * 8 * s)
      : 0;

  const level = colourLevel(game);
  let style = baseStyle(game, level);
  if (game.flashing) style = inverted(style);

  const frame = (st: PixelStyle): Frame => ({
    p,
    game,
    style: st,
    alpha,
    s,
    fs: Math.max(1, Math.round(2 * s)),
    camX,
    camY,
    X: (wx) => Math.round((wx - camX) * s),
    Y: (wy) => Math.round((wy - camY) * s) + hop,
  });
  const f = frame(style);

  const world = (fr: Frame) => {
    p.clear(fr.style.paper);
    drawTiles(fr);
    drawFlags(fr);
    drawSwitches(fr);
    drawPickups(fr);
    if (game.enemiesActive) {
      for (const walker of game.walkers) drawWalker(fr, walker);
      if (game.boss) drawBlock(fr, game.boss);
      if (game.flicker) drawFlicker(fr, game.flicker);
    }
    drawProjectiles(fr);
    drawPlayer(fr);
  };

  // COLOUR: the new palette floods outward from the pickup over the old one.
  const wave = colourWave(f, moment);
  if (wave && !game.flashing) {
    world(frame(baseStyle(game, level === 16 ? 4 : 0)));
    p.clippedToCircle(wave.x, wave.y, wave.r, () => world(f));
  } else if (moment?.feature === 'LEFT' && t >= MOMENT_FLASH && t < MOMENT_HITSTOP) {
    // ← LEFT: the world briefly turns around.
    p.mirrored(() => world(f));
  } else {
    world(f);
  }

  drawHud(f);
  drawMoment(f);
}

function colourWave(f: Frame, moment: Game['moment']): { x: number; y: number; r: number } | null {
  if (!moment || (moment.feature !== 'COLOUR_4' && moment.feature !== 'COLOUR_16')) return null;
  const k = (moment.t - MOMENT_FLASH) / 1.1;
  if (k >= 1) return null;
  const origin = moment.origin ?? { x: f.camX + VIEW_W / 2, y: f.camY + VIEW_H / 2 };
  const reach = Math.hypot(f.p.width, f.p.height);
  return { x: f.X(origin.x), y: f.Y(origin.y), r: Math.max(0, k) * reach };
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
  const map = game.map;
  const tx0 = Math.floor(f.camX / TILE);
  const tx1 = Math.floor((f.camX + VIEW_W) / TILE);
  const ty0 = Math.floor(f.camY / TILE);
  const ty1 = Math.floor((f.camY + VIEW_H) / TILE);

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
      if (tile === Tile.Door) {
        // A barred gate.
        p.color(style.door);
        const bars = 4;
        const step = (right - left + 1) / bars;
        for (let i = 0; i < bars; i++) {
          p.rect(left + i * step + 1, top, Math.max(1, step - 2), bottom - top + 1);
        }
        p.hline(left, right, top);
        p.hline(left, right, bottom);
        continue;
      }
      if (!map.isSolidForDraw(tx, ty)) continue;

      if (style.filled) {
        const hot = tile === Tile.Hot;
        // Solid bricks with mortar lines.
        p.color(hot ? style.hot : style.tiles);
        p.rect(left, top, right - left + 1, bottom - top + 1);
        p.color(hot ? style.hotMortar : style.mortar);
        const mid = Math.round((top + bottom) / 2);
        p.hline(left, right, mid);
        p.hline(left, right, bottom);
        p.vline(Math.round((left + right) / 2), top, mid);
        p.vline(right, mid, bottom);
        if (style.grass && !hot && !map.isSolidForDraw(tx, ty - 1)) {
          p.color(style.grass);
          p.rect(left, top, right - left + 1, Math.max(2, Math.round((bottom - top) * 0.2)));
        }
        continue;
      }
      // Outline only the edges that face empty space, so solid regions read as line art.
      p.color(style.tiles);
      if (!map.isSolidForDraw(tx, ty - 1)) p.hline(left, right, top);
      if (!map.isSolidForDraw(tx, ty + 1)) p.hline(left, right, bottom);
      if (!map.isSolidForDraw(tx - 1, ty)) p.vline(left, top, bottom);
      if (!map.isSolidForDraw(tx + 1, ty)) p.vline(right, top, bottom);
    }
  }
}

function onScreen(f: Frame, x: number, y: number, margin = 0): boolean {
  return (
    x >= f.camX - margin &&
    x < f.camX + VIEW_W + margin &&
    y >= f.camY - margin &&
    y < f.camY + VIEW_H + margin
  );
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

function drawFlags(f: Frame): void {
  if (!f.game.features.has('CHECKPOINTS')) return;
  for (const flag of f.game.flags) {
    if (onScreen(f, flag.x, flag.y, TILE)) drawFlag(f, flag);
  }
}

function drawFlag(f: Frame, flag: Flag): void {
  const { p, s, style } = f;
  const x = f.X(flag.x);
  const y = f.Y(flag.y);
  const pole = Math.round(26 * s);
  p.color(style.text);
  p.vline(x, y - pole, y - 1);
  p.hline(x - 2, x + 2, y - 1);
  // The flag: down at the bottom until you touch it, then up at the top.
  const fy = flag.raised ? y - pole : y - Math.round(10 * s);
  p.color(flag.raised ? style.pickup : style.hazard);
  const w = Math.round(9 * s);
  const h = Math.round(6 * s);
  for (let i = 0; i < h; i++) p.hline(x + 1, x + Math.round(w * (1 - i / h)), fy + i);
}

function drawSwitches(f: Frame): void {
  for (const sw of f.game.switches) {
    if (onScreen(f, sw.box.x, sw.box.y, TILE)) drawSwitch(f, sw);
  }
}

function drawSwitch(f: Frame, sw: Switch): void {
  const { p, s, style } = f;
  const cx = f.X(sw.box.x + sw.box.w / 2);
  const cy = f.Y(sw.box.y + sw.box.h / 2);
  // A target: ring and bullseye. Hit ones go solid.
  const r = Math.round(5 * s);
  p.color(sw.hit ? style.pickup : style.hazard);
  if (sw.hit) {
    p.disc(cx, cy, r);
  } else {
    p.circle(cx, cy, r);
    p.disc(cx, cy, Math.max(1, Math.round(r / 3)));
  }
}

function drawWalker(f: Frame, walker: Walker): void {
  const { p, game, style, alpha, X, Y } = f;
  if (walker.gone) return;
  if (!walker.alive && Math.floor(walker.deadT * 16) % 2 === 0) return; // death blink
  const b = walker.box;
  const x = lerp(walker.prevX, b.x, alpha);
  const y = lerp(walker.prevY, b.y, alpha);
  if (!onScreen(f, x, y, TILE)) return;
  const left = X(x);
  const top = Y(y);
  const right = X(x + b.w) - 1;
  const bottom = Y(y + b.h) - 1;
  p.color(style.enemy);
  if (!style.filled) {
    p.strokeRect(left, top, right - left + 1, bottom - top + 1);
    return;
  }
  // Blocky body on two stubby legs, eyes looking where it's going. With ANIMATION the
  // legs take turns.
  const legs = Math.max(1, Math.round((bottom - top) * 0.2));
  const animated = game.features.has('ANIMATION') && walker.alive;
  const step = animated ? Math.floor(x / 3) % 2 : 0;
  p.rect(left, top, right - left + 1, bottom - top + 1 - legs);
  p.rect(left + 1, bottom - legs + 1 - step, 2, legs);
  p.rect(right - 2, bottom - legs + 1 - (animated ? 1 - step : 0), 2, legs);
  p.color(style.detail);
  const eyeY = top + Math.round((bottom - top) * 0.25);
  const eyeX = walker.dir > 0 ? right - 5 : left + 2;
  p.rect(eyeX, eyeY, 2, 2);
  p.rect(eyeX + (walker.dir > 0 ? -4 : 4), eyeY, 2, 2);
}

function drawBlock(f: Frame, boss: BlockBoss): void {
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

  p.color(flash ? style.paper : style.enemy);
  if (style.filled || flash) p.rect(left, top, w, h);
  else p.strokeRect(left, top, w, h);
  if (flash) {
    p.color(style.enemy);
    p.strokeRect(left, top, w, h);
  }

  // Face: angry brows and eyes, or X eyes when dazed.
  p.color(style.filled && !flash ? style.detail : style.enemy);
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

function drawFlicker(f: Frame, boss: FlickerBoss): void {
  const { p, game, style, alpha, X, Y } = f;
  if (boss.state === 'dead' || boss.state === 'waiting') return;
  // Sprite flicker: invisible on alternate frames while flickering (or dying).
  const flickering = boss.flickering || boss.state === 'dying';
  if (flickering && Math.floor(game.time * 30) % 2 === 0) return;
  const b = boss.box;
  const x = lerp(boss.prevX, b.x, alpha);
  const y = lerp(boss.prevY, b.y, alpha);
  const left = X(x);
  const top = Y(y);
  const w = X(x + b.w) - left;
  const h = Y(y + b.h) - top;
  const cx = left + w / 2;
  // A flapping bat-like thing: body, wings up or down, two eyes.
  const wingY = Math.floor(game.time * 8) % 2 === 0 ? top : top + h * 0.6;
  p.color(style.enemy);
  p.disc(cx, top + h * 0.55, h * 0.4);
  for (const dir of [-1, 1]) {
    const tipX = cx + dir * w * 0.5;
    stroke(f, cx + dir * h * 0.3, top + h * 0.5, tipX, wingY);
    stroke(f, tipX, wingY, cx + dir * w * 0.3, top + h * 0.7);
  }
  p.color(style.detail);
  p.rect(cx - 4, top + h * 0.45, 2, 2);
  p.rect(cx + 2, top + h * 0.45, 2, 2);
}

function drawProjectiles(f: Frame): void {
  const { p, game, style, alpha, s, X, Y } = f;
  p.color(style.player);
  for (const pebble of game.pebbles) {
    const x = lerp(pebble.prevX, pebble.box.x, alpha);
    const y = lerp(pebble.prevY, pebble.box.y, alpha);
    const size = Math.max(2, Math.round(pebble.box.w * s));
    p.rect(X(x), Y(y), size, size);
  }
  for (const bomb of game.bombs) {
    const x = lerp(bomb.prevX, bomb.box.x, alpha) + bomb.box.w / 2;
    const y = lerp(bomb.prevY, bomb.box.y, alpha) + bomb.box.h / 2;
    p.color(style.hazard);
    p.disc(X(x), Y(y), Math.max(2, (bomb.box.w / 2) * s));
    if (Math.floor(game.time * 12) % 2 === 0) {
      // The fuse spark.
      p.color(style.text);
      p.rect(X(x), Y(y) - Math.round(4 * s), 1, Math.max(1, Math.round(2 * s)));
    }
  }
}

function drawPlayer(f: Frame): void {
  const { p, game, style, alpha, s, X, Y } = f;
  const player = game.player;
  // Blink while invulnerable after respawning.
  if (game.invulnerableT > 0 && Math.floor(game.invulnerableT * 12) % 2 === 0) return;
  const deathT = game.deathT;
  if (deathT !== null && deathT > DEATH_TIME * 0.6 && Math.floor(deathT * 16) % 2 === 0) return;

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
    dead: deathT !== null,
    animated: game.features.has('ANIMATION')
      ? {
          walkDistance: player.walkDistance,
          moving: player.vx !== 0,
          onGround: player.onGround,
          vy: player.vy,
          squash: player.landSquash / LAND_SQUASH_TIME,
          wallSliding: player.wallSliding,
        }
      : undefined,
  });
  p.color(style.player);
  for (const [x0, y0, x1, y1] of pose.segments) {
    stroke(f, X(px + x0), Y(py + y0), X(px + x1), Y(py + y1));
  }
  const hx = X(px + pose.head.x);
  const hy = Y(py + pose.head.y);
  if (style.filled) p.disc(hx, hy, pose.head.r * s);
  else p.circle(hx, hy, pose.head.r * s);

  // HANDS & FEET: little fists and shoes.
  if (game.features.has('HANDS_FEET')) {
    const size = Math.max(2, Math.round(2.5 * s));
    p.color(style.skin);
    for (const [x, y] of pose.hands) p.rect(X(px + x) - 1, Y(py + y) - 1, size, size);
    p.color(style.player);
    const shoe = Math.max(2, Math.round(1.5 * s));
    for (const [x, y] of pose.feet) p.rect(X(px + x) - 1, Y(py + y) - shoe + 1, size + 1, shoe);
  }
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

  // Bosses: name card when they wake, then health pips.
  const boss = game.enemiesActive ? (game.boss ?? game.flicker) : null;
  if (boss && boss.state !== 'waiting' && boss.state !== 'dead') {
    const maxHp = game.boss ? BOSS_HP : FLICKER_HP;
    const pip = 3 * fs;
    const total = maxHp * (pip + fs) - fs;
    const x0 = Math.round(p.width / 2 - total / 2);
    p.color(style.hazard);
    for (let i = 0; i < maxHp; i++) {
      const x = x0 + i * (pip + fs);
      if (i < boss.hp) p.rect(x, 2 * fs, pip, pip);
      else p.strokeRect(x, 2 * fs, pip, pip);
    }
    if (game.bossIntroT !== null && game.bossIntroT < BOSS_INTRO_TIME) {
      p.color(style.text);
      const name = game.boss ? 'THE BLOCK' : 'FLICKER';
      p.textCentered(name, p.width / 2, Math.round(p.height * 0.18), fs * 2);
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
  const playerY = (game.playerCenterY - f.camY) / VIEW_H;
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
  p.color(moment.feature.startsWith('COLOUR') ? style.pickup : style.text);
  p.textCentered(def.label, p.width / 2, top + (GLYPH_H + 3) * fs, fs * 2);
  p.color(style.text);
  p.textCentered(def.hint, p.width / 2, top + (GLYPH_H * 3 + 6) * fs, fs);
}

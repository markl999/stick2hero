import { VIEW_W } from '../../config';
import {
  DEPRECATOR_LINES,
  LANTERN_RADIUS,
  LETTERBOX_TIME,
  type Ghost,
  type Light,
  type Particle,
} from '../../game/era4';
import { GLYPH_H } from '../font3x5';
import { wrap } from './era3Draw';
import type { Frame } from './pixelTier';

/*
 * Era 4 (32-BIT) drawing: a moonlit night, water and hollow walls (TRANSPARENCY),
 * particles, real lighting, pseudo-3D depth, the cutscene and the Chase.
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

/** Deterministic pseudo-random 0..1 for a seed (stars, columns). */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// --- Sky and DEPTH ---------------------------------------------------------------------

/** The sky's gradient, one pixel wide, made once per canvas height and stretched across. */
let skyStrip: HTMLCanvasElement | null = null;
function skyGradient(h: number): HTMLCanvasElement | null {
  if (skyStrip?.height === h) return skyStrip;
  const strip = document.createElement('canvas');
  strip.width = 1;
  strip.height = h;
  const ctx = strip.getContext('2d');
  if (!ctx) return null;
  for (let y = 0; y < h; y++) {
    ctx.fillStyle = mix('#060a1c', '#2b3d6e', Math.min(1, y / (h * 0.85)));
    ctx.fillRect(0, y, 1, 1);
  }
  skyStrip = strip;
  return strip;
}

export function drawNightSky(f: Frame, depthIntro: number | null): void {
  const { p, game, s } = f;
  const h = p.height;
  const strip = skyGradient(h);
  if (strip) {
    const ctx = p.context;
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(strip, 0, 0, p.width, h);
    ctx.imageSmoothingEnabled = smooth;
  }
  // Stars, drifting very slightly.
  p.color('#dfe8ff');
  for (let i = 0; i < 90; i++) {
    const x = (((hash(i) * p.width * 1.4 - f.camX * 0.04 * s) % p.width) + p.width) % p.width;
    const y = hash(i + 500) * h * 0.55;
    const twinkle = Math.sin(game.time * 2 + i) > 0.6 ? 2 : 1;
    p.rect(x, y, twinkle, twinkle);
  }
  // The moon.
  p.color('#f4f1de');
  p.disc(p.width * 0.78 - f.camX * 0.02 * s, h * 0.2, 22 * s);
  p.color(mix('#060a1c', '#2b3d6e', 0.25));
  p.disc(p.width * 0.78 - f.camX * 0.02 * s + 8 * s, h * 0.18, 18 * s);
  // Ruins on the horizon (Era 5: a city skyline, windows lit).
  const city = game.level.era === 5;
  p.color('#1a2340');
  const step = Math.max(1, Math.round(s));
  const skylineTop = (x: number) => {
    const block = Math.floor((f.camX * 0.15 + x / s) / 26);
    const height = city
      ? 40 + hash(block + 9) * 70
      : hash(block) > 0.45
        ? 30 + hash(block + 9) * 50
        : 12 + hash(block + 3) * 10;
    return Math.round(h * 0.78 - height * s);
  };
  // One rectangle per building, not per column.
  for (let x = 0; x < p.width; ) {
    const top = skylineTop(x);
    let end = x + step;
    while (end < p.width && skylineTop(end) === top) end += step;
    p.rect(x, top, end - x, h - top);
    x = end;
  }
  if (city) {
    p.color('#ffcf6b');
    for (let i = 0; i < 70; i++) {
      const x =
        (((hash(i + 900) * p.width * 1.3 - f.camX * 0.15 * s) % p.width) + p.width) % p.width;
      p.rect(x, h * (0.5 + hash(i + 950) * 0.25), Math.max(1, s), Math.max(1, s));
    }
  }

  if (!game.features.has('DEPTH')) return;
  // DEPTH: a floor plane receding to the horizon, and columns standing at depths.
  const k = depthIntro === null ? 1 : Math.min(1, Math.max(0, (depthIntro - 0.15) / 0.9));
  const horizon = h * 0.7;
  const vanishX = p.width / 2;
  p.color('#2a3558');
  for (let row = 1; row <= 7; row++) {
    const y = horizon + (h - horizon) * Math.pow(row / 7, 2) * k;
    p.hline(0, p.width, y);
  }
  for (let col = -12; col <= 12; col++) {
    const offset = ((f.camX * 0.5 * s) % (60 * s)) / (60 * s);
    const bottomX = vanishX + (col - offset) * 60 * s * 1.6;
    p.line(vanishX + (bottomX - vanishX) * 0.08, horizon, lerp(vanishX, bottomX, k), h);
  }
  // Columns at three depths: far ones small and slow, near ones big and fast.
  for (const [depth, colour] of [
    [0.25, '#26304f'],
    [0.45, '#2e3a5f'],
    [0.7, '#384672'],
  ] as const) {
    const spacing = 140;
    const scale = depth * k;
    for (let i = -1; i < 8; i++) {
      const base = Math.floor((f.camX * depth) / spacing) + i;
      const wx = base * spacing - f.camX * depth;
      const x = wx * s;
      const width = 18 * scale * s;
      const height = 150 * scale * s;
      const bottom = horizon + (h - horizon) * depth * 0.4;
      if (hash(base * 7 + depth * 100) < 0.35) continue;
      p.color(colour);
      p.rect(x - width / 2, bottom - height, width, height);
      p.rect(x - width * 0.8, bottom - height - 4 * scale * s, width * 1.6, 5 * scale * s);
    }
  }
}

/** DEPTH: dark pillars and hanging vines passing in front of everything. */
export function drawForeground(f: Frame): void {
  const { p, game, s } = f;
  if (!game.features.has('DEPTH')) return;
  const factor = 1.45;
  const spacing = 210;
  p.color('#03050d');
  for (let i = -1; i < 5; i++) {
    const base = Math.floor((f.camX * factor) / spacing) + i;
    if (hash(base * 3) < 0.45) continue;
    const x = (base * spacing - f.camX * factor) * s;
    if (hash(base * 5) < 0.5) {
      // A pillar.
      p.rect(x, 0, 16 * s, p.height);
    } else {
      // Vines from the top.
      for (let v = 0; v < 4; v++) {
        const len = (40 + hash(base * 11 + v) * 70) * s;
        p.rect(x + v * 6 * s, 0, 2 * s, len);
        p.rect(x + v * 6 * s - s, len - 3 * s, 4 * s, 3 * s);
      }
    }
  }
}

// --- TRANSPARENCY: water and hollow walls ----------------------------------------------

export function drawWater(
  f: Frame,
  left: number,
  top: number,
  w: number,
  h: number,
  surface: boolean,
): void {
  const { p, game } = f;
  if (game.features.has('TRANSPARENCY')) {
    p.withAlpha(0.42, () => {
      p.color('#3a7bd5');
      p.rect(left, top, w, h);
    });
    if (surface) {
      p.color('#9fd3ff');
      const wave = Math.round(Math.sin(game.time * 3 + left * 0.05) * f.s);
      p.hline(left, left + w - 1, top + wave + f.s);
    }
  } else {
    // Without alpha, water is just a blue wall.
    p.color('#2a55a8');
    p.rect(left, top, w, h);
    p.color('#3a6cc7');
    p.hline(left, left + w - 1, top + h / 2);
  }
}

// --- Ghosts, torches, braziers ---------------------------------------------------------

export function drawGhost(f: Frame, ghost: Ghost): void {
  const { p, game, alpha, s, X, Y } = f;
  if (ghost.gone) return;
  const x = lerp(ghost.prevX, ghost.box.x, alpha);
  const y = lerp(ghost.prevY, ghost.box.y, alpha);
  const left = X(x);
  const top = Y(y);
  const w = X(x + ghost.box.w) - left;
  const h = Y(y + ghost.box.h) - top;
  const see = game.features.has('TRANSPARENCY');
  const fade = ghost.alive ? 1 : Math.max(0, 1 - ghost.deadT / 0.6);
  p.withAlpha((see ? 0.55 : 1) * fade, () => {
    // A sheet: round top, wavy hem, hollow eyes.
    p.color('#e8f4ff');
    p.disc(left + w / 2, top + w / 2, w / 2);
    p.rect(left, top + w / 2, w, h - w / 2 - 2 * s);
    for (let i = 0; i < 4; i++) {
      const wave = Math.sin(game.time * 6 + i) > 0 ? 2 * s : 0;
      p.rect(left + (i * w) / 4, top + h - 2 * s - wave, w / 4, 2 * s + wave);
    }
    p.color('#1b2240');
    p.rect(left + w * 0.25, top + h * 0.3, w * 0.15, h * 0.18);
    p.rect(left + w * 0.6, top + h * 0.3, w * 0.15, h * 0.18);
  });
}

export function drawLightSource(f: Frame, light: Light): void {
  const { p, game, s, X, Y } = f;
  const x = X(light.x);
  const y = Y(light.y);
  if (light.kind === 'torch') {
    // A bracket on the wall.
    p.color('#5c4a3a');
    p.rect(x - s, y - 30 * s, 2 * s, 10 * s);
  } else {
    // A brazier: a bowl on a stand.
    p.color('#6d6d78');
    p.rect(x - 2 * s, y - 10 * s, 4 * s, 10 * s);
    p.rect(x - 7 * s, y - 15 * s, 14 * s, 5 * s);
    p.color('#4a4a55');
    p.rect(x - 5 * s, y - s, 10 * s, s);
  }
  if (!light.lit) return;
  const flameY = Y(light.flameY);
  const flicker = Math.sin(game.time * 17 + light.x) * s;
  p.color('#ff8c2a');
  p.disc(x, flameY, 4 * s + flicker * 0.5);
  p.color('#ffd25a');
  p.disc(x, flameY + s, 2.5 * s);
}

const PARTICLE_COLOURS: Record<Particle['kind'], string> = {
  dust: '#b9a98f',
  spark: '#ffe27a',
  splash: '#9fd3ff',
  debris: '#8b7b66',
  glitch: '#ff3df2',
  ember: '#ff9a3c',
};

export function drawParticles(f: Frame): void {
  const { p, game, s, X, Y } = f;
  if (!game.features.has('PARTICLES')) return;
  for (const part of game.particles.list) {
    const k = part.life / part.max;
    const size = Math.max(1, Math.round(part.size * s * (part.kind === 'dust' ? 1 + (1 - k) : 1)));
    const draw = () => {
      p.color(
        part.kind === 'glitch'
          ? Math.random() < 0.5
            ? '#ff3df2'
            : '#3dfff2'
          : PARTICLE_COLOURS[part.kind],
      );
      p.rect(X(part.x) - size / 2, Y(part.y) - size / 2, size, size);
    };
    if (game.features.has('TRANSPARENCY')) p.withAlpha(Math.min(1, k * 1.5), draw);
    else draw();
  }
}

// --- LIGHTING --------------------------------------------------------------------------

export function drawLighting(f: Frame): void {
  const { p, game, s, X, Y } = f;
  if (!game.features.has('LIGHTING')) return;
  const player = game.player;
  const lights: { x: number; y: number; r: number }[] = [];
  const flicker = (seed: number) =>
    1 + Math.sin(game.time * 11 + seed) * 0.04 + Math.sin(game.time * 23 + seed) * 0.03;
  // Your lantern.
  lights.push({
    x: X(player.feetX),
    y: Y(player.box.y + 8),
    r: LANTERN_RADIUS * s * flicker(1),
  });
  for (const light of game.lights) {
    if (light.lit)
      lights.push({ x: X(light.x), y: Y(light.flameY), r: light.radius * s * flicker(light.x) });
  }
  for (const lamp of game.lamps) {
    if (lamp.lit) lights.push({ x: X(lamp.x), y: Y(lamp.y), r: lamp.radius * s });
  }
  // Things that glow a little on their own.
  for (const ghost of game.ghosts) {
    if (ghost.alive && game.enemiesActive)
      lights.push({ x: X(ghost.box.x + 8), y: Y(ghost.box.y + 9), r: 26 * s });
  }
  for (const pickup of game.pickups) {
    if (!pickup.collected) lights.push({ x: X(pickup.x), y: Y(pickup.y), r: 30 * s });
  }
  for (const part of game.particles.list) {
    if (part.kind === 'ember' || part.kind === 'spark')
      lights.push({ x: X(part.x), y: Y(part.y), r: 6 * s });
  }
  // During the LIGHTING moment the dark falls gradually.
  const m = game.moment;
  const fall = m?.feature === 'LIGHTING' ? Math.min(1, m.t / 1.2) : 1;
  p.darkness(`rgba(3,5,18,${(0.96 * fall).toFixed(3)})`, lights);
}

// --- The cutscene and the Chase ---------------------------------------------------------

/** The Deprecator: a tall shape made of missing data, tearing at the edges. */
export function drawDeprecator(f: Frame): void {
  const { p, game, s, X, Y } = f;
  const scene = game.cutscene;
  const at = game.deprecator;
  if (!scene || !at) return;
  if (scene.phase === 'letterbox' || scene.phase === 'pan') return;
  const appear = scene.phase === 'materialise' ? scene.t : 1;
  const leaving = scene.phase === 'delete' ? scene.t : 0;
  if (appear < 1 && Math.random() > appear) return; // flickers into being
  const x = X(at.x);
  const y = Y(at.y);
  const w = 26 * s;
  const h = 64 * s;
  const tear = (n: number) => (Math.random() - 0.5) * n * s;
  for (let row = 0; row < h; row += 2 * s) {
    if (leaving > 0 && Math.random() < leaving) continue;
    const half = (w / 2) * (row < h * 0.25 ? 0.6 : 1) + tear(3);
    const shift = Math.random() < 0.1 ? tear(16) : 0;
    p.color('#ff3df2');
    p.hline(x - half + shift - 2 * s, x + half + shift - 2 * s, y - h + row);
    p.color('#3dfff2');
    p.hline(x - half + shift + 2 * s, x + half + shift + 2 * s, y - h + row);
    p.color('#000000');
    p.rect(x - half + shift, y - h + row, half * 2, 2 * s);
  }
  // Two white rectangles for eyes.
  p.color('#ffffff');
  p.rect(x - 7 * s, y - h + 9 * s, 4 * s, 2 * s);
  p.rect(x + 3 * s, y - h + 9 * s, 4 * s, 2 * s);
}

/** Letterbox bars, the villain's lines, and the static wipe when it says its word. */
export function drawCutsceneOverlay(f: Frame): void {
  const { p, game, fs } = f;
  const scene = game.cutscene;
  const chasing = game.wave?.active ?? false;
  if (!scene && !chasing) return;

  const k = scene?.phase === 'letterbox' ? Math.min(1, scene.t / LETTERBOX_TIME) : 1;
  // Full bars for the cutscene; thin ones during the Chase so they never hide the floor.
  const bar = Math.round(p.height * (scene ? 0.11 : 0.04) * k);
  p.color('#000000');
  p.rect(0, 0, p.width, bar);
  p.rect(0, p.height - bar, p.width, bar);

  if (scene?.phase === 'talk') {
    // Smaller type in the bottom bar: the speaker, then up to two lines.
    const ts = Math.max(1, Math.round(fs / 2));
    const line = DEPRECATOR_LINES[scene.line];
    const shown = line.text.slice(0, Math.floor(scene.chars));
    const x = 6 * ts;
    const top = p.height - bar + 2 * ts;
    p.color('#ff3df2');
    p.text(line.speaker, x, top, ts);
    p.color('#ffffff');
    const lines = wrap(shown, Math.floor((p.width - 12 * ts) / ts));
    lines.slice(0, 2).forEach((l, i) => p.text(l, x, top + (GLYPH_H + 3) * ts * (i + 1), ts));
  }
  if (scene?.phase === 'delete' && !game.comfort.reduceFlashing) {
    // Static tears across the screen.
    for (let i = 0; i < 40; i++) {
      p.color(Math.random() < 0.5 ? '#ff3df2' : Math.random() < 0.5 ? '#3dfff2' : '#ffffff');
      p.rect(Math.random() * p.width, Math.random() * p.height, Math.random() * 80 * fs, fs);
    }
  }

  // "RUN!" as the Chase starts.
  const run = game.chaseT;
  if (run !== null && run < 1.6 && Math.floor(run * 6) % 2 === 0) {
    p.color('#ff3df2');
    p.textCentered('RUN!', p.width / 2, Math.round(p.height * 0.25), fs * 4);
  }
}

/** The deletion wave: everything behind it is torn away into static. */
export function drawWave(f: Frame): void {
  const { p, game, alpha, s, X } = f;
  const wave = game.wave;
  if (!wave?.active) return;
  const edge = X(lerp(wave.prevX, wave.x, alpha));
  if (edge < 0) {
    // Off screen to the left: warn with a flickering strip.
    if (edge > -VIEW_W * s && Math.floor(game.time * 10) % 2 === 0) {
      p.color('#ff3df2');
      p.rect(0, 0, 3 * s, p.height);
    }
    return;
  }
  p.color('#000000');
  p.rect(0, 0, edge, p.height);
  for (let y = 0; y < p.height; y += 2 * s) {
    const jag = Math.random() * 14 * s;
    p.color(Math.random() < 0.5 ? '#ff3df2' : '#3dfff2');
    p.rect(edge - jag, y, jag + Math.random() * 6 * s, 2 * s);
  }
}

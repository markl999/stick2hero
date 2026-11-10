import { FEATURES } from '../../core/features';
import { STREET_LAMP_HEIGHT, type Drone, type Lamp, type Vent } from '../../game/era5';
import {
  BEAM_W,
  BEAM_WARN,
  DEP_H,
  DEP_W,
  FINALE_PHASES,
  PHASE_HITS,
  WAVE_H,
  type Finale,
} from '../../game/finale';
import { GLYPH_H } from '../font3x5';
import type { StickPose } from '../stickman';
import { wrap } from './era3Draw';
import type { Frame } from './pixelTier';

/*
 * Era 5 in the pixel tiers: the first screen (before HD), and the finale, where the
 * Deprecator rolls the look back through every palette to Era 0's white void. Everything
 * here draws in the current style's colours, so it degrades with the rest of the game.
 */

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Colours that survive every palette: real colours when there are some, else the ink. */
function tint(f: Frame, colour: string): string {
  return f.style.rich || f.style.grass ? colour : f.style.text;
}

export function drawLampPixel(f: Frame, lamp: Lamp): void {
  const { p, s, X, Y } = f;
  p.color(f.style.filled ? '#6d6d78' : f.style.text);
  if (lamp.kind === 'street') {
    const x = X(lamp.anchorX);
    p.rect(x - 1 * s, Y(lamp.anchorY - STREET_LAMP_HEIGHT), Math.max(1, s), STREET_LAMP_HEIGHT * s);
    p.rect(x - 4 * s, Y(lamp.anchorY - STREET_LAMP_HEIGHT), 8 * s, Math.max(1, 2 * s));
  } else if (lamp.state === 'on') {
    p.line(X(lamp.anchorX), Y(lamp.anchorY), X(lamp.x), Y(lamp.y - 6));
    p.rect(X(lamp.x) - 6 * s, Y(lamp.y - 4), 12 * s, Math.max(1, 3 * s));
  }
  if (!lamp.lit) return;
  p.color(tint(f, '#ffe9a8'));
  p.disc(X(lamp.x), Y(lamp.y + 1), Math.max(1, 2 * s));
}

export function drawVentPixel(f: Frame, vent: Vent): void {
  const { p, s, X, Y } = f;
  p.color(f.style.filled ? '#5c6680' : f.style.text);
  p.rect(X(vent.x - 9), Y(vent.y - 9), 18 * s, 9 * s);
  p.color(f.style.paper);
  for (let i = -6; i <= 6; i += 4) p.rect(X(vent.x + i), Y(vent.y - 7), Math.max(1, s), 5 * s);
}

export function drawDronePixel(f: Frame, drone: Drone): void {
  const { p, s, X, Y } = f;
  if (!drone.alive) return;
  const x = X(drone.x);
  const y = Y(drone.y);
  p.color(f.style.enemy);
  p.rect(x - 8 * s, y - 4 * s, 16 * s, 8 * s);
  p.rect(x - 9 * s, y - 7 * s, 18 * s, Math.max(1, s));
  p.color(f.style.paper);
  p.rect(x + Math.cos(drone.angle) * 4 * s - s, y - s, 2 * s, 2 * s);
  if (drone.alert > 0.3) {
    p.color(f.style.hazard);
    p.textCentered('!', x, y - 14 * s, f.fs);
  }
}

export function drawDebrisPixel(f: Frame): void {
  const { p, s, X, Y } = f;
  p.color(f.style.filled ? f.style.tiles : f.style.text);
  for (const b of f.game.debris.bodies) {
    const size = Math.max(1, Math.round(Math.max(b.w, b.h) * 0.7 * s));
    p.rect(X(b.x) - size / 2, Y(b.y) - size / 2, size, size);
  }
}

/** CAPE in pixels: a flag of colour off the shoulders, streaming out when you move. */
export function drawCapePixel(f: Frame, px: number, py: number, pose: StickPose): void {
  const { p, game, s, X, Y } = f;
  const player = game.player;
  const back = -player.facing;
  const speed = Math.min(1, Math.abs(player.vx) / 110);
  const reach = player.gliding ? 16 : 4 + speed * 8;
  const drop = player.gliding ? 8 : 15 - speed * 4;
  p.color(tint(f, '#d7263d'));
  const top = py + pose.segments[0][1] + 1;
  for (let i = 0; i < drop * s; i++) {
    const k = i / (drop * s);
    const w = 2 + k * reach;
    const x0 = px + back * 0.5;
    const x1 = px + back * w;
    p.hline(X(Math.min(x0, x1)), X(Math.max(x0, x1)), Y(top) + i);
  }
}

// --- The finale ----------------------------------------------------------------------------

export function drawFinalePixel(f: Frame, fin: Finale): void {
  const { p, game, s, X, Y, style } = f;
  for (const beam of fin.beams) {
    const left = X(beam.x - BEAM_W / 2);
    const w = BEAM_W * s;
    const bottom = Y(fin.floorY);
    if (beam.t < BEAM_WARN) {
      if (Math.floor(beam.t * 14) % 2) continue;
      p.color(style.hazard);
      p.vline(left, 0, bottom);
      p.vline(left + w - 1, 0, bottom);
    } else {
      p.color(style.hazard);
      p.rect(left, 0, w, bottom);
      p.color(style.paper);
      p.rect(left + w / 3, 0, w / 3, bottom);
    }
  }
  p.color(style.hazard);
  for (const wave of fin.waves) {
    for (let i = 0; i < 10; i++) {
      p.rect(
        X(wave.x + (Math.random() - 0.5) * 20),
        Y(fin.floorY - Math.random() * WAVE_H),
        3 * s,
        Math.max(1, s),
      );
    }
  }
  if (fin.orb) {
    // The dropped feature looks like a pickup of the current era.
    const x = X(fin.orb.x);
    const y = Y(fin.orb.y) + Math.round(Math.sin(game.time * 3) * 1.5 * s);
    const half = Math.max(3, Math.round(7 * s));
    p.color(style.pickup);
    if (style.filled) p.disc(x, y, half + 1);
    else p.strokeRect(x - half, y - half, half * 2 + 1, half * 2 + 1);
    p.color(style.filled ? style.paper : style.pickup);
    p.textCentered('?', x, y - Math.floor((GLYPH_H * f.fs) / 2), f.fs);
    p.color(style.text);
    p.textCentered(FEATURES[fin.orb.feature].label, x, y - half - (GLYPH_H + 3) * f.fs, f.fs);
  }

  const state = fin.state;
  if (state === 'waiting' || state === 'done' || state === 'restore') return;
  if (state === 'intro' && Math.random() > Math.min(1, fin.t / 1.2)) return;
  const b = fin.box;
  const x = X(lerp(fin.prevX, b.x, f.alpha) + DEP_W / 2);
  const y = Y(lerp(fin.prevY, b.y, f.alpha));
  const w = DEP_W * s;
  const h = DEP_H * s;
  if (state === 'beaten' && Math.random() < fin.t) return;
  if (!style.filled) {
    // Era 0: even the Deprecator is just an outline now.
    p.color(style.text);
    p.strokeRect(x - w / 2, y + h * 0.25, w, h * 0.75);
    p.strokeRect(x - w * 0.3, y, w * 0.6, h * 0.25);
    p.rect(x - 4 * s, y + 9 * s, 2 * s, Math.max(1, s));
    p.rect(x + 2 * s, y + 9 * s, 2 * s, Math.max(1, s));
    return;
  }
  const glitch = state === 'exposed' || state === 'dropped' || state === 'last' ? 3 : 1;
  for (let row = 0; row < h; row += 2 * s) {
    const half = (w / 2) * (row < h * 0.25 ? 0.6 : 1) + (Math.random() - 0.5) * 2 * s * glitch;
    const shift = Math.random() < 0.08 * glitch ? (Math.random() - 0.5) * 14 * s : 0;
    if (style.rich || style.grass) {
      p.color('#ff3df2');
      p.hline(x - half + shift - 2 * s, x + half + shift - 2 * s, y + row);
      p.color('#3dfff2');
      p.hline(x - half + shift + 2 * s, x + half + shift + 2 * s, y + row);
    }
    p.color(fin.hitFlash > 0 ? style.text : style.rich || style.grass ? '#000000' : style.enemy);
    p.rect(x - half + shift, y + row, half * 2, 2 * s);
  }
  p.color(style.rich || style.grass ? '#ffffff' : style.paper);
  p.rect(x - 7 * s, y + 9 * s, 4 * s, 2 * s);
  p.rect(x + 3 * s, y + 9 * s, 4 * s, 2 * s);
  if (state === 'exposed' && Math.floor(game.time * 6) % 2) {
    p.color(style.text);
    p.textCentered('HIT IT!', x, y - (GLYPH_H + 3) * f.fs, f.fs);
  }
}

/** The finale's HUD in pixels: its name, a pip per phase, and what you've won back. */
export function drawFinaleHudPixel(f: Frame, fin: Finale): void {
  const { p, fs, style } = f;
  if (!fin.active || fin.state === 'restore') return;
  if (!fin.final) {
    const n = FINALE_PHASES.length;
    const pip = 4 * fs;
    const total = n * (pip + fs) - fs;
    const x0 = Math.round(p.width / 2 - total / 2);
    for (let i = 0; i < n; i++) {
      p.color(style.hazard);
      const x = x0 + i * (pip + fs);
      if (i > fin.phase) p.rect(x, 2 * fs, pip, fs * 2);
      else if (i === fin.phase) {
        p.strokeRect(x, 2 * fs, pip, fs * 2);
        p.rect(x, 2 * fs, (pip * fin.hits) / PHASE_HITS, fs * 2);
      }
    }
  }
  if (fin.reclaimed.length > 0 && style.filled) {
    const ts = Math.max(1, Math.round(fs / 2));
    p.color(style.pickup);
    const label = `RECLAIMED: ${fin.reclaimed.map((id) => FEATURES[id].label).join(' ')}`;
    p.textCentered(label, p.width / 2, 9 * fs, ts);
  }
}

/** What the Deprecator says, typed out along the bottom. */
export function drawSpeechPixel(f: Frame, fin: Finale): void {
  const { p, fs, style } = f;
  const speech = fin.speech;
  if (!speech) return;
  const ts = Math.max(1, Math.round(fs / 2));
  const shown = speech.text.slice(0, Math.floor(speech.t * 40));
  const lines = wrap(shown, Math.floor((p.width - 12 * ts) / ts));
  const lineH = (GLYPH_H + 3) * ts;
  // Between the Deprecator (up high) and the floor, so it never hides you.
  const top = Math.round(p.height * 0.6);
  const width = Math.max(...lines.map((l) => l.length), 14) * 4 * ts + 12 * ts;
  p.color(style.paper);
  p.rect(2 * ts, top - 2 * ts, width, lineH * (lines.length + 1) + 2 * ts);
  p.color(style.hazard);
  p.text('THE DEPRECATOR', 6 * ts, top, ts);
  p.color(style.text);
  lines.forEach((l, i) => p.text(l, 6 * ts, top + lineH * (i + 1), ts));
}

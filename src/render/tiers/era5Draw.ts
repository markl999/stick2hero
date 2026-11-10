import { FEATURES } from '../../core/features';
import type { Knight } from '../../game/enemies';
import {
  DRONE_HALF_ANGLE,
  DRONE_RANGE,
  STREET_LAMP_HEIGHT,
  ZAP_TIME,
  type Drone,
  type Lamp,
  type Vent,
} from '../../game/era5';
import type { Particle } from '../../game/era4';
import { BEAM_W, BEAM_TIME, BEAM_WARN, DEP_H, DEP_W, WAVE_H, type Finale } from '../../game/finale';
import { DEATH_TIME } from '../../game/game';
import type { Pickup } from '../../game/pickup';
import { LAND_SQUASH_TIME, RUN_SPEED, SWING_TIME, type Player } from '../../game/player';
import type { Flag, Npc } from '../../game/props';
import { visibilityPolygon } from '../../world/light';
import { hatRects } from '../hats';
import { stickPose, type StickPose } from '../stickman';
import { expressionFor } from './era3Draw';
import { font, hash, lerp, NEON_CYAN, NEON_GOLD, NEON_PINK, type HdFrame } from './hdCommon';

/*
 * Era 5 (HD) entities, drawn in world units through the frame's transform.
 */

const SKIN = '#ffd3b0';
const BODY = '#f4efe6';
const CAPE = '#d7263d';
const CAPE_INNER = '#7e0f22';

// --- Scenery ------------------------------------------------------------------------------

export function drawVent(f: HdFrame, vent: Vent): void {
  const { ctx, t } = f;
  const x = vent.x;
  const y = vent.y;
  // A rooftop vent: a metal box with a grille.
  ctx.fillStyle = '#3d4566';
  ctx.fillRect(x - 9, y - 9, 18, 9);
  ctx.fillStyle = '#596387';
  ctx.fillRect(x - 9, y - 9, 18, 1.5);
  ctx.strokeStyle = '#20253b';
  ctx.lineWidth = 0.8;
  for (let i = -6; i <= 6; i += 3) {
    ctx.beginPath();
    ctx.moveTo(x + i, y - 7);
    ctx.lineTo(x + i, y - 1);
    ctx.stroke();
  }
  // Rising air: wavy streaks up the column.
  const top = vent.top;
  const height = y - 10 - top;
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 6; i++) {
    const k = (t * 0.9 + i / 6) % 1;
    const sy = y - 10 - k * height;
    const sx = x + Math.sin(t * 3 + i * 2) * 5 + (i - 2.5) * 3;
    ctx.strokeStyle = `rgba(200,240,255,${(0.35 * (1 - k)).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + 3, sy - 6, sx, sy - 12);
    ctx.stroke();
  }
}

export function drawLamp(f: HdFrame, lamp: Lamp): void {
  const { ctx } = f;
  if (lamp.kind === 'street') {
    const x = lamp.anchorX;
    const y = lamp.anchorY;
    ctx.strokeStyle = '#3a4060';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x - 6, y - STREET_LAMP_HEIGHT + 4);
    ctx.quadraticCurveTo(x - 6, y - STREET_LAMP_HEIGHT - 2, x, y - STREET_LAMP_HEIGHT);
    ctx.stroke();
    ctx.fillStyle = '#4a5275';
    ctx.beginPath();
    ctx.moveTo(x - 5, y - STREET_LAMP_HEIGHT - 1);
    ctx.lineTo(x + 6, y - STREET_LAMP_HEIGHT - 1);
    ctx.lineTo(x + 4, y - STREET_LAMP_HEIGHT + 3);
    ctx.lineTo(x - 3, y - STREET_LAMP_HEIGHT + 3);
    ctx.fill();
    bulb(f, x + 0.5, y - STREET_LAMP_HEIGHT + 3, 2.4);
    return;
  }
  const x = lamp.x;
  const y = lamp.y;
  if (lamp.state === 'on') {
    ctx.strokeStyle = '#5a6080';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(lamp.anchorX, lamp.anchorY);
    ctx.lineTo(x, y - 6);
    ctx.stroke();
  }
  if (lamp.state === 'broken') {
    ctx.fillStyle = '#2f3550';
    ctx.fillRect(x - 6, y, 12, 3);
    return;
  }
  // A conical shade.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-lamp.angle);
  ctx.fillStyle = '#4a5275';
  ctx.beginPath();
  ctx.moveTo(-2, -6);
  ctx.lineTo(2, -6);
  ctx.lineTo(8, 1);
  ctx.lineTo(-8, 1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (lamp.lit) bulb(f, x, y + 1, 2.6);
}

function bulb(f: HdFrame, x: number, y: number, r: number): void {
  const { ctx } = f;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
  g.addColorStop(0, 'rgba(255,235,180,0.9)');
  g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
  ctx.fillStyle = '#fff6d8';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function drawFlagHd(f: HdFrame, flag: Flag): void {
  const { ctx, t } = f;
  const x = flag.x;
  const y = flag.y;
  ctx.strokeStyle = '#c9cde0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 26);
  ctx.stroke();
  const fy = flag.raised ? y - 26 : y - 10;
  ctx.fillStyle = flag.raised ? NEON_GOLD : '#ff2d55';
  ctx.beginPath();
  ctx.moveTo(x, fy);
  ctx.quadraticCurveTo(x + 5, fy + 1 + Math.sin(t * 6) * 1.5, x + 10, fy + 3);
  ctx.lineTo(x, fy + 7);
  ctx.closePath();
  ctx.fill();
}

/** Era 5's pickup container: a cloud with a download arrow. */
export function drawPickupHd(f: HdFrame, pickup: Pickup): void {
  const { game } = f;
  const x = pickup.x;
  const y = pickup.y + Math.sin(game.time * 3 + pickup.x * 0.1) * 1.5;
  token(f, x, y, FEATURES[pickup.feature].label, NEON_CYAN);
}

/** A glowing cloud token with a label: pickups, and the features the Deprecator drops. */
export function token(f: HdFrame, x: number, y: number, label: string, glow: string): void {
  const { ctx, t } = f;
  const halo = ctx.createRadialGradient(x, y, 0, x, y, 16);
  halo.addColorStop(0, glow + '66');
  halo.addColorStop(1, glow + '00');
  ctx.fillStyle = halo;
  ctx.fillRect(x - 16, y - 16, 32, 32);
  ctx.fillStyle = '#f2fbff';
  ctx.beginPath();
  ctx.arc(x - 3.5, y + 0.5, 3.5, 0, Math.PI * 2);
  ctx.arc(x + 1, y - 1.5, 4.5, 0, Math.PI * 2);
  ctx.arc(x + 5, y + 1, 3, 0, Math.PI * 2);
  ctx.rect(x - 3.5, y + 0.5, 8.5, 3.5);
  ctx.fill();
  // The download arrow, nudging down.
  const bob = (t * 2) % 1;
  ctx.strokeStyle = glow;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 0.5, y - 2 + bob);
  ctx.lineTo(x + 0.5, y + 2.5 + bob);
  ctx.moveTo(x - 1.5, y + 0.8 + bob);
  ctx.lineTo(x + 0.5, y + 2.8 + bob);
  ctx.lineTo(x + 2.5, y + 0.8 + bob);
  ctx.stroke();
  ctx.font = font(5.2, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  // Keep the label on screen near the edges.
  const half = ctx.measureText(label).width / 2 + 2;
  const right = f.camX + f.W / f.s;
  ctx.fillText(label, Math.min(Math.max(x, f.camX + half), right - half), y - 9);
}

export function drawNpcHd(f: HdFrame, npc: Npc): void {
  const { ctx, game } = f;
  const bob = Math.sin(game.time * 2 + npc.x);
  const x = npc.x;
  const y = npc.y;
  // The placeholder: still a missing texture, now in glorious HD.
  const w = 14;
  const h = 24;
  const cell = 2;
  for (let cy = 0; cy < h; cy += cell) {
    for (let cx = 0; cx < w; cx += cell) {
      ctx.fillStyle = (cx / cell + cy / cell) % 2 === 0 ? '#ff00dc' : '#111111';
      ctx.fillRect(x - w / 2 + cx, y - h + cy + bob, cell, cell);
    }
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 4, y - h + 5 + bob, 2, 2);
  ctx.fillRect(x + 2, y - h + 5 + bob, 2, 2);
}

// --- Enemies --------------------------------------------------------------------------------

/** Knights, in HD: security robots. */
export function drawRobot(f: HdFrame, knight: Knight): void {
  const { ctx, game, alpha } = f;
  if (knight.gone) return;
  if (!knight.alive) {
    // With PHYSICS it fell apart (that's debris now). Otherwise it blinks out.
    if (game.features.has('PHYSICS') || Math.floor(knight.deadT * 16) % 2 === 0) return;
  }
  const b = knight.box;
  const x = lerp(knight.prevX, b.x, alpha);
  const y = lerp(knight.prevY, b.y, alpha);
  const step = Math.sin(x * 0.4) * 2;
  const flash = knight.flinchT > 0;
  // Legs.
  ctx.fillStyle = '#2b3049';
  ctx.fillRect(x + 2, y + 18 + Math.max(0, step), 4, 8 - Math.max(0, step));
  ctx.fillRect(x + b.w - 6, y + 18 + Math.max(0, -step), 4, 8 - Math.max(0, -step));
  // Body and head.
  ctx.fillStyle = flash ? '#ffffff' : '#4b5675';
  roundRect(ctx, x, y + 6, b.w, 14, 2);
  ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : '#5d6990';
  roundRect(ctx, x + 2, y, b.w - 4, 7, 2);
  ctx.fill();
  // The visor: cyan, red when it charges.
  ctx.fillStyle = knight.charging ? '#ff2d55' : NEON_CYAN;
  const vx = knight.dir > 0 ? x + b.w - 8 : x + 3;
  ctx.fillRect(vx, y + 2.5, 5, 1.8);
  // A chest light.
  ctx.fillStyle = knight.charging ? '#ff2d55' : NEON_GOLD;
  ctx.beginPath();
  ctx.arc(x + b.w / 2, y + 12, 1.2, 0, Math.PI * 2);
  ctx.fill();
}

export function drawDrone(f: HdFrame, drone: Drone): void {
  const { ctx, t } = f;
  const x = drone.x;
  const y = drone.y + (drone.alive ? Math.sin(t * 3 + x) * 1.2 : 0);
  ctx.save();
  ctx.translate(x, y);
  if (!drone.alive) ctx.rotate(Math.min(1.2, drone.t * 3) * drone.facing);
  // Rotors.
  ctx.strokeStyle = 'rgba(200,210,240,0.6)';
  ctx.lineWidth = 0.8;
  const spin = drone.alive ? Math.sin(t * 40) * 5 : 3;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 6 - spin, -6);
    ctx.lineTo(side * 6 + spin, -6);
    ctx.stroke();
  }
  ctx.fillStyle = '#2d3350';
  ctx.fillRect(-7, -6, 1, 3);
  ctx.fillRect(6, -6, 1, 3);
  // Body.
  ctx.fillStyle = '#353c5e';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4c5582';
  ctx.beginPath();
  ctx.ellipse(0, -1.5, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (!drone.alive) return;
  // The eye looks where it's looking.
  const ex = x + Math.cos(drone.angle) * 5;
  const ey = y + Math.sin(drone.angle) * 3;
  const hot = drone.alert > 0.3 || drone.state === 'zap';
  ctx.fillStyle = hot ? '#ff2d55' : '#ff8a3d';
  ctx.beginPath();
  ctx.arc(ex, ey, 2, 0, Math.PI * 2);
  ctx.fill();
  // The alert meter, then the "!".
  if (drone.alert > 0) {
    ctx.strokeStyle = drone.alert > 0.6 ? '#ff2d55' : NEON_GOLD;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y - 11, 3.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * drone.alert);
    ctx.stroke();
    if (drone.alert > 0.3) {
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = font(6, 900);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', x, y - 10.6);
    }
  }
  if (drone.state === 'zap') {
    const k = 1 - drone.t / ZAP_TIME;
    ctx.strokeStyle = `rgba(255,60,90,${k.toFixed(3)})`;
    ctx.lineWidth = 3 * k + 0.5;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(drone.zapX, drone.zapY);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${k.toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** What a drone can see, drawn as a red cone that stops at walls. */
export function drawDroneCone(f: HdFrame, drone: Drone): void {
  if (!drone.alive) return;
  const { ctx, game } = f;
  const origin = { x: drone.x, y: drone.y };
  const poly = visibilityPolygon(game.map, origin, DRONE_RANGE);
  if (poly.length < 3) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.arc(
    origin.x,
    origin.y,
    DRONE_RANGE,
    drone.angle - DRONE_HALF_ANGLE,
    drone.angle + DRONE_HALF_ANGLE,
  );
  ctx.closePath();
  ctx.clip();
  const g = ctx.createRadialGradient(origin.x, origin.y, 4, origin.x, origin.y, DRONE_RANGE);
  const a = 0.16 + drone.alert * 0.25;
  g.addColorStop(0, `rgba(255,45,85,${a.toFixed(3)})`);
  g.addColorStop(1, 'rgba(255,45,85,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// --- Debris, particles, projectiles -------------------------------------------------------

const DEBRIS_COLOURS = {
  concrete: '#5b5674',
  glass: 'rgba(170,235,255,0.75)',
  metal: '#8a93b0',
  robot: '#4b5675',
} as const;

export function drawDebris(f: HdFrame): void {
  const { ctx, game } = f;
  for (const b of game.debris.bodies) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, b.life);
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = DEBRIS_COLOURS[b.kind];
    ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
    if (b.kind === 'concrete') {
      ctx.fillStyle = '#6d6889';
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, Math.min(1.2, b.h / 3));
    } else if (b.kind === 'robot') {
      ctx.fillStyle = NEON_CYAN;
      ctx.fillRect(-b.w / 4, -0.5, b.w / 2, 1);
    }
    ctx.restore();
  }
}

const PARTICLE_COLOURS: Record<Particle['kind'], string> = {
  dust: '#b8b0d8',
  spark: '#ffe27a',
  splash: '#9fd3ff',
  debris: '#8b7b96',
  glitch: NEON_PINK,
  ember: '#ff9a3c',
};

export function drawHdParticles(f: HdFrame): void {
  const { ctx, game } = f;
  if (!game.features.has('PARTICLES')) return;
  for (const part of game.particles.list) {
    const k = part.life / part.max;
    ctx.globalAlpha = Math.min(1, k * 1.5);
    if (part.kind === 'glitch') {
      ctx.fillStyle = Math.random() < 0.5 ? NEON_PINK : NEON_CYAN;
      ctx.fillRect(part.x - 1.2, part.y - 1.2, 2.4, 2.4);
      continue;
    }
    ctx.fillStyle = PARTICLE_COLOURS[part.kind];
    const r = (part.size / 2) * (part.kind === 'dust' ? 1 + (1 - k) : 1);
    ctx.beginPath();
    ctx.arc(part.x, part.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawProjectilesHd(f: HdFrame): void {
  const { ctx, game, alpha, t } = f;
  ctx.fillStyle = '#d9dcef';
  for (const pebble of game.pebbles) {
    const x = lerp(pebble.prevX, pebble.box.x, alpha) + pebble.box.w / 2;
    const y = lerp(pebble.prevY, pebble.box.y, alpha) + pebble.box.h / 2;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bombs and the Deprecator's falling bits: corrupted cubes.
  for (const bomb of game.bombs) {
    const x = lerp(bomb.prevX, bomb.box.x, alpha) + bomb.box.w / 2;
    const y = lerp(bomb.prevY, bomb.box.y, alpha) + bomb.box.h / 2;
    const j = Math.sin(t * 40 + x) * 0.8;
    ctx.fillStyle = NEON_PINK;
    ctx.fillRect(x - 4 + j, y - 4, 8, 8);
    ctx.fillStyle = NEON_CYAN;
    ctx.fillRect(x - 4 - j, y - 4, 8, 8);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
  }
}

// --- The hero ------------------------------------------------------------------------------

export function drawPlayerHd(f: HdFrame): void {
  const { ctx, game, alpha } = f;
  const player = game.player;
  if (game.invulnerableT > 0 && Math.floor(game.invulnerableT * 12) % 2 === 0) return;
  const deathT = game.deathT;
  if (deathT !== null && deathT > DEATH_TIME * 0.6 && Math.floor(deathT * 16) % 2 === 0) return;
  const px = lerp(player.prevX, player.box.x, alpha) + player.box.w / 2;
  const py = lerp(player.prevY, player.box.y, alpha) + player.box.h;
  const fs = game.features;
  const dead = deathT !== null;
  const pose = stickPose({
    arms: fs.has('ARMS'),
    state: player.state,
    facing: player.facing,
    punching: player.punchT > 0 && !player.swinging,
    dead,
    bigHead: game.cosmetics.bigHead && fs.has('CHEAT_CODES'),
    animated: fs.has('ANIMATION')
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

  // DASH afterimages.
  if (player.dashing) {
    for (const off of [10, 20]) {
      ctx.globalAlpha = 0.25;
      drawFigure(f, px - off * player.facing, py, pose, player, false);
    }
    ctx.globalAlpha = 1;
  }
  if (fs.has('CAPE') && !dead) drawCape(f, px, py, player);
  drawFigure(f, px, py, pose, player, !dead);
}

function drawFigure(
  f: HdFrame,
  px: number,
  py: number,
  pose: StickPose,
  player: Player,
  full: boolean,
): void {
  const { ctx, game } = f;
  const fs = game.features;
  const seg = (i: number) => {
    const [x0, y0, x1, y1] = pose.segments[i];
    ctx.moveTo(px + x0, py + y0);
    ctx.lineTo(px + x1, py + y1);
  };
  const limbs = (from: number, to: number) => {
    ctx.beginPath();
    for (let i = from; i < Math.min(to, pose.segments.length); i++) seg(i);
    // A cool rim light, then the body.
    ctx.strokeStyle = 'rgba(61,242,255,0.35)';
    ctx.lineWidth = 3.6;
    ctx.stroke();
    ctx.strokeStyle = BODY;
    ctx.lineWidth = 2.2;
    ctx.stroke();
  };
  limbs(0, 3);
  if (full && fs.has('OUTFIT')) drawTunic(f, px, py, pose);
  limbs(3, pose.segments.length);

  const hx = px + pose.head.x;
  const hy = py + pose.head.y;
  ctx.fillStyle = 'rgba(61,242,255,0.35)';
  ctx.beginPath();
  ctx.arc(hx, hy, pose.head.r + 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BODY;
  ctx.beginPath();
  ctx.arc(hx, hy, pose.head.r, 0, Math.PI * 2);
  ctx.fill();
  if (full && fs.has('FACE')) drawFaceHd(f, hx, hy, pose.head.r, player.facing);
  if (full && fs.has('HATS')) {
    const k = pose.head.r / 4.5;
    for (const r of hatRects(game.cosmetics.hat, player.facing, k, game.time)) {
      ctx.fillStyle = r.colour;
      ctx.fillRect(hx + r.x, hy - pose.head.r + r.y, r.w, r.h);
    }
  }
  if (full && fs.has('SWORD') && fs.has('ARMS') && player.state === 'normal') {
    drawSwordHd(f, px, py, player);
  }
  if (fs.has('HANDS_FEET')) {
    ctx.fillStyle = SKIN;
    for (const [x, y] of pose.hands) {
      ctx.beginPath();
      ctx.arc(px + x, py + y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#2a2440';
    for (const [x, y] of pose.feet) {
      ctx.beginPath();
      ctx.ellipse(px + x + player.facing * 0.8, py + y - 0.8, 2.2, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTunic(f: HdFrame, px: number, py: number, pose: StickPose): void {
  const { ctx } = f;
  const [, neckY, , hipY] = pose.segments[0];
  const g = ctx.createLinearGradient(px, py + neckY, px, py + hipY + 3);
  g.addColorStop(0, '#4aa3f0');
  g.addColorStop(1, '#1d5fa8');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(px - 3, py + neckY + 1);
  ctx.lineTo(px + 3, py + neckY + 1);
  ctx.lineTo(px + 5.5, py + hipY + 3);
  ctx.lineTo(px - 5.5, py + hipY + 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8d5524';
  ctx.fillRect(px - 4.2, py + hipY - 1, 8.4, 1.6);
  ctx.fillStyle = NEON_GOLD;
  ctx.fillRect(px - 0.8, py + hipY - 1.1, 1.6, 1.8);
  // An emblem on the chest.
  ctx.fillStyle = NEON_GOLD;
  ctx.beginPath();
  ctx.moveTo(px, py + neckY + 3);
  ctx.lineTo(px + 1.6, py + neckY + 5);
  ctx.lineTo(px, py + neckY + 7);
  ctx.lineTo(px - 1.6, py + neckY + 5);
  ctx.fill();
}

/** The cape: it hangs, streams out behind you as you run, and spreads wide as you glide. */
function drawCape(f: HdFrame, px: number, py: number, player: Player): void {
  const { ctx, game } = f;
  const back = -player.facing;
  const t = game.time;
  const speed = Math.min(1.3, Math.abs(player.vx) / RUN_SPEED);
  const flutter = Math.sin(t * 11 + px * 0.05) * (0.6 + speed);
  let w1 = 3.5 + speed * 6;
  let w2 = 3 + speed * 9;
  let y1 = -17 + speed * 2;
  let y2 = -2 - speed * 3;
  if (player.gliding) {
    w1 = 15;
    w2 = 17;
    y1 = -17;
    y2 = -9;
  } else if (!player.onGround && player.vy > 80) {
    y1 -= 4;
    y2 -= 8;
  }
  const ax = px + back * 0.5;
  const ay = py - 18.5;
  const bx = px + back * w1;
  const by = py + y1 + flutter * 0.5;
  const cx = px + back * w2;
  const cy = py + y2 + flutter;
  const dx = px + back * 0.5;
  const dy = py - 8;
  ctx.fillStyle = CAPE;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(px + back * w1 * 0.6, py - 20, bx, by);
  ctx.quadraticCurveTo(px + back * (w1 + w2) * 0.55 + flutter, (by + cy) / 2, cx, cy);
  ctx.quadraticCurveTo(px + back * w2 * 0.4, cy + 1.5, dx, dy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = CAPE_INNER;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(px + back * 1.5, py - 17);
  ctx.quadraticCurveTo(px + back * (w1 + w2) * 0.3, (by + cy) / 2, px + back * w2 * 0.7, cy - 1);
  ctx.stroke();
}

function drawFaceHd(f: HdFrame, hx: number, hy: number, r: number, facing: 1 | -1): void {
  const { ctx, game } = f;
  const expression = expressionFor(game);
  const ex = hx + facing * r * 0.35;
  const ey = hy - r * 0.15;
  ctx.fillStyle = '#1b1533';
  const size = expression === 'worried' ? 1.1 : 0.8;
  for (const dx of [-r * 0.3, r * 0.3]) {
    ctx.beginPath();
    ctx.arc(ex + dx, ey, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#1b1533';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  const my = hy + r * 0.45;
  if (expression === 'worried') {
    ctx.arc(ex, my + 0.6, 0.9, 0, Math.PI * 2);
  } else if (expression === 'happy') {
    ctx.arc(ex, my - 0.8, r * 0.35, 0.2, Math.PI - 0.2);
  } else if (expression === 'determined') {
    ctx.moveTo(ex - r * 0.55, ey - r * 0.45);
    ctx.lineTo(ex - r * 0.1, ey - r * 0.25);
    ctx.moveTo(ex + r * 0.55, ey - r * 0.45);
    ctx.lineTo(ex + r * 0.1, ey - r * 0.25);
    ctx.moveTo(ex - r * 0.25, my);
    ctx.lineTo(ex + r * 0.25, my);
  } else {
    ctx.moveTo(ex - r * 0.2, my);
    ctx.lineTo(ex + r * 0.2, my);
  }
  ctx.stroke();
}

function drawSwordHd(f: HdFrame, px: number, py: number, player: Player): void {
  const { ctx } = f;
  const dir = player.facing;
  const hand = { x: px + dir * 10, y: py - 16 };
  let tip: { x: number; y: number };
  if (player.punchT > 0 && player.swinging) {
    const k = 1 - player.punchT / SWING_TIME;
    let angle = 0;
    let length = 20;
    if (player.swingStage === 2) {
      length = 27;
    } else {
      const [from, to] = player.swingStage === 0 ? [-70, 45] : [45, -70];
      angle = lerp(from, to, Math.min(1, k * 1.4));
      // The swoosh: where the blade has been.
      ctx.strokeStyle = 'rgba(160,230,255,0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const r = ((from + ((angle - from) * i) / 8) * Math.PI) / 180;
        const x = hand.x + dir * Math.cos(r) * length * 0.85;
        const y = hand.y + Math.sin(r) * length * 0.85;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const r = (angle * Math.PI) / 180;
    tip = { x: hand.x + dir * Math.cos(r) * length, y: hand.y + Math.sin(r) * length };
  } else {
    // Across the back.
    hand.x = px - dir * 4;
    hand.y = py - 22;
    tip = { x: px - dir * 7.5, y: py - 28 };
    const grip = { x: px + dir * 2, y: py - 11 };
    // The strap.
    ctx.strokeStyle = '#6b4520';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(hand.x, hand.y);
    ctx.lineTo(grip.x, grip.y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(61,242,255,0.5)';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(hand.x, hand.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  ctx.strokeStyle = '#eef3ff';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.fillStyle = '#d4a017';
  ctx.fillRect(hand.x - 1.2, hand.y - 2, 2.4, 4);
}

// --- The Deprecator -------------------------------------------------------------------------

export function drawFinale(f: HdFrame, fin: Finale): void {
  const { ctx, t } = f;
  // Beams: a flickering warning column, then a blast of deletion.
  for (const beam of fin.beams) {
    const left = beam.x - BEAM_W / 2;
    const top = f.camY - 20;
    const height = fin.floorY - top;
    if (beam.t < BEAM_WARN) {
      const on = Math.floor(beam.t * 14) % 2 === 0;
      ctx.fillStyle = `rgba(255,61,154,${on ? 0.16 : 0.07})`;
      ctx.fillRect(left, top, BEAM_W, height);
      ctx.strokeStyle = on ? NEON_PINK : 'rgba(255,61,154,0.4)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(left, top, BEAM_W, height);
      ctx.setLineDash([]);
    } else {
      const k = 1 - (beam.t - BEAM_WARN) / BEAM_TIME;
      const g = ctx.createLinearGradient(left, 0, left + BEAM_W, 0);
      g.addColorStop(0, 'rgba(255,61,154,0)');
      g.addColorStop(0.25, NEON_PINK);
      g.addColorStop(0.5, '#ffffff');
      g.addColorStop(0.75, NEON_CYAN);
      g.addColorStop(1, 'rgba(61,242,255,0)');
      ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = g;
      ctx.fillRect(left - 4, top, BEAM_W + 8, height);
      ctx.globalAlpha = 1;
    }
  }
  for (const wave of fin.waves) {
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = i % 3 === 0 ? '#ffffff' : i % 2 ? NEON_PINK : NEON_CYAN;
      const x = wave.x + (Math.random() - 0.5) * 22;
      const y = fin.floorY - Math.random() * WAVE_H;
      ctx.fillRect(x, y, 2 + Math.random() * 5, 1.5);
    }
  }
  if (fin.orb) {
    const glow = fin.final ? '#ffffff' : NEON_GOLD;
    token(f, fin.orb.x, fin.orb.y + Math.sin(t * 4) * 1.2, FEATURES[fin.orb.feature].label, glow);
  }

  // The Deprecator itself.
  const state = fin.state;
  if (state === 'waiting' || state === 'done' || state === 'restore') return;
  if (state === 'intro' && Math.random() > Math.min(1, fin.t / 1.2)) return;
  const b = fin.box;
  const x = lerp(fin.prevX, b.x, f.alpha) + DEP_W / 2;
  const y = lerp(fin.prevY, b.y, f.alpha);
  const breaking = state === 'beaten' ? fin.t : 0;
  const glitchy = state === 'exposed' || state === 'dropped' ? 3 : 1;
  for (let row = 0; row < DEP_H; row += 2) {
    if (breaking > 0 && hash(row + Math.floor(t * 20)) < breaking) continue;
    const half = (DEP_W / 2) * (row < DEP_H * 0.25 ? 0.6 : 1) + (Math.random() - 0.5) * 2 * glitchy;
    const shift = Math.random() < 0.08 * glitchy ? (Math.random() - 0.5) * 14 : 0;
    const fly = breaking * (hash(row) - 0.5) * 120;
    ctx.fillStyle = NEON_PINK;
    ctx.fillRect(x - half + shift - 1.8 + fly, y + row, half * 2, 2);
    ctx.fillStyle = NEON_CYAN;
    ctx.fillRect(x - half + shift + 1.8 + fly, y + row, half * 2, 2);
    ctx.fillStyle = fin.hitFlash > 0 ? '#ffffff' : '#000000';
    ctx.fillRect(x - half + shift + fly, y + row, half * 2, 2);
  }
  if (breaking === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 7, y + 9, 4, 2);
    ctx.fillRect(x + 3, y + 9, 4, 2);
  }
  // What it's holding: the feature you need to win back.
  if (state === 'fight' || state === 'exposed' || state === 'strip') {
    const label = FEATURES[fin.current.reclaim].label;
    const pulse = 0.6 + Math.sin(t * 6) * 0.3;
    ctx.fillStyle = `rgba(255,210,61,${pulse.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y + 24, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = font(4, 800);
    ctx.textAlign = 'center';
    ctx.fillStyle = NEON_GOLD;
    ctx.fillText(label, x, y + 33);
  }
  if (state === 'exposed') {
    ctx.font = font(5, 900);
    ctx.textAlign = 'center';
    ctx.fillStyle = Math.floor(t * 6) % 2 ? '#ffffff' : NEON_GOLD;
    ctx.fillText('HIT IT!', x, y - 5);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

import { TILE, VIEW_H, VIEW_W } from '../../config';
import { MOMENT_FLASH, type Game } from '../../game/game';
import { visibilityPolygon } from '../../world/light';
import { SPIKE_HEIGHT, Tile } from '../../world/tilemap';
import type { PixelCanvas } from '../pixelCanvas';
import {
  drawDebris,
  drawDrone,
  drawDroneCone,
  drawFinale,
  drawFlagHd,
  drawHdParticles,
  drawLamp,
  drawNpcHd,
  drawPickupHd,
  drawPlayerHd,
  drawProjectilesHd,
  drawRobot,
  drawVent,
} from './era5Draw';
import { applyPhotoFilter, drawHdUi } from './hdUi';
import { font, hash, lerp, NEON_CYAN, NEON_PINK, type HdFrame } from './hdCommon';

export { font, hash, lerp, NEON_CYAN, NEON_GOLD, NEON_PINK, type HdFrame } from './hdCommon';

/*
 * HD (Era 5): native resolution, anti-aliased vector drawing straight onto the canvas,
 * in world units through a transform. A rainy neon city at night: a gradient sky, two
 * layers of skyline, rooftops with lit windows, lamps that cast real shadows (DYNAMIC
 * SHADOWS) and rain. BLOOM / POST-FX is a GPU filter on top (see postFx.ts).
 */

let shade: HTMLCanvasElement | null = null;
let pixelate: HTMLCanvasElement | null = null;

export function drawHdTier(p: PixelCanvas, game: Game, alpha: number): void {
  const ctx = p.context;
  const W = p.width;
  const H = p.height;
  const cam = game.camera;
  const photo = game.photo;
  const zoom = cam.zoom;
  const s = (W / VIEW_W) * zoom;
  const shakeX = cam.shake ? (Math.random() - 0.5) * 2 * cam.shake : 0;
  const shakeY = cam.shake ? (Math.random() - 0.5) * 2 * cam.shake : 0;
  // The view's centre in world units.
  const cx = lerp(cam.prevX, cam.x, alpha) + VIEW_W / 2 + shakeX + (photo?.offsetX ?? 0);
  const cy = lerp(cam.prevY, cam.y, alpha) + VIEW_H / 2 + shakeY + (photo?.offsetY ?? 0);
  const camX = cx - W / 2 / s;
  const camY = cy - H / 2 / s;
  const f: HdFrame = {
    ctx,
    game,
    alpha,
    W,
    H,
    s,
    camX,
    camY,
    t: game.time,
    sx: (wx) => (wx - camX) * s,
    sy: (wy) => (wy - camY) * s,
    world: () => ctx.setTransform(s, 0, 0, s, -camX * s, -camY * s),
    screen: () => ctx.setTransform(1, 0, 0, 1, 0, 0),
  };

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  f.screen();
  drawSky(f);
  drawSkyline(f);

  f.world();
  drawTiles(f);
  for (const vent of game.vents) if (near(f, vent.x, TILE * 3)) drawVent(f, vent);
  for (const lamp of game.lamps) if (near(f, lamp.anchorX, TILE * 6)) drawLamp(f, lamp);
  for (const flag of game.flags)
    if (game.features.has('CHECKPOINTS') && near(f, flag.x)) drawFlagHd(f, flag);
  for (const pickup of game.pickups) {
    if (!pickup.collected && near(f, pickup.x)) drawPickupHd(f, pickup);
  }
  if (game.features.has('NPCS')) for (const npc of game.npcs) if (near(f, npc.x)) drawNpcHd(f, npc);
  if (game.enemiesActive) {
    for (const knight of game.knights) if (near(f, knight.box.x)) drawRobot(f, knight);
    for (const drone of game.drones) if (near(f, drone.x, TILE * 4)) drawDrone(f, drone);
  }
  drawDebris(f);
  drawProjectilesHd(f);
  drawPlayerHd(f);
  drawHdParticles(f);
  if (game.finale) drawFinale(f, game.finale);

  // Darkness, with the lamps' light (and shadows) cut out of it.
  if (game.features.has('LIGHTING')) drawLighting(f);
  f.world();
  if (game.enemiesActive) {
    for (const drone of game.drones) if (near(f, drone.x, TILE * 9)) drawDroneCone(f, drone);
  }

  f.screen();
  if (game.features.has('LENS_FLARE')) drawLensFlares(f);
  drawRain(f);
  if (photo?.filter && photo.filter !== 'NONE') applyPhotoFilter(f, photo.filter);
  drawHdUi(f);
  drawEnhance(f);
  ctx.restore();
}

/**
 * LENS FLARE (a secret): every light on screen throws a chain of coloured ghosts across the
 * picture, through its middle, plus a long blue streak. Far too many, on purpose.
 */
function drawLensFlares(f: HdFrame): void {
  const { ctx, game, W, H } = f;
  const sources: { x: number; y: number; k: number }[] = [
    // The moon (where drawSky puts it).
    { x: W * 0.8 - f.camX * 0.02 * f.s, y: H * 0.2, k: 0.7 },
  ];
  for (const lamp of game.lamps) {
    if (!lamp.lit) continue;
    const x = f.sx(lamp.x);
    const y = f.sy(lamp.y);
    if (x > -W * 0.1 && x < W * 1.1 && y > -H * 0.1 && y < H * 1.1) sources.push({ x, y, k: 1 });
  }
  const cx = W / 2;
  const cy = H / 2;
  const ghosts = [
    { t: 0.35, r: 0.05, c: '120,255,240' },
    { t: 0.7, r: 0.025, c: '255,90,220' },
    { t: 1.15, r: 0.08, c: '255,210,90' },
    { t: 1.5, r: 0.04, c: '120,160,255' },
    { t: 1.9, r: 0.12, c: '255,120,160' },
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const src of sources) {
    const dx = cx - src.x;
    const dy = cy - src.y;
    for (const g of ghosts) {
      const x = src.x + dx * g.t;
      const y = src.y + dy * g.t;
      const r = H * g.r;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(${g.c},${(0.3 * src.k).toFixed(3)})`);
      grad.addColorStop(0.7, `rgba(${g.c},${(0.18 * src.k).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${g.c},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // The anamorphic streak.
    const streak = ctx.createLinearGradient(src.x - W * 0.45, 0, src.x + W * 0.45, 0);
    streak.addColorStop(0, 'rgba(90,160,255,0)');
    streak.addColorStop(0.5, `rgba(150,200,255,${(0.45 * src.k).toFixed(3)})`);
    streak.addColorStop(1, 'rgba(90,160,255,0)');
    ctx.fillStyle = streak;
    ctx.fillRect(src.x - W * 0.45, src.y - H * 0.004, W * 0.9, H * 0.008);
  }
  ctx.restore();
}

/** Is this world x within the view (plus a margin)? */
export function near(f: HdFrame, x: number, margin = TILE * 2): boolean {
  return x > f.camX - margin && x < f.camX + f.W / f.s + margin;
}

// --- Sky and skyline ---------------------------------------------------------------------

function drawSky(f: HdFrame): void {
  const { ctx, W, H, t } = f;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#07031a');
  sky.addColorStop(0.45, '#1d0b45');
  sky.addColorStop(0.8, '#5a1660');
  sky.addColorStop(1, '#a3326e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // A hazy moon behind the clouds.
  const mx = W * 0.8 - f.camX * 0.02 * f.s;
  const my = H * 0.2;
  const halo = ctx.createRadialGradient(mx, my, 0, mx, my, H * 0.3);
  halo.addColorStop(0, 'rgba(255,220,250,0.45)');
  halo.addColorStop(1, 'rgba(255,220,250,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(mx - H * 0.3, my - H * 0.3, H * 0.6, H * 0.6);
  ctx.fillStyle = '#fbe9ff';
  ctx.beginPath();
  ctx.arc(mx, my, H * 0.055, 0, Math.PI * 2);
  ctx.fill();

  // Slow clouds.
  ctx.fillStyle = 'rgba(40,12,70,0.55)';
  for (let i = 0; i < 7; i++) {
    const x = ((hash(i) * W * 1.6 + t * 6 * f.s - f.camX * 0.05 * f.s) % (W * 1.6)) - W * 0.3;
    const y = H * (0.1 + hash(i + 9) * 0.3);
    const w = W * (0.18 + hash(i + 3) * 0.2);
    ctx.beginPath();
    ctx.ellipse(x, y, w, H * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

const SIGNS = [
  'NOW IN HD',
  '60 FPS',
  'STICK 2 HERO',
  'RAY TRACED',
  '4K',
  'NEW!',
  'PRE-ORDER',
  'DLC',
];

function drawSkyline(f: HdFrame): void {
  const { ctx, W, H, s, t } = f;
  const layers = [
    { k: 0.12, spacing: 46, colour: '#1a0d36', top: 0.38, windows: 0.18 },
    { k: 0.3, spacing: 70, colour: '#120827', top: 0.5, windows: 0.3 },
  ];
  for (const [li, layer] of layers.entries()) {
    const offset = f.camX * layer.k;
    const first = Math.floor(offset / layer.spacing) - 1;
    const count = Math.ceil(W / s / layer.spacing) + 3;
    for (let i = first; i < first + count; i++) {
      const seed = i * 13 + li * 1000;
      const bw = layer.spacing * (0.6 + hash(seed) * 0.35);
      const x = (i * layer.spacing - offset) * s;
      const height = H * (1 - layer.top) * (0.45 + hash(seed + 1) * 0.6);
      const top = H - height;
      ctx.fillStyle = layer.colour;
      ctx.fillRect(x, top, bw * s, height);
      // Windows: a grid, some lit.
      const cell = 6 * s;
      for (let wy = top + cell; wy < H - cell; wy += cell * 1.4) {
        for (let wx = x + cell * 0.6; wx < x + bw * s - cell; wx += cell) {
          const h = hash(seed + wx * 0.37 + wy * 0.11);
          if (h > layer.windows) continue;
          ctx.fillStyle =
            h < layer.windows * 0.3 ? 'rgba(120,230,255,0.55)' : 'rgba(255,200,120,0.5)';
          ctx.fillRect(wx, wy, cell * 0.45, cell * 0.6);
        }
      }
      // A blinking light on the tallest roofs.
      if (hash(seed + 7) > 0.6 && Math.sin(t * 2 + seed) > 0.3) {
        ctx.fillStyle = '#ff4455';
        ctx.fillRect(x + bw * s * 0.5 - s, top - 3 * s, 2 * s, 2 * s);
      }
      // Neon signs on the nearer layer.
      if (li === 1 && hash(seed + 5) > 0.55) {
        const text = SIGNS[Math.floor(hash(seed + 6) * SIGNS.length)];
        const colour = hash(seed + 8) > 0.5 ? NEON_PINK : NEON_CYAN;
        const flicker = hash(Math.floor(t * 8) + seed) > 0.04 ? 1 : 0.3;
        ctx.globalAlpha = 0.9 * flicker;
        ctx.font = font(5.5 * s);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const sy = top + height * 0.18;
        ctx.strokeStyle = colour;
        ctx.lineWidth = s * 0.8;
        const tw = ctx.measureText(text).width + 4 * s;
        ctx.strokeRect(x + (bw * s) / 2 - tw / 2, sy - 4.5 * s, tw, 9 * s);
        ctx.fillStyle = colour;
        ctx.fillText(text, x + (bw * s) / 2, sy + 0.3 * s);
        ctx.globalAlpha = 1;
      }
    }
  }
  // Haze at the bottom.
  const haze = ctx.createLinearGradient(0, H * 0.6, 0, H);
  haze.addColorStop(0, 'rgba(163,50,110,0)');
  haze.addColorStop(1, 'rgba(163,50,110,0.25)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, H * 0.6, W, H * 0.4);
}

// --- Rooftops ------------------------------------------------------------------------------

function drawTiles(f: HdFrame): void {
  const { ctx, game, t } = f;
  const map = game.map;
  const tx0 = Math.floor(f.camX / TILE) - 1;
  const tx1 = Math.ceil((f.camX + f.W / f.s) / TILE) + 1;
  const ty0 = Math.max(0, Math.floor(f.camY / TILE) - 1);
  const ty1 = Math.min(map.height - 1, Math.ceil((f.camY + f.H / f.s) / TILE) + 1);
  const solid = (x: number, y: number) =>
    map.isSolidForDraw(x, y) && map.tileAt(x, y) !== Tile.Cracked;

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const tile = map.tileAt(tx, ty);
      const x = tx * TILE;
      const y = ty * TILE;
      if (tile === Tile.Spikes) {
        // Electrified spikes: red means danger.
        ctx.fillStyle = '#ff2d55';
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          ctx.moveTo(x + i * 5, y + TILE);
          ctx.lineTo(x + i * 5 + 2.5, y + TILE - SPIKE_HEIGHT);
          ctx.lineTo(x + i * 5 + 5, y + TILE);
        }
        ctx.fill();
        continue;
      }
      if (tile === Tile.Cracked) {
        drawCracked(f, x, y);
        continue;
      }
      if (!map.isSolid(tx, ty) || tx < 0 || tx >= map.width) continue;
      // A building: dark panels, lit windows, a rooftop ledge where it meets the sky.
      ctx.fillStyle = '#1b1533';
      ctx.fillRect(x - 0.05, y - 0.05, TILE + 0.1, TILE + 0.1);
      ctx.strokeStyle = '#272047';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + 0.25, y + 0.25, TILE - 0.5, TILE - 0.5);
      const top = !solid(tx, ty - 1);
      if (!top) {
        for (let i = 0; i < 4; i++) {
          const h = hash(tx * 31 + ty * 17 + i);
          if (h > 0.45) continue;
          const lit = Math.sin(t * 0.3 + h * 40) > -0.6;
          ctx.fillStyle = lit
            ? h < 0.15
              ? 'rgba(110,225,255,0.55)'
              : 'rgba(255,196,110,0.6)'
            : 'rgba(40,32,70,0.9)';
          ctx.fillRect(x + 3 + (i % 2) * 9, y + 4 + Math.floor(i / 2) * 8, 5, 5);
        }
      } else {
        // Rooftop: concrete coping with a neon reflection along the edge.
        ctx.fillStyle = '#3a345e';
        ctx.fillRect(x, y, TILE, 4);
        ctx.fillStyle = '#4c4677';
        ctx.fillRect(x, y, TILE, 1.2);
        ctx.fillStyle = 'rgba(61,242,255,0.5)';
        ctx.fillRect(x, y - 0.3, TILE, 0.6);
        // A puddle now and then, reflecting the sky.
        if (hash(tx * 7.3) > 0.7) {
          ctx.fillStyle = 'rgba(255,90,170,0.35)';
          ctx.beginPath();
          ctx.ellipse(x + 10, y + 2, 6, 1, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (!solid(tx - 1, ty)) {
        ctx.fillStyle = 'rgba(255,61,154,0.35)';
        ctx.fillRect(x, y, 0.8, TILE);
      }
      if (!solid(tx + 1, ty)) {
        ctx.fillStyle = 'rgba(10,6,24,0.6)';
        ctx.fillRect(x + TILE - 1.5, y, 1.5, TILE);
      }
    }
  }
}

function drawCracked(f: HdFrame, x: number, y: number): void {
  const { ctx, game } = f;
  ctx.fillStyle = '#4a4560';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = '#5b5674';
  ctx.fillRect(x + 1, y + 1, TILE - 2, 3);
  ctx.strokeStyle = '#1b1533';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  const seed = x * 0.13 + y * 0.71;
  ctx.moveTo(x + 4 + hash(seed) * 4, y);
  ctx.lineTo(x + 9, y + 7 + hash(seed + 1) * 3);
  ctx.lineTo(x + 6, y + 12);
  ctx.lineTo(x + 12, y + TILE);
  ctx.moveTo(x + 9, y + 8);
  ctx.lineTo(x + TILE, y + 6 + hash(seed + 2) * 6);
  ctx.moveTo(x + 6, y + 12);
  ctx.lineTo(x, y + 15);
  ctx.stroke();
  if (game.features.has('PHYSICS')) {
    // Once there's physics, it looks breakable.
    const pulse = 0.25 + Math.sin(game.time * 4) * 0.15;
    ctx.strokeStyle = `rgba(255,180,90,${pulse.toFixed(3)})`;
    ctx.lineWidth = 0.6;
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
  }
}

// --- Light and shadow ----------------------------------------------------------------------

/**
 * LIGHTING: the night, with each lamp's light cut out of it. With DYNAMIC SHADOWS the
 * light is clipped to what the lamp can actually see (the same geometry the drones use);
 * without them it pours straight through walls, like old engines.
 */
function drawLighting(f: HdFrame): void {
  const { ctx, game, W, H } = f;
  const scale = 0.5;
  shade ??= document.createElement('canvas');
  const w = Math.ceil(W * scale);
  const h = Math.ceil(H * scale);
  if (shade.width !== w || shade.height !== h) {
    shade.width = w;
    shade.height = h;
  }
  const sctx = shade.getContext('2d');
  if (!sctx) return;
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.globalCompositeOperation = 'source-over';
  sctx.clearRect(0, 0, w, h);
  const m = game.moment;
  const fall = m?.feature === 'LIGHTING' ? Math.min(1, m.t / 1.2) : 1;
  sctx.fillStyle = `rgba(6,3,20,${(0.74 * fall).toFixed(3)})`;
  sctx.fillRect(0, 0, w, h);
  sctx.setTransform(f.s * scale, 0, 0, f.s * scale, -f.camX * f.s * scale, -f.camY * f.s * scale);
  sctx.globalCompositeOperation = 'destination-out';
  const shadows = game.features.has('DYNAMIC_SHADOWS');
  const lights: { x: number; y: number; r: number; clip: boolean }[] = [];
  for (const lamp of game.lamps) {
    if (lamp.lit && near(f, lamp.x, lamp.radius)) {
      lights.push({ x: lamp.x, y: lamp.y, r: lamp.radius, clip: shadows });
    }
  }
  // Soft glows that never cast shadows: pickups, the player's suit lights, neon.
  for (const pickup of game.pickups) {
    if (!pickup.collected && near(f, pickup.x))
      lights.push({ x: pickup.x, y: pickup.y, r: 40, clip: false });
  }
  const p = game.player;
  lights.push({ x: p.feetX, y: p.box.y + 10, r: 26, clip: false });
  if (game.finale?.orb)
    lights.push({ x: game.finale.orb.x, y: game.finale.orb.y, r: 45, clip: false });

  for (const light of lights) {
    const g = sctx.createRadialGradient(
      light.x,
      light.y,
      light.r * 0.05,
      light.x,
      light.y,
      light.r,
    );
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.85)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = g;
    sctx.beginPath();
    if (light.clip) {
      const poly = visibilityPolygon(game.map, light, light.r);
      if (poly.length < 3) continue;
      sctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) sctx.lineTo(poly[i].x, poly[i].y);
      sctx.closePath();
    } else {
      sctx.arc(light.x, light.y, light.r, 0, Math.PI * 2);
    }
    sctx.fill();
  }
  f.screen();
  ctx.drawImage(shade, 0, 0, W, H);

  // A warm tint where the lamps shine.
  f.world();
  ctx.globalCompositeOperation = 'lighter';
  for (const lamp of game.lamps) {
    if (!lamp.lit || !near(f, lamp.x, lamp.radius)) continue;
    const g = ctx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, lamp.radius * 0.8);
    g.addColorStop(0, 'rgba(255,190,110,0.28)');
    g.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    if (shadows) {
      const poly = visibilityPolygon(game.map, lamp, lamp.radius);
      if (poly.length >= 3) {
        ctx.moveTo(poly[0].x, poly[0].y);
        for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      }
    } else {
      ctx.arc(lamp.x, lamp.y, lamp.radius, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

// --- Rain ----------------------------------------------------------------------------------

function drawRain(f: HdFrame): void {
  const { ctx, W, H, t, s } = f;
  ctx.strokeStyle = 'rgba(180,200,255,0.28)';
  ctx.lineWidth = Math.max(1, s * 0.25);
  ctx.beginPath();
  const n = 120;
  for (let i = 0; i < n; i++) {
    const speed = 0.9 + hash(i + 50) * 0.5;
    const x = (((hash(i) * W + t * 60 * s * 0.4 - f.camX * s * 0.6) % W) + W) % W;
    const y = ((hash(i + 100) * H + t * H * speed) % (H + 40)) - 20;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2 * s, y + 9 * s);
  }
  ctx.stroke();
}

// --- The HD moment ---------------------------------------------------------------------------

/** HD's moment: ENHANCE. The picture sharpens through the old resolutions to native. */
function drawEnhance(f: HdFrame): void {
  const m = f.game.moment;
  if (m?.feature !== 'HD' || (m.kind ?? 'added') !== 'added') return;
  const { ctx, W, H } = f;
  const steps = [160, 320, 640, 1280];
  const t = m.t - MOMENT_FLASH;
  const i = Math.floor(t / 0.22);
  if (t < 0) {
    if (f.game.comfort.reduceFlashing) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    return;
  }
  if (i >= steps.length || steps[i] >= W) return;
  const w = steps[i];
  const h = Math.round((w * 9) / 16);
  pixelate ??= document.createElement('canvas');
  if (pixelate.width !== w) {
    pixelate.width = w;
    pixelate.height = h;
  }
  const pctx = pixelate.getContext('2d');
  if (!pctx) return;
  pctx.imageSmoothingEnabled = true;
  pctx.drawImage(ctx.canvas, 0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pixelate, 0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = font(H * 0.08, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ENHANCE', W / 2, H * 0.3);
}

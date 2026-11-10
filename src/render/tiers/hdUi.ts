import { VIEW_W } from '../../config';
import { FEATURE_IDS, FEATURES } from '../../core/features';
import { POPUP_TIME } from '../../game/achievements';
import { FINALE_PHASES, PHASE_HITS, RESTORE_TIME } from '../../game/finale';
import { MOMENT_DURATION, MOMENT_FLASH, MOMENT_HITSTOP } from '../../game/game';
import type { PhotoFilter } from '../../game/photo';
import { font, hash, NEON_CYAN, NEON_GOLD, NEON_PINK, type HdFrame } from './hdCommon';

/*
 * HD's interface: a clean, modern HUD, banners, the achievement cascade, toasts, photo
 * mode and the finale's subtitles. Everything here is in screen pixels.
 */

let photoScratch: HTMLCanvasElement | null = null;

export function drawHdUi(f: HdFrame): void {
  const { game } = f;
  const capturing = game.photo?.snapRequested ?? false;
  drawWorldToasts(f);
  if (game.photo) {
    // The picture itself is clean: no HUD, and the photo UI only when not capturing.
    if (!capturing) drawPhotoUi(f);
    return;
  }
  drawHud(f);
  drawFinaleUi(f);
  drawTalk(f);
  drawToasts(f);
  drawAchievements(f);
  drawBanner(f);
  drawFlash(f);
  drawRestore(f);
}

function panel(f: HdFrame, x: number, y: number, w: number, h: number, edge = NEON_CYAN): void {
  const { ctx } = f;
  const r = Math.min(h / 2, f.H * 0.012);
  ctx.fillStyle = 'rgba(10,6,28,0.78)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(1, f.H * 0.002);
  ctx.stroke();
}

function text(
  f: HdFrame,
  value: string,
  x: number,
  y: number,
  size: number,
  colour = '#ffffff',
  align: CanvasTextAlign = 'left',
  weight = 700,
): void {
  const { ctx } = f;
  ctx.font = font(size, weight);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colour;
  ctx.fillText(value, x, y);
}

// --- HUD ---------------------------------------------------------------------------------

function drawHud(f: HdFrame): void {
  const { game, W, H, ctx } = f;
  const u = H / 100;
  if (game.features.has('SCORE')) {
    text(f, 'SCORE', u * 2.5, u * 3.2, u * 1.8, 'rgba(255,255,255,0.6)', 'left', 600);
    text(f, Math.floor(game.displayScore).toLocaleString('en-GB'), u * 2.5, u * 6.2, u * 3.4);
    if (game.features.has('HIGH_SCORES') && !game.finale?.active) {
      const hi = Math.floor(Math.max(game.hiScore, game.displayScore)).toLocaleString('en-GB');
      text(f, `HI ${hi}`, u * 2.5, u * 9.4, u * 1.8, 'rgba(255,255,255,0.6)', 'left', 600);
    }
  }
  if (game.features.has('LIVES')) {
    for (let i = 0; i < 3; i++) {
      const x = W - u * (3.5 + i * 4.2);
      const y = u * 4.5;
      ctx.fillStyle = i < game.lives ? '#ff3d6e' : 'rgba(255,255,255,0.18)';
      heart(ctx, x, y, u * 1.5);
    }
  }
  // Near a drone: are you hidden?
  const p = game.player;
  const watched = game.drones.some((d) => d.alive && Math.abs(d.x - p.feetX) < VIEW_W * 0.7);
  if (watched && game.enemiesActive) {
    const hidden = !game.playerLit;
    const x = u * 4;
    const y = H - u * 5;
    ctx.strokeStyle = hidden ? 'rgba(255,255,255,0.5)' : '#ff2d55';
    ctx.lineWidth = u * 0.4;
    ctx.beginPath();
    ctx.ellipse(x, y, u * 1.8, u * (hidden ? 0.3 : 1.1), 0, 0, Math.PI * 2);
    ctx.stroke();
    if (!hidden) {
      ctx.fillStyle = '#ff2d55';
      ctx.beginPath();
      ctx.arc(x, y, u * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    text(
      f,
      hidden ? 'HIDDEN' : 'IN THE LIGHT',
      x + u * 3,
      y,
      u * 1.8,
      hidden ? '#ffffffaa' : '#ff2d55',
    );
  }
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.3, x, y - r * 0.35);
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
  ctx.fill();
}

// --- The finale ----------------------------------------------------------------------------

function drawFinaleUi(f: HdFrame): void {
  const { game, W, H, ctx } = f;
  const fin = game.finale;
  if (!fin || !fin.active) return;
  const u = H / 100;
  if (fin.state !== 'restore') {
    // Name, and a pip per phase.
    text(f, 'THE DEPRECATOR', W / 2, u * 3.4, u * 2.4, NEON_PINK, 'center', 800);
    const n = FINALE_PHASES.length;
    const pw = u * 5;
    const x0 = W / 2 - (n * pw + (n - 1) * u) / 2;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (pw + u);
      ctx.fillStyle =
        i < fin.phase ? 'rgba(255,255,255,0.15)' : i === fin.phase ? NEON_PINK : '#5a2a55';
      ctx.fillRect(x, u * 5.6, pw, u * 0.9);
      if (i === fin.phase) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, u * 5.6, (pw * fin.hits) / PHASE_HITS, u * 0.9);
      }
    }
    // What you've won back so far (it all returns when it's beaten).
    if (fin.reclaimed.length > 0) {
      const labels = fin.reclaimed.map((id) => FEATURES[id].label);
      text(
        f,
        `RECLAIMED: ${labels.join(' · ')}`,
        W / 2,
        u * 8.6,
        u * 1.6,
        NEON_GOLD,
        'center',
        600,
      );
    }
  }
  const speech = fin.speech;
  if (speech) {
    const shown = speech.text.slice(0, Math.floor(speech.t * 40));
    const w = W * 0.7;
    // Between the Deprecator (up high) and the floor, so it never hides you.
    const y = H * 0.56;
    panel(f, W / 2 - w / 2, y, w, H * 0.13, NEON_PINK);
    text(f, 'THE DEPRECATOR', W / 2 - w / 2 + u * 2, y + u * 3, u * 1.8, NEON_PINK);
    text(f, shown, W / 2 - w / 2 + u * 2, y + u * 8, u * 2.6);
  }
}

/** Everything comes back at once: every feature's name flies out of you. */
function drawRestore(f: HdFrame): void {
  const { game, W, H, ctx } = f;
  const fin = game.finale;
  if (!fin || fin.state !== 'restore') return;
  const t = fin.t;
  if (t < 0.6) {
    ctx.fillStyle = `rgba(255,255,255,${(1 - t / 0.6).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
  const u = H / 100;
  const cx = f.sx(game.player.feetX);
  const cy = f.sy(game.player.box.y + 10);
  FEATURE_IDS.forEach((id, i) => {
    const a = hash(i) * Math.PI * 2;
    const k = Math.min(1, t / 1.6);
    const r = (0.1 + 0.9 * (1 - Math.pow(1 - k, 3))) * W * (0.25 + hash(i + 40) * 0.35);
    const alpha = Math.max(0, 1 - Math.max(0, t - 2) / (RESTORE_TIME - 2.5));
    ctx.globalAlpha = alpha;
    text(
      f,
      FEATURES[id].label,
      cx + Math.cos(a) * r,
      cy + Math.sin(a) * r * 0.6,
      u * 1.9,
      i % 3 ? NEON_CYAN : NEON_GOLD,
      'center',
      800,
    );
  });
  ctx.globalAlpha = 1;
}

// --- Talking -------------------------------------------------------------------------------

function drawTalk(f: HdFrame): void {
  const { game, W, H } = f;
  const u = H / 100;
  const npc = game.talkableNpc;
  if (npc) {
    const x = f.sx(npc.x);
    const y = f.sy(npc.y - 34);
    panel(f, x - u * 4, y - u * 1.8, u * 8, u * 3.6);
    text(f, '↑ TALK', x, y, u * 1.7, '#ffffff', 'center');
  }
  const d = game.dialogue;
  if (!d) return;
  const w = W * 0.8;
  const x = W / 2 - w / 2;
  const y = H * 0.68;
  panel(f, x, y, w, H * 0.26);
  const textPx = u * 2.8;
  const page = d.npc.pages[d.page] ?? '';
  const shown = page.slice(0, Math.floor(d.chars));
  // Wrap by measuring with the real font.
  f.ctx.font = font(textPx);
  const lines: string[] = [];
  let line = '';
  for (const word of page.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (f.ctx.measureText(next).width > w - u * 6 && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  let remaining = shown.length;
  lines.forEach((l, i) => {
    text(f, l.slice(0, Math.max(0, remaining)), x + u * 3, y + u * 4 + i * textPx * 1.4, textPx);
    remaining -= l.length + 1;
  });
}

// --- Toasts and achievements -------------------------------------------------------------

function drawWorldToasts(f: HdFrame): void {
  const { game, H } = f;
  const u = H / 100;
  for (const toast of game.toasts) {
    if (toast.x === undefined || toast.y === undefined) continue;
    const k = toast.t / toast.life;
    f.ctx.globalAlpha = 1 - k;
    const jitter = (Math.random() - 0.5) * u * 0.6;
    text(
      f,
      toast.text,
      f.sx(toast.x) + jitter,
      f.sy(toast.y) - k * u * 6,
      u * 2.4,
      NEON_GOLD,
      'center',
      900,
    );
  }
  f.ctx.globalAlpha = 1;
}

function drawToasts(f: HdFrame): void {
  const { game, W, H } = f;
  const u = H / 100;
  let y = H * 0.14;
  for (const toast of game.toasts) {
    if (toast.x !== undefined) continue;
    const fade = Math.min(1, toast.t * 4, (toast.life - toast.t) * 3);
    f.ctx.globalAlpha = Math.max(0, fade);
    const w = W * 0.5;
    panel(f, W / 2 - w / 2, y, w, toast.sub ? u * 9 : u * 5.5, NEON_GOLD);
    text(f, toast.text, W / 2, y + u * 2.8, u * 2.6, '#ffffff', 'center', 800);
    if (toast.sub) text(f, toast.sub, W / 2, y + u * 6.4, u * 1.8, NEON_GOLD, 'center', 600);
    y += u * 11;
  }
  f.ctx.globalAlpha = 1;
}

function drawAchievements(f: HdFrame): void {
  const { game, W, H, ctx } = f;
  const u = H / 100;
  const cardW = W * 0.2;
  const cardH = u * 6;
  const perColumn = Math.floor((H - u * 10) / (cardH + u * 0.8));
  game.achievements.popups.forEach((p, i) => {
    const age = p.t - p.delay;
    if (age < 0) return;
    const slide = Math.min(1, age * 6);
    const fade = Math.min(1, (POPUP_TIME - age) * 2);
    const col = Math.floor(i / perColumn);
    const row = i % perColumn;
    const x = W - (cardW + u) * (col + 1) + (1 - slide) * cardW;
    const y = u * 9 + row * (cardH + u * 0.8);
    ctx.globalAlpha = Math.max(0, fade);
    panel(f, x, y, cardW, cardH, NEON_GOLD);
    ctx.fillStyle = NEON_GOLD;
    ctx.beginPath();
    ctx.arc(x + cardH / 2, y + cardH / 2, cardH * 0.3, 0, Math.PI * 2);
    ctx.fill();
    text(f, '★', x + cardH / 2, y + cardH / 2 + u * 0.1, cardH * 0.4, '#3a2a00', 'center', 900);
    text(
      f,
      'ACHIEVEMENT UNLOCKED',
      x + cardH,
      y + cardH * 0.32,
      u * 1.25,
      'rgba(255,255,255,0.6)',
      'left',
      600,
    );
    text(f, p.name, x + cardH, y + cardH * 0.68, u * 1.75, '#ffffff', 'left', 800);
  });
  ctx.globalAlpha = 1;
  if (game.achievements.popups.length > 20) {
    const shown = game.achievements.popups.filter((p) => p.t >= p.delay).length;
    text(f, `${shown} ACHIEVEMENTS`, u * 3, H - u * 4, u * 2.6, NEON_GOLD, 'left', 900);
  }
}

// --- The unlock banner ---------------------------------------------------------------------

function drawBanner(f: HdFrame): void {
  const { game, W, H } = f;
  const m = game.moment;
  if (!m || m.t < MOMENT_FLASH) return;
  const kind = m.kind ?? 'added';
  if (kind === 'restored') return;
  const u = H / 100;
  const def = FEATURES[m.feature];
  const out = Math.min(1, (MOMENT_DURATION - m.t) * 3);
  const into = Math.min(1, (m.t - MOMENT_FLASH) * 6);
  f.ctx.globalAlpha = Math.max(0, Math.min(out, into));
  const playerY = (game.playerCenterY - f.camY) / (H / f.s);
  const y = H * (playerY < 0.5 ? 0.58 : 0.14);
  const w = W * 0.46;
  const colour = kind === 'removed' ? '#ff2d55' : kind === 'reclaimed' ? NEON_GOLD : NEON_CYAN;
  const heading =
    kind === 'removed' ? 'FEATURE REMOVED' : kind === 'reclaimed' ? 'RECLAIMED' : 'FEATURE ADDED';
  const hint =
    m.hint ??
    (kind === 'removed'
      ? 'WIN IT BACK'
      : kind === 'reclaimed'
        ? 'IT WILL COME BACK. KEEP GOING'
        : def.hint);
  panel(f, W / 2 - w / 2, y, w, u * 15, colour);
  text(f, heading, W / 2, y + u * 3, u * 1.8, colour, 'center', 700);
  text(f, def.label, W / 2, y + u * 7.6, u * 4.6, '#ffffff', 'center', 900);
  text(f, hint, W / 2, y + u * 12, u * 1.8, 'rgba(255,255,255,0.75)', 'center', 600);
  f.ctx.globalAlpha = 1;
}

/** The start of every moment: a soft white flash (HD is too classy to invert). */
function drawFlash(f: HdFrame): void {
  const m = f.game.moment;
  if (!m || m.t > MOMENT_HITSTOP || m.feature === 'HD') return;
  const k = 1 - m.t / MOMENT_HITSTOP;
  f.ctx.fillStyle =
    m.kind === 'removed'
      ? `rgba(255,30,80,${(k * 0.5).toFixed(3)})`
      : `rgba(255,255,255,${(k * 0.6).toFixed(3)})`;
  f.ctx.fillRect(0, 0, f.W, f.H);
}

// --- Photo mode ----------------------------------------------------------------------------

function drawPhotoUi(f: HdFrame): void {
  const { game, W, H, ctx } = f;
  const photo = game.photo;
  if (!photo) return;
  const u = H / 100;
  // Rule-of-thirds grid and corner brackets.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const k of [1 / 3, 2 / 3]) {
    ctx.moveTo(W * k, 0);
    ctx.lineTo(W * k, H);
    ctx.moveTo(0, H * k);
    ctx.lineTo(W, H * k);
  }
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = u * 0.4;
  const m = u * 3;
  const l = u * 6;
  ctx.beginPath();
  for (const [x, y, dx, dy] of [
    [m, m, 1, 1],
    [W - m, m, -1, 1],
    [m, H - m, 1, -1],
    [W - m, H - m, -1, -1],
  ]) {
    ctx.moveTo(x, y + dy * l);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * l, y);
  }
  ctx.stroke();
  panel(f, W / 2 - u * 12, u * 3.5, u * 24, u * 5);
  text(f, 'PHOTO MODE', W / 2, u * 6, u * 3, '#ffffff', 'center', 900);
  panel(f, W * 0.18, H - u * 8.5, W * 0.64, u * 5);
  text(
    f,
    `ARROWS: MOVE   ·   X: FILTER (${photo.filter})   ·   SPACE: TAKE PHOTO   ·   P: DONE`,
    W / 2,
    H - u * 6,
    u * 1.9,
    'rgba(255,255,255,0.85)',
    'center',
    600,
  );
  if (photo.shots > 0) {
    text(f, `${photo.shots} SAVED`, W - u * 5, u * 6, u * 1.9, NEON_GOLD, 'right', 700);
  }
  if (photo.flashT > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(photo.flashT / 0.3).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Photo filters, applied to the finished picture. '1978' is, of course, the best one. */
export function applyPhotoFilter(f: HdFrame, filter: PhotoFilter): void {
  const { ctx, W, H } = f;
  ctx.save();
  if (filter === 'NOIR' || filter === 'SEPIA') {
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, W, H);
    if (filter === 'SEPIA') {
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = 'rgba(160,110,55,0.85)';
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 0, W, H);
    }
  } else if (filter === 'VAPORWAVE') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, 'rgba(255,90,200,0.6)');
    g.addColorStop(1, 'rgba(60,230,255,0.6)');
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (filter === '1978') {
    // Back to the beginning: 160×90, black and white.
    photoScratch ??= document.createElement('canvas');
    photoScratch.width = 160;
    photoScratch.height = 90;
    const pctx = photoScratch.getContext('2d', { willReadFrequently: true });
    if (pctx) {
      pctx.drawImage(ctx.canvas, 0, 0, 160, 90);
      const img = pctx.getImageData(0, 0, 160, 90);
      for (let i = 0; i < img.data.length; i += 4) {
        const l = img.data[i] * 0.3 + img.data[i + 1] * 0.59 + img.data[i + 2] * 0.11;
        // Bright things become ink on white paper, like Era 0.
        const v = l > 165 ? 0 : 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      }
      pctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(photoScratch, 0, 0, W, H);
    }
  }
  ctx.restore();
}

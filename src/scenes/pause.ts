import {
  BINDABLE_ACTIONS,
  DEFAULT_KEYS,
  PAD_LAYOUT,
  RESERVED_KEYS,
  copyBindings,
  keyName,
  rebind,
  type BindableAction,
  type Input,
} from '../core/input';
import { COMFORT_KEYS, type Comfort } from '../core/comfort';
import { featureRows, toggleRow, type FeatureRow } from '../core/featureMenu';
import { ERA_NAMES, FEATURES, type FeatureId } from '../core/features';
import type { ScoreEntry } from '../core/scores';
import { VOLUME_STEPS, type Settings } from '../core/settings';
import type { ResolutionRequest } from '../render/display';
import { textWidth } from '../render/font3x5';
import type { PixelCanvas } from '../render/pixelCanvas';
import {
  BLACK,
  DIM,
  INK,
  Page,
  drawScoreTable,
  menuBack,
  menuConfirm,
  menuPressed,
  menuResolution,
} from './menuDraw';
import type { Scene } from './scene';

export interface PauseOptions {
  /** The game, drawn frozen behind the menu. */
  under: Scene;
  input: Input;
  settings: () => Settings;
  /** Apply and remember new settings. */
  setSettings: (settings: Settings) => void;
  /** A blip at the new sound-effects volume. */
  previewSfx: () => void;
  /** HIGH SCORES: the table, or null if you haven't found it yet. */
  highScores: () => readonly ScoreEntry[] | null;
  run: number;
  /** The post-game Feature Menu, or null before the Deprecator's beaten. */
  featureMenu: FeatureMenuOptions | null;
  onResume: () => void;
  /** Wipe the save and start again from the tape. */
  onNewGame: () => void;
}

export interface FeatureMenuOptions {
  /** Everything you've collected, on or off. */
  owned: () => ReadonlySet<FeatureId>;
  isOn: (id: FeatureId) => boolean;
  set: (id: FeatureId, on: boolean) => void;
}

type Item = 'resume' | 'features' | 'controls' | 'access' | 'music' | 'sfx' | 'scores' | 'newGame';
type Page_ = 'main' | 'features' | 'controls' | 'access' | 'scores' | 'newGame';

/** Rows of the Feature Menu on screen at once. */
const FEATURE_ROWS_SHOWN = 13;

const ITEM_LABELS: Record<Item, string> = {
  resume: 'RESUME',
  features: 'FEATURES',
  controls: 'CONTROLS',
  access: 'ACCESSIBILITY',
  music: 'MUSIC',
  sfx: 'SOUND FX',
  scores: 'HIGH SCORES',
  newGame: 'NEW GAME',
};

const COMFORT_LABELS: Record<keyof Comfort, [string, string]> = {
  reduceFlashing: ['REDUCE FLASHING', 'NO FULL-SCREEN FLASHES OR FLICKERING STATIC'],
  reduceShake: ['REDUCE SCREEN SHAKE', 'NO CAMERA SHAKE OR SCREEN HOPS'],
  reduceMotion: ['REDUCE MOTION', 'NO ZOOMS, SCREEN FLIPS OR LOADING STRIPES'],
  colourBlind: ['COLOUR-BLIND PALETTE', 'DANGER IN AMBER INSTEAD OF RED'],
};

const ACTION_LABELS: Record<BindableAction, string> = {
  left: 'LEFT',
  right: 'RIGHT',
  up: 'UP / CLIMB',
  down: 'DOWN',
  jump: 'JUMP',
  attack: 'ATTACK',
  special: 'SPECIAL',
  dash: 'DASH',
  photo: 'PHOTO MODE',
};

/** The controls screen's rows: every action, then two buttons. */
const CONTROL_ROWS = [...BINDABLE_ACTIONS, 'reset', 'done'] as const;

/**
 * The pause menu (PRD §12): there from the very first screen, because options are
 * accessibility, not a feature to collect. Esc / Start opens and closes it.
 */
export class PauseScene implements Scene {
  readonly name = 'pause';
  private t = 0;
  private page: Page_ = 'main';
  private cursor = 0;
  private controlsCursor = 0;
  private accessCursor = 0;
  private featureCursor = 0;
  /** First Feature Menu row on screen. */
  private featureScroll = 0;
  /** New game: 0 = NO, 1 = YES. */
  private confirmCursor = 0;
  /** The controls screen is waiting for a key for this action. */
  private capturing: BindableAction | null = null;
  private message: { text: string; t: number } | null = null;

  constructor(private readonly opts: PauseOptions) {}

  resolution(): ResolutionRequest {
    return menuResolution(this.opts.under.resolution());
  }

  smooth(): boolean {
    return this.opts.under.smooth?.() ?? false;
  }

  renderCap(): number | null {
    return null;
  }

  private items(): Item[] {
    const items: Item[] = ['resume'];
    if (this.opts.featureMenu) items.push('features');
    items.push('controls', 'access', 'music', 'sfx');
    if (this.opts.highScores()) items.push('scores');
    items.push('newGame');
    return items;
  }

  update(dt: number, input: Input): void {
    this.t += dt;
    if (this.message) {
      this.message.t += dt;
      if (this.message.t > 3) this.message = null;
    }
    if (this.page === 'main') this.updateMain(input);
    else if (this.page === 'controls') this.updateControls(input);
    else if (this.page === 'access') this.updateAccess(input);
    else if (this.page === 'features') this.updateFeatures(input);
    else if (this.page === 'scores') {
      if (menuBack(input) || menuConfirm(input)) this.page = 'main';
    } else this.updateNewGame(input);
  }

  private updateMain(input: Input): void {
    const items = this.items();
    if (menuBack(input)) return this.resume();
    if (menuPressed(input, 'up')) this.cursor = (this.cursor + items.length - 1) % items.length;
    if (menuPressed(input, 'down')) this.cursor = (this.cursor + 1) % items.length;
    this.cursor = Math.min(this.cursor, items.length - 1);
    const item = items[this.cursor];
    if (item === 'music' || item === 'sfx') {
      let step = 0;
      if (menuPressed(input, 'left')) step = -1;
      if (menuPressed(input, 'right')) step = 1;
      // Selecting a slider steps it up, wrapping round to silent.
      if (menuConfirm(input)) step = this.opts.settings()[item] >= VOLUME_STEPS ? -VOLUME_STEPS : 1;
      if (step !== 0) this.changeVolume(item, step);
      return;
    }
    if (!menuConfirm(input)) return;
    if (item === 'resume') this.resume();
    else if (item === 'controls') {
      this.page = 'controls';
      this.controlsCursor = 0;
    } else if (item === 'features') {
      this.page = 'features';
    } else if (item === 'access') {
      this.page = 'access';
      this.accessCursor = 0;
    } else if (item === 'scores') this.page = 'scores';
    else if (item === 'newGame') {
      this.page = 'newGame';
      this.confirmCursor = 0;
    }
  }

  private featureRows(): FeatureRow[] {
    return this.opts.featureMenu ? featureRows(this.opts.featureMenu.owned()) : [];
  }

  /** The Feature Menu: a long list, scrolled to keep the cursor in view. */
  private updateFeatures(input: Input): void {
    const menu = this.opts.featureMenu;
    const rows = this.featureRows();
    if (!menu || menuBack(input) || rows.length === 0) {
      this.page = 'main';
      return;
    }
    const n = rows.length;
    if (menuPressed(input, 'up')) this.featureCursor = (this.featureCursor + n - 1) % n;
    if (menuPressed(input, 'down')) this.featureCursor = (this.featureCursor + 1) % n;
    this.featureCursor = Math.min(this.featureCursor, n - 1);
    if (this.featureCursor < this.featureScroll) this.featureScroll = this.featureCursor;
    if (this.featureCursor >= this.featureScroll + FEATURE_ROWS_SHOWN) {
      this.featureScroll = this.featureCursor - FEATURE_ROWS_SHOWN + 1;
    }
    const toggle = menuConfirm(input) || menuPressed(input, 'left') || menuPressed(input, 'right');
    if (!toggle) return;
    for (const change of toggleRow(rows[this.featureCursor], menu.owned(), menu.isOn)) {
      menu.set(change.id, change.on);
    }
  }

  /** The accessibility page: a toggle per option, then BACK. */
  private updateAccess(input: Input): void {
    const n = COMFORT_KEYS.length + 1;
    if (menuBack(input)) {
      this.page = 'main';
      return;
    }
    if (menuPressed(input, 'up')) this.accessCursor = (this.accessCursor + n - 1) % n;
    if (menuPressed(input, 'down')) this.accessCursor = (this.accessCursor + 1) % n;
    const key = COMFORT_KEYS[this.accessCursor];
    const toggle =
      menuConfirm(input) || (key && (menuPressed(input, 'left') || menuPressed(input, 'right')));
    if (!toggle) return;
    if (!key) {
      this.page = 'main';
      return;
    }
    const settings = this.opts.settings();
    this.opts.setSettings({
      ...settings,
      comfort: { ...settings.comfort, [key]: !settings.comfort[key] },
    });
  }

  private changeVolume(which: 'music' | 'sfx', step: number): void {
    const settings = this.opts.settings();
    const value = Math.max(0, Math.min(VOLUME_STEPS, settings[which] + step));
    if (value === settings[which]) return;
    this.opts.setSettings({ ...settings, [which]: value });
    if (which === 'sfx') this.opts.previewSfx();
  }

  private updateControls(input: Input): void {
    if (this.capturing) {
      // The keyboard is captured, so only a gamepad can cancel from here.
      if (input.wasPressed('back')) this.stopCapture();
      return;
    }
    if (menuBack(input)) {
      this.page = 'main';
      return;
    }
    const n = CONTROL_ROWS.length;
    if (menuPressed(input, 'up')) this.controlsCursor = (this.controlsCursor + n - 1) % n;
    if (menuPressed(input, 'down')) this.controlsCursor = (this.controlsCursor + 1) % n;
    if (!menuConfirm(input)) return;
    const row = CONTROL_ROWS[this.controlsCursor];
    if (row === 'done') this.page = 'main';
    else if (row === 'reset') {
      this.opts.setSettings({ ...this.opts.settings(), keys: copyBindings(DEFAULT_KEYS) });
      this.say('KEYS BACK TO DEFAULTS');
    } else this.startCapture(row);
  }

  private startCapture(action: BindableAction): void {
    this.capturing = action;
    this.message = null;
    this.opts.input.captureKey((code) => {
      this.capturing = null;
      if (code === 'Escape') return;
      const label = ACTION_LABELS[action];
      const settings = this.opts.settings();
      const next = rebind(settings.keys, action, code);
      if (!next) {
        this.say(
          RESERVED_KEYS.has(code)
            ? `${keyName(code)} IS FOR MENUS`
            : `${label} NEEDS AT LEAST ONE KEY`,
        );
        return;
      }
      const removed = next[action].length < settings.keys[action].length;
      this.opts.setSettings({ ...settings, keys: next });
      this.say(`${label}: ${removed ? 'REMOVED' : 'ADDED'} ${keyName(code)}`);
    });
  }

  private stopCapture(): void {
    this.capturing = null;
    this.opts.input.cancelCapture();
  }

  private say(text: string): void {
    this.message = { text, t: 0 };
  }

  private updateNewGame(input: Input): void {
    if (menuBack(input)) {
      this.page = 'main';
      return;
    }
    if (
      menuPressed(input, 'left') ||
      menuPressed(input, 'right') ||
      menuPressed(input, 'up') ||
      menuPressed(input, 'down')
    ) {
      this.confirmCursor = 1 - this.confirmCursor;
    }
    if (!menuConfirm(input)) return;
    if (this.confirmCursor === 1) this.opts.onNewGame();
    else this.page = 'main';
  }

  private resume(): void {
    this.stopCapture();
    this.opts.onResume();
  }

  // --- Drawing ---------------------------------------------------------------------------

  render(p: PixelCanvas, alpha: number): void {
    this.opts.under.render(p, alpha);
    const page = new Page(p);
    page.shade(0.9);
    if (this.page === 'main') this.drawMain(page);
    else if (this.page === 'controls') this.drawControls(page);
    else if (this.page === 'access') this.drawAccess(page);
    else if (this.page === 'features') this.drawFeatures(page);
    else if (this.page === 'scores') {
      drawScoreTable(page, this.opts.highScores() ?? [], this.opts.run, this.t);
      page.color(DIM).center('ESC: BACK', 166);
    } else this.drawNewGame(page);
  }

  private drawMain(page: Page): void {
    page.color(INK).center('PAUSED', 14, 3);
    const settings = this.opts.settings();
    this.items().forEach((item, i) => {
      const y = 40 + i * 15;
      const selected = i === this.cursor;
      page.item(ITEM_LABELS[item], 96, y, 128, 2, selected);
      if (item === 'music' || item === 'sfx') {
        const value = settings[item];
        for (let v = 0; v < VOLUME_STEPS; v++) {
          page.color(selected ? BLACK : INK);
          const x = 172 + v * 5;
          if (v < value) page.rect(x, y, 4, 10);
          else page.rect(x + 1, y + 8, 2, 2);
        }
      }
    });
    page.color(DIM).center('ARROWS: CHOOSE   ENTER: SELECT   ESC: RESUME', 166);
  }

  private drawFeatures(page: Page): void {
    const menu = this.opts.featureMenu;
    if (!menu) return;
    page.color(INK).center('FEATURES', 6, 2);
    const rows = this.featureRows();
    const owned = menu.owned();
    const shown = rows.slice(this.featureScroll, this.featureScroll + FEATURE_ROWS_SHOWN);
    shown.forEach((row, i) => {
      const y = 24 + i * 9;
      const selected = this.featureScroll + i === this.featureCursor;
      if (row.kind === 'era') {
        const group = [...owned].filter((id) => FEATURES[id].era === row.era);
        const on = group.filter(menu.isOn).length;
        page.item(`ERA ${row.era}: ${ERA_NAMES[row.era]}`, 56, y, 208, 1, selected);
        page.color(selected ? BLACK : DIM).right(`${on}/${group.length} ON`, 264, y);
        return;
      }
      const on = menu.isOn(row.id);
      page.item(FEATURES[row.id].label, 68, y, 196, 1, selected);
      page.color(selected ? BLACK : on ? INK : DIM).right(on ? 'ON' : 'OFF', 264, y);
    });
    // Scroll hints.
    page.color(DIM);
    if (this.featureScroll > 0) page.text('^', 268, 24);
    if (this.featureScroll + FEATURE_ROWS_SHOWN < rows.length) page.text('V', 268, 132);
    const row = rows[this.featureCursor];
    page
      .color(INK)
      .center(
        row?.kind === 'feature'
          ? FEATURES[row.id].description.toUpperCase()
          : 'SWITCH THE WHOLE ERA ON OR OFF',
        148,
      );
    page.color(DIM).center('ENTER: SWITCH   ESC: BACK', 164);
  }

  private drawAccess(page: Page): void {
    page.color(INK).center('ACCESSIBILITY', 14, 2);
    const comfort = this.opts.settings().comfort;
    COMFORT_KEYS.forEach((key, i) => {
      const y = 44 + i * 18;
      const selected = i === this.accessCursor;
      page.item(COMFORT_LABELS[key][0], 56, y, 208, 2, selected);
      page.color(selected ? BLACK : comfort[key] ? INK : DIM);
      page.right(comfort[key] ? 'ON' : 'OFF', 264, y, 2);
    });
    page.item(
      'BACK',
      56,
      44 + COMFORT_KEYS.length * 18 + 4,
      208,
      2,
      this.accessCursor === COMFORT_KEYS.length,
    );
    const key = COMFORT_KEYS[this.accessCursor];
    page.color(INK).center(key ? COMFORT_LABELS[key][1] : '', 140);
    page.color(DIM);
    page.center('FLASHING, SHAKE AND MOTION START ON IF YOUR', 154);
    page.center('SYSTEM ASKS FOR REDUCED MOTION', 162);
  }

  private drawControls(page: Page): void {
    page.color(INK).center('CONTROLS', 6, 2);
    const keys = this.opts.settings().keys;
    CONTROL_ROWS.forEach((row, i) => {
      const y = 24 + i * 9;
      const selected = i === this.controlsCursor;
      if (row === 'reset' || row === 'done') {
        const label = row === 'reset' ? 'RESET TO DEFAULTS' : 'BACK';
        page.item(label, 64, y + 2, 200, 1, selected);
        return;
      }
      const waiting = this.capturing === row;
      page.item(ACTION_LABELS[row], 64, y, 200, 1, selected);
      page.color(selected ? BLACK : INK);
      const text = waiting
        ? Math.floor(this.t * 3) % 2
          ? 'PRESS A KEY...'
          : ''
        : keys[row].map(keyName).join('  ');
      page.text(text, 136, y);
    });
    page.color(DIM);
    page.center('ALWAYS: ESC PAUSE / BACK   ENTER SELECT   ARROWS MENUS', 130);
    const pad = PAD_LAYOUT.map(([b, a]) => `${b} ${a}`);
    page.center(`GAMEPAD: ${pad.slice(0, 3).join('   ')}`, 140);
    page.center(pad.slice(3).join('   '), 148);
    if (this.capturing) {
      page.color(INK).center('PRESS A NEW KEY TO ADD IT, OR ONE OF ITS KEYS TO REMOVE IT', 162);
      page.color(DIM).center('ESC: CANCEL', 171);
    } else {
      page.color(this.message ? INK : DIM);
      page.center(this.message?.text ?? 'ENTER: CHANGE KEYS   ESC: BACK', 166);
    }
  }

  private drawNewGame(page: Page): void {
    page.color(INK).center('NEW GAME?', 40, 3);
    page.center('START AGAIN FROM THE VERY BEGINNING.', 74, 1);
    page.center('EVERY FEATURE YOU HAVE COLLECTED WILL BE LOST.', 84, 1);
    page.color(DIM).center('(YOUR HIGH SCORES, VOLUME AND KEYS ARE KEPT.)', 96, 1);
    page.item('NO', 112, 120, textWidth('NO') * 2, 2, this.confirmCursor === 0);
    page.item('YES', 184, 120, textWidth('YES') * 2, 2, this.confirmCursor === 1);
    page.color(DIM).center('ESC: BACK', 166);
  }
}

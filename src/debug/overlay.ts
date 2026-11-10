import { FEATURE_IDS, FEATURES, type FeatureRegistry } from '../core/features';
import type { FixedLoop } from '../core/loop';
import type { Game } from '../game/game';
import { RESOLUTIONS, type Display, type Resolution } from '../render/display';

export interface DebugDeps {
  features: FeatureRegistry;
  game: Game;
  loop: FixedLoop;
  display: Display;
  /** Set a resolution override, or null to go back to the era's own resolution. */
  sceneName(): string;
  setResolutionOverride(res: Resolution | null): void;
  playIntro(): void;
  resetSave(): void;
}

const STYLE = `
  position: fixed; top: 8px; left: 8px; z-index: 10;
  padding: 10px 12px; max-width: 260px;
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #e8e8e8; background: rgba(20, 20, 24, 0.88);
  border: 1px solid #444; border-radius: 6px; user-select: none;
`;

/**
 * Developer overlay, toggled with the backquote key (`). In dev builds it's always
 * available; in production only with ?debug in the URL.
 */
export class DebugOverlay {
  private readonly root = document.createElement('div');
  private readonly stats = document.createElement('pre');
  private readonly list = document.createElement('div');
  private lastStats = 0;

  constructor(private readonly deps: DebugDeps) {
    this.root.style.cssText = STYLE;
    this.root.style.display = 'none';
    this.stats.style.margin = '0 0 8px';

    const title = document.createElement('div');
    title.textContent = 'STICK 2 HERO · debug (`)';
    title.style.cssText = 'font-weight: bold; margin-bottom: 6px;';

    this.root.append(title, this.stats, this.buildResolution(), this.list, this.buildButtons());
    document.body.appendChild(this.root);

    this.buildFeatureList();
    deps.features.onChange(() => this.syncChecks());

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') this.toggle();
    });
  }

  toggle(): void {
    this.root.style.display = this.root.style.display === 'none' ? 'block' : 'none';
  }

  /** Call every rendered frame; refreshes the text a few times a second. */
  update(): void {
    if (this.root.style.display === 'none') return;
    const now = performance.now();
    if (now - this.lastStats < 200) return;
    this.lastStats = now;
    const { loop, game, display } = this.deps;
    const p = game.player;
    const res = display.currentResolution;
    this.stats.textContent = [
      `scene  ${this.deps.sceneName()}`,
      `render ${loop.renderFps.toFixed(0)} fps (cap ${loop.renderCap ?? 'none'})`,
      `sim    ${loop.stepsPerSecond.toFixed(0)} Hz`,
      `res    ${res.width}×${res.height}`,
      `pos    ${p.feetX.toFixed(1)}, ${p.feetY.toFixed(1)}`,
      `vel    ${p.vx.toFixed(0)}, ${p.vy.toFixed(0)}  ${p.state === 'normal' ? (p.onGround ? 'ground' : 'air') : p.state}`,
      `cam    ${game.camera.mode} @ ${game.camera.x}, ${game.camera.y}`,
      `score  ${game.score}`,
    ].join('\n');
  }

  private buildResolution(): HTMLElement {
    const label = document.createElement('label');
    label.style.cssText = 'display: block; margin-bottom: 8px;';
    label.textContent = 'resolution ';
    const select = document.createElement('select');
    const auto = new Option('era default', '');
    select.add(auto);
    for (const [name, r] of Object.entries(RESOLUTIONS)) {
      select.add(new Option(`${r.width}×${r.height} (${name})`, name));
    }
    select.addEventListener('change', () => {
      const r = RESOLUTIONS[select.value as keyof typeof RESOLUTIONS];
      this.deps.setResolutionOverride(r ?? null);
      select.blur(); // Don't let arrow keys keep changing it.
    });
    label.appendChild(select);
    return label;
  }

  private buildFeatureList(): void {
    this.list.replaceChildren();
    let era = -1;
    for (const id of FEATURE_IDS) {
      const def = FEATURES[id];
      if (def.era !== era) {
        era = def.era;
        const heading = document.createElement('div');
        heading.textContent = `Era ${era}`;
        heading.style.cssText = 'color: #999; margin-top: 4px;';
        this.list.appendChild(heading);
      }
      const row = document.createElement('label');
      row.style.cssText = 'display: block; cursor: pointer;';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.dataset.feature = id;
      box.checked = this.deps.features.has(id);
      box.addEventListener('change', () => {
        this.deps.features.set(id, box.checked);
        box.blur(); // Keep Space for jumping.
      });
      row.append(box, ` ${def.label}`);
      row.title = def.description;
      this.list.appendChild(row);
    }
  }

  private syncChecks(): void {
    for (const box of this.list.querySelectorAll<HTMLInputElement>('input[data-feature]')) {
      const id = box.dataset.feature;
      if (id) box.checked = this.deps.features.has(id as (typeof FEATURE_IDS)[number]);
    }
  }

  private buildButtons(): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;';
    const button = (text: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.addEventListener('click', () => {
        onClick();
        b.blur();
      });
      return b;
    };
    const { features } = this.deps;
    row.append(
      button('all on', () => FEATURE_IDS.forEach((id) => features.unlock(id))),
      button('all off', () => FEATURE_IDS.forEach((id) => features.lock(id))),
      button('tape intro', () => this.deps.playIntro()),
      button('reset save', () => this.deps.resetSave()),
    );
    return row;
  }
}

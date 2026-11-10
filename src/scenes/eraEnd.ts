import { ERA_NAMES, type Era } from '../core/features';
import type { Input } from '../core/input';
import { RESOLUTIONS, type Resolution } from '../render/display';
import { GLYPH_H } from '../render/font3x5';
import type { PixelCanvas } from '../render/pixelCanvas';
import type { Scene } from './scene';

const PHOSPHOR = '#33ff66';
const INVERT_TIME = 0.35;
const MIN_TIME = 1.2;

export interface EraEndOptions {
  from: Era;
  /** The next era, and whether it's playable yet. */
  to: Era;
  available: boolean;
  onDone(): void;
}

/** Between eras: the screen wipes to black and announces the next era. Any key continues. */
export class EraEndScene implements Scene {
  readonly name = 'era-end';
  private t = 0;

  constructor(private readonly options: EraEndOptions) {}

  resolution(): Resolution {
    return RESOLUTIONS.ERA1;
  }

  renderCap(): number | null {
    return null;
  }

  update(dt: number, input: Input): void {
    this.t += dt;
    if (this.t > MIN_TIME && input.wasAnyPressed()) this.options.onDone();
  }

  render(p: PixelCanvas): void {
    const { from, to, available } = this.options;
    // Wipe: the old screen drains away from the top down.
    p.clear('#000');
    if (this.t < INVERT_TIME) {
      const remaining = Math.round(p.height * (1 - this.t / INVERT_TIME));
      p.color(from === 0 ? '#fff' : PHOSPHOR);
      p.rect(0, p.height - remaining, p.width, remaining);
      return;
    }
    const cx = p.width / 2;
    const line = (GLYPH_H + 4) * 2;
    let y = Math.round(p.height * 0.2);
    p.color('#fff');
    p.textCentered(`END OF ERA ${from}`, cx, y, 2);
    y += line * 2;
    p.color(PHOSPHOR);
    p.textCentered(`ERA ${to}: ${ERA_NAMES[to]}`, cx, y, 3);
    if (!available) {
      y += line * 1.5;
      p.textCentered('COMING SOON', cx, y, 2);
    }
    if (this.t > MIN_TIME && Math.floor(this.t * 2) % 2 === 0) {
      p.color('#fff');
      p.textCentered('PRESS ANY KEY', cx, p.height - line, 1);
    }
  }
}

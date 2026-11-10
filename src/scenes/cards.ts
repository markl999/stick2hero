import { typeCheat, type Cheat } from '../core/cheats';
import type { Input } from '../core/input';
import { RESOLUTIONS, type Resolution } from '../render/display';
import { GLYPH_H } from '../render/font3x5';
import type { PixelCanvas } from '../render/pixelCanvas';
import { stickPose } from '../render/stickman';
import type { Scene } from './scene';

const PHOSPHOR = '#33ff66';
const PAPER = '#020a04';

/**
 * The TITLE SCREEN feature: once collected, the game has a title screen, shown right
 * away (it's "just been made") and on every boot after the tape loader.
 */
export class TitleScene implements Scene {
  readonly name = 'title';
  private t = 0;
  /** CHEAT CODES: what's been typed, and what the last code did. */
  private typed = '';
  private message: { text: string; t: number } | null = null;

  /**
   * `cheat`: with CHEAT CODES, called when a code is typed; returns what to say about it.
   * Typing then doesn't start the game; anything else (Enter, a button) does.
   */
  constructor(
    private readonly onDone: () => void,
    private readonly cheat?: (code: Cheat) => string,
  ) {}

  resolution(): Resolution {
    return RESOLUTIONS.ERA1;
  }

  renderCap(): number | null {
    return null;
  }

  update(dt: number, input: Input): void {
    this.t += dt;
    if (this.message) this.message.t += dt;
    const letters = input.typed();
    if (this.cheat && letters.length > 0) {
      const result = typeCheat(this.typed, letters);
      this.typed = result.buffer;
      if (result.cheat) this.message = { text: this.cheat(result.cheat), t: 0 };
      return;
    }
    if (this.t > 0.6 && input.wasAnyPressed()) this.onDone();
  }

  render(p: PixelCanvas): void {
    p.clear(PAPER);
    p.color(PHOSPHOR);
    const cx = p.width / 2;
    // The logo, with a frame.
    p.strokeRect(36, 18, p.width - 72, 92);
    p.strokeRect(38, 20, p.width - 76, 88);
    p.textCentered('STICK 2', cx, 30, 6);
    p.textCentered('HERO', cx, 70, 6);

    // The hero (for now) standing proudly under the logo.
    const pose = stickPose({ arms: true, state: 'normal', facing: 1 });
    const fx = cx;
    const fy = 142;
    for (const [x0, y0, x1, y1] of pose.segments) {
      p.line(fx + x0, fy + y0, fx + x1, fy + y1);
      p.line(fx + x0 + 1, fy + y0, fx + x1 + 1, fy + y1);
    }
    p.disc(fx + pose.head.x, fy + pose.head.y, pose.head.r);
    p.hline(cx - 40, cx + 40, fy + 1);

    if (this.cheat) {
      // CHEAT CODES: the code so far, and what the last one did.
      if (this.message && this.message.t < 2.5) {
        p.textCentered(this.message.text, cx, 152, 2);
      } else if (this.typed) {
        p.textCentered(`CODE: ${this.typed}${Math.floor(this.t * 3) % 2 ? '-' : ' '}`, cx, 152, 2);
      } else if (Math.floor(this.t * 2) % 2 === 0) {
        p.textCentered('TYPE A CODE, OR PRESS ENTER', cx, 152, 2);
      }
    } else if (Math.floor(this.t * 2) % 2 === 0) {
      p.textCentered('PRESS ANY KEY', cx, 152, 2);
    }
    p.textCentered('1981', cx, p.height - (GLYPH_H + 3), 1);
  }
}

/** LIVES ran out. Any key restarts the era from its beginning (features are kept). */
export class GameOverScene implements Scene {
  readonly name = 'game-over';
  private t = 0;

  constructor(private readonly onDone: () => void) {}

  resolution(): Resolution {
    return RESOLUTIONS.ERA1;
  }

  renderCap(): number | null {
    return null;
  }

  update(dt: number, input: Input): void {
    this.t += dt;
    if (this.t > 1.2 && input.wasAnyPressed()) this.onDone();
  }

  render(p: PixelCanvas): void {
    p.clear(PAPER);
    p.color(PHOSPHOR);
    const cx = p.width / 2;
    p.textCentered('GAME OVER', cx, 60, 5);
    if (this.t > 1.2 && Math.floor(this.t * 2) % 2 === 0) {
      p.textCentered('PRESS ANY KEY TO TRY AGAIN', cx, 120, 2);
    }
  }
}

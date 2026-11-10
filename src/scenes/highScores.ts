import type { Input } from '../core/input';
import {
  INITIAL_CHARS,
  INITIALS_LENGTH,
  qualifies,
  record,
  runEntry,
  type ScoreEntry,
} from '../core/scores';
import { RESOLUTIONS, type Resolution } from '../render/display';
import type { PixelCanvas } from '../render/pixelCanvas';
import { BLACK, DIM, INK, PHOSPHOR, Page, drawScoreTable } from './menuDraw';
import type { Scene } from './scene';

export interface HighScoreOptions {
  table: readonly ScoreEntry[];
  run: number;
  score: number;
  /** The table changed: remember it. */
  onSave: (table: ScoreEntry[]) => void;
  onDone: () => void;
}

/**
 * HIGH SCORES, after a Game Over or the ending: type your initials if you made the table
 * (arcade style: up/down picks a letter, or just type it), then see where you are.
 * A run that's already on the table just has its row raised.
 */
export class HighScoreScene implements Scene {
  readonly name = 'high-scores';
  private t = 0;
  private table: ScoreEntry[];
  private entering: boolean;
  private readonly letters: number[] = Array<number>(INITIALS_LENGTH).fill(0);
  private slot = 0;
  /** Where the new score landed, or -1. */
  private rank = -1;

  constructor(private readonly opts: HighScoreOptions) {
    this.table = [...opts.table];
    const existing = runEntry(this.table, opts.run);
    this.entering = !existing && qualifies(this.table, opts.score);
    if (existing && opts.score > existing.score) this.save(existing.initials);
    else if (existing) this.rank = this.table.indexOf(existing);
  }

  resolution(): Resolution {
    return RESOLUTIONS.ERA1;
  }

  renderCap(): number | null {
    return null;
  }

  update(dt: number, input: Input): void {
    this.t += dt;
    if (!this.entering) {
      if (this.t > 0.8 && input.wasAnyPressed()) this.opts.onDone();
      return;
    }
    // Typed letters win. (Letters can also be game keys: W is UP, X is ATTACK...)
    const typed = input.typed();
    if (typed.length > 0) {
      for (const ch of typed) {
        this.letters[this.slot] = INITIAL_CHARS.indexOf(ch);
        if (this.next()) return;
      }
      return;
    }
    // Otherwise only the fixed menu keys and the gamepad, for the same reason.
    const n = INITIAL_CHARS.length;
    const letter = this.letters[this.slot];
    if (input.wasPressed('menuUp')) this.letters[this.slot] = (letter + 1) % n;
    if (input.wasPressed('menuDown')) this.letters[this.slot] = (letter + n - 1) % n;
    if (input.wasPressed('menuLeft') || input.wasPressed('back')) {
      this.slot = Math.max(0, this.slot - 1);
    }
    if (input.wasPressed('menuRight') || input.wasPressed('confirm')) this.next();
  }

  /** Move to the next letter; after the last, save. Returns true once saved. */
  private next(): boolean {
    if (this.slot < INITIALS_LENGTH - 1) {
      this.slot++;
      return false;
    }
    this.save(this.letters.map((i) => INITIAL_CHARS[i]).join(''));
    this.entering = false;
    this.t = 0;
    return true;
  }

  private save(initials: string): void {
    const result = record(this.table, { initials, score: this.opts.score, run: this.opts.run });
    this.table = result.table;
    this.rank = result.rank;
    this.opts.onSave(this.table);
  }

  render(p: PixelCanvas): void {
    p.clear(BLACK);
    const page = new Page(p);
    const score = this.opts.score.toString().padStart(6, '0');
    if (this.entering) {
      page.color(PHOSPHOR).center('NEW HIGH SCORE!', 24, 3);
      page.color(INK).center(`SCORE ${score}`, 52, 2);
      page.color(PHOSPHOR).center('ENTER YOUR INITIALS', 76, 1);
      for (let i = 0; i < INITIALS_LENGTH; i++) {
        // Centred in its slot (M and W are wider than the rest).
        const cx = 128 + i * 32;
        const active = i === this.slot;
        page.color(active ? INK : PHOSPHOR);
        page.center(INITIAL_CHARS[this.letters[i]], 92, 5, cx);
        if (!active || Math.floor(this.t * 3) % 2 === 0) page.rect(cx - 12, 122, 24, 2);
      }
      page.color(DIM).center('UP / DOWN: LETTER   ENTER: NEXT   (OR JUST TYPE)', 150);
      return;
    }
    drawScoreTable(page, this.table, this.opts.run, this.t);
    page.color(this.rank >= 0 ? INK : DIM);
    page.center(this.rank >= 0 ? `YOU: ${score}` : `YOUR SCORE ${score}: NOT QUITE`, 162);
    if (this.t > 0.8 && Math.floor(this.t * 2) % 2 === 0) {
      page.color(DIM).center('PRESS ANY KEY', 172);
    }
  }
}

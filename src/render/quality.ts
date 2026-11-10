/**
 * HD quality: Era 5 draws at the screen's own resolution, which a weak integrated GPU may
 * not manage at 60fps. This watches the render rate while HD is on and says when to step
 * the resolution down. It never steps back up (a picture that keeps changing is worse).
 */
export const HD_WIDTHS = [1920, 1280, 960, 640] as const;

/** Below this frame rate, sustained... */
const SLOW_MS = 1000 / 45;
/** ...for this long, step down. */
const SUSTAIN_MS = 3000;
/** Gaps longer than this are the tab being hidden or a hiccup, not slowness. */
const IGNORE_MS = 250;

export class HdQuality {
  private level = 0;
  private avg = 1000 / 60;
  private slowFor = 0;

  get maxWidth(): number {
    return HD_WIDTHS[this.level];
  }

  /** Call once per rendered HD frame. Returns true when the resolution just stepped down. */
  frame(intervalMs: number): boolean {
    if (intervalMs <= 0 || intervalMs > IGNORE_MS) return false;
    this.avg += (intervalMs - this.avg) * 0.1;
    this.slowFor = this.avg > SLOW_MS ? this.slowFor + intervalMs : 0;
    if (this.slowFor < SUSTAIN_MS || this.level >= HD_WIDTHS.length - 1) return false;
    this.level++;
    this.slowFor = 0;
    this.avg = 1000 / 60;
    return true;
  }
}

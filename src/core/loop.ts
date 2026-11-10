import { STEP } from '../config';

export interface LoopCallbacks {
  /** Advance the simulation by exactly one fixed step. */
  step(dt: number): void;
  /** Draw. `alpha` (0..1) is how far we are between the last step and the next one. */
  render(alpha: number): void;
}

/**
 * Fixed-timestep simulation (always 60Hz) with an independent, optionally capped,
 * render rate. Era 0 renders at 15fps until FRAME_RATE is collected, but physics
 * still runs at 60Hz so movement feels identical.
 */
export class FixedLoop {
  /** Max renders per second, or null for every animation frame. */
  renderCap: number | null = null;
  renderFps = 0;
  stepsPerSecond = 0;

  private acc = 0;
  private last = 0;
  private lastRender = -Infinity;
  private running = false;
  private frameCount = 0;
  private stepCount = 0;
  private statsStart = 0;
  private forceRender = false;

  constructor(private readonly callbacks: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.statsStart = this.last;
    requestAnimationFrame(this.tick);
  }

  /** Render on the next frame even if the cap would skip it (e.g. after a resize). */
  requestRender(): void {
    this.forceRender = true;
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    requestAnimationFrame(this.tick);

    // Clamp long gaps (tab switched away) so we don't fast-forward the world.
    this.acc += Math.min((now - this.last) / 1000, 0.25);
    this.last = now;

    while (this.acc >= STEP) {
      this.callbacks.step(STEP);
      this.acc -= STEP;
      this.stepCount++;
    }

    // Small tolerance so a 15fps cap lands on every 4th 60Hz frame, not every 5th.
    const minGap = this.renderCap ? 1000 / this.renderCap - 2 : 0;
    if (this.forceRender || now - this.lastRender >= minGap) {
      this.forceRender = false;
      this.lastRender = now;
      this.callbacks.render(this.acc / STEP);
      this.frameCount++;
    }

    if (now - this.statsStart >= 500) {
      const secs = (now - this.statsStart) / 1000;
      this.renderFps = this.frameCount / secs;
      this.stepsPerSecond = this.stepCount / secs;
      this.frameCount = 0;
      this.stepCount = 0;
      this.statsStart = now;
    }
  };
}

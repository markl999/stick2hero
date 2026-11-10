import type { Input } from '../core/input';
import type { Resolution } from '../render/display';
import type { PixelCanvas } from '../render/pixelCanvas';

/** A top-level mode of the game: the tape loader, gameplay, an era transition… */
export interface Scene {
  readonly name: string;
  /** Internal resolution this scene draws at. */
  resolution(): Resolution;
  /** Max renders per second, or null for uncapped. Checked every step. */
  renderCap(): number | null;
  update(dt: number, input: Input): void;
  render(p: PixelCanvas, alpha: number): void;
}

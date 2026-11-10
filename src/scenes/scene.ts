import type { Input } from '../core/input';
import type { MusicTrack } from '../core/audio';
import type { ResolutionRequest } from '../render/display';
import type { PostFx } from '../render/postFx';
import type { PixelCanvas } from '../render/pixelCanvas';

/** A top-level mode of the game: the tape loader, gameplay, an era transition… */
export interface Scene {
  readonly name: string;
  /** Internal resolution this scene draws at ('native' for HD). Checked every frame. */
  resolution(): ResolutionRequest;
  /** HD: scale smoothly rather than in crisp whole pixels. */
  smooth?(): boolean;
  /** BLOOM / POST-FX for this frame, if any. */
  postFx?(): PostFx | null;
  /** Override the soundtrack while this scene is showing. */
  music?(): MusicTrack;
  /** Max renders per second, or null for uncapped. Checked every step. */
  renderCap(): number | null;
  update(dt: number, input: Input): void;
  render(p: PixelCanvas, alpha: number): void;
}

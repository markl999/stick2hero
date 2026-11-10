import { Application, CanvasSource, Container, RenderTexture, Sprite, Texture } from 'pixi.js';
import { PixelCanvas } from './pixelCanvas';

export interface Resolution {
  width: number;
  height: number;
}

/** Internal resolutions the eras step through (PRD §11). All are 16:9, matching one screen. */
export const RESOLUTIONS = {
  ERA0: { width: 160, height: 90 },
  ERA1: { width: 320, height: 180 },
  ERA3: { width: 640, height: 360 },
  HD: { width: 1280, height: 720 },
  FULL_HD: { width: 1920, height: 1080 },
} as const satisfies Record<string, Resolution>;

/**
 * The render pipeline:
 *   world layers (for now just the pixel canvas)
 *     → RenderTexture at the era's internal resolution
 *     → one Sprite on the stage, scaled up with nearest-neighbour filtering, letterboxed
 * Post-processing (CRT, bloom, …) will hang off the stage sprite in later milestones.
 */
export class Display {
  readonly pixel: PixelCanvas;
  private readonly world = new Container();
  private readonly screen: Sprite;
  private pixelSprite: Sprite;
  private target: RenderTexture;
  private resolution: Resolution;

  private constructor(
    private readonly app: Application,
    initial: Resolution,
  ) {
    this.resolution = initial;
    this.pixel = new PixelCanvas(initial.width, initial.height);
    this.pixelSprite = new Sprite(this.makePixelTexture());
    this.world.addChild(this.pixelSprite);
    this.target = this.makeTarget(initial);
    this.screen = new Sprite(this.target);
    app.stage.addChild(this.screen);
    this.layout();
  }

  static async create(parent: HTMLElement, initial: Resolution): Promise<Display> {
    const app = new Application();
    await app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      background: '#000000',
      antialias: false,
      autoStart: false, // We drive rendering from our own fixed-step loop.
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      preference: 'webgl',
    });
    parent.appendChild(app.canvas);
    return new Display(app, initial);
  }

  get currentResolution(): Resolution {
    return this.resolution;
  }

  setResolution(res: Resolution): void {
    if (res.width === this.resolution.width && res.height === this.resolution.height) return;
    this.resolution = res;
    this.pixel.resize(res.width, res.height);

    const oldPixel = this.pixelSprite.texture;
    this.pixelSprite.texture = this.makePixelTexture();
    oldPixel.destroy(true);

    const oldTarget = this.target;
    this.target = this.makeTarget(res);
    this.screen.texture = this.target;
    oldTarget.destroy(true);

    this.layout();
  }

  /** Call when the window size changes. */
  resize(width: number, height: number): void {
    this.app.renderer.resize(width, height);
    this.layout();
  }

  /** Upload the pixel canvas and draw the frame. */
  present(): void {
    this.pixelSprite.texture.source.update();
    this.app.renderer.render({ container: this.world, target: this.target, clear: true });
    this.app.renderer.render({ container: this.app.stage });
  }

  private makePixelTexture(): Texture {
    const source = new CanvasSource({ resource: this.pixel.canvas, scaleMode: 'nearest' });
    return new Texture({ source });
  }

  private makeTarget(res: Resolution): RenderTexture {
    return RenderTexture.create({ width: res.width, height: res.height, scaleMode: 'nearest' });
  }

  /** Largest integer scale that fits (fractional only if the window is smaller than 1×). */
  private layout(): void {
    const { width: W, height: H } = this.app.screen;
    const { width: w, height: h } = this.resolution;
    const fit = Math.min(W / w, H / h);
    const scale = fit >= 1 ? Math.floor(fit) : fit;
    this.screen.scale.set(scale);
    this.screen.position.set(Math.round((W - w * scale) / 2), Math.round((H - h * scale) / 2));
  }
}

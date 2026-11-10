import { AudioEngine } from './core/audio';
import { FeatureRegistry } from './core/features';
import { Input } from './core/input';
import { FixedLoop } from './core/loop';
import { clearSave, loadSave, writeSave } from './core/save';
import { DebugOverlay } from './debug/overlay';
import { Game } from './game/game';
import { Display, type Resolution } from './render/display';
import { EraEndScene } from './scenes/eraEnd';
import { GameScene } from './scenes/gameScene';
import type { Scene } from './scenes/scene';
import { TapeLoaderScene } from './scenes/tapeLoader';
import { ERA0_LEVEL } from './world/levels/era0';
import { parseLevel } from './world/tilemap';

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const save = loadSave();
  const features = new FeatureRegistry(save.features);
  const audio = new AudioEngine();
  const input = new Input();
  input.attach(window, () => audio.unlock());
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const game = new Game({
    features,
    level: parseLevel(ERA0_LEVEL),
    hooks: { beep: () => audio.beep(), save: () => persist() },
    score: save.score,
    checkpoint: save.checkpoint,
  });
  const persist = () =>
    writeSave({
      version: 1,
      features: features.list(),
      score: game.score,
      introSeen: save.introSeen,
      checkpoint: game.checkpoint,
    });
  features.onChange(() => persist());

  const parent = document.getElementById('app');
  if (!parent) throw new Error('#app missing');

  // --- Scenes ---------------------------------------------------------------------
  let resolutionOverride: Resolution | null = null;
  let scene: Scene;
  const display = await Display.create(parent, { width: 320, height: 180 });
  const loop = new FixedLoop({
    step: (dt) => {
      input.poll();
      scene.update(dt, input);
      loop.renderCap = scene.renderCap();
    },
    render: (alpha) => {
      scene.render(display.pixel, alpha);
      display.present();
      debug?.update();
    },
  });

  const setScene = (next: Scene) => {
    scene = next;
    applyResolution();
  };
  const applyResolution = () => {
    display.setResolution(resolutionOverride ?? scene.resolution());
    loop.renderCap = scene.renderCap();
    loop.requestRender();
  };

  const gameScene = new GameScene(game, () => setScene(new EraEndScene(() => setScene(gameScene))));
  const tapeScene = () =>
    new TapeLoaderScene({
      audio,
      skippable: save.introSeen,
      reducedMotion,
      onDone: (completed) => {
        if (completed && !save.introSeen) {
          save.introSeen = true;
          persist();
        }
        setScene(gameScene);
      },
    });

  setScene(params.has('skipintro') ? gameScene : tapeScene());

  window.addEventListener('resize', () => {
    display.resize(window.innerWidth, window.innerHeight);
    loop.requestRender();
  });

  // --- Debug ----------------------------------------------------------------------
  const debugEnabled = import.meta.env.DEV || params.has('debug');
  const debug = debugEnabled
    ? new DebugOverlay({
        features,
        game,
        loop,
        display,
        sceneName: () => scene.name,
        setResolutionOverride: (res) => {
          resolutionOverride = res;
          applyResolution();
        },
        playIntro: () => setScene(tapeScene()),
        resetSave: () => {
          clearSave();
          location.reload();
        },
      })
    : null;

  // Dev-only handle for poking at the game from the console or browser automation.
  if (import.meta.env.DEV) {
    Object.assign(window, { __stick2hero: { game, features, setScene, gameScene } });
  }

  loop.start();
}

void boot();

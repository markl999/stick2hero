import { AudioEngine } from './core/audio';
import { FeatureRegistry } from './core/features';
import { Input } from './core/input';
import { FixedLoop } from './core/loop';
import { clearSave, loadSave, writeSave } from './core/save';
import { DebugOverlay } from './debug/overlay';
import { Game } from './game/game';
import { Display, RESOLUTIONS, type Resolution } from './render/display';
import { drawEra0 } from './render/tiers/era0';
import { TEST_ROOM } from './world/levels/testRoom';
import { parseLevel } from './world/tilemap';

async function boot(): Promise<void> {
  const save = loadSave();
  const features = new FeatureRegistry(save.features);
  const audio = new AudioEngine();
  const input = new Input();
  input.attach(window, () => audio.unlock());

  const game = new Game(
    features,
    parseLevel(TEST_ROOM),
    { beep: () => audio.beep(), save: () => persist() },
    save.score,
  );
  const persist = () =>
    writeSave({
      version: 1,
      features: features.list(),
      score: game.score,
      introSeen: save.introSeen,
    });

  const parent = document.getElementById('app');
  if (!parent) throw new Error('#app missing');

  // Only Era 0 exists so far; later eras will choose their resolution from the feature set.
  const eraResolution = (): Resolution => RESOLUTIONS.ERA0;
  let resolutionOverride: Resolution | null = null;

  const display = await Display.create(parent, eraResolution());

  const loop = new FixedLoop({
    step: (dt) => {
      input.poll();
      game.update(dt, input);
    },
    render: (alpha) => {
      drawEra0(display.pixel, game, alpha);
      display.present();
      debug?.update();
    },
  });

  const applyFeatures = () => {
    loop.renderCap = features.has('FRAME_RATE') ? null : 15;
    display.setResolution(resolutionOverride ?? eraResolution());
    loop.requestRender();
  };
  features.onChange(() => {
    applyFeatures();
    persist();
  });
  applyFeatures();

  window.addEventListener('resize', () => {
    display.resize(window.innerWidth, window.innerHeight);
    loop.requestRender();
  });

  const debugEnabled = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
  const debug = debugEnabled
    ? new DebugOverlay({
        features,
        game,
        loop,
        display,
        setResolutionOverride: (res) => {
          resolutionOverride = res;
          applyFeatures();
        },
        resetSave: () => {
          clearSave();
          location.reload();
        },
      })
    : null;

  loop.start();
}

void boot();

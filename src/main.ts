import { VIEW_W } from './config';
import { AudioEngine } from './core/audio';
import { FeatureRegistry } from './core/features';
import { Input } from './core/input';
import { FixedLoop } from './core/loop';
import { clearSave, loadSave, writeSave } from './core/save';
import { DebugOverlay } from './debug/overlay';
import { Game, type GameRequest, type Point } from './game/game';
import { Display, type Resolution } from './render/display';
import { GameOverScene, TitleScene } from './scenes/cards';
import { EraEndScene } from './scenes/eraEnd';
import { GameScene } from './scenes/gameScene';
import type { Scene } from './scenes/scene';
import { TapeLoaderScene } from './scenes/tapeLoader';
import type { Era } from './core/features';
import { ERA_LEVELS } from './world/levels';
import { parseLevel } from './world/tilemap';

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const save = loadSave();
  const features = new FeatureRegistry(save.features);
  const audio = new AudioEngine();
  const input = new Input();
  input.attach(window, () => audio.unlock());
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const parent = document.getElementById('app');
  if (!parent) throw new Error('#app missing');

  // --- Game state -------------------------------------------------------------------
  let era = Math.min(save.era, ERA_LEVELS.length - 1);
  let game: Game;
  let gameScene: GameScene;

  const persist = () =>
    writeSave({
      version: 1,
      features: features.list(),
      score: game.score,
      introSeen: save.introSeen,
      checkpoint: game.checkpoint,
      era,
    });

  const startEra = (index: number, checkpoint: Point | null, score: number) => {
    era = index;
    game = new Game({
      features,
      level: parseLevel(ERA_LEVELS[index]),
      hooks: {
        sound: (name, x) => {
          if (name === 'beep') return audio.beep();
          // SAMPLES + STEREO: pan by where the sound is relative to the middle of the screen.
          const stereo = features.has('SAMPLES_STEREO');
          const offset = x === undefined ? 0 : (x - (game.camera.x + VIEW_W / 2)) / (VIEW_W / 2);
          const distance = Math.abs(offset);
          audio.sfx(name, {
            pan: stereo ? Math.max(-1, Math.min(1, offset)) : 0,
            rich: stereo,
            volume: name === 'step' ? Math.max(0.15, 1 - distance / 3) * 0.7 : 1,
          });
        },
        save: () => persist(),
      },
      score,
      checkpoint,
    });
    gameScene = new GameScene(game, onRequest);
  };

  const onRequest = (request: GameRequest) => {
    if (request === 'title') {
      setScene(new TitleScene(() => setScene(gameScene)));
    } else if (request === 'gameOver') {
      setScene(
        new GameOverScene(() => {
          startEra(era, null, game.score);
          persist();
          setScene(gameScene);
        }),
      );
    } else if (request === 'eraComplete') {
      const next = era + 1;
      const available = next < ERA_LEVELS.length;
      setScene(
        new EraEndScene({
          from: era as Era,
          to: Math.min(next, 5) as Era,
          available,
          onDone: () => {
            if (available) {
              startEra(next, null, game.score);
              persist();
            }
            setScene(gameScene);
          },
        }),
      );
    }
  };

  startEra(era, save.checkpoint, save.score);
  features.onChange((id) => {
    persist();
    if (id === 'MUSIC' || id === 'CD_AUDIO') syncMusic();
  });

  /** The soundtrack plays everywhere once you have it, except over the tape loader. */
  const syncMusic = () => {
    if (scene?.name === 'tape') return audio.setMusic(null);
    audio.setMusic(features.has('CD_AUDIO') ? 'cd' : features.has('MUSIC') ? 'chip' : null);
  };

  // --- Scenes -----------------------------------------------------------------------
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
    syncMusic();
    applyResolution();
  };
  const applyResolution = () => {
    display.setResolution(resolutionOverride ?? scene.resolution());
    loop.renderCap = scene.renderCap();
    loop.requestRender();
  };

  /** After the tape: the title screen, once the game has one. */
  const afterTape = () =>
    setScene(features.has('TITLE_SCREEN') ? new TitleScene(() => setScene(gameScene)) : gameScene);
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
        afterTape();
      },
    });

  setScene(params.has('skipintro') ? gameScene! : tapeScene());

  window.addEventListener('resize', () => {
    display.resize(window.innerWidth, window.innerHeight);
    loop.requestRender();
  });

  // --- Debug ------------------------------------------------------------------------
  const debugEnabled = import.meta.env.DEV || params.has('debug');
  const debug = debugEnabled
    ? new DebugOverlay({
        features,
        game: () => game,
        loop,
        display,
        sceneName: () => scene.name,
        eraCount: ERA_LEVELS.length,
        loadEra: (index) => {
          startEra(index, null, game.score);
          persist();
          setScene(gameScene);
        },
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
    Object.assign(window, {
      __stick2hero: {
        get game() {
          return game;
        },
        features,
        setScene,
      },
    });
  }

  loop.start();
}

void boot();

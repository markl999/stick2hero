import { VIEW_W } from './config';
import { AudioEngine, type MusicTrack } from './core/audio';
import { FEATURE_IDS, FeatureRegistry, type Era, type FeatureId } from './core/features';
import { Input } from './core/input';
import { FixedLoop } from './core/loop';
import { clearSave, defaultSave, loadSave, writeSave } from './core/save';
import { loadScores, writeScores, type ScoreEntry } from './core/scores';
import { loadSettings, volumeGain, writeSettings, type Settings } from './core/settings';
import { DebugOverlay } from './debug/overlay';
import { Game, type Point } from './game/game';
import { Display, type Resolution } from './render/display';
import { GameOverScene, TitleScene } from './scenes/cards';
import { EndingScene } from './scenes/ending';
import { EraEndScene } from './scenes/eraEnd';
import { CompletionScene } from './scenes/completion';
import { GameScene, type SceneRequest } from './scenes/gameScene';
import { HighScoreScene } from './scenes/highScores';
import { PauseScene } from './scenes/pause';
import type { Scene } from './scenes/scene';
import { TapeLoaderScene } from './scenes/tapeLoader';
import { ERA_LEVELS } from './world/levels';
import { parseLevel } from './world/tilemap';

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const save = loadSave();
  // Switched off in the Feature Menu: still collected, just not on.
  const disabled = new Set<FeatureId>(save.disabled.filter((id) => save.features.includes(id)));
  const features = new FeatureRegistry(save.features.filter((id) => !disabled.has(id)));
  const audio = new AudioEngine();
  const input = new Input();
  input.attach(window, () => audio.unlock());

  // Options (volume, keys) and the high-score table live apart from the save.
  // The system's reduced-motion preference sets the defaults for the comfort options.
  const systemReducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let settings: Settings = loadSettings(systemReducedMotion);
  const applySettings = () => {
    input.setBindings(settings.keys);
    audio.setVolumes(volumeGain(settings.music), volumeGain(settings.sfx));
  };
  applySettings();
  let scores: ScoreEntry[] = loadScores();
  /** The tape loader's and the ending's stripes: off with reduced motion or flashing. */
  const calmStripes = () => settings.comfort.reduceMotion || settings.comfort.reduceFlashing;

  const parent = document.getElementById('app');
  if (!parent) throw new Error('#app missing');

  // --- Game state -------------------------------------------------------------------
  let era = Math.min(save.era, ERA_LEVELS.length - 1);
  let game: Game;
  let gameScene: GameScene;
  /** PHOTO MODE asked for the next frame to be saved. */
  let photoPending = false;
  /** Deaths in earlier eras' games (each era is a new Game with its own count). */
  let deathsBefore = save.deaths;
  const totalDeaths = () => deathsBefore + (game?.stats.deaths ?? 0);

  const gamepads = () =>
    (navigator.getGamepads?.() ?? []).filter((pad): pad is Gamepad => pad?.connected === true);

  /** Set just before a deliberate reset reloads the page, so nothing writes the old game back. */
  let saveFrozen = false;
  const persist = () => {
    if (saveFrozen) return;
    // Features the Deprecator has taken (for now) are still yours: save them as collected.
    // So are features switched off in the Feature Menu.
    const taken = game?.finale?.stripped ?? [];
    writeSave({
      version: 1,
      features: FEATURE_IDS.filter(
        (id) => features.has(id) || taken.includes(id) || disabled.has(id),
      ),
      score: game.score,
      introSeen: save.introSeen,
      checkpoint: game.checkpoint,
      era,
      cleared: save.cleared,
      run: save.run,
      disabled: [...disabled],
      playTime: save.playTime,
      deaths: totalDeaths(),
    });
  };

  const startEra = (index: number, checkpoint: Point | null, score: number) => {
    // Leaving the finale mid-fight gives back everything it took.
    game?.finale?.restoreAll();
    deathsBefore = totalDeaths();
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
        hasGamepad: () => gamepads().length > 0,
        rumble: (strength, seconds) => {
          for (const pad of gamepads()) {
            void pad.vibrationActuator
              ?.playEffect('dual-rumble', {
                duration: Math.round(seconds * 1000),
                strongMagnitude: strength,
                weakMagnitude: Math.min(1, strength * 1.3),
              })
              .catch(() => undefined);
          }
        },
        photo: () => {
          photoPending = true;
        },
      },
      score,
      checkpoint,
      finaleDone: save.cleared,
      hiScore: scores[0]?.score ?? 0,
      comfort: settings.comfort,
    });
    game.disabled = disabled;
    gameScene = new GameScene(game, onRequest);
  };

  /** HIGH SCORES: after a Game Over or the ending, the table (and your initials) first. */
  const thenScores = (next: () => void) => {
    if (!features.has('HIGH_SCORES')) return next();
    setScene(
      new HighScoreScene({
        table: scores,
        run: save.run,
        score: game.score,
        onSave: (table) => {
          scores = table;
          writeScores(table);
          game.hiScore = table[0]?.score ?? 0;
        },
        onDone: next,
      }),
    );
  };

  const pause = () => {
    const resumeTo = scene;
    setScene(
      new PauseScene({
        under: resumeTo,
        input,
        settings: () => settings,
        setSettings: (next) => {
          settings = next;
          writeSettings(next);
          applySettings();
          game.comfort = next.comfort;
        },
        previewSfx: () => audio.beep(),
        highScores: () => (features.has('HIGH_SCORES') ? scores : null),
        run: save.run,
        // The Feature Menu: after the Deprecator, switch anything you've collected.
        featureMenu: save.cleared
          ? {
              owned: () =>
                new Set(FEATURE_IDS.filter((id) => features.has(id) || disabled.has(id))),
              isOn: (id) => features.has(id),
              set: (id, on) => {
                if (on) {
                  disabled.delete(id);
                  features.unlock(id);
                } else {
                  disabled.add(id);
                  features.lock(id);
                }
              },
            }
          : null,
        onResume: () => setScene(resumeTo),
        onNewGame: () => {
          // A fresh save (a new run for the high-score table), then start from the tape.
          saveFrozen = true;
          writeSave({ ...defaultSave(), introSeen: true });
          location.reload();
        },
      }),
    );
  };

  const onRequest = (request: SceneRequest) => {
    if (request === 'pause') {
      pause();
    } else if (request === 'title') {
      setScene(new TitleScene(() => setScene(gameScene)));
    } else if (request === 'gameOver') {
      // In the finale, a Game Over puts everything back and starts the fight again.
      const retry = game.retryCheckpoint;
      setScene(
        new GameOverScene(() =>
          thenScores(() => {
            startEra(era, retry, game.score);
            persist();
            setScene(gameScene);
          }),
        ),
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
    } else if (request === 'ending') {
      save.cleared = true;
      persist();
      setScene(
        new EndingScene({
          audio,
          score: game.score,
          deaths: totalDeaths(),
          reducedMotion: calmStripes(),
          onDone: () =>
            setScene(
              new CompletionScene({
                owned: FEATURE_IDS.filter((id) => features.has(id) || disabled.has(id)),
                playTime: save.playTime,
                deaths: totalDeaths(),
                score: game.score,
                onDone: () =>
                  thenScores(() => {
                    // Back on the roof, the Deprecator gone, everything yours.
                    startEra(era, game.checkpoint, game.score);
                    persist();
                    setScene(new TitleScene(() => setScene(gameScene)));
                  }),
              }),
            ),
        }),
      );
    }
  };

  startEra(era, save.checkpoint, save.score);
  features.onChange(() => persist());
  // Keep the play time (and everything else) when the tab is hidden or closed.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persist();
  });
  window.addEventListener('pagehide', () => persist());

  /**
   * The soundtrack plays everywhere once you have it, except over the tape loader. Scenes
   * can override it (the ending). Checked every step, so feature changes and the finale's
   * rollbacks switch it straight away.
   */
  let track: MusicTrack | undefined;
  const syncMusic = () => {
    const want: MusicTrack =
      scene?.name === 'tape'
        ? null
        : scene?.music
          ? scene.music()
          : features.has('CD_AUDIO')
            ? 'cd'
            : features.has('MUSIC')
              ? 'chip'
              : null;
    if (want !== track) {
      track = want;
      audio.setMusic(want);
    }
    const adaptive = scene === gameScene && features.has('ADAPTIVE_MUSIC');
    audio.setIntensity(adaptive ? game.musicIntensity : 0);
  };

  // --- Scenes -----------------------------------------------------------------------
  let resolutionOverride: Resolution | null = null;
  let scene: Scene;
  const display = await Display.create(parent, { width: 320, height: 180 });
  const loop = new FixedLoop({
    step: (dt) => {
      input.poll();
      if (scene === gameScene) save.playTime += dt;
      scene.update(dt, input);
      loop.renderCap = scene.renderCap();
      syncMusic();
    },
    render: (alpha) => {
      applyResolution();
      scene.render(display.pixel, alpha);
      display.setPostFx(scene.postFx?.() ?? null);
      display.present();
      if (photoPending) savePhoto();
      debug?.update();
    },
  });

  const setScene = (next: Scene) => {
    scene = next;
    syncMusic();
    applyResolution();
    loop.requestRender();
  };
  /** Scenes can change resolution mid-scene (HD, and the finale rolling it back). */
  const applyResolution = () => {
    display.setSmooth(resolutionOverride ? false : (scene.smooth?.() ?? false));
    display.setResolution(resolutionOverride ?? scene.resolution());
  };

  /** PHOTO MODE: save what's on screen as a PNG. It actually works. */
  const savePhoto = () => {
    photoPending = false;
    const photo = game.photo;
    void display.capture().then((blob) => {
      if (photo) photo.snapRequested = false;
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `stick2hero-photo-${Date.now()}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  };

  /** After the tape: the title screen, once the game has one. */
  const afterTape = () =>
    setScene(features.has('TITLE_SCREEN') ? new TitleScene(() => setScene(gameScene)) : gameScene);
  const tapeScene = () =>
    new TapeLoaderScene({
      audio,
      skippable: save.introSeen,
      reducedMotion: calmStripes(),
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
          saveFrozen = true;
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
        get gameScene() {
          return gameScene;
        },
        /** The scene showing now (its name tells automation where it is). */
        get scene() {
          return scene;
        },
        /** Jump to the ending (for checking it). */
        ending: () => onRequest('ending'),
      },
    });
  }

  loop.start();
}

void boot();

# Stick 2 Hero — Product Requirements Document

**Status:** v1.0 (ready to build) · **Date:** 2026-11-10 · **Owner:** Mark

---

## 1. One-liner

A 2D browser platformer where you start as a black stick man on a blank white screen and **collect the features of video games themselves**: colour, sound, arms, scrolling, music, weapons, particles, lighting. Over one playthrough the game grows from a 1978-style prototype into a modern, effects-heavy action game, and the stick man becomes a hero.

## 2. Vision & pillars

1. **Every pickup is a feature.** A pickup doesn't give you points or a power-up. It upgrades the game itself.
2. **Every pickup gets a "moment".** The change happens instantly and you can see or hear it. Colour floods outward from the pickup, music swells in, the camera pulls back. It never silently flips a setting.
3. **Features change how you play, not just how it looks.** Most unlocks change gameplay. A purely cosmetic pickup is fine now and then as a breather.
4. **Each era plays differently**, so it isn't the same level with better paint.
5. **Each pickup is placed where you need it.** If a gap needs a jump, `JUMP` sits just before it.
6. **The game knows it's a game.** Light, fourth-wall humour: you have to collect "ENEMIES" before any exist, and you can't die until you pick up "DEATH".
7. **Procedural over painted.** Graphics (vector) and audio are generated in code, so the game stays small, consistent and buildable by a tiny team.

## 3. Target audience & platform

- **Audience:** people who grew up with games across the eras (nostalgia), and anyone who enjoys meta or self-aware games.
- **Platform:** desktop web browser, playable from a URL with no install. Keyboard and gamepad.
- **Later (not in v1):** a packaged desktop build (Tauri/Electron for Steam/itch.io), mobile touch controls.

## 4. Story (light touch)

The game is an **abandoned, unfinished project**. Its developer shelved it partway through, leaving a stick-man placeholder in an empty test level. The stick man rebuilds the game around himself by recovering its missing features.

- **The promise:** the tape-loading screen shows the hero the game was _meant_ to have: muscular, caped, heroic. Then the game loads, and you're a stick man.
- **The world:** in Era 3, NPCs turn out to be other half-finished characters (placeholder art, "TODO" dialogue). They explain that the game was abandoned, and they hint at the **Deprecator**: what's left of the developer's decision to cut features and shelve the game.
- **The delivery:** the story is told through pickup labels, NPC lines and one cutscene (Era 4). No long text dumps.
- **The payoff:** the final shot recreates the loading-screen picture in full modern style, and this time it's you.

## 5. Core gameplay loop

```
Explore level → spot/reach a Feature pickup → collect it →
game visibly/audibly upgrades → new ability or challenge opens the path →
explore further → Era Gate → next Era
```

- **Genre:** a side-on 2D platformer for the whole game. The presentation evolves; the core controls stay familiar.
- **Required pickups** sit on the main path and drive the progression.
- **Secret pickups** are optional extras hidden off the path (section 7).
- **Pickup containers match their era:** a lettered square → glowing arcade token → cartridge → floppy disk → CD → cloud/download icon.

## 6. The Eras — final unlock ladder

**Total:** about 45 main-path features plus 8 secrets, over roughly 70 minutes (about one unlock every 1.5 minutes).

### Intro — TAPE LOADER (~10 seconds)

| Step | What happens                                                                                                                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Black screen, blinking text: `PRESS ANY KEY TO START TAPE`. This key press also unlocks browser audio.                                                                      |
| 2    | **Pilot tone:** a steady high tone, with thick black and white stripes rolling slowly through the screen border.                                                            |
| 3    | **Data screech:** harsh noise bursts and fast, thin flickering stripes. In the centre, a low-res black-and-white picture of a **caped hero** loads row by row from the top. |
| 4    | Text: `LOADING...` → the screech cuts out → a hard cut to a white screen and **silence**. The stick man is standing there with no arms.                                     |

- It's all black and white, so the colour reveal in Era 2 still lands.
- All audio is generated in code with Web Audio (oscillator + filtered noise), so there are no asset files. Volume is kept at a comfortable level, with a softened screech.
- After the first playthrough, any key skips the intro (remembered in `localStorage`).
- If the browser asks for reduced motion (`prefers-reduced-motion`), the stripes move slowly and don't flicker.
- **Joke:** the tape had sound and the game doesn't. The loader got all the budget.

### Era 0 — BOOT (~1978) · ~10 min · _"This barely counts as a game"_

**Feel:** a white void, 1px black lines, silence, 15fps, 160×90 internal resolution. Almost broken, in a charming way.
**Gameplay:** navigation puzzles. Learn that pickups change the rules.

| Feature      | Moment                                                                                         | Gameplay purpose                                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `← LEFT`     | The stick man turns around for the first time.                                                 | You start able to walk only right. A few steps ahead, ← LEFT sits in front of a step you can't climb. This teaches the premise in 5 seconds. |
| `JUMP`       | The first jump.                                                                                | Waits _behind_ your start point, so you need ← LEFT to reach it. Then you go back and jump the step.                                         |
| `BEEP`       | Total silence, then one square-wave _beep_ on your next jump.                                  | The first sound in the game itself.                                                                                                          |
| `SCREEN 2`   | Walk off the edge and the screen flips. The world just got bigger.                             | Opens up multi-screen levels.                                                                                                                |
| `ARMS`       | Two lines appear on the stick man.                                                             | Grab ledges and climb. Arms are **not** a weapon yet.                                                                                        |
| `SCORE`      | A HUD appears and counts up everything you've done so far.                                     | Points for pickups and distance. A fourth-wall joke.                                                                                         |
| `FRAME RATE` | **Era exit.** Choppy 15fps jumps to smooth 60fps, then the screen inverts and you're in Era 1. | Sits at the top of the final climbing challenge.                                                                                             |

### Era 1 — ARCADE (~1981) · ~10 min · _"Now there's danger"_

**Feel:** the screen **inverts** to a black background with glowing white/green phosphor pixels, like an old arcade monitor. Filled pixels replace lines. A pixel font, 320×180.
**Gameplay:** survival and combat on single screens.

| Feature             | Moment                                                                                                          | Gameplay purpose                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `ENEMIES`           | The label warns it's a terrible idea, and you have to collect it anyway. Blocky enemies walk in from the edges. | The first threat. Until `DEATH`, they pass harmlessly through you, which is funny. |
| `DEATH`             | A scary moment: the next touch kills you, and you respawn on the spot.                                          | Enemies are now dangerous.                                                         |
| `LIVES`             | Relief: 3 lives and a Game Over screen.                                                                         | A real fail state.                                                                 |
| `PUNCH`             | Your arms become a weapon.                                                                                      | The first time you fight back.                                                     |
| `SFX`               | BEEP grows into a set of distinct sounds for stepping, hitting, dying and picking things up.                    | Combat feels physical.                                                             |
| `TITLE SCREEN`      | You get booted to a freshly "made" title screen that reads **STICK 2 HERO**, then dropped back into the game.   | A joke and a moment to breathe.                                                    |
| **Gate: The Block** | A huge rectangle boss.                                                                                          | The first boss.                                                                    |

### Era 2 — 8-BIT (~1985) · ~12 min · _"It's a real game now"_

**Feel:** the biggest single transformation, because colour and music arrive here.
**Gameplay:** platforming with momentum. Wall jumps, longer runs.

| Feature                      | Moment                                                                                                                               | Gameplay purpose                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `COLOUR (4)`                 | Colour floods out from the pickup in a wave.                                                                                         | Hazards are **red**, the game's language for danger from now on. Some "safe" monochrome platforms turn out to be hazards. Shape cues back up colour for accessibility. |
| `SCROLLING`                  | Flip-screen gives way to a smooth camera, and the level stretches out.                                                               | Bigger levels, momentum.                                                                                                                                               |
| `ANIMATION`                  | Until now the stick man slid around in a fixed pose. Now he gets a walk cycle, a jump pose and a landing squash. **He feels alive.** | Reading his poses makes movement easier to control.                                                                                                                    |
| `MUSIC`                      | **The best moment of the first half of the game.** A quiet build-up area, then a 3-channel chiptune kicks in.                        | Atmosphere. The music also signals when danger is near.                                                                                                                |
| `HANDS & FEET`               | Hands and feet appear on the body.                                                                                                   | Feet give you **wall-jumping**.                                                                                                                                        |
| `THROW`                      | The first ranged weapon: pebbles.                                                                                                    | Hit switches and enemies from a distance.                                                                                                                              |
| `CHECKPOINTS`                | A flag appears just before the hardest section.                                                                                      | An act of mercy.                                                                                                                                                       |
| **Gate: Flicker**            | A boss with attack patterns that is invulnerable while it flickers.                                                                  | A nod to the hardware limits of the era.                                                                                                                               |
| _Gate reward:_ `COLOUR (16)` | The full palette arrives automatically when you win.                                                                                 | A satisfying second colour step.                                                                                                                                       |

### Era 3 — 16-BIT (~1991) · ~12 min · _"Adventure and personality"_

**Feel:** rich and lush. The stick man becomes a _character_.
**Gameplay:** exploration, NPCs, sword combat.

| Feature                   | Moment                                                                                                                       | Gameplay purpose                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `PARALLAX`                | The background splits into layers that move at different speeds. **256 colours and gradient skies arrive at the same time.** | The world has depth. Hidden routes in the foreground layer.                       |
| `SAMPLES` + `STEREO`      | Real-sounding effects that pan left and right.                                                                               | **You hear enemies off-screen** before you see them.                              |
| `FACE`                    | Eyes and expressions: scared, determined.                                                                                    | An emotional beat. Expressions hint at danger.                                    |
| `NPCs` + `DIALOGUE`       | The first other characters, half-finished, with "TODO" lines.                                                                | Delivers the story (section 4) and hints.                                         |
| `OUTFIT`                  | A tunic. The first sign of the hero look.                                                                                    | Cosmetic milestone.                                                               |
| `SWORD`                   | A melee weapon with a 3-hit combo.                                                                                           | A big step up from punching.                                                      |
| `DASH`                    | A quick burst of speed.                                                                                                      | Cross gaps, dash through enemies.                                                 |
| `SAVE GAME`               | A joke label: "The game can now save!"                                                                                       | **Autosave actually works from the very start.** This pickup only _announces_ it. |
| **Gate: Multi-part boss** | A large boss that fills the screen, fought across the layered background.                                                    | Sword + dash test.                                                                |

### Era 4 — 32-BIT (~1997) · ~12 min · _"Cinematic"_

**Feel:** see-through effects, light, particles and the first cutscene. The game starts _showing off_.
**Gameplay:** atmosphere. Dark areas, set pieces.

| Feature             | Moment                                                                 | Gameplay purpose                                                 |
| ------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `TRANSPARENCY`      | Water, glass and ghosts appear.                                        | Hidden passages behind see-through walls.                        |
| `PARTICLES`         | Dust, sparks and impacts.                                              | Cosmetic, but makes everything feel better.                      |
| `LIGHTING`          | The level goes dark, and your light source flickers on.                | **Darkness is a mechanic.** Carry or activate lights to explore. |
| `CAMERA`            | Zoom, look-ahead and screen shake.                                     | Cinematic framing, and you can see further ahead.                |
| `CD AUDIO`          | The chiptune gives way to a full recorded music track.                 | A big audio moment.                                              |
| `VOICE`             | Grunts, and NPCs get voice barks.                                      | Character.                                                       |
| `DEPTH`             | Pseudo-3D background and foreground layers.                            | Spectacle.                                                       |
| `CUTSCENE`          | The first in-engine cinematic: **the Deprecator is revealed.**         | Story turning point.                                             |
| **Gate: The Chase** | A cinematic escape with the camera pulled in close, instead of a boss. | Variety between boss fights.                                     |

### Era 5 — MODERN (today) · ~15 min · _"Everything at once"_

**Feel:** maximum: bloom, real-time shadows, physics everywhere. Deliberately a little _too much_.
**Gameplay:** power fantasy built around three pickups (**SHADOWS, PHYSICS, CAPE**). The rest come quickly as comedy.

| Feature             | Moment                                                                                         | Gameplay purpose                                       |
| ------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `HD`                | **Opens the era.** The low-res pixel look gives way to crisp, full-resolution vector graphics. | A huge visual leap.                                    |
| `DYNAMIC SHADOWS`   | Light sources cast shadows that move.                                                          | **Shadow puzzles.** Enemies can't see you in the dark. |
| `PHYSICS`           | The scenery becomes destructible: debris and ragdolls.                                         | Smash through walls for shortcuts.                     |
| `CAPE`              | The last body part. The silhouette is now unmistakably a hero.                                 | **Gliding**, the final big movement ability.           |
| `BLOOM` / `POST-FX` | Glow, chromatic aberration, vignette.                                                          | Cosmetic, deliberately overdone.                       |
| `ADAPTIVE MUSIC`    | The music builds up during fights.                                                             | Atmosphere.                                            |
| `RUMBLE`            | Gamepad haptics.                                                                               | Feel (keyboard players get a joke toast instead).      |
| `ACHIEVEMENTS`      | 40 achievements pop up at once.                                                                | A joke.                                                |
| `PHOTO MODE`        | It actually works.                                                                             | A joke that's also a real feature.                     |

### Finale — The Deprecator

The boss **takes features away in reverse order:** bloom goes, then CD audio drops back to the chiptune, colour drains, scrolling stops, the cape falls off, and finally you're a stick man with no arms on a white screen in silence. You beat each phase by winning back the feature it took. The last hit happens in Era 0 graphics, and then **everything comes back at once**. The final shot recreates the loading-screen hero picture with you in it, and the title reads **HERO**.

### Post-game

- **Feature Menu:** turn any collected feature on or off, for example to play the final level in Era 0 graphics, or with colour but no sound.
- A completion screen shows secrets found, total time and deaths.

## 7. Secrets (optional pickups)

| Secret              | Era | Effect                                                                                              |
| ------------------- | --- | --------------------------------------------------------------------------------------------------- |
| `HIGH SCORES`       | 1   | A local high-score table with three-letter initials.                                                |
| `CHEAT CODES`       | 2   | Type a hidden code on the title screen to unlock a silly mode (e.g. big head).                      |
| `TUTORIAL`          | 3   | Pops up hints for things you've already mastered ("Press JUMP to jump!").                           |
| `CRT SCANLINES`     | 2–3 | An optional CRT filter you can toggle.                                                              |
| `WILHELM SCREAM`    | 4   | Enemies occasionally let out a famous-sounding scream. (The sound is our own, not the real sample.) |
| `LENS FLARE`        | 5   | Ridiculous lens flares everywhere.                                                                  |
| `MICROTRANSACTIONS` | 5   | A shop opens. Everything costs 0. Satire.                                                           |
| `HATS`              | any | Hats. Several of them.                                                                              |

## 8. Character progression ("Stick → Hero")

The body is built up in stages: no arms → arms (climb) → filled pixels → walk-cycle animation → hands & feet → face → outfit → cape. The same skeleton drives every stage. Only the way it's drawn changes: 1px lines → filled pixels → pixel sprite → shaded vector → fully lit HD vector.

**Weapons:** none → punch (Era 1) → throw (Era 2) → sword (Era 3) → energy blast (Era 5) → final hero move (finale).

## 9. Controls

| Action         | Keyboard      | Gamepad            |
| -------------- | ------------- | ------------------ |
| Move           | ← → / A D     | Left stick / D-pad |
| Jump           | Space / W / ↑ | A                  |
| Attack         | J / X         | X                  |
| Special / Dash | K / C         | B / RB             |
| Pause          | Esc           | Start              |

Controls are always available, so nobody is locked out by an unlock. A feature gates the _ability_ (e.g. jumping), never the input device. Gamepad input works from the start; only rumble is an unlock.

## 10. Audio progression

| Stage               | Tech                                                                            |
| ------------------- | ------------------------------------------------------------------------------- |
| Tape loader         | Web Audio: pilot-tone oscillator + filtered noise bursts                        |
| Silence             | —                                                                               |
| Beep                | One square-wave oscillator                                                      |
| SFX                 | Generated sfxr-style effects                                                    |
| Chiptune            | A 3–4 channel tracker-style synth playing patterns written in code              |
| Samples/Stereo      | Short synthesised or recorded samples, with stereo panning                      |
| CD Audio / Adaptive | Pre-made music tracks (OGG), layered stems for adaptive mixing (**source TBD**) |

## 11. Technical approach

- **Language/tooling:** TypeScript + Vite. Deploy as a static site (Netlify, Vercel or GitHub Pages).
- **Rendering:** **PixiJS v8** (WebGL). Primitive and vector drawing for every era; filters and shaders for CRT, bloom, lighting and post-processing.
- **Resolution as a feature:** the game renders to an off-screen texture at the era's internal resolution (160×90 → 320×180 → 640×360 → native; always 16:9, one screen = 16×9 tiles) and scales it up with nearest-neighbour filtering until `HD`.
- **Frame rate as a feature:** the simulation is a fixed 60Hz timestep. Only the _render_ rate is held at 15fps until `FRAME RATE`.
- **Physics:** a custom tile/box (AABB) platformer controller, so jumping feels tight and the same in every era. `PHYSICS` (Era 5) adds a light rigid-body layer for debris only, never for player movement.
- **Feature registry (core architecture):** a single `features` store that every system reads (renderer, audio, input, HUD, physics, level logic). Each feature has an `id`, `era`, `label`, `requires[]` and an `onUnlock` hook for its moment. All gating goes through this one place.
- **Tiered drawing:** each entity has a draw function per visual tier, chosen from the active features. This makes the post-game Feature Menu nearly free to build.
- **Levels:** text/JSON tile maps (ASCII grids at first, with an option to move to the Tiled editor later), plus entity and pickup placement.
- **Save:** collected features, checkpoint, settings and an "intro seen" flag, autosaved to `localStorage` from the start.
- **Performance:** 60fps on a mid-range laptop with integrated graphics. Initial download under 10MB.

## 12. Accessibility & options

- Remappable keys.
- **Reduce flashing**, **reduce screen shake** and **reduce motion**. These follow `prefers-reduced-motion` by default, including the tape loader stripes.
- Music and SFX volume sliders, available in the pause menu from the start.
- A colour-blind-safe palette. Every colour-coded mechanic also uses a shape cue.

## 13. Scope

### MVP / Vertical slice (M2)

Tape loader + Eras 0–2 (about 20 features), two bosses, autosave, keyboard + gamepad, web deploy. **This answers the key question: is collecting features fun and surprising?**

### v1.0

All 6 eras, the Deprecator finale, secrets, the Feature Menu, and the accessibility options.

### Non-goals (v1)

Multiplayer, true 3D, procedural levels, monetisation or ads, mobile store builds, a level editor for players.

## 14. Milestones

| #     | Milestone                 | Outcome                                                                                                                                                                 |
| ----- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 ✅ | Foundations               | Vite + Pixi + TypeScript running. Fixed-timestep loop, input, feature registry, low-res render target, AABB tile physics. The stick man walks and jumps in a test room. |
| M1 ✅ | Era 0 + Tape Loader       | The full intro and BOOT chapter, all 7 features with their moments, autosave.                                                                                           |
| M2 ✅ | Vertical slice (Eras 0–2) | Enemies, death, lives, colour, scrolling, chiptune, two bosses. **Playtest with 3–5 people.**                                                                           |
| M3    | Era 3                     | Parallax, samples, face, NPCs, sword, dash, boss.                                                                                                                       |
| M4    | Era 4                     | Transparency, particles, lighting, CD audio, cutscene, chase.                                                                                                           |
| M5    | Era 5 + Finale            | HD, shadows, physics, cape, post-FX, Deprecator, ending.                                                                                                                |
| M6    | Polish & ship             | Secrets, Feature Menu, accessibility, performance pass, public release.                                                                                                 |

### M0 task breakdown (done 2026-11-10)

1. Scaffold: Vite + TypeScript + PixiJS v8, ESLint/Prettier, `npm run dev` / `build`.
2. Game loop: fixed 60Hz update, separate render step with a configurable render-rate cap.
3. Render pipeline: low-res `RenderTexture` → nearest-neighbour scale to fit the window (letterboxed).
4. Input: keyboard + Gamepad API mapped to the abstract actions in section 9.
5. Feature registry: typed feature definitions, `has(id)`, `unlock(id)`, unlock events, save/load to `localStorage`.
6. Tile map loader: ASCII grid → solid tiles + spawn/pickup markers.
7. Player controller: AABB collision, walking, gravity and jumping (coyote time + jump buffering), everything gated by features (`LEFT`, `JUMP`).
8. Stick man drawn in the Era 0 style (1px lines, no arms) from a simple skeleton.
9. One pickup entity that unlocks a feature, with a placeholder "moment".
10. A debug overlay (toggle with a key): FPS, active features, and buttons to unlock or lock any feature.

## 15. Success criteria

- A first-time player gets their first pickup in under 10 seconds and understands the premise in under 1 minute.
- Every required pickup produces a noticeable change. In playtests, players react to most unlocks.
- No era outstays its welcome (about 10–15 minutes each).
- Holds 60fps in the modern era on target hardware.

## 16. Inspirations & differentiation

The idea is in the same family as "the game evolves as you play" titles (e.g. _Evoland_) and meta-comedy games (e.g. _DLC Quest_). Stick 2 Hero is its own thing:

- **One genre the whole way through.** It's a platformer from start to finish.
- **The character is the progression.** The stick man literally assembles himself into a hero.
- **The loading-screen promise and its payoff** bookend the game.
- **The Deprecator finale** turns the mechanic around by taking features away.
- All art, audio, characters and levels are original.

## 17. Decisions

### Decided (2026-11-10)

| #   | Decision                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Browser game** for v1, keyboard + gamepad.                                                                                                                                                                                                                                          |
| 2   | **Side-on platformer throughout.**                                                                                                                                                                                                                                                    |
| 3   | **Vector art + shaders** for the modern era.                                                                                                                                                                                                                                          |
| 4   | **Light narrative:** an abandoned, unfinished game rebuilding itself (section 4).                                                                                                                                                                                                     |
| 5   | **Unlock ladder** as in section 6, including: a tape-loader intro, Era 1 inverting to a black screen, `FRAME RATE` ending Era 0, `HD` opening Era 5, `HIGH SCORES` as a secret, `COLOUR (16)` as a boss reward, 256 colours merged into `PARALLAX`, `SAVE GAME` as a joke label only. |
| 6   | **PixiJS v8** + custom AABB physics.                                                                                                                                                                                                                                                  |
| 7   | Players never lose features except during the Deprecator finale.                                                                                                                                                                                                                      |
| 8   | Target length: 60–90 minutes.                                                                                                                                                                                                                                                         |

### Still open (not blocking M0–M2)

| #   | Question                                                                                                                         | Needed by   |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 9   | Music source for Era 4–5 (`CD AUDIO`, `ADAPTIVE MUSIC`): commission, licence, or self-made?                                      | M4          |
| 10  | Hosting choice (Netlify / Vercel / GitHub Pages) and domain                                                                      | M2          |
| 11  | Era 0 length: the M1 level plays in about 3–4 minutes against a ~10-minute target. Add screens, or accept a shorter opening era? | M2 playtest |
| 12  | THROW took the Special button (K/C). Era 3's DASH needs a binding: double-tap a direction, Shift/L, or share Special?            | M3          |
| 13  | Run the M2 playtest (3–5 people, Eras 0–2) and fold the findings in before M3.                                                   | Before M3   |

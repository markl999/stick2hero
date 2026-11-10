# Stick 2 Hero

A browser platformer where you collect the features of video games themselves. The game evolves from a 1978-style stick-figure prototype to a modern game. **PRD.md is the source of truth** for the design, the unlock ladder (section 6) and the milestones (section 14).

## Commands

- `npm run dev`: dev server (http://localhost:5173). Press backquote (`) to open the debug overlay: toggle features, change resolution, reset the save.
- `npm run check`: type-check + lint + tests. Run before calling anything done.
- `npm run build`: production build to `dist/` (static, relative paths). Add `?debug` to the URL to get the overlay in production.
- `?skipintro` in the URL goes straight past the tape loader. In dev, `window.__stick2hero` exposes `{ game, features, setScene, gameScene }` for the console and browser automation.

## Architecture rules

- **Every feature gate goes through `FeatureRegistry`** (`src/core/features.ts`). Systems ask `features.has('X')`. Never add ad-hoc booleans for unlockable behaviour. New features get added to `FEATURE_IDS` + `FEATURES`.
- **Features gate abilities, never input devices.** Input always reads every key and gamepad. Game logic decides what's allowed.
- **Game logic (`src/game`, `src/world`, `src/core` apart from audio/input) is free of Pixi and the DOM** and covered by Vitest. Rendering only _reads_ game state.
- **Fixed 60Hz simulation** (`FixedLoop`). The render rate is separate and can be capped (15fps before `FRAME_RATE`). Renderers interpolate with `alpha`.
- **World units vs pixels:** one screen is always 320×180 world units (16×9 tiles of 20). The era's internal resolution (160×90, 320×180, …) only decides how many pixels draw it. Renderers convert using `s = width / VIEW_W`.
- **Tiered drawing:** each visual era has a renderer in `src/render/tiers/`. The low-res eras draw pixel-perfect into `PixelCanvas` (a 2D canvas uploaded as a texture). It goes `world → RenderTexture → nearest-neighbour upscaled sprite`. Post-FX will attach to that final sprite.
- **Stick man pose** comes from `src/render/stickman.ts` (a skeleton in world units, with the feet at the origin). Every tier draws the same skeleton in its own style.
- **Scenes** (`src/scenes/`): the tape loader, gameplay and the end-of-era screen. Each one picks its own resolution and render cap. `main.ts` switches between them.
- **Levels** are ASCII grids (`src/world/levels/`): `#` solid, `.` empty, `P` spawn, plus per-level pickup characters mapped to feature ids. Flip-screen levels are authored as 16×9 screens and assembled with `composeScreens`.
- **Level design rules** come from the player physics: 1–2 tile rises are jumpable, 3-tile rises need ARMS (ledge grab), and 4+ tiles are impossible. Pickups must sit on solid ground, because collecting one sets the checkpoint there. `tests/game.test.ts` has a bot that plays Era 0 from start to finish. Update its route whenever the level changes.
- Audio is procedural Web Audio (`src/core/audio.ts`) and only starts after a user gesture.

# Stick 2 Hero

A browser platformer where you collect the features of video games themselves. The game evolves from a 1978-style stick-figure prototype to a modern game. **PRD.md is the source of truth** for the design, the unlock ladder (section 6) and the milestones (section 14).

## Commands

- `npm run dev`: dev server (http://localhost:5173). Press backquote (`) to open the debug overlay: toggle features, change resolution, reset the save.
- `npm run check`: type-check + lint + tests. Run before calling anything done.
- `npm run build`: production build to `dist/` (static, relative paths). Add `?debug` to the URL to get the overlay in production.

## Architecture rules

- **Every feature gate goes through `FeatureRegistry`** (`src/core/features.ts`). Systems ask `features.has('X')`. Never add ad-hoc booleans for unlockable behaviour. New features get added to `FEATURE_IDS` + `FEATURES`.
- **Features gate abilities, never input devices.** Input always reads every key and gamepad. Game logic decides what's allowed.
- **Game logic (`src/game`, `src/world`, `src/core` apart from audio/input) is free of Pixi and the DOM** and covered by Vitest. Rendering only _reads_ game state.
- **Fixed 60Hz simulation** (`FixedLoop`). The render rate is separate and can be capped (15fps before `FRAME_RATE`). Renderers interpolate with `alpha`.
- **World units vs pixels:** one screen is always 320×180 world units (16×9 tiles of 20). The era's internal resolution (160×90, 320×180, …) only decides how many pixels draw it. Renderers convert using `s = width / VIEW_W`.
- **Tiered drawing:** each visual era has a renderer in `src/render/tiers/`. The low-res eras draw pixel-perfect into `PixelCanvas` (a 2D canvas uploaded as a texture). It goes `world → RenderTexture → nearest-neighbour upscaled sprite`. Post-FX will attach to that final sprite.
- **Stick man pose** comes from `src/render/stickman.ts` (a skeleton in world units, with the feet at the origin). Every tier draws the same skeleton in its own style.
- **Levels** are ASCII grids (`src/world/levels/`): `#` solid, `.` empty, `P` spawn, plus per-level pickup characters mapped to feature ids.
- Audio is procedural Web Audio (`src/core/audio.ts`) and only starts after a user gesture.

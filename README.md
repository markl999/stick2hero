# Stick 2 Hero

A 2D browser platformer where you start as a stick man on a blank white screen and collect the
features of video games themselves (colour, sound, arms, scrolling, music, weapons, lighting),
until the game has grown from a 1978-style prototype into a modern one and the stick man is a hero.

See [PRD.md](PRD.md) for the full design.

## Running

```sh
npm install
npm run dev     # http://localhost:5173 — press ` for the debug overlay
npm run check   # type-check, lint, tests
npm run build   # static build in dist/
```

**Controls:** ← → / A D to move · Space / W / ↑ to jump · gamepad supported.

## Status

M0 (foundations) is done: fixed-timestep loop, feature registry, low-res render pipeline, tile
physics, and an Era 0 test room. Next is M1: the tape-loader intro and the full Era 0 chapter.

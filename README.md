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

**Controls:** ← → / A D to move · Space / W / ↑ to jump (and climb, once you have arms) · ↓ to
let go of a ledge · gamepad supported.

## Status

M1 is done: the tape-loader intro and a playable Era 0 (BOOT) chapter with all seven of its
features. Next is M2: Eras 1–2 (enemies, death, colour, scrolling, chiptune) and the first playtest.

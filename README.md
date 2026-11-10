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
let go of a ledge · X / J to punch · C / K to throw (hold ↑ to throw upwards) · gamepad supported.
Each ability only works once you've collected it.

## Status

M2 is done: the tape-loader intro and three playable eras. BOOT (Era 0), ARCADE (Era 1, with
The Block) and 8-BIT (Era 2, with Flicker). Next: a playtest, then M3 (Era 3, 16-BIT).

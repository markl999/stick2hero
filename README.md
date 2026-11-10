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
let go of a ledge · X / J to punch (or swing a sword) · C / K to throw (hold ↑ to throw upwards) ·
Shift / L to dash · ↑ to talk · gamepad supported.
Each ability only works once you've collected it.

## Status

M3 is done: the tape-loader intro and four playable eras. BOOT, ARCADE (The Block), 8-BIT
(Flicker) and 16-BIT (The Warden). Next: M4, Era 4 (32-BIT).

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
Shift / L to dash · ↑ to talk · jump to swim upwards in water · hold jump in the air to glide
(once you have a cape) · P for photo mode · gamepad supported.
Each ability only works once you've collected it.

## Status

M5 is done: the whole game plays from the tape loader to the ending. BOOT, ARCADE (The Block),
8-BIT (Flicker), 16-BIT (The Warden), 32-BIT (the cutscene and the Chase) and MODERN: HD, real
shadows and stealth, physics, the cape, far too much bloom, then the Deprecator, who rolls the
game back to a white screen while you win it back. Next: M6, secrets, the Feature Menu,
accessibility and polish.

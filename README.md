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

**Esc / Start pauses**, from the very first screen. The pause menu has:

- **CONTROLS:** see every binding and rebind the keyboard. Select an action, then press a new key to
  add it, or one of its keys to remove it (for example W from JUMP, if you don't want up to jump).
  Esc, Enter and the arrow keys always work in menus, so a bad binding can't lock you out.
- **ACCESSIBILITY:** reduce flashing, reduce screen shake, reduce motion (the first three start
  on if your system asks for reduced motion) and a colour-blind palette (danger in amber instead
  of red; hot bricks also carry a flame mark, so colour is never the only cue).
- **MUSIC and SOUND FX** volume.
- **NEW GAME:** start again from the tape. Your high scores, volume and keys are kept.

There's a high-score table too, but you have to find it first.

**After the ending**, a completion screen shows what you collected, your time and deaths, and the
pause menu gains **FEATURES**: switch any feature you've collected on or off (a whole era at once
from its heading). Turn off Eras 1–5 and the last roof is a white void again.

## Status

M5 is done: the whole game plays from the tape loader to the ending. BOOT, ARCADE (The Block),
8-BIT (Flicker), 16-BIT (The Warden), 32-BIT (the cutscene and the Chase) and MODERN: HD, real
shadows and stealth, physics, the cape, far too much bloom, then the Deprecator, who rolls the
game back to a white screen while you win it back. M6 has started: the pause menu (rebindable
keys, volume, new game) and the first secret, HIGH SCORES, are in. Still to come: the other
secrets, the Feature Menu, the rest of the accessibility options and polish.

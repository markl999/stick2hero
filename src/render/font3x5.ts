/** A tiny 3×5 pixel font for the earliest eras. Each glyph is 5 rows of 3 columns. */
export const GLYPH_W = 3;
export const GLYPH_H = 5;

const RAW: Record<string, string> = {
  A: '.#. #.# ### #.# #.#',
  B: '##. #.# ##. #.# ##.',
  C: '.## #.. #.. #.. .##',
  D: '##. #.# #.# #.# ##.',
  E: '### #.. ##. #.. ###',
  F: '### #.. ##. #.. #..',
  G: '.## #.. #.# #.# .##',
  H: '#.# #.# ### #.# #.#',
  I: '### .#. .#. .#. ###',
  J: '..# ..# ..# #.# .#.',
  K: '#.# #.# ##. #.# #.#',
  L: '#.. #.. #.. #.. ###',
  M: '#.# ### #.# #.# #.#',
  N: '##. #.# #.# #.# #.#',
  O: '.#. #.# #.# #.# .#.',
  P: '##. #.# ##. #.. #..',
  Q: '.#. #.# #.# ##. .##',
  R: '##. #.# ##. #.# #.#',
  S: '.## #.. .#. ..# ##.',
  T: '### .#. .#. .#. .#.',
  U: '#.# #.# #.# #.# ###',
  V: '#.# #.# #.# #.# .#.',
  W: '#.# #.# #.# ### #.#',
  X: '#.# #.# .#. #.# #.#',
  Y: '#.# #.# .#. .#. .#.',
  Z: '### ..# .#. #.. ###',
  '0': '### #.# #.# #.# ###',
  '1': '.#. ##. .#. .#. ###',
  '2': '##. ..# .#. #.. ###',
  '3': '##. ..# .#. ..# ##.',
  '4': '#.# #.# ### ..# ..#',
  '5': '### #.. ##. ..# ##.',
  '6': '.## #.. ### #.# ###',
  '7': '### ..# .#. .#. .#.',
  '8': '### #.# ### #.# ###',
  '9': '### #.# ### ..# ##.',
  ' ': '... ... ... ... ...',
  '<': '..# .#. #.. .#. ..#',
  '>': '#.. .#. ..# .#. #..',
  '-': '... ... ### ... ...',
  '.': '... ... ... ... .#.',
  ':': '... .#. ... .#. ...',
  '!': '.#. .#. .#. ... .#.',
  '?': '##. ..# .#. ... .#.',
  '/': '..# ..# .#. #.. #..',
  _: '... ... ... ... ###',
};

/** Glyph bitmaps: rows of booleans. Unknown characters render as '?'. */
const GLYPHS = new Map<string, boolean[][]>(
  Object.entries(RAW).map(([ch, rows]) => [
    ch,
    rows.split(' ').map((row) => [...row].map((c) => c === '#')),
  ]),
);

export function glyph(ch: string): boolean[][] {
  return GLYPHS.get(ch.toUpperCase()) ?? GLYPHS.get('?')!;
}

/** Width in font pixels (before scaling), with 1px spacing between glyphs. */
export function textWidth(text: string): number {
  return text.length === 0 ? 0 : text.length * (GLYPH_W + 1) - 1;
}

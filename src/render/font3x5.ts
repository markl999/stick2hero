/**
 * A tiny pixel font for the earliest eras. Glyphs are 5 rows tall and usually 3 wide;
 * M, N and W are wider because they're unreadable at 3 (like real 8-bit fonts).
 */
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
  M: '#...# ##.## #.#.# #...# #...#',
  N: '#..# ##.# #.## #..# #..#',
  O: '.#. #.# #.# #.# .#.',
  P: '##. #.# ##. #.. #..',
  Q: '.#. #.# #.# ##. .##',
  R: '##. #.# ##. #.# #.#',
  S: '.## #.. .#. ..# ##.',
  T: '### .#. .#. .#. .#.',
  U: '#.# #.# #.# #.# ###',
  V: '#.# #.# #.# #.# .#.',
  W: '#...# #...# #.#.# ##.## #...#',
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
  '(': '.# #. #. #. .#',
  ')': '#. .# .# .# #.',
  '&': '.#.. #.#. .#.. #.#. .#.#',
  ',': '.. .. .. .# #.',
  "'": '# # . . .',
  '+': '... .#. ### .#. ...',
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

export function glyphWidth(ch: string): number {
  return glyph(ch)[0].length;
}

/** Width in font pixels (before scaling), with 1px spacing between glyphs. */
export function textWidth(text: string): number {
  let width = 0;
  for (const ch of text) width += glyphWidth(ch) + 1;
  return Math.max(0, width - 1);
}

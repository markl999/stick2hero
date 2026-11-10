/**
 * Keyboard + gamepad, mapped to abstract actions (PRD §9).
 * Inputs are never gated here: features gate *abilities* in game logic, not devices.
 *
 * The game's actions can be rebound from the pause menu (PRD §12). The menu keys can't be:
 * Esc always pauses and goes back, Enter always selects, and the arrow keys always move
 * through menus, so no binding can lock you out.
 */

export type Action =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'jump'
  | 'attack'
  | 'special'
  | 'dash'
  | 'pause'
  | 'photo'
  // Menus only, on fixed keys.
  | 'confirm'
  | 'back'
  | 'menuUp'
  | 'menuDown'
  | 'menuLeft'
  | 'menuRight';

/** What game logic reads. Kept minimal so tests can fake it. */
export interface ActionState {
  isDown(action: Action): boolean;
  wasPressed(action: Action): boolean;
}

/** The actions you can rebind, in the order the controls screen lists them. */
export const BINDABLE_ACTIONS = [
  'left',
  'right',
  'up',
  'down',
  'jump',
  'attack',
  'special',
  'dash',
  'photo',
] as const;
export type BindableAction = (typeof BINDABLE_ACTIONS)[number];

/** Keyboard codes (KeyboardEvent.code) per action. */
export type KeyBindings = Record<BindableAction, string[]>;

/** Up to this many keys per action. */
export const MAX_KEYS_PER_ACTION = 3;

export const DEFAULT_KEYS: KeyBindings = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'ArrowUp', 'KeyW'],
  attack: ['KeyJ', 'KeyX'],
  special: ['KeyK', 'KeyC'],
  dash: ['ShiftLeft', 'ShiftRight', 'KeyL'],
  photo: ['KeyP'],
};

/** Keys that always do the same thing, whatever the bindings. */
const FIXED_KEYS: Record<string, Action[]> = {
  Escape: ['pause', 'back'],
  Enter: ['confirm'],
  NumpadEnter: ['confirm'],
  Space: ['confirm'],
  Backspace: ['back'],
  ArrowUp: ['menuUp'],
  ArrowDown: ['menuDown'],
  ArrowLeft: ['menuLeft'],
  ArrowRight: ['menuRight'],
};

/** Keys you can't bind to a game action (they belong to menus and the debug overlay). */
export const RESERVED_KEYS: ReadonlySet<string> = new Set([
  'Escape',
  'Enter',
  'NumpadEnter',
  'Backspace',
  'Backquote',
]);

export function copyBindings(keys: KeyBindings): KeyBindings {
  const out = {} as KeyBindings;
  for (const a of BINDABLE_ACTIONS) out[a] = [...keys[a]];
  return out;
}

/** The full code → actions table for a set of bindings. */
export function buildKeymap(keys: KeyBindings): Map<string, Action[]> {
  const map = new Map<string, Action[]>();
  const add = (code: string, action: Action) => {
    const list = map.get(code) ?? [];
    if (!list.includes(action)) list.push(action);
    map.set(code, list);
  };
  for (const [code, actions] of Object.entries(FIXED_KEYS)) for (const a of actions) add(code, a);
  for (const a of BINDABLE_ACTIONS) for (const code of keys[a]) add(code, a);
  return map;
}

/**
 * Rebinding: pressing a key the action already has takes it off (as long as one is left);
 * pressing a new one adds it at the front, dropping the oldest past the limit. Returns the
 * new bindings, or null if nothing changed (a reserved key, or the action's last key).
 */
export function rebind(
  keys: KeyBindings,
  action: BindableAction,
  code: string,
): KeyBindings | null {
  if (RESERVED_KEYS.has(code)) return null;
  const current = keys[action];
  let next: string[];
  if (current.includes(code)) {
    if (current.length === 1) return null;
    next = current.filter((c) => c !== code);
  } else {
    next = [code, ...current].slice(0, MAX_KEYS_PER_ACTION);
  }
  return { ...copyBindings(keys), [action]: next };
}

/** Bindings from a save, falling back to the defaults for anything missing or broken. */
export function sanitiseBindings(value: unknown): KeyBindings {
  const out = copyBindings(DEFAULT_KEYS);
  if (typeof value !== 'object' || value === null) return out;
  const raw = value as Record<string, unknown>;
  for (const a of BINDABLE_ACTIONS) {
    const list = raw[a];
    if (!Array.isArray(list)) continue;
    const codes = list
      .filter((c): c is string => typeof c === 'string' && c.length > 0 && !RESERVED_KEYS.has(c))
      .filter((c, i, all) => all.indexOf(c) === i)
      .slice(0, MAX_KEYS_PER_ACTION);
    if (codes.length > 0) out[a] = codes;
  }
  return out;
}

const KEY_NAMES: Record<string, string> = {
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  Space: 'SPACE',
  ShiftLeft: 'L-SHIFT',
  ShiftRight: 'R-SHIFT',
  ControlLeft: 'L-CTRL',
  ControlRight: 'R-CTRL',
  AltLeft: 'L-ALT',
  AltRight: 'R-ALT',
  MetaLeft: 'L-CMD',
  MetaRight: 'R-CMD',
  Tab: 'TAB',
  CapsLock: 'CAPS',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Minus: '-',
  Equal: '+',
  Quote: "'",
  Semicolon: 'SEMICOLON',
  BracketLeft: '(',
  BracketRight: ')',
  Backslash: 'BACKSLASH',
  Escape: 'ESC',
  Enter: 'ENTER',
  Backspace: 'BACKSPACE',
};

/** A short, printable name for a key code ("KeyA" → "A", "ArrowUp" → "UP"). */
export function keyName(code: string): string {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `NUM ${code.slice(6)}`;
  if (/^F\d+$/.test(code)) return code;
  return code
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '');
}

// Standard Gamepad mapping button indices. (Not rebindable.)
const PAD_BUTTONS: Record<number, Action[]> = {
  0: ['jump', 'confirm'], // A
  1: ['special', 'back'], // B
  2: ['attack'], // X
  4: ['dash'], // LB
  5: ['dash'], // RB
  7: ['dash'], // RT
  8: ['photo'], // Back / Select
  9: ['pause'], // Start
  12: ['up', 'menuUp'],
  13: ['down', 'menuDown'],
  14: ['left', 'menuLeft'],
  15: ['right', 'menuRight'],
};
const STICK_DEADZONE = 0.4;

/** What the controls screen says about the gamepad. */
export const PAD_LAYOUT: readonly [string, string][] = [
  ['A', 'JUMP'],
  ['X', 'ATTACK'],
  ['B', 'SPECIAL'],
  ['LB/RB', 'DASH'],
  ['START', 'PAUSE'],
  ['SELECT', 'PHOTO'],
];

/** Keys that shouldn't count as "any key" (debug toggle, modifiers). */
const IGNORED_FOR_ANY_KEY = new Set([
  'Backquote',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
]);

export class Input implements ActionState {
  private keymap = buildKeymap(DEFAULT_KEYS);
  private readonly keysDown = new Set<string>();
  /** Key presses since the last poll, so taps shorter than one step aren't lost. */
  private readonly latched = new Set<Action>();
  private padDown = new Set<Action>();
  private down = new Set<Action>();
  private pressed = new Set<Action>();
  /** Any key or button at all (for "PRESS ANY KEY"), latched like actions. */
  private anyLatched = false;
  private anyPressed = false;
  private padButtonsDown = 0;
  /** The controls screen is waiting for a key to bind. */
  private capture: ((code: string) => void) | null = null;
  /** Letters and digits typed since the last poll (for entering initials). */
  private typedLatched: string[] = [];
  private typedChars: string[] = [];

  setBindings(keys: KeyBindings): void {
    this.keymap = buildKeymap(keys);
    this.keysDown.clear();
  }

  /** Hand the next key press to `onKey` instead of the game (for rebinding). */
  captureKey(onKey: (code: string) => void): void {
    this.capture = onKey;
  }

  cancelCapture(): void {
    this.capture = null;
  }

  attach(target: Window, onUserGesture?: () => void): void {
    target.addEventListener('keydown', (e) => {
      onUserGesture?.();
      if (this.capture && !e.repeat && e.code !== 'Backquote') {
        e.preventDefault();
        const onKey = this.capture;
        this.capture = null;
        onKey(e.code);
        return;
      }
      if (!e.repeat && !IGNORED_FOR_ANY_KEY.has(e.code)) this.anyLatched = true;
      if (!e.repeat && /^(Key[A-Z]|Digit\d)$/.test(e.code))
        this.typedLatched.push(e.code.slice(-1));
      const actions = this.keymap.get(e.code);
      if (!actions) return;
      e.preventDefault();
      if (!e.repeat) for (const a of actions) this.latched.add(a);
      this.keysDown.add(e.code);
    });
    target.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });
    target.addEventListener('pointerdown', (e) => {
      onUserGesture?.();
      // Only clicks on the game itself, not on the debug overlay.
      if (e.target instanceof HTMLCanvasElement) this.anyLatched = true;
    });
    target.addEventListener('blur', () => this.keysDown.clear());
  }

  /** Call once per fixed simulation step, before game logic. */
  poll(): void {
    const prevPad = this.padDown;
    const prevButtons = this.padButtonsDown;
    this.padDown = this.readGamepads();

    const down = new Set<Action>();
    for (const code of this.keysDown) for (const a of this.keymap.get(code) ?? []) down.add(a);
    for (const a of this.padDown) down.add(a);

    const pressed = new Set<Action>(this.latched);
    for (const a of this.padDown) if (!prevPad.has(a)) pressed.add(a);

    this.anyPressed = this.anyLatched || this.padButtonsDown > prevButtons;
    this.anyLatched = false;
    this.latched.clear();
    this.typedChars = this.typedLatched;
    this.typedLatched = [];
    this.down = down;
    this.pressed = pressed;
  }

  /** True if any key, click or gamepad button was pressed since the last poll. */
  wasAnyPressed(): boolean {
    return this.anyPressed;
  }

  /** Letters and digits typed since the last poll, in order. */
  typed(): readonly string[] {
    return this.typedChars;
  }

  isDown(action: Action): boolean {
    return this.down.has(action);
  }

  wasPressed(action: Action): boolean {
    return this.pressed.has(action);
  }

  private readGamepads(): Set<Action> {
    const result = new Set<Action>();
    this.padButtonsDown = 0;
    const pads = typeof navigator !== 'undefined' ? navigator.getGamepads?.() : null;
    if (!pads) return result;
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      pad.buttons.forEach((button, i) => {
        if (!button.pressed) return;
        this.padButtonsDown++;
        for (const a of PAD_BUTTONS[i] ?? []) result.add(a);
      });
      const x = pad.axes[0] ?? 0;
      const y = pad.axes[1] ?? 0;
      if (x < -STICK_DEADZONE) result.add('left').add('menuLeft');
      if (x > STICK_DEADZONE) result.add('right').add('menuRight');
      if (y < -STICK_DEADZONE) result.add('up').add('menuUp');
      if (y > STICK_DEADZONE) result.add('down').add('menuDown');
    }
    return result;
  }
}

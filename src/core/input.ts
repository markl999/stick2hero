/**
 * Keyboard + gamepad, mapped to abstract actions (PRD §9).
 * Inputs are never gated here: features gate *abilities* in game logic, not devices.
 */

export type Action =
  'left' | 'right' | 'up' | 'down' | 'jump' | 'attack' | 'special' | 'dash' | 'pause' | 'photo';

/** What game logic reads. Kept minimal so tests can fake it. */
export interface ActionState {
  isDown(action: Action): boolean;
  wasPressed(action: Action): boolean;
}

const KEYMAP: Record<string, Action[]> = {
  ArrowLeft: ['left'],
  KeyA: ['left'],
  ArrowRight: ['right'],
  KeyD: ['right'],
  ArrowUp: ['up', 'jump'],
  KeyW: ['up', 'jump'],
  Space: ['jump'],
  ArrowDown: ['down'],
  KeyS: ['down'],
  KeyJ: ['attack'],
  KeyX: ['attack'],
  KeyK: ['special'],
  KeyC: ['special'],
  ShiftLeft: ['dash'],
  ShiftRight: ['dash'],
  KeyL: ['dash'],
  Escape: ['pause'],
  KeyP: ['photo'],
};

// Standard Gamepad mapping button indices.
const PAD_BUTTONS: Record<number, Action[]> = {
  0: ['jump'], // A
  1: ['special'], // B
  2: ['attack'], // X
  4: ['dash'], // LB
  5: ['dash'], // RB
  7: ['dash'], // RT
  8: ['photo'], // Back / Select
  9: ['pause'], // Start
  12: ['up'],
  13: ['down'],
  14: ['left'],
  15: ['right'],
};
const STICK_DEADZONE = 0.4;

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

  attach(target: Window, onUserGesture?: () => void): void {
    target.addEventListener('keydown', (e) => {
      onUserGesture?.();
      if (!e.repeat && !IGNORED_FOR_ANY_KEY.has(e.code)) this.anyLatched = true;
      const actions = KEYMAP[e.code];
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
    for (const code of this.keysDown) for (const a of KEYMAP[code] ?? []) down.add(a);
    for (const a of this.padDown) down.add(a);

    const pressed = new Set<Action>(this.latched);
    for (const a of this.padDown) if (!prevPad.has(a)) pressed.add(a);

    this.anyPressed = this.anyLatched || this.padButtonsDown > prevButtons;
    this.anyLatched = false;
    this.latched.clear();
    this.down = down;
    this.pressed = pressed;
  }

  /** True if any key, click or gamepad button was pressed since the last poll. */
  wasAnyPressed(): boolean {
    return this.anyPressed;
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
      if (x < -STICK_DEADZONE) result.add('left');
      if (x > STICK_DEADZONE) result.add('right');
      if (y < -STICK_DEADZONE) result.add('up');
      if (y > STICK_DEADZONE) result.add('down');
    }
    return result;
  }
}

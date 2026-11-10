/**
 * Keyboard + gamepad, mapped to abstract actions (PRD §9).
 * Inputs are never gated here: features gate *abilities* in game logic, not devices.
 */

export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'attack' | 'special' | 'pause';

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
  Escape: ['pause'],
};

// Standard Gamepad mapping button indices.
const PAD_BUTTONS: Record<number, Action[]> = {
  0: ['jump'], // A
  1: ['special'], // B
  2: ['attack'], // X
  5: ['special'], // RB
  9: ['pause'], // Start
  12: ['up'],
  13: ['down'],
  14: ['left'],
  15: ['right'],
};
const STICK_DEADZONE = 0.4;

export class Input implements ActionState {
  private readonly keysDown = new Set<string>();
  /** Key presses since the last poll, so taps shorter than one step aren't lost. */
  private readonly latched = new Set<Action>();
  private padDown = new Set<Action>();
  private down = new Set<Action>();
  private pressed = new Set<Action>();

  attach(target: Window, onUserGesture?: () => void): void {
    target.addEventListener('keydown', (e) => {
      onUserGesture?.();
      const actions = KEYMAP[e.code];
      if (!actions) return;
      e.preventDefault();
      if (!e.repeat) for (const a of actions) this.latched.add(a);
      this.keysDown.add(e.code);
    });
    target.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });
    target.addEventListener('pointerdown', () => onUserGesture?.());
    target.addEventListener('blur', () => this.keysDown.clear());
  }

  /** Call once per fixed simulation step, before game logic. */
  poll(): void {
    const prevPad = this.padDown;
    this.padDown = this.readGamepads();

    const down = new Set<Action>();
    for (const code of this.keysDown) for (const a of KEYMAP[code] ?? []) down.add(a);
    for (const a of this.padDown) down.add(a);

    const pressed = new Set<Action>(this.latched);
    for (const a of this.padDown) if (!prevPad.has(a)) pressed.add(a);

    this.latched.clear();
    this.down = down;
    this.pressed = pressed;
  }

  isDown(action: Action): boolean {
    return this.down.has(action);
  }

  wasPressed(action: Action): boolean {
    return this.pressed.has(action);
  }

  private readGamepads(): Set<Action> {
    const result = new Set<Action>();
    const pads = typeof navigator !== 'undefined' ? navigator.getGamepads?.() : null;
    if (!pads) return result;
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      pad.buttons.forEach((button, i) => {
        if (button.pressed) for (const a of PAD_BUTTONS[i] ?? []) result.add(a);
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

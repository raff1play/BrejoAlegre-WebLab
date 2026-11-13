import { InputState } from '../../core/inputState';
import { blendAxis, responsiveMotoSteer } from '../../core/analogStick.ts';
import { VirtualJoystick } from './virtualJoystick';

export type Control =
  | 'accelerate' | 'brake' | 'left' | 'right'
  | 'camera-left' | 'camera-right' | 'zoom-in' | 'zoom-out';
export type Action = 'mount' | 'graphics' | 'pause' | 'wait';

const KEYBOARD = 'keyboard';
/** Physical key positions (event.code), so WASD works on any keyboard layout. */
const HOLD_KEYS: Record<string, Control> = {
  KeyW: 'accelerate', ArrowUp: 'accelerate',
  KeyS: 'brake', ArrowDown: 'brake', Space: 'brake',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyQ: 'camera-left', KeyE: 'camera-right',
  KeyZ: 'zoom-in', Equal: 'zoom-in', NumpadAdd: 'zoom-in',
  KeyX: 'zoom-out', Minus: 'zoom-out', NumpadSubtract: 'zoom-out',
};
const ACTION_KEYS: Record<string, Action> = { KeyF: 'mount', Enter: 'mount', KeyG: 'graphics', KeyP: 'pause', Escape: 'pause', KeyH: 'wait' };

/**
 * Keyboard and touch input. Hold controls come from `[data-control]` buttons, one-shot actions
 * from `[data-action]` buttons. Each finger is its own source, so multi-touch works and releasing,
 * cancelling or losing a pointer can never leave a control stuck. Everything is released when the
 * page loses focus or is hidden.
 */
export class GameInput {
  readonly state = new InputState<Control>();
  readonly joystick: VirtualJoystick;
  private readonly buttons = new Map<Control, HTMLElement[]>();

  constructor(root: ParentNode, private readonly onAction: (action: Action) => void) {
    this.joystick = new VirtualJoystick(root);
    window.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) { this.state.releaseSource(KEYBOARD); this.paint(); return; }
      const control = HOLD_KEYS[event.code];
      const action = ACTION_KEYS[event.code];
      if (!control && !action) return;
      event.preventDefault();
      if (event.repeat) return;
      if (control) { this.state.press(KEYBOARD, control); this.paint(); }
      if (action) this.onAction(action);
    });
    window.addEventListener('keyup', (event) => {
      const control = HOLD_KEYS[event.code];
      if (!control) return;
      event.preventDefault();
      this.state.release(KEYBOARD, control);
      this.paint();
    });
    window.addEventListener('blur', () => this.reset());
    window.addEventListener('pagehide', () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
    document.addEventListener('contextmenu', (event) => event.preventDefault());

    for (const button of root.querySelectorAll<HTMLElement>('[data-control]')) {
      const control = button.dataset.control as Control;
      this.buttons.set(control, [...(this.buttons.get(control) ?? []), button]);
      const release = (event: PointerEvent) => {
        this.state.releaseSource(`pointer-${event.pointerId}`);
        this.paint();
      };
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        try { button.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
        this.state.press(`pointer-${event.pointerId}`, control);
        this.paint();
      });
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    }
    for (const button of root.querySelectorAll<HTMLElement>('[data-action]')) {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        this.onAction(button.dataset.action as Action);
        button.blur();
      });
    }
  }

  axis(positive: Control, negative: Control): number { return this.state.axis(positive, negative); }
  /** Proportional steering while riding; keyboard remains fully functional. */
  steer(): number { return blendAxis(this.axis('right', 'left'), responsiveMotoSteer(this.joystick.axes.x)); }
  /** Full 360-degree movement while on foot. */
  walkingAxes(): { forward: number; right: number } {
    return {
      forward: blendAxis(this.axis('accelerate', 'brake'), this.joystick.axes.y),
      right: blendAxis(this.axis('right', 'left'), this.joystick.axes.x),
    };
  }
  isDown(control: Control): boolean { return this.state.isDown(control); }

  reset(): void {
    this.joystick.reset();
    this.state.clear();
    this.paint();
  }

  private paint(): void {
    for (const [control, buttons] of this.buttons) {
      const down = this.state.isDown(control);
      for (const button of buttons) button.classList.toggle('active', down);
    }
  }
}

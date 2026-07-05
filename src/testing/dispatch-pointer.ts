import { decodeKeybinding } from '../keybindings.js';
import { MouseButton, type PointerEventKind } from '../pointer.js';
import { POINTER_KIND_TO_DOM, type TestPointerKind } from './internal.js';

export interface DispatchPointerOptions {
  readonly isMac?: boolean | undefined;
  readonly pointerType?: 'mouse' | 'pen' | 'touch' | undefined;
  readonly clientX?: number | undefined;
  readonly clientY?: number | undefined;
  /** Held buttons bitmask for move/enter/leave. Defaults to left (1). */
  readonly buttons?: number | undefined;
  readonly bubbles?: boolean | undefined;
  readonly cancelable?: boolean | undefined;
  /** Wheel delta when kind is `wheel`. Defaults to vertical scroll down. */
  readonly deltaY?: number | undefined;
  readonly deltaX?: number | undefined;
}

/**
 * Dispatch a DOM event that matches a pointer binding encoding
 * (`KeyMod.CtrlCmd | MouseButton.Left`, kind `'down'`, etc.).
 */
export function dispatchPointerBinding(
  target: EventTarget,
  binding: number,
  kind: PointerEventKind,
  options: DispatchPointerOptions = {}
): Event {
  const isMac = options.isMac ?? false;
  const parts = decodeKeybinding(binding, isMac);
  if (parts === null || parts.length !== 1) {
    throw new Error(
      `[kilid/testing] pointer bindings must be single-part encodings; got ${binding}`
    );
  }
  const part = parts[0]!;
  const domType = POINTER_KIND_TO_DOM[kind as TestPointerKind];
  const buttonCode = part.keyCode;

  if (kind === 'wheel') {
    const deltaY =
      options.deltaY ??
      (buttonCode === MouseButton.WheelUp
        ? -1
        : buttonCode === MouseButton.WheelDown
          ? 1
          : 0);
    const deltaX =
      options.deltaX ??
      (buttonCode === MouseButton.WheelLeft ? -1 : buttonCode === MouseButton.WheelRight ? 1 : 0);
    const event = new WheelEvent(domType, {
      ctrlKey: part.ctrlKey,
      shiftKey: part.shiftKey,
      altKey: part.altKey,
      metaKey: part.metaKey,
      deltaY,
      deltaX,
      bubbles: options.bubbles ?? true,
      cancelable: options.cancelable ?? true,
    });
    target.dispatchEvent(event);
    return event;
  }

  const domButton = buttonCode >= MouseButton.Left && buttonCode <= MouseButton.X2 ? buttonCode - 1 : 0;
  const usePointer = kind === 'down' || kind === 'up' || kind === 'move' || kind === 'enter' || kind === 'leave' || kind === 'cancel';

  const init: MouseEventInit = {
    button: domButton,
    buttons: options.buttons ?? (domButton >= 0 ? 1 << domButton : 0),
    ctrlKey: part.ctrlKey,
    shiftKey: part.shiftKey,
    altKey: part.altKey,
    metaKey: part.metaKey,
    clientX: options.clientX ?? 0,
    clientY: options.clientY ?? 0,
    bubbles: options.bubbles ?? true,
    cancelable: options.cancelable ?? true,
  };

  const event = usePointer
    ? new MouseEvent(domType, init)
    : new MouseEvent(domType, init);

  if (usePointer && options.pointerType !== undefined) {
    Object.defineProperty(event, 'pointerType', { value: options.pointerType });
  }

  target.dispatchEvent(event);
  return event;
}

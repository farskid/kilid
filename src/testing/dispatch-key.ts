import { decodeKeybinding, type ResolvedChord } from '../keybindings.js';
import { keyCodeToDomCode } from './internal.js';

export interface DispatchKeyOptions {
  /** Platform used to resolve `KeyMod.CtrlCmd` / `KeyMod.WinCtrl`. Defaults to `false`. */
  readonly isMac?: boolean | undefined;
  readonly bubbles?: boolean | undefined;
  readonly cancelable?: boolean | undefined;
}

function partToKeyboardInit(
  part: ResolvedChord,
  options: DispatchKeyOptions
): KeyboardEventInit {
  return {
    code: keyCodeToDomCode(part.keyCode),
    ctrlKey: part.ctrlKey,
    shiftKey: part.shiftKey,
    altKey: part.altKey,
    metaKey: part.metaKey,
    bubbles: options.bubbles ?? true,
    cancelable: options.cancelable ?? true,
  };
}

/**
 * Dispatch one keydown for a single-part encoded binding
 * (`KeyMod.CtrlCmd | KeyCode.KeyS`). Returns the dispatched event.
 */
export function dispatchKeyPart(
  target: EventTarget,
  partEncoding: number,
  options: DispatchKeyOptions = {}
): KeyboardEvent {
  const isMac = options.isMac ?? false;
  const parts = decodeKeybinding(partEncoding, isMac);
  if (parts === null || parts.length === 0) {
    throw new Error(`[kilid/testing] invalid key part encoding: ${partEncoding}`);
  }
  const event = new KeyboardEvent('keydown', partToKeyboardInit(parts[0]!, options));
  target.dispatchEvent(event);
  return event;
}

/**
 * Dispatch keydown event(s) for an encoded binding. Chord encodings dispatch
 * two keydowns in order (`Ctrl+K Ctrl+S`). Returns every event dispatched.
 */
export function dispatchKeybinding(
  target: EventTarget,
  encoding: number,
  options: DispatchKeyOptions = {}
): KeyboardEvent[] {
  const isMac = options.isMac ?? false;
  const parts = decodeKeybinding(encoding, isMac);
  if (parts === null || parts.length === 0) {
    throw new Error(`[kilid/testing] invalid keybinding encoding: ${encoding}`);
  }
  const events: KeyboardEvent[] = [];
  for (const part of parts) {
    const event = new KeyboardEvent('keydown', partToKeyboardInit(part, options));
    target.dispatchEvent(event);
    events.push(event);
  }
  return events;
}

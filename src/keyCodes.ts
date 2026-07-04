/**
 * Layout-independent virtual key codes, modelled after Monaco's `KeyCode`.
 *
 * Values must fit in 8 bits (0..255) so a full keybinding (modifiers +
 * key code, or a two-part chord) can be packed into a single number.
 *
 * A plain const object rather than a TypeScript enum: enums emit a
 * bidirectional runtime mapping (name -> value AND value -> name), doubling
 * the shipped bytes for a reverse lookup nothing uses. Member names
 * deliberately match `KeyboardEvent.code` values wherever possible so event
 * resolution is a direct property lookup instead of a shipped table.
 */
export const KeyCode = {
  Unknown: 0,

  Backspace: 1,
  Tab: 2,
  Enter: 3,
  Shift: 4,
  Ctrl: 5,
  Alt: 6,
  Meta: 7,
  PauseBreak: 8,
  CapsLock: 9,
  Escape: 10,
  Space: 11,
  PageUp: 12,
  PageDown: 13,
  End: 14,
  Home: 15,
  LeftArrow: 16,
  UpArrow: 17,
  RightArrow: 18,
  DownArrow: 19,
  Insert: 20,
  Delete: 21,

  Digit0: 22,
  Digit1: 23,
  Digit2: 24,
  Digit3: 25,
  Digit4: 26,
  Digit5: 27,
  Digit6: 28,
  Digit7: 29,
  Digit8: 30,
  Digit9: 31,

  KeyA: 32,
  KeyB: 33,
  KeyC: 34,
  KeyD: 35,
  KeyE: 36,
  KeyF: 37,
  KeyG: 38,
  KeyH: 39,
  KeyI: 40,
  KeyJ: 41,
  KeyK: 42,
  KeyL: 43,
  KeyM: 44,
  KeyN: 45,
  KeyO: 46,
  KeyP: 47,
  KeyQ: 48,
  KeyR: 49,
  KeyS: 50,
  KeyT: 51,
  KeyU: 52,
  KeyV: 53,
  KeyW: 54,
  KeyX: 55,
  KeyY: 56,
  KeyZ: 57,

  ContextMenu: 58,

  F1: 59,
  F2: 60,
  F3: 61,
  F4: 62,
  F5: 63,
  F6: 64,
  F7: 65,
  F8: 66,
  F9: 67,
  F10: 68,
  F11: 69,
  F12: 70,
  F13: 71,
  F14: 72,
  F15: 73,
  F16: 74,
  F17: 75,
  F18: 76,
  F19: 77,

  NumLock: 78,
  ScrollLock: 79,

  Semicolon: 80,
  Equal: 81,
  Comma: 82,
  Minus: 83,
  Period: 84,
  Slash: 85,
  Backquote: 86,
  BracketLeft: 87,
  Backslash: 88,
  BracketRight: 89,
  Quote: 90,
  IntlBackslash: 91,

  Numpad0: 92,
  Numpad1: 93,
  Numpad2: 94,
  Numpad3: 95,
  Numpad4: 96,
  Numpad5: 97,
  Numpad6: 98,
  Numpad7: 99,
  Numpad8: 100,
  Numpad9: 101,
  NumpadMultiply: 102,
  NumpadAdd: 103,
  NumpadSubtract: 104,
  NumpadDecimal: 105,
  NumpadDivide: 106,
  NumpadEnter: 107,
} as const;

export type KeyCode = (typeof KeyCode)[keyof typeof KeyCode];

/** First key code past the defined range; useful for iteration/validation. */
export const KEY_CODE_MAX = 108;

/**
 * Punctuation characters for key codes Semicolon..Quote, in value order.
 * Shared by event-key resolution and label formatting.
 */
export const PUNCTUATION_CHARS = ";=,-./`[\\]'";

/**
 * `KeyboardEvent.code` / `KeyboardEvent.key` values whose key code cannot be
 * found by direct member-name lookup on {@link KeyCode}.
 */
const NAME_EXCEPTIONS: Record<string, KeyCode> = {
  ArrowLeft: KeyCode.LeftArrow,
  ArrowUp: KeyCode.UpArrow,
  ArrowRight: KeyCode.RightArrow,
  ArrowDown: KeyCode.DownArrow,
  ShiftLeft: KeyCode.Shift,
  ShiftRight: KeyCode.Shift,
  ControlLeft: KeyCode.Ctrl,
  ControlRight: KeyCode.Ctrl,
  Control: KeyCode.Ctrl,
  AltLeft: KeyCode.Alt,
  AltRight: KeyCode.Alt,
  MetaLeft: KeyCode.Meta,
  MetaRight: KeyCode.Meta,
  Pause: KeyCode.PauseBreak,
};

function lookupName(name: string): KeyCode | undefined {
  const exception = NAME_EXCEPTIONS[name];
  if (exception !== undefined) {
    return exception;
  }
  // Member names match event codes (KeyA, Digit0, F1, Numpad5, Semicolon,
  // PageUp, ...) so this covers the vast majority with zero table data.
  if (name !== 'Unknown' && Object.prototype.hasOwnProperty.call(KeyCode, name)) {
    return (KeyCode as Record<string, KeyCode>)[name];
  }
  return undefined;
}

function fromKeyValue(key: string): KeyCode {
  if (key.length === 1) {
    const ch = key.charCodeAt(0);
    if (ch >= 97 && ch <= 122) return (KeyCode.KeyA + ch - 97) as KeyCode;
    if (ch >= 65 && ch <= 90) return (KeyCode.KeyA + ch - 65) as KeyCode;
    if (ch >= 48 && ch <= 57) return (KeyCode.Digit0 + ch - 48) as KeyCode;
    if (ch === 32) return KeyCode.Space;
    const punct = PUNCTUATION_CHARS.indexOf(key);
    if (punct >= 0) return (KeyCode.Semicolon + punct) as KeyCode;
    return KeyCode.Unknown;
  }
  return lookupName(key) ?? KeyCode.Unknown;
}

/**
 * Resolve the key code for a live keyboard event. Prefers the physical
 * `event.code` (layout-independent, matching Monaco's behaviour of binding to
 * physical keys) and falls back to `event.key` for keyboards whose `code` is
 * unavailable or exotic.
 */
export function keyCodeFromEvent(event: KeyboardEvent): KeyCode {
  return lookupName(event.code) ?? fromKeyValue(event.key);
}

/** True for Shift/Ctrl/Alt/Meta — keys that never terminate a binding on their own. */
export function isModifierKeyCode(keyCode: number): boolean {
  return keyCode >= KeyCode.Shift && keyCode <= KeyCode.Meta;
}

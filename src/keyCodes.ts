/**
 * Layout-independent virtual key codes, modelled after Monaco's `KeyCode`.
 *
 * Values must fit in 8 bits (0..255) so a full keybinding (modifiers +
 * key code, or a two-part chord) can be packed into a single number.
 */
export enum KeyCode {
  Unknown = 0,

  Backspace = 1,
  Tab = 2,
  Enter = 3,
  Shift = 4,
  Ctrl = 5,
  Alt = 6,
  Meta = 7,
  PauseBreak = 8,
  CapsLock = 9,
  Escape = 10,
  Space = 11,
  PageUp = 12,
  PageDown = 13,
  End = 14,
  Home = 15,
  LeftArrow = 16,
  UpArrow = 17,
  RightArrow = 18,
  DownArrow = 19,
  Insert = 20,
  Delete = 21,

  Digit0 = 22,
  Digit1 = 23,
  Digit2 = 24,
  Digit3 = 25,
  Digit4 = 26,
  Digit5 = 27,
  Digit6 = 28,
  Digit7 = 29,
  Digit8 = 30,
  Digit9 = 31,

  KeyA = 32,
  KeyB = 33,
  KeyC = 34,
  KeyD = 35,
  KeyE = 36,
  KeyF = 37,
  KeyG = 38,
  KeyH = 39,
  KeyI = 40,
  KeyJ = 41,
  KeyK = 42,
  KeyL = 43,
  KeyM = 44,
  KeyN = 45,
  KeyO = 46,
  KeyP = 47,
  KeyQ = 48,
  KeyR = 49,
  KeyS = 50,
  KeyT = 51,
  KeyU = 52,
  KeyV = 53,
  KeyW = 54,
  KeyX = 55,
  KeyY = 56,
  KeyZ = 57,

  ContextMenu = 58,

  F1 = 59,
  F2 = 60,
  F3 = 61,
  F4 = 62,
  F5 = 63,
  F6 = 64,
  F7 = 65,
  F8 = 66,
  F9 = 67,
  F10 = 68,
  F11 = 69,
  F12 = 70,
  F13 = 71,
  F14 = 72,
  F15 = 73,
  F16 = 74,
  F17 = 75,
  F18 = 76,
  F19 = 77,

  NumLock = 78,
  ScrollLock = 79,

  Semicolon = 80,
  Equal = 81,
  Comma = 82,
  Minus = 83,
  Period = 84,
  Slash = 85,
  Backquote = 86,
  BracketLeft = 87,
  Backslash = 88,
  BracketRight = 89,
  Quote = 90,
  IntlBackslash = 91,

  Numpad0 = 92,
  Numpad1 = 93,
  Numpad2 = 94,
  Numpad3 = 95,
  Numpad4 = 96,
  Numpad5 = 97,
  Numpad6 = 98,
  Numpad7 = 99,
  Numpad8 = 100,
  Numpad9 = 101,
  NumpadMultiply = 102,
  NumpadAdd = 103,
  NumpadSubtract = 104,
  NumpadDecimal = 105,
  NumpadDivide = 106,
  NumpadEnter = 107,

  /** Keep this as the last entry. */
  MAX_VALUE = 108,
}

interface KeyCodeStrMaps {
  toString: string[];
  fromString: Map<string, KeyCode>;
  /** Maps `KeyboardEvent.code` values to key codes. */
  fromEventCode: Map<string, KeyCode>;
  /** Maps `KeyboardEvent.key` values (lowercased) to key codes. */
  fromEventKey: Map<string, KeyCode>;
}

const maps: KeyCodeStrMaps = {
  toString: [],
  fromString: new Map(),
  fromEventCode: new Map(),
  fromEventKey: new Map(),
};

function define(
  keyCode: KeyCode,
  label: string,
  eventCode: string | null,
  eventKey: string | null = null,
  ...aliases: string[]
): void {
  maps.toString[keyCode] = label;
  for (const name of [label, ...aliases]) {
    if (!maps.fromString.has(name.toLowerCase())) {
      maps.fromString.set(name.toLowerCase(), keyCode);
    }
  }
  if (eventCode !== null && !maps.fromEventCode.has(eventCode)) {
    maps.fromEventCode.set(eventCode, keyCode);
  }
  if (eventKey !== null && !maps.fromEventKey.has(eventKey.toLowerCase())) {
    maps.fromEventKey.set(eventKey.toLowerCase(), keyCode);
  }
}

define(KeyCode.Unknown, 'unknown', null);
define(KeyCode.Backspace, 'Backspace', 'Backspace', 'Backspace');
define(KeyCode.Tab, 'Tab', 'Tab', 'Tab');
define(KeyCode.Enter, 'Enter', 'Enter', 'Enter', 'Return');
define(KeyCode.Shift, 'Shift', 'ShiftLeft', 'Shift');
maps.fromEventCode.set('ShiftRight', KeyCode.Shift);
define(KeyCode.Ctrl, 'Ctrl', 'ControlLeft', 'Control', 'Control');
maps.fromEventCode.set('ControlRight', KeyCode.Ctrl);
define(KeyCode.Alt, 'Alt', 'AltLeft', 'Alt', 'Option');
maps.fromEventCode.set('AltRight', KeyCode.Alt);
define(KeyCode.Meta, 'Meta', 'MetaLeft', 'Meta', 'Cmd', 'Command', 'Win');
maps.fromEventCode.set('MetaRight', KeyCode.Meta);
define(KeyCode.PauseBreak, 'PauseBreak', 'Pause', 'Pause', 'Pause');
define(KeyCode.CapsLock, 'CapsLock', 'CapsLock', 'CapsLock');
define(KeyCode.Escape, 'Escape', 'Escape', 'Escape', 'Esc');
define(KeyCode.Space, 'Space', 'Space', ' ');
define(KeyCode.PageUp, 'PageUp', 'PageUp', 'PageUp');
define(KeyCode.PageDown, 'PageDown', 'PageDown', 'PageDown');
define(KeyCode.End, 'End', 'End', 'End');
define(KeyCode.Home, 'Home', 'Home', 'Home');
define(KeyCode.LeftArrow, 'LeftArrow', 'ArrowLeft', 'ArrowLeft', 'Left');
define(KeyCode.UpArrow, 'UpArrow', 'ArrowUp', 'ArrowUp', 'Up');
define(KeyCode.RightArrow, 'RightArrow', 'ArrowRight', 'ArrowRight', 'Right');
define(KeyCode.DownArrow, 'DownArrow', 'ArrowDown', 'ArrowDown', 'Down');
define(KeyCode.Insert, 'Insert', 'Insert', 'Insert');
define(KeyCode.Delete, 'Delete', 'Delete', 'Delete');

for (let i = 0; i <= 9; i++) {
  define(KeyCode.Digit0 + i, String(i), `Digit${i}`, String(i));
}
for (let i = 0; i < 26; i++) {
  const letter = String.fromCharCode(65 + i); // 'A'..'Z'
  define(KeyCode.KeyA + i, letter, `Key${letter}`, letter.toLowerCase());
}

define(KeyCode.ContextMenu, 'ContextMenu', 'ContextMenu', 'ContextMenu');

for (let i = 1; i <= 19; i++) {
  define(KeyCode.F1 + i - 1, `F${i}`, `F${i}`, `F${i}`);
}

define(KeyCode.NumLock, 'NumLock', 'NumLock', 'NumLock');
define(KeyCode.ScrollLock, 'ScrollLock', 'ScrollLock', 'ScrollLock');

define(KeyCode.Semicolon, ';', 'Semicolon', ';', 'Semicolon');
define(KeyCode.Equal, '=', 'Equal', '=', 'Equal', 'Plus');
define(KeyCode.Comma, ',', 'Comma', ',', 'Comma');
define(KeyCode.Minus, '-', 'Minus', '-', 'Minus');
define(KeyCode.Period, '.', 'Period', '.', 'Period');
define(KeyCode.Slash, '/', 'Slash', '/', 'Slash');
define(KeyCode.Backquote, '`', 'Backquote', '`', 'Backquote', 'Backtick');
define(KeyCode.BracketLeft, '[', 'BracketLeft', '[', 'BracketLeft');
define(KeyCode.Backslash, '\\', 'Backslash', '\\', 'Backslash');
define(KeyCode.BracketRight, ']', 'BracketRight', ']', 'BracketRight');
define(KeyCode.Quote, "'", 'Quote', "'", 'Quote');
define(KeyCode.IntlBackslash, 'IntlBackslash', 'IntlBackslash');

for (let i = 0; i <= 9; i++) {
  define(KeyCode.Numpad0 + i, `NumPad${i}`, `Numpad${i}`, null, `Numpad${i}`);
}
define(KeyCode.NumpadMultiply, 'NumPad_Multiply', 'NumpadMultiply', null, 'NumpadMultiply');
define(KeyCode.NumpadAdd, 'NumPad_Add', 'NumpadAdd', null, 'NumpadAdd');
define(KeyCode.NumpadSubtract, 'NumPad_Subtract', 'NumpadSubtract', null, 'NumpadSubtract');
define(KeyCode.NumpadDecimal, 'NumPad_Decimal', 'NumpadDecimal', null, 'NumpadDecimal');
define(KeyCode.NumpadDivide, 'NumPad_Divide', 'NumpadDivide', null, 'NumpadDivide');
define(KeyCode.NumpadEnter, 'NumPad_Enter', 'NumpadEnter', null, 'NumpadEnter');

export namespace KeyCodeUtils {
  /** Human-readable, parseable label for a key code (e.g. `"K"`, `"PageUp"`). */
  export function toString(keyCode: KeyCode): string {
    return maps.toString[keyCode] ?? 'unknown';
  }

  /** Reverse of {@link toString}. Case-insensitive; also accepts aliases such as `"Esc"`. */
  export function fromString(key: string): KeyCode {
    return maps.fromString.get(key.toLowerCase()) ?? KeyCode.Unknown;
  }

  /**
   * Resolve the key code for a live keyboard event. Prefers the physical
   * `event.code` (layout-independent, matching Monaco's behaviour of binding to
   * physical keys) and falls back to `event.key` for keyboards whose `code` is
   * unavailable or exotic.
   */
  export function fromKeyboardEvent(event: KeyboardEvent): KeyCode {
    const byCode = maps.fromEventCode.get(event.code);
    if (byCode !== undefined) {
      return byCode;
    }
    return maps.fromEventKey.get(event.key.toLowerCase()) ?? KeyCode.Unknown;
  }

  /** True for Shift/Ctrl/Alt/Meta — keys that never terminate a binding on their own. */
  export function isModifierKey(keyCode: KeyCode): boolean {
    return (
      keyCode === KeyCode.Shift ||
      keyCode === KeyCode.Ctrl ||
      keyCode === KeyCode.Alt ||
      keyCode === KeyCode.Meta
    );
  }
}

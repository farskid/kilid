/**
 * Layout-independent virtual key codes, modelled after Monaco's `KeyCode`.
 *
 * Values must fit in 8 bits (0..255) so a full keybinding (modifiers +
 * key code, or a two-part chord) can be packed into a single number.
 *
 * The table is generated at runtime from packed strings and tiny loops:
 * shipping data as data instead of a 108-member object literal cuts both
 * minified and gzipped size (the derived families — Key*, Digit*, F*,
 * Numpad* — need no shipped names at all). The static shape is preserved
 * through the {@link KeyCodeName} union, so `KeyCode.KeyS` still typechecks
 * and autocompletes. Member names deliberately match `KeyboardEvent.code`
 * values wherever possible so event resolution is a property lookup rather
 * than a shipped table.
 */

type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
// prettier-ignore
type Letter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';
// prettier-ignore
type FKey = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19;

// prettier-ignore
export type KeyCodeName =
  | 'Unknown' | 'Backspace' | 'Tab' | 'Enter' | 'Shift' | 'Ctrl' | 'Alt' | 'Meta'
  | 'PauseBreak' | 'CapsLock' | 'Escape' | 'Space' | 'PageUp' | 'PageDown' | 'End'
  | 'Home' | 'LeftArrow' | 'UpArrow' | 'RightArrow' | 'DownArrow' | 'Insert' | 'Delete'
  | `Digit${Digit}` | `Key${Letter}` | 'ContextMenu' | `F${FKey}`
  | 'NumLock' | 'ScrollLock' | 'Semicolon' | 'Equal' | 'Comma' | 'Minus' | 'Period'
  | 'Slash' | 'Backquote' | 'BracketLeft' | 'Backslash' | 'BracketRight' | 'Quote'
  | 'IntlBackslash' | `Numpad${Digit}`
  | 'NumpadMultiply' | 'NumpadAdd' | 'NumpadSubtract' | 'NumpadDecimal'
  | 'NumpadDivide' | 'NumpadEnter';

export type KeyCode = number;

const table: Record<string, number> = {};
let next = 0;
const defineRange = (names: string): void => {
  for (const name of names.split(' ')) {
    table[name] = next++;
  }
};

defineRange(
  'Unknown Backspace Tab Enter Shift Ctrl Alt Meta PauseBreak CapsLock Escape Space PageUp PageDown End Home LeftArrow UpArrow RightArrow DownArrow Insert Delete'
);
for (let i = 0; i <= 9; i++) table['Digit' + i] = next++;
for (let i = 0; i < 26; i++) table['Key' + String.fromCharCode(65 + i)] = next++;
table['ContextMenu'] = next++;
for (let i = 1; i <= 19; i++) table['F' + i] = next++;
defineRange(
  'NumLock ScrollLock Semicolon Equal Comma Minus Period Slash Backquote BracketLeft Backslash BracketRight Quote IntlBackslash'
);
for (let i = 0; i <= 9; i++) table['Numpad' + i] = next++;
defineRange('NumpadMultiply NumpadAdd NumpadSubtract NumpadDecimal NumpadDivide NumpadEnter');

export const KeyCode = table as Readonly<Record<KeyCodeName, number>>;

/** First key code past the defined range; useful for iteration/validation. */
export const KEY_CODE_MAX = next;

/**
 * Punctuation characters for key codes Semicolon..Quote, in value order.
 * Shared by event-key resolution and label formatting.
 */
export const PUNCTUATION_CHARS = ";=,-./`[\\]'";

/**
 * `KeyboardEvent.code` / `KeyboardEvent.key` values whose key code cannot be
 * found by direct member-name lookup on {@link KeyCode}. Packed as
 * `EventName=MemberName` pairs.
 */
const NAME_EXCEPTIONS: Record<string, number> = {};
for (const pair of 'ArrowLeft=LeftArrow ArrowUp=UpArrow ArrowRight=RightArrow ArrowDown=DownArrow ShiftLeft=Shift ShiftRight=Shift ControlLeft=Ctrl ControlRight=Ctrl Control=Ctrl AltLeft=Alt AltRight=Alt MetaLeft=Meta MetaRight=Meta Pause=PauseBreak'.split(
  ' '
)) {
  const eq = pair.indexOf('=');
  NAME_EXCEPTIONS[pair.slice(0, eq)] = table[pair.slice(eq + 1)]!;
}

function lookupName(name: string): number | undefined {
  const exception = NAME_EXCEPTIONS[name];
  if (exception !== undefined) {
    return exception;
  }
  // Member names match event codes (KeyA, Digit0, F1, Numpad5, Semicolon,
  // PageUp, ...) so this covers the vast majority with zero table data.
  if (name !== 'Unknown' && Object.prototype.hasOwnProperty.call(table, name)) {
    return table[name];
  }
  return undefined;
}

function fromKeyValue(key: string): number {
  if (key.length === 1) {
    const ch = key.charCodeAt(0);
    if (ch >= 97 && ch <= 122) return KeyCode.KeyA + ch - 97;
    if (ch >= 65 && ch <= 90) return KeyCode.KeyA + ch - 65;
    if (ch >= 48 && ch <= 57) return KeyCode.Digit0 + ch - 48;
    if (ch === 32) return KeyCode.Space;
    const punct = PUNCTUATION_CHARS.indexOf(key);
    if (punct >= 0) return KeyCode.Semicolon + punct;
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
export function keyCodeFromEvent(event: KeyboardEvent): number {
  return lookupName(event.code) ?? fromKeyValue(event.key);
}

/** True for Shift/Ctrl/Alt/Meta — keys that never terminate a binding on their own. */
export function isModifierKeyCode(keyCode: number): boolean {
  return keyCode >= KeyCode.Shift && keyCode <= KeyCode.Meta;
}

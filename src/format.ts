/**
 * String parsing and formatting for keybindings.
 *
 * This module is intentionally separate from the core: it is only bundled
 * when you import `parseKeybinding` / `formatKeybinding` (or the label
 * helpers). The lookup tables are built lazily on first use, so nothing here
 * runs at module load either.
 */
import { KeyCode, PUNCTUATION_CHARS } from './keyCodes.js';
import { KeyChord, KeyMod, decodeKeybinding, type ResolvedChord } from './keybindings.js';

let labelByCode: string[] | null = null;
let codeByLabel: Map<string, KeyCode> | null = null;

function labels(): string[] {
  if (labelByCode !== null) {
    return labelByCode;
  }
  const arr: string[] = [];
  for (const name in KeyCode) {
    const code = (KeyCode as Record<string, number>)[name]!;
    // 'KeyA' -> 'A', 'Digit0' -> '0'; everything else keeps its member name.
    arr[code] =
      name.length === 4 && name.startsWith('Key')
        ? name.slice(3)
        : name.length === 6 && name.startsWith('Digit')
          ? name.slice(5)
          : name;
  }
  for (let i = 0; i < PUNCTUATION_CHARS.length; i++) {
    arr[KeyCode.Semicolon + i] = PUNCTUATION_CHARS[i]!;
  }
  arr[KeyCode.Unknown] = 'unknown';
  labelByCode = arr;
  return arr;
}

const KEY_ALIASES: Record<string, KeyCode> = {
  esc: KeyCode.Escape,
  return: KeyCode.Enter,
  left: KeyCode.LeftArrow,
  up: KeyCode.UpArrow,
  right: KeyCode.RightArrow,
  down: KeyCode.DownArrow,
  plus: KeyCode.Equal,
  backtick: KeyCode.Backquote,
};

function labelMap(): Map<string, KeyCode> {
  if (codeByLabel !== null) {
    return codeByLabel;
  }
  const map = new Map<string, KeyCode>();
  const arr = labels();
  // Member names first ('semicolon', 'pageup', ...), then display labels
  // (';', 'A', ...), then aliases.
  for (const name in KeyCode) {
    map.set(name.toLowerCase(), (KeyCode as Record<string, KeyCode>)[name]!);
  }
  for (let code = 1; code < arr.length; code++) {
    const label = arr[code];
    if (label !== undefined && !map.has(label.toLowerCase())) {
      map.set(label.toLowerCase(), code as KeyCode);
    }
  }
  for (const alias in KEY_ALIASES) {
    map.set(alias, KEY_ALIASES[alias]!);
  }
  codeByLabel = map;
  return map;
}

/** Human-readable, parseable label for a key code (e.g. `"K"`, `"PageUp"`). */
export function keyCodeToString(keyCode: KeyCode): string {
  return labels()[keyCode] ?? 'unknown';
}

/** Reverse of {@link keyCodeToString}. Case-insensitive; also accepts aliases such as `"Esc"`. */
export function keyCodeFromString(key: string): KeyCode {
  return labelMap().get(key.toLowerCase()) ?? KeyCode.Unknown;
}

const MOD_PARSE: Record<string, number> = {
  ctrl: KeyMod.CtrlCmd,
  control: KeyMod.CtrlCmd,
  ctrlcmd: KeyMod.CtrlCmd,
  mod: KeyMod.CtrlCmd,
  cmd: KeyMod.CtrlCmd,
  command: KeyMod.CtrlCmd,
  meta: KeyMod.CtrlCmd,
  shift: KeyMod.Shift,
  alt: KeyMod.Alt,
  option: KeyMod.Alt,
  opt: KeyMod.Alt,
  winctrl: KeyMod.WinCtrl,
  win: KeyMod.WinCtrl,
  super: KeyMod.WinCtrl,
};

function parsePart(part: string): number {
  let mods = 0;
  const pieces = part.split('+');
  const last = pieces[pieces.length - 1];
  if (last === undefined || last.length === 0) {
    throw new Error(`Invalid keybinding part: "${part}"`);
  }
  for (let i = 0; i < pieces.length - 1; i++) {
    const mod = MOD_PARSE[pieces[i]!.trim().toLowerCase()];
    if (mod === undefined) {
      throw new Error(`Unknown modifier "${pieces[i]}" in keybinding part "${part}"`);
    }
    mods |= mod;
  }
  const keyCode = keyCodeFromString(last.trim());
  if (keyCode === KeyCode.Unknown) {
    throw new Error(`Unknown key "${last}" in keybinding part "${part}"`);
  }
  return mods | keyCode;
}

/**
 * Parse a human-readable keybinding such as `"Ctrl+K Ctrl+S"`,
 * `"CtrlCmd+Shift+P"` or `"Alt+F4"` into its binary encoding.
 *
 * `Ctrl`, `Cmd`, `Meta` and `Mod` all map to {@link KeyMod.CtrlCmd} so a
 * single string works across platforms; use `WinCtrl`/`Super` for the
 * secondary platform modifier.
 */
export function parseKeybinding(keybinding: string): number {
  const parts = keybinding.trim().split(/\s+/);
  if (parts.length === 0 || parts.length > 2 || parts[0] === undefined || parts[0] === '') {
    throw new Error(`Invalid keybinding: "${keybinding}" (expected 1 or 2 chord parts)`);
  }
  const first = parsePart(parts[0]);
  if (parts.length === 2 && parts[1] !== undefined) {
    return KeyChord(first, parsePart(parts[1]));
  }
  return first;
}

export interface FormatOptions {
  /** Use macOS symbols/labels (`⌘`, `⇧`, `⌥`, `⌃`). Defaults to `false`. */
  readonly isMac?: boolean;
}

function formatResolvedPart(chord: ResolvedChord, isMac: boolean): string {
  const result: string[] = [];
  if (isMac) {
    if (chord.ctrlKey) result.push('⌃');
    if (chord.altKey) result.push('⌥');
    if (chord.shiftKey) result.push('⇧');
    if (chord.metaKey) result.push('⌘');
    result.push(keyCodeToString(chord.keyCode));
    return result.join('');
  }
  if (chord.ctrlKey) result.push('Ctrl');
  if (chord.shiftKey) result.push('Shift');
  if (chord.altKey) result.push('Alt');
  if (chord.metaKey) result.push('Win');
  result.push(keyCodeToString(chord.keyCode));
  return result.join('+');
}

/**
 * Render an encoded keybinding as a user-facing label, e.g.
 * `"Ctrl+K Ctrl+S"` or `"⌘K ⌘S"` on macOS.
 */
export function formatKeybinding(keybinding: number, options: FormatOptions = {}): string {
  const isMac = options.isMac ?? false;
  const parts = decodeKeybinding(keybinding, isMac);
  if (parts === null) {
    return '';
  }
  return parts.map((part) => formatResolvedPart(part, isMac)).join(' ');
}

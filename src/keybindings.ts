import { KeyCode, KeyCodeUtils } from './keyCodes.js';

/**
 * Binary encoding of a single keybinding part, identical to Monaco's layout:
 *
 * ```
 * 15 14 13 12 11 10  9  8  7 .. 0
 *  -  -  C  S  A  W  key code
 * ```
 *
 * A two-part chord packs the second part into bits 16..31.
 */
const enum BinaryKeybindingsMask {
  CtrlCmd = (1 << 11) >>> 0,
  Shift = (1 << 10) >>> 0,
  Alt = (1 << 9) >>> 0,
  WinCtrl = (1 << 8) >>> 0,
  KeyCode = 0x000000ff,
}

/**
 * Modifier flags to be OR-ed with a {@link KeyCode}, e.g.
 * `KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyP`.
 */
export const KeyMod = {
  /** `Cmd` on macOS, `Ctrl` on Windows/Linux. */
  CtrlCmd: BinaryKeybindingsMask.CtrlCmd as number,
  Shift: BinaryKeybindingsMask.Shift as number,
  /** `Option` on macOS, `Alt` on Windows/Linux. */
  Alt: BinaryKeybindingsMask.Alt as number,
  /** `Ctrl` on macOS, `Win`/`Meta` on Windows/Linux. */
  WinCtrl: BinaryKeybindingsMask.WinCtrl as number,
} as const;

/**
 * Combine two keybinding parts into a chord, e.g.
 * `KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyS)`
 * for `Ctrl+K Ctrl+S`.
 */
export function KeyChord(firstPart: number, secondPart: number): number {
  const chordPart = ((secondPart & 0x0000ffff) << 16) >>> 0;
  return (firstPart | chordPart) >>> 0;
}

/** A keybinding part with modifiers resolved against a concrete platform. */
export interface ResolvedChord {
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
  readonly keyCode: KeyCode;
}

function decodePart(part: number, isMac: boolean): ResolvedChord {
  const ctrlCmd = (part & BinaryKeybindingsMask.CtrlCmd) !== 0;
  const winCtrl = (part & BinaryKeybindingsMask.WinCtrl) !== 0;
  return {
    ctrlKey: isMac ? winCtrl : ctrlCmd,
    metaKey: isMac ? ctrlCmd : winCtrl,
    shiftKey: (part & BinaryKeybindingsMask.Shift) !== 0,
    altKey: (part & BinaryKeybindingsMask.Alt) !== 0,
    keyCode: (part & BinaryKeybindingsMask.KeyCode) as KeyCode,
  };
}

/**
 * Decode an encoded keybinding into 1 or 2 platform-resolved chord parts.
 * Returns `null` for `0` / bindings without a key code in the first part.
 */
export function decodeKeybinding(keybinding: number, isMac: boolean): ResolvedChord[] | null {
  if (keybinding === 0) {
    return null;
  }
  const firstPart = (keybinding & 0x0000ffff) >>> 0;
  const secondPart = (keybinding & 0xffff0000) >>> 16;
  const first = decodePart(firstPart, isMac);
  if (first.keyCode === KeyCode.Unknown) {
    return null;
  }
  if (secondPart !== 0) {
    return [first, decodePart(secondPart, isMac)];
  }
  return [first];
}

/**
 * A canonical, platform-independent string for a resolved chord, used as a
 * lookup key when matching events against registered bindings.
 */
export function chordHashFromParts(
  ctrlKey: boolean,
  shiftKey: boolean,
  altKey: boolean,
  metaKey: boolean,
  keyCode: number
): number {
  return (
    (ctrlKey ? 1 : 0) |
    ((shiftKey ? 1 : 0) << 1) |
    ((altKey ? 1 : 0) << 2) |
    ((metaKey ? 1 : 0) << 3) |
    (keyCode << 4)
  );
}

export function chordHash(chord: ResolvedChord): number {
  return chordHashFromParts(chord.ctrlKey, chord.shiftKey, chord.altKey, chord.metaKey, chord.keyCode);
}

const MOD_PARSE: Record<string, keyof typeof KeyMod> = {
  ctrl: 'CtrlCmd',
  control: 'CtrlCmd',
  ctrlcmd: 'CtrlCmd',
  mod: 'CtrlCmd',
  cmd: 'CtrlCmd',
  command: 'CtrlCmd',
  meta: 'CtrlCmd',
  shift: 'Shift',
  alt: 'Alt',
  option: 'Alt',
  opt: 'Alt',
  winctrl: 'WinCtrl',
  win: 'WinCtrl',
  super: 'WinCtrl',
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
    mods |= KeyMod[mod];
  }
  const keyCode = KeyCodeUtils.fromString(last.trim());
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
    result.push(KeyCodeUtils.toString(chord.keyCode));
    return result.join('');
  }
  if (chord.ctrlKey) result.push('Ctrl');
  if (chord.shiftKey) result.push('Shift');
  if (chord.altKey) result.push('Alt');
  if (chord.metaKey) result.push('Win');
  result.push(KeyCodeUtils.toString(chord.keyCode));
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

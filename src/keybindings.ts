import { KeyCode } from './keyCodes.js';

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

/** True when `encoding` packs a second chord part in bits 16–31. */
export function isKeyChordEncoding(encoding: number): boolean {
  return (encoding & 0xffff0000) !== 0;
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
 * Decode a single keybinding part with platform-resolved modifiers, allowing
 * a zero key code (modifier-only encodings, used by pointer move bindings).
 */
export function decodeKeybindingPart(part: number, isMac: boolean): ResolvedChord {
  return decodePart(part & 0x0000ffff, isMac);
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
 * A canonical integer for a resolved chord, used as the lookup key when
 * matching events against registered bindings.
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

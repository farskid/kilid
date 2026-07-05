import type { KeybindingHandler } from '../keyboard.js';
import { chordServices } from './chordServiceCache.js';
import { useKeyboardBinding } from './useKeyboardBinding.js';
import type { UseKeybindingOptions } from './shared.js';

/**
 * Register a keybinding with the chord-capable `chordKeybindings` dispatcher.
 * Handles both single-part bindings and two-part chords (`KeyChord(...)`).
 *
 * ```tsx
 * useChordKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS, save);
 * useChordKeybinding(
 *   KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyS),
 *   openShortcuts
 * );
 * ```
 */
export function useChordKeybinding(
  binding: number,
  handler: KeybindingHandler,
  options: UseKeybindingOptions = {}
): void {
  useKeyboardBinding(binding, handler, options, chordServices);
}

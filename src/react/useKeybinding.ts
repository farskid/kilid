import type { KeybindingHandler } from '../keyboard.js';
import { keyboardServices } from './keyboardServiceCache.js';
import { useKeyboardBinding } from './useKeyboardBinding.js';
import type { UseKeybindingOptions } from './shared.js';

/**
 * Register a single-part keybinding with the lean `keybindings` dispatcher, e.g.
 *
 * ```tsx
 * useKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS, save);
 * useKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS, save, { capture: true });
 * ```
 *
 * For two-part chords use {@link useChordKeybinding}. For string bindings use
 * {@link useParsedKeybinding} (pulls in the parser module).
 */
export function useKeybinding(
  binding: number,
  handler: KeybindingHandler,
  options: UseKeybindingOptions = {}
): void {
  useKeyboardBinding(binding, handler, options, keyboardServices);
}

import { parseKeybinding } from '../format.js';
import { isKeyChordEncoding } from '../keybindings.js';
import type { KeybindingHandler } from '../keyboard.js';
import { chordServices } from './chordServiceCache.js';
import { keyboardServices } from './keyboardServiceCache.js';
import { useKeyboardBinding } from './useKeyboardBinding.js';
import type { UseKeybindingOptions } from './shared.js';

/**
 * Register a string keybinding — pulls in `parseKeybinding` and routes to
 * `keybindings` or `chordKeybindings` based on the parsed encoding.
 *
 * ```tsx
 * useParsedKeybinding('Ctrl+Shift+P', quickOpen);
 * useParsedKeybinding('Ctrl+K Ctrl+S', openShortcuts);
 * ```
 */
export function useParsedKeybinding(
  binding: string,
  handler: KeybindingHandler,
  options: UseKeybindingOptions = {}
): void {
  const encoded = parseKeybinding(binding);
  useKeyboardBinding(
    encoded,
    handler,
    options,
    isKeyChordEncoding(encoded) ? chordServices : keyboardServices
  );
}

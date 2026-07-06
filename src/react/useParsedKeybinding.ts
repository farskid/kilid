import { parseKeybinding } from '../format.js';
import { isKeyChordEncoding } from '../keybindings.js';
import { chordServices, keyboardServices } from '../adapter/keyboardServiceCache.js';
import type { KeybindingHandler } from '../keyboard.js';
import { useKeyboardBinding } from './useKeyboardBinding.js';
import type { UseKeybindingOptions } from './shared.js';

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

import { keyboardServices } from '../adapter/keyboardServiceCache.js';
import type { KeybindingHandler } from '../keyboard.js';
import { useKeyboardBinding } from './useKeyboardBinding.js';
import type { UseKeybindingOptions } from './shared.js';

export function useKeybinding(
  binding: number,
  handler: KeybindingHandler,
  options: UseKeybindingOptions = {}
): void {
  useKeyboardBinding(binding, handler, options, keyboardServices);
}

import { chordServices } from '../adapter/keyboardServiceCache.js';
import type { KeybindingHandler } from '../keyboard.js';
import { useKeyboardBinding } from './useKeyboardBinding.js';
import type { UseKeybindingOptions } from './shared.js';

export function useChordKeybinding(
  binding: number,
  handler: KeybindingHandler,
  options: UseKeybindingOptions = {}
): void {
  useKeyboardBinding(binding, handler, options, chordServices);
}

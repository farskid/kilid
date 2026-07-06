import type { KeybindingHandler } from '../keyboard.js';
import { keyboardServices } from '../adapter/keyboardServiceCache.js';
import { subscribeKeybinding } from '../adapter/subscribeKeybinding.js';
import { keyboardServiceOptions, type KeyboardHookOptions } from '../adapter/options.js';

/** Imperative binding for Angular services / `afterNextRender`. Returns cleanup. */
export function bindKeybinding(
  target: EventTarget,
  binding: number,
  handler: KeybindingHandler,
  options: KeyboardHookOptions = {}
): () => void {
  if (!(options.enabled ?? true)) return () => {};
  return subscribeKeybinding(
    binding,
    () => handler,
    () => options.when,
    target,
    keyboardServiceOptions(options),
    { preventDefault: options.preventDefault, stopPropagation: options.stopPropagation },
    keyboardServices
  );
}

import type { KeybindingHandler } from '../keyboard.js';
import { keyboardServices, chordServices } from '../adapter/keyboardServiceCache.js';
import { subscribeKeybinding } from '../adapter/subscribeKeybinding.js';
import { keyboardServiceOptions, type KeyboardHookOptions } from '../adapter/options.js';
import { resolveAdapterTarget } from '../adapter/resolveTarget.js';
import { isKeyChordEncoding } from '../keybindings.js';
import { parseKeybinding } from '../format.js';

/**
 * Register a keybinding and return an unsubscribe function.
 * Wrap in Svelte 5 `$effect` for automatic lifecycle:
 *
 * ```svelte
 * <script>
 *   import { KeyMod, KeyCode } from '@farskid/kilid';
 *   import { bindKeybinding } from '@farskid/kilid/svelte';
 *   $effect(() => bindKeybinding(undefined, KeyMod.CtrlCmd | KeyCode.KeyS, save));
 * </script>
 * ```
 */
export function bindKeybinding(
  target: EventTarget | null | undefined,
  binding: number,
  handler: KeybindingHandler,
  options: KeyboardHookOptions = {}
): () => void {
  if (!(options.enabled ?? true)) {
    return () => {};
  }
  const el = target ?? resolveAdapterTarget(options.target);
  if (el === null) {
    return () => {};
  }
  return subscribeKeybinding(
    binding,
    () => handler,
    () => options.when,
    el,
    keyboardServiceOptions(options),
    { preventDefault: options.preventDefault, stopPropagation: options.stopPropagation },
    keyboardServices
  );
}

export function bindChordKeybinding(
  target: EventTarget | null | undefined,
  binding: number,
  handler: KeybindingHandler,
  options: KeyboardHookOptions = {}
): () => void {
  if (!(options.enabled ?? true)) return () => {};
  const el = target ?? resolveAdapterTarget(options.target);
  if (el === null) return () => {};
  return subscribeKeybinding(
    binding,
    () => handler,
    () => options.when,
    el,
    keyboardServiceOptions(options),
    { preventDefault: options.preventDefault, stopPropagation: options.stopPropagation },
    chordServices
  );
}

export function bindParsedKeybinding(
  target: EventTarget | null | undefined,
  binding: string,
  handler: KeybindingHandler,
  options: KeyboardHookOptions = {}
): () => void {
  const encoded = parseKeybinding(binding);
  const services = isKeyChordEncoding(encoded) ? chordServices : keyboardServices;
  if (!(options.enabled ?? true)) return () => {};
  const el = target ?? resolveAdapterTarget(options.target);
  if (el === null) return () => {};
  return subscribeKeybinding(
    encoded,
    () => handler,
    () => options.when,
    el,
    keyboardServiceOptions(options),
    { preventDefault: options.preventDefault, stopPropagation: options.stopPropagation },
    services
  );
}

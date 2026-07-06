import { watch, toValue, isRef, type MaybeRefOrGetter } from 'vue';
import type { KeybindingHandler } from '../keyboard.js';
import { keyboardServices, chordServices } from '../adapter/keyboardServiceCache.js';
import { subscribeKeybinding } from '../adapter/subscribeKeybinding.js';
import {
  keyboardServiceOptions,
  type KeyboardHookOptions,
} from '../adapter/options.js';
import { resolveVueTarget } from './resolveTarget.js';
import { isKeyChordEncoding } from '../keybindings.js';
import { parseKeybinding } from '../format.js';

function latestHandler(handler: KeybindingHandler | MaybeRefOrGetter<KeybindingHandler>): () => KeybindingHandler {
  if (isRef(handler)) {
    return () => handler.value;
  }
  let current = handler as KeybindingHandler;
  watch(
    () => (isRef(handler) ? handler.value : handler) as KeybindingHandler,
    (h) => {
      current = h;
    },
    { flush: 'sync' }
  );
  return () => current;
}

function useKeyboardBinding(
  binding: MaybeRefOrGetter<number>,
  getHandler: () => KeybindingHandler,
  options: KeyboardHookOptions,
  services: typeof keyboardServices
): void {
  watch(
    () =>
      [
        toValue(binding),
        options.enabled ?? true,
        options.preventDefault,
        options.stopPropagation,
        options.capture,
        options.isMac,
        options.chordTimeout,
        resolveVueTarget(options.target),
      ] as const,
    (_, __, onCleanup) => {
      if (!(options.enabled ?? true)) {
        return;
      }
      const target = resolveVueTarget(options.target);
      if (target === null) {
        return;
      }
      onCleanup(
        subscribeKeybinding(
          toValue(binding),
          getHandler,
          () => options.when,
          target,
          keyboardServiceOptions(options),
          { preventDefault: options.preventDefault, stopPropagation: options.stopPropagation },
          services
        )
      );
    },
    { flush: 'post', immediate: true }
  );
}

export function useKeybinding(
  binding: MaybeRefOrGetter<number>,
  handler: KeybindingHandler | MaybeRefOrGetter<KeybindingHandler>,
  options: KeyboardHookOptions = {}
): void {
  useKeyboardBinding(binding, latestHandler(handler), options, keyboardServices);
}

export function useChordKeybinding(
  binding: MaybeRefOrGetter<number>,
  handler: KeybindingHandler | MaybeRefOrGetter<KeybindingHandler>,
  options: KeyboardHookOptions = {}
): void {
  useKeyboardBinding(binding, latestHandler(handler), options, chordServices);
}

export function useParsedKeybinding(
  binding: MaybeRefOrGetter<string>,
  handler: KeybindingHandler | MaybeRefOrGetter<KeybindingHandler>,
  options: KeyboardHookOptions = {}
): void {
  const encoded = () => parseKeybinding(toValue(binding));
  const getHandler = latestHandler(handler);
  watch(
    () => [encoded(), options.enabled ?? true, options.capture, options.isMac, options.chordTimeout, resolveVueTarget(options.target)] as const,
    (_, __, onCleanup) => {
      if (!(options.enabled ?? true)) return;
      const target = resolveVueTarget(options.target);
      if (target === null) return;
      const enc = encoded();
      const services = isKeyChordEncoding(enc) ? chordServices : keyboardServices;
      onCleanup(
        subscribeKeybinding(
          enc,
          getHandler,
          () => options.when,
          target,
          keyboardServiceOptions(options),
          { preventDefault: options.preventDefault, stopPropagation: options.stopPropagation },
          services
        )
      );
    },
    { flush: 'post', immediate: true }
  );
}

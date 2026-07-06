import { useEffect } from 'react';
import type { KeyboardAdapterServiceOptions } from '../adapter-contract.js';
import type { KeybindingHandler, Keybindings } from '../keyboard.js';
import {
  keyboardServiceOptions,
  useLatestRef,
  resolveTarget,
  type UseKeybindingOptions,
} from './shared.js';
import type { ServiceCache } from '../adapter/serviceCache.js';
import { subscribeKeybinding } from '../adapter/subscribeKeybinding.js';

export function useKeyboardBinding(
  encoded: number,
  handler: KeybindingHandler,
  options: UseKeybindingOptions,
  services: ServiceCache<Keybindings, KeyboardAdapterServiceOptions>
): void {
  const handlerRef = useLatestRef(handler);
  const whenRef = useLatestRef(options.when);

  const { enabled = true, preventDefault, stopPropagation, capture, isMac, chordTimeout } =
    options;
  const targetRef = useLatestRef(options.target);
  const serviceOpts = keyboardServiceOptions(options);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const target = resolveTarget(targetRef.current);
    if (target === null) {
      return;
    }
    return subscribeKeybinding(
      encoded,
      () => handlerRef.current,
      () => whenRef.current,
      target,
      serviceOpts,
      { preventDefault, stopPropagation },
      services
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    encoded,
    enabled,
    preventDefault,
    stopPropagation,
    capture,
    isMac,
    chordTimeout,
    resolveTarget(options.target),
  ]);
}

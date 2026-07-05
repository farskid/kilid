import { useEffect } from 'react';
import type { KeyboardAdapterServiceOptions } from '../adapter-contract.js';
import type { KeybindingHandler, Keybindings } from '../keyboard.js';
import {
  keyboardServiceOptions,
  resolveTarget,
  useLatestRef,
  type UseKeybindingOptions,
} from './shared.js';
import type { ServiceCache } from './serviceCache.js';

/** Shared hook body — callers supply the service cache (keybindings vs chords). */
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
    const service = services.acquire(target, serviceOpts);
    const off = service.add(encoded, (e) => handlerRef.current(e), {
      when: () => whenRef.current === undefined || whenRef.current(),
      preventDefault,
      stopPropagation,
    });
    return () => {
      off();
      services.release(target, serviceOpts);
    };
    // targetRef/handlerRef/whenRef are stable ref objects.
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

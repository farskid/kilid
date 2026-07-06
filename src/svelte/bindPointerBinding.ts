import { pointerServices } from '../adapter/pointerServiceCache.js';
import { subscribePointerBinding } from '../adapter/subscribePointerBinding.js';
import {
  pointerServiceOptions,
  pointerTypeKey,
  type PointerHookOptions,
} from '../adapter/options.js';
import { resolveAdapterTarget } from '../adapter/resolveTarget.js';
import type { PointerBindingHandler, PointerEventKind } from '../pointer.js';

/** Register a pointer binding; return cleanup. Use inside `$effect` in Svelte 5. */
export function bindPointerBinding<K extends PointerEventKind>(
  target: EventTarget | null | undefined,
  binding: number,
  kind: K,
  handler: PointerBindingHandler<K>,
  options: PointerHookOptions = {}
): () => void {
  if (!(options.enabled ?? true)) return () => {};
  const el = target ?? resolveAdapterTarget(options.target);
  if (el === null) return () => {};
  const key = pointerTypeKey(options.pointerType);
  return subscribePointerBinding(
    binding,
    kind,
    () => handler,
    () => options.when,
    el,
    pointerServiceOptions(options),
    {
      preventDefault: options.preventDefault,
      stopPropagation: options.stopPropagation,
      pointerType: key === '' ? undefined : (key.split(',') as import('../pointer.js').PointerType[]),
    },
    pointerServices
  );
}

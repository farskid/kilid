import type { PointerBindingHandler, PointerEventKind, PointerType } from '../pointer.js';
import { pointerServices } from '../adapter/pointerServiceCache.js';
import { subscribePointerBinding } from '../adapter/subscribePointerBinding.js';
import {
  pointerServiceOptions,
  pointerTypeKey,
  type PointerHookOptions,
} from '../adapter/options.js';

export function bindPointerBinding<K extends PointerEventKind>(
  target: EventTarget,
  binding: number,
  kind: K,
  handler: PointerBindingHandler<K>,
  options: PointerHookOptions = {}
): () => void {
  if (!(options.enabled ?? true)) return () => {};
  const key = pointerTypeKey(options.pointerType);
  return subscribePointerBinding(
    binding,
    kind,
    () => handler,
    () => options.when,
    target,
    pointerServiceOptions(options),
    {
      preventDefault: options.preventDefault,
      stopPropagation: options.stopPropagation,
      pointerType: key === '' ? undefined : (key.split(',') as PointerType[]),
    },
    pointerServices
  );
}

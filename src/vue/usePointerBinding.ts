import { watch, toValue, isRef, type MaybeRefOrGetter } from 'vue';
import { pointerServices } from '../adapter/pointerServiceCache.js';
import { subscribePointerBinding } from '../adapter/subscribePointerBinding.js';
import {
  pointerServiceOptions,
  pointerTypeKey,
  type PointerHookOptions,
} from '../adapter/options.js';
import { resolveVueTarget } from './resolveTarget.js';
import type { PointerBindingHandler, PointerEventKind } from '../pointer.js';

function latestHandler<K extends PointerEventKind>(
  handler: PointerBindingHandler<K> | MaybeRefOrGetter<PointerBindingHandler<K>>
): () => PointerBindingHandler<K> {
  if (isRef(handler)) {
    return () => handler.value;
  }
  let current = handler as PointerBindingHandler<K>;
  watch(
    () => (isRef(handler) ? handler.value : handler) as PointerBindingHandler<K>,
    (h) => {
      current = h;
    },
    { flush: 'sync' }
  );
  return () => current;
}

export function usePointerBinding<K extends PointerEventKind>(
  binding: MaybeRefOrGetter<number>,
  kind: K,
  handler: PointerBindingHandler<K> | MaybeRefOrGetter<PointerBindingHandler<K>>,
  options: PointerHookOptions = {}
): void {
  const getHandler = latestHandler(handler);
  const ptKey = () => pointerTypeKey(options.pointerType);

  watch(
    () =>
      [
        toValue(binding),
        kind,
        options.enabled ?? true,
        options.preventDefault,
        options.stopPropagation,
        options.capture,
        options.isMac,
        ptKey(),
        resolveVueTarget(options.target),
      ] as const,
    (_, __, onCleanup) => {
      if (!(options.enabled ?? true)) return;
      const target = resolveVueTarget(options.target);
      if (target === null) return;
      const key = ptKey();
      onCleanup(
        subscribePointerBinding(
          toValue(binding),
          kind,
          getHandler,
          () => options.when,
          target,
          pointerServiceOptions(options),
          {
            preventDefault: options.preventDefault,
            stopPropagation: options.stopPropagation,
            pointerType: key === '' ? undefined : (key.split(',') as import('../pointer.js').PointerType[]),
          },
          pointerServices
        )
      );
    },
    { flush: 'post', immediate: true }
  );
}

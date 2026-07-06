import { useEffect } from 'react';
import { pointerServices } from '../adapter/pointerServiceCache.js';
import { pointerServiceOptions, pointerTypeKey } from '../adapter/options.js';
import { subscribePointerBinding } from '../adapter/subscribePointerBinding.js';
import type { PointerBindingHandler, PointerEventKind } from '../pointer.js';
import { resolveTarget, useLatestRef, type UsePointerBindingOptions } from './shared.js';

export function usePointerBinding<K extends PointerEventKind>(
  binding: number,
  kind: K,
  handler: PointerBindingHandler<K>,
  options: UsePointerBindingOptions = {}
): void {
  const handlerRef = useLatestRef(handler);
  const whenRef = useLatestRef(options.when);
  const { enabled = true, preventDefault, stopPropagation, capture, isMac } = options;
  const targetRef = useLatestRef(options.target);
  const serviceOpts = pointerServiceOptions(options);
  const ptKey = pointerTypeKey(options.pointerType);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const target = resolveTarget(targetRef.current);
    if (target === null) {
      return;
    }
    return subscribePointerBinding(
      binding,
      kind,
      () => handlerRef.current,
      () => whenRef.current,
      target,
      serviceOpts,
      {
        preventDefault,
        stopPropagation,
        pointerType: ptKey === '' ? undefined : (ptKey.split(',') as import('../pointer.js').PointerType[]),
      },
      pointerServices
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    binding,
    kind,
    enabled,
    preventDefault,
    stopPropagation,
    capture,
    isMac,
    ptKey,
    resolveTarget(options.target),
  ]);
}

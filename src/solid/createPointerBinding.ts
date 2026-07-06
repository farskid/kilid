import { createEffect, onCleanup, type Accessor } from 'solid-js';
import { pointerServices } from '../adapter/pointerServiceCache.js';
import { subscribePointerBinding } from '../adapter/subscribePointerBinding.js';
import {
  pointerServiceOptions,
  pointerTypeKey,
  type PointerHookOptions,
} from '../adapter/options.js';
import { resolveAdapterTarget } from '../adapter/resolveTarget.js';
import type { PointerBindingHandler, PointerEventKind } from '../pointer.js';

export function createPointerBinding<K extends PointerEventKind>(
  binding: Accessor<number> | number,
  kind: K,
  handler: Accessor<PointerBindingHandler<K>>,
  options: PointerHookOptions = {}
): void {
  const getBinding = typeof binding === 'function' ? binding : () => binding;
  const ptKey = () => pointerTypeKey(options.pointerType);

  createEffect(() => {
    if (!(options.enabled ?? true)) return;
    const target = resolveAdapterTarget(options.target);
    if (target === null) return;
    const key = ptKey();
    onCleanup(
      subscribePointerBinding(
        getBinding(),
        kind,
        handler,
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
  });
}

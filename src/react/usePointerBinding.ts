import { useEffect } from 'react';
import type { PointerBindingHandler, PointerEventKind, PointerType } from '../pointer.js';
import { pointerServices } from './pointerServiceCache.js';
import {
  pointerServiceOptions,
  resolveTarget,
  useLatestRef,
  type UsePointerBindingOptions,
} from './shared.js';

/**
 * Register a pointer/mouse binding, e.g.
 *
 * ```tsx
 * usePointerBinding(KeyMod.CtrlCmd | MouseButton.Left, 'click', addToSelection, {
 *   target: listRef,
 * });
 * usePointerBinding(MouseButton.Left, 'move', onDraw, {
 *   target: canvasRef,
 *   pointerType: ['pen', 'touch'],
 *   capture: true,
 * });
 * ```
 */
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
  // Pointer types are a tiny list; serialize to a primitive dep so callers
  // can pass inline arrays without re-registering every render.
  const pointerTypeKey =
    options.pointerType === undefined
      ? ''
      : typeof options.pointerType === 'string'
        ? options.pointerType
        : [...options.pointerType].sort().join(',');

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const target = resolveTarget(targetRef.current);
    if (target === null) {
      return;
    }
    const service = pointerServices.acquire(target, serviceOpts);
    const off = service.add(binding, kind, ((e) => handlerRef.current(e)) as PointerBindingHandler<K>, {
      when: () => whenRef.current === undefined || whenRef.current(),
      preventDefault,
      stopPropagation,
      pointerType: pointerTypeKey === '' ? undefined : (pointerTypeKey.split(',') as PointerType[]),
    });
    return () => {
      off();
      pointerServices.release(target, serviceOpts);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    binding,
    kind,
    enabled,
    preventDefault,
    stopPropagation,
    capture,
    isMac,
    pointerTypeKey,
    resolveTarget(options.target),
  ]);
}

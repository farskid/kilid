import { useEffect } from 'react';
import { pointerServices } from '../adapter/pointerServiceCache.js';
import { pointerServiceOptions, pointerTypeKey } from '../adapter/options.js';
import { subscribePointerBinding } from '../adapter/subscribePointerBinding.js';
import type {
  PointerBindingHandler,
  PointerButtonlessKind,
  PointerEventKind,
  PointerType,
} from '../pointer.js';
import { resolveTarget, useLatestRef, type UsePointerBindingOptions } from './shared.js';

/**
 * Register a pointer/mouse binding, e.g.
 *
 * ```tsx
 * usePointerBinding(KeyMod.CtrlCmd | MouseButton.Left, 'click', addToSelection, {
 *   target: listRef,
 * });
 * // Buttonless kinds need no binding:
 * usePointerBinding('move', onDraw, {
 *   target: canvasRef,
 *   pointerType: ['pen', 'touch'],
 * });
 * // Or modifier-only — move while Alt is held:
 * usePointerBinding(KeyMod.Alt, 'move', onAltDraw, { target: canvasRef });
 * ```
 */
export function usePointerBinding<K extends PointerButtonlessKind>(
  kind: K,
  handler: PointerBindingHandler<K>,
  options?: UsePointerBindingOptions
): void;
export function usePointerBinding<K extends PointerEventKind>(
  binding: number,
  kind: K,
  handler: PointerBindingHandler<K>,
  options?: UsePointerBindingOptions
): void;
export function usePointerBinding<K extends PointerEventKind>(
  bindingOrKind: number | PointerButtonlessKind,
  kindOrHandler: K | PointerBindingHandler<K>,
  handlerOrOptions?: PointerBindingHandler<K> | UsePointerBindingOptions,
  maybeOptions?: UsePointerBindingOptions
): void {
  const buttonless = typeof bindingOrKind === 'string';
  const binding = buttonless ? 0 : bindingOrKind;
  const kind = (buttonless ? bindingOrKind : kindOrHandler) as K;
  const handler = (buttonless ? kindOrHandler : handlerOrOptions) as PointerBindingHandler<K>;
  const options =
    (buttonless ? (handlerOrOptions as UsePointerBindingOptions | undefined) : maybeOptions) ?? {};

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
        pointerType: ptKey === '' ? undefined : (ptKey.split(',') as PointerType[]),
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

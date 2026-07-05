/**
 * React adapter for kilid.
 *
 * Import from `kilid/react` — this entry is built separately and is never
 * included in your bundle unless you import it.
 *
 * Performance design:
 * - Handler and `when` guard live in refs (latest-ref pattern), so changing
 *   them re-registers nothing: no listener churn, no binding Map mutation,
 *   zero work per render.
 * - Bindings only re-register when something structural changes: the encoded
 *   binding, the target, event kind, or dispatch flags.
 * - All hooks bound to the same EventTarget share one refcounted service
 *   (one DOM listener per event type across the whole app).
 */
import { useEffect, useRef, type RefObject } from 'react';
import type {
  AdapterBindingTarget,
  KeyboardAdapterServiceOptions,
  PointerAdapterServiceOptions,
} from '../adapter-contract.js';
import { parseKeybinding } from '../format.js';
import type { KeybindingHandler } from '../keyboard.js';
import type { PointerBindingHandler, PointerEventKind, PointerType } from '../pointer.js';
import { keyboardServices, pointerServices } from './serviceCache.js';

export type BindingTarget = AdapterBindingTarget;

interface CommonHookOptions {
  /**
   * Where to listen. An EventTarget (e.g. `window`) or a React ref to one.
   * Defaults to `window`. Pass `null`/a ref holding `null` to disable.
   */
  readonly target?: BindingTarget;
  /** Dynamic guard; read from a ref at dispatch, so changing it is free. */
  readonly when?: (() => boolean) | undefined;
  /** Disable the binding entirely (unregisters it). Defaults to `true`. */
  readonly enabled?: boolean | undefined;
  readonly preventDefault?: boolean | undefined;
  readonly stopPropagation?: boolean | undefined;
}

export interface UseKeybindingOptions extends CommonHookOptions, KeyboardAdapterServiceOptions {}

export interface UsePointerBindingOptions extends CommonHookOptions, PointerAdapterServiceOptions {
  readonly pointerType?: PointerType | readonly PointerType[] | undefined;
}

/** Keeps the latest value in a ref without triggering effects. */
function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  // Assigning during render is safe here: the ref is only read inside event
  // handlers, which never run during render.
  ref.current = value;
  return ref;
}

function resolveTarget(target: BindingTarget): EventTarget | null {
  if (target === undefined) {
    return typeof window !== 'undefined' ? window : null;
  }
  if (target === null) {
    return null;
  }
  if ('current' in target && !(target instanceof EventTarget)) {
    return (target as RefObject<EventTarget | null>).current;
  }
  return target as EventTarget;
}

function keyboardServiceOptions(options: UseKeybindingOptions): KeyboardAdapterServiceOptions {
  return {
    capture: options.capture,
    isMac: options.isMac,
    chordTimeout: options.chordTimeout,
  };
}

function pointerServiceOptions(options: UsePointerBindingOptions): PointerAdapterServiceOptions {
  return {
    capture: options.capture,
    isMac: options.isMac,
  };
}

/**
 * Register a Monaco-style keybinding, e.g.
 *
 * ```tsx
 * useKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS, save);
 * useKeybinding('Ctrl+K Ctrl+S', openShortcuts, { target: editorRef });
 * useKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS, save, { capture: true });
 * ```
 */
export function useKeybinding(
  binding: number | string,
  handler: KeybindingHandler,
  options: UseKeybindingOptions = {}
): void {
  const handlerRef = useLatestRef(handler);
  const whenRef = useLatestRef(options.when);

  // Normalize string bindings to the numeric encoding so the effect's dep is
  // a stable primitive; `'Ctrl+S'` re-parses per render (cheap, registration
  // path only) but re-registers nothing.
  const encoded = typeof binding === 'string' ? parseKeybinding(binding) : binding;
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
    const service = keyboardServices.acquire(target, serviceOpts);
    const off = service.add(encoded, (e) => handlerRef.current(e), {
      when: () => whenRef.current === undefined || whenRef.current(),
      preventDefault,
      stopPropagation,
    });
    return () => {
      off();
      keyboardServices.release(target, serviceOpts);
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

import { useRef, type RefObject } from 'react';
import type {
  KeyboardAdapterServiceOptions,
  PointerAdapterServiceOptions,
} from '../adapter-contract.js';

export type BindingTarget =
  | EventTarget
  | { readonly current: EventTarget | null }
  | null
  | undefined;

export interface CommonHookOptions {
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
  readonly pointerType?: import('../pointer.js').PointerType | readonly import('../pointer.js').PointerType[] | undefined;
}

/** Keeps the latest value in a ref without triggering effects. */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  // Assigning during render is safe here: the ref is only read inside event
  // handlers, which never run during render.
  ref.current = value;
  return ref;
}

export function resolveTarget(target: BindingTarget): EventTarget | null {
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

export function keyboardServiceOptions(
  options: UseKeybindingOptions
): KeyboardAdapterServiceOptions {
  return {
    capture: options.capture,
    isMac: options.isMac,
    chordTimeout: options.chordTimeout,
  };
}

export function pointerServiceOptions(
  options: UsePointerBindingOptions
): PointerAdapterServiceOptions {
  return {
    capture: options.capture,
    isMac: options.isMac,
  };
}

export function keyboardServiceKey(options: KeyboardAdapterServiceOptions): string {
  return `${options.capture ?? false}\0${options.isMac === undefined ? 'd' : options.isMac ? '1' : '0'}\0${options.chordTimeout ?? 5000}`;
}

export function pointerServiceKey(options: PointerAdapterServiceOptions): string {
  return `${options.capture ?? false}\0${options.isMac === undefined ? 'd' : options.isMac ? '1' : '0'}`;
}

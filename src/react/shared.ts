import { useRef, type RefObject } from 'react';
import type {
  KeyboardHookOptions,
  PointerHookOptions,
  CommonHookOptions,
  AdapterBindingTarget,
} from '../adapter/options.js';
import { resolveAdapterTarget } from '../adapter/resolveTarget.js';

export type BindingTarget = AdapterBindingTarget;
export type UseKeybindingOptions = KeyboardHookOptions;
export type UsePointerBindingOptions = PointerHookOptions;
export type { CommonHookOptions };

export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export function resolveTarget(target: BindingTarget): EventTarget | null {
  return resolveAdapterTarget(target);
}

export { keyboardServiceOptions, pointerServiceOptions } from '../adapter/options.js';

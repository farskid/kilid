import type {
  KeyboardAdapterServiceOptions,
  PointerAdapterServiceOptions,
} from '../adapter-contract.js';
import type { PointerEventKind, PointerType } from '../pointer.js';

/** EventTarget, framework ref, or disabled. */
export type AdapterBindingTarget =
  | EventTarget
  | null
  | undefined
  | { readonly current?: EventTarget | null }
  | { readonly value?: EventTarget | null };

export interface CommonHookOptions {
  readonly target?: AdapterBindingTarget;
  readonly when?: (() => boolean) | undefined;
  readonly enabled?: boolean | undefined;
  readonly preventDefault?: boolean | undefined;
  readonly stopPropagation?: boolean | undefined;
}

export interface KeyboardHookOptions extends CommonHookOptions, KeyboardAdapterServiceOptions {}

export interface PointerHookOptions extends CommonHookOptions, PointerAdapterServiceOptions {
  readonly pointerType?: PointerType | readonly PointerType[] | undefined;
}

export function keyboardServiceOptions(
  options: KeyboardHookOptions
): KeyboardAdapterServiceOptions {
  return {
    capture: options.capture,
    isMac: options.isMac,
    chordTimeout: options.chordTimeout,
  };
}

export function pointerServiceOptions(options: PointerHookOptions): PointerAdapterServiceOptions {
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

export function pointerTypeKey(
  pointerType: PointerType | readonly PointerType[] | undefined
): string {
  if (pointerType === undefined) {
    return '';
  }
  return typeof pointerType === 'string' ? pointerType : [...pointerType].sort().join(',');
}

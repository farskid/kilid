/**
 * Contract between kilid core services and framework adapters.
 *
 * Adapters (React today; Vue/Svelte/etc. later) must passthrough these options
 * to the underlying factories. `test/adapter-contract.test.ts` enforces the
 * contract at compile time and with behavioral smoke tests.
 */
import type { ChordKeybindingsOptions } from './chords.js';
import type { KeybindingOptions } from './keyboard.js';
import type { PointerBindingOptions, PointerBindingsOptions } from './pointer.js';

/** Service options keyboard adapters must accept (→ `chordKeybindings`). */
export type KeyboardAdapterServiceOptions = Pick<
  ChordKeybindingsOptions,
  'capture' | 'isMac' | 'chordTimeout'
>;

/** Per-binding options keyboard adapters must accept (→ `add`). */
export type KeyboardAdapterBindingOptions = KeybindingOptions & {
  /** Adapter extension: skip registration when `false`. Defaults to `true`. */
  readonly enabled?: boolean | undefined;
};

/** Service options pointer adapters must accept (→ `pointerBindings`). */
export type PointerAdapterServiceOptions = PointerBindingsOptions;

/** Per-binding options pointer adapters must accept (→ `add`). */
export type PointerAdapterBindingOptions = PointerBindingOptions & {
  readonly enabled?: boolean | undefined;
};

/** Where an adapter attaches listeners — EventTarget, ref, or disabled. */
export type AdapterBindingTarget =
  | EventTarget
  | { readonly current: EventTarget | null }
  | null
  | undefined;

/** Shared hook options every adapter should support. */
export type AdapterCommonOptions = {
  readonly target?: AdapterBindingTarget | undefined;
} & Pick<KeyboardAdapterBindingOptions, 'when' | 'enabled' | 'preventDefault' | 'stopPropagation'>;

export const KEYBOARD_ADAPTER_SERVICE_OPTION_KEYS = [
  'capture',
  'isMac',
  'chordTimeout',
] as const satisfies readonly (keyof KeyboardAdapterServiceOptions)[];

export const KEYBOARD_ADAPTER_BINDING_OPTION_KEYS = [
  'when',
  'preventDefault',
  'stopPropagation',
  'enabled',
] as const satisfies readonly (keyof KeyboardAdapterBindingOptions)[];

export const POINTER_ADAPTER_SERVICE_OPTION_KEYS = [
  'capture',
  'isMac',
] as const satisfies readonly (keyof PointerAdapterServiceOptions)[];

export const POINTER_ADAPTER_BINDING_OPTION_KEYS = [
  'when',
  'preventDefault',
  'stopPropagation',
  'pointerType',
  'enabled',
] as const satisfies readonly (keyof PointerAdapterBindingOptions)[];


/** True when `options` has every key in `keys`. Used by adapter contract tests. */
export function hasOptionKeys(
  options: Record<string, unknown>,
  keys: readonly string[]
): boolean {
  return keys.every((key) => key in options);
}

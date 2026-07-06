import { toValue, type MaybeRef } from 'vue';
import type { AdapterBindingTarget } from '../adapter/options.js';
import { resolveAdapterTarget } from '../adapter/resolveTarget.js';

/** Resolve Vue refs or plain adapter targets to an EventTarget. */
export function resolveVueTarget(
  target: MaybeRef<AdapterBindingTarget> | AdapterBindingTarget | undefined
): EventTarget | null {
  return resolveAdapterTarget(toValue(target as MaybeRef<AdapterBindingTarget | undefined>));
}

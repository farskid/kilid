import type { AdapterBindingTarget } from './options.js';

/** Resolve an adapter target to an EventTarget (or null when disabled). */
export function resolveAdapterTarget(target: AdapterBindingTarget): EventTarget | null {
  if (target === undefined) {
    return typeof window !== 'undefined' ? window : null;
  }
  if (target === null) {
    return null;
  }
  if (target instanceof EventTarget) {
    return target;
  }
  if ('current' in target) {
    return target.current ?? null;
  }
  if ('value' in target) {
    return target.value ?? null;
  }
  return null;
}

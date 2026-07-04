import { KeybindingService } from '../keyboard.js';
import { MouseBindingService } from '../mouse.js';
import { PointerBindingService } from '../pointer.js';

/**
 * Refcounted, per-target service sharing.
 *
 * Every hook that binds to the same EventTarget reuses one service instance
 * (and therefore one DOM listener per event type), no matter how many
 * components mount. The last unmounting hook disposes the service.
 *
 * Keyed by target via Map (not WeakMap) because we need deterministic cleanup
 * on refcount zero anyway; entries never outlive their bindings.
 */
interface CacheEntry<T> {
  service: T;
  refCount: number;
}

class ServiceCache<T extends { dispose(): void }> {
  private readonly _entries = new Map<EventTarget, CacheEntry<T>>();

  constructor(private readonly _factory: (target: EventTarget) => T) {}

  acquire(target: EventTarget): T {
    let entry = this._entries.get(target);
    if (entry === undefined) {
      entry = { service: this._factory(target), refCount: 0 };
      this._entries.set(target, entry);
    }
    entry.refCount++;
    return entry.service;
  }

  release(target: EventTarget): void {
    const entry = this._entries.get(target);
    if (entry === undefined) {
      return;
    }
    entry.refCount--;
    if (entry.refCount <= 0) {
      this._entries.delete(target);
      entry.service.dispose();
    }
  }
}

export const keyboardServices = new ServiceCache<KeybindingService>(
  (target) => new KeybindingService(target)
);
export const mouseServices = new ServiceCache<MouseBindingService>(
  (target) => new MouseBindingService(target)
);
export const pointerServices = new ServiceCache<PointerBindingService>(
  (target) => new PointerBindingService(target)
);

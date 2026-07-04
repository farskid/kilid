import { chordKeybindings, type ChordKeybindings } from '../chords.js';
import { pointerBindings, type PointerBindings } from '../pointer.js';

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

// The adapter uses the chord-capable superset: useKeybinding accepts chord
// encodings/strings, and hooks importing the adapter already opt into the
// convenience layer.
export const keyboardServices = new ServiceCache<ChordKeybindings>((target) =>
  chordKeybindings(target)
);
export const pointerServices = new ServiceCache<PointerBindings>((target) => pointerBindings(target));

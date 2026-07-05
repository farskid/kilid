import { chordKeybindings, type ChordKeybindings } from '../chords.js';
import type {
  KeyboardAdapterServiceOptions,
  PointerAdapterServiceOptions,
} from '../adapter-contract.js';
import { pointerBindings, type PointerBindings } from '../pointer.js';

function keyboardServiceKey(options: KeyboardAdapterServiceOptions): string {
  return `${options.capture ?? false}\0${options.isMac === undefined ? 'd' : options.isMac ? '1' : '0'}\0${options.chordTimeout ?? 5000}`;
}

function pointerServiceKey(options: PointerAdapterServiceOptions): string {
  return `${options.capture ?? false}\0${options.isMac === undefined ? 'd' : options.isMac ? '1' : '0'}`;
}

/**
 * Refcounted, per-(target, service-options) service sharing.
 *
 * Every hook that binds to the same EventTarget with the same service
 * configuration reuses one service instance (and therefore one DOM listener
 * per event type). The last unmounting hook disposes the service.
 *
 * Keyed by target via Map (not WeakMap) because we need deterministic cleanup
 * on refcount zero anyway; entries never outlive their bindings.
 */
interface CacheEntry<T> {
  service: T;
  refCount: number;
}

class ServiceCache<T extends { dispose(): void }, O extends object> {
  private readonly _entries = new Map<EventTarget, Map<string, CacheEntry<T>>>();

  constructor(
    private readonly _factory: (target: EventTarget, options: O) => T,
    private readonly _keyOf: (options: O) => string
  ) {}

  acquire(target: EventTarget, options: O): T {
    let byOpts = this._entries.get(target);
    if (byOpts === undefined) {
      byOpts = new Map();
      this._entries.set(target, byOpts);
    }
    const bucket = this._keyOf(options);
    let entry = byOpts.get(bucket);
    if (entry === undefined) {
      entry = { service: this._factory(target, options), refCount: 0 };
      byOpts.set(bucket, entry);
    }
    entry.refCount++;
    return entry.service;
  }

  release(target: EventTarget, options: O): void {
    const byOpts = this._entries.get(target);
    if (byOpts === undefined) {
      return;
    }
    const bucket = this._keyOf(options);
    const entry = byOpts.get(bucket);
    if (entry === undefined) {
      return;
    }
    entry.refCount--;
    if (entry.refCount <= 0) {
      byOpts.delete(bucket);
      entry.service.dispose();
      if (byOpts.size === 0) {
        this._entries.delete(target);
      }
    }
  }
}

// The adapter uses the chord-capable superset: useKeybinding accepts chord
// encodings/strings, and hooks importing the adapter already opt into the
// convenience layer.
export const keyboardServices = new ServiceCache<ChordKeybindings, KeyboardAdapterServiceOptions>(
  (target, options) => chordKeybindings(target, options),
  keyboardServiceKey
);
export const pointerServices = new ServiceCache<PointerBindings, PointerAdapterServiceOptions>(
  (target, options) => pointerBindings(target, options),
  pointerServiceKey
);

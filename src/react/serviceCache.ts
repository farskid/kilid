/** Refcounted, per-(target, service-options) service sharing for React hooks. */

export interface ServiceCache<T extends { dispose(): void }, O extends object> {
  acquire(target: EventTarget, options: O): T;
  release(target: EventTarget, options: O): void;
}

/**
 * Create a refcounted service cache. Each hook on the same target with the same
 * service options reuses one service instance (one DOM listener per event type).
 */
export function createServiceCache<T extends { dispose(): void }, O extends object>(
  factory: (target: EventTarget, options: O) => T,
  keyOf: (options: O) => string
): ServiceCache<T, O> {
  const entries = new Map<EventTarget, Map<string, { service: T; refCount: number }>>();

  return {
    acquire(target, options) {
      let byOpts = entries.get(target);
      if (byOpts === undefined) {
        byOpts = new Map();
        entries.set(target, byOpts);
      }
      const bucket = keyOf(options);
      let entry = byOpts.get(bucket);
      if (entry === undefined) {
        entry = { service: factory(target, options), refCount: 0 };
        byOpts.set(bucket, entry);
      }
      entry.refCount++;
      return entry.service;
    },

    release(target, options) {
      const byOpts = entries.get(target);
      if (byOpts === undefined) {
        return;
      }
      const bucket = keyOf(options);
      const entry = byOpts.get(bucket);
      if (entry === undefined) {
        return;
      }
      entry.refCount--;
      if (entry.refCount <= 0) {
        byOpts.delete(bucket);
        entry.service.dispose();
        if (byOpts.size === 0) {
          entries.delete(target);
        }
      }
    },
  };
}

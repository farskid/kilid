/** Anything that can release its resources/listeners. */
export interface IDisposable {
  dispose(): void;
}

export function toDisposable(fn: () => void): IDisposable {
  let disposed = false;
  return {
    dispose() {
      if (!disposed) {
        disposed = true;
        fn();
      }
    },
  };
}

/** Collects disposables so they can be released together. */
export class DisposableStore implements IDisposable {
  private readonly _items = new Set<IDisposable>();
  private _isDisposed = false;

  add<T extends IDisposable>(item: T): T {
    if (this._isDisposed) {
      item.dispose();
    } else {
      this._items.add(item);
    }
    return item;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    for (const item of this._items) {
      item.dispose();
    }
    this._items.clear();
  }
}

/** Add a DOM listener and get back a disposable that removes it. */
export function addDisposableListener<K extends keyof GlobalEventHandlersEventMap>(
  target: EventTarget,
  type: K,
  handler: (event: GlobalEventHandlersEventMap[K]) => void,
  options?: AddEventListenerOptions
): IDisposable {
  target.addEventListener(type, handler as EventListener, options);
  return toDisposable(() => target.removeEventListener(type, handler as EventListener, options));
}

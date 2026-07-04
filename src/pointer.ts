import { chordHashFromParts, decodeKeybinding } from './keybindings.js';
import { MouseButton } from './mouse.js';
import { addDisposableListener, toDisposable, type IDisposable } from './lifecycle.js';
import { detectIsMac } from './platform.js';

export type PointerEventKind = 'down' | 'up' | 'move' | 'enter' | 'leave' | 'cancel';

const KIND_TO_DOM: Record<PointerEventKind, string> = {
  down: 'pointerdown',
  up: 'pointerup',
  move: 'pointermove',
  enter: 'pointerenter',
  leave: 'pointerleave',
  cancel: 'pointercancel',
};

export type PointerType = 'mouse' | 'pen' | 'touch';

export type PointerBindingHandler = (event: PointerEvent) => void;

export interface PointerBindingOptions {
  readonly when?: (() => boolean) | undefined;
  readonly preventDefault?: boolean | undefined;
  readonly stopPropagation?: boolean | undefined;
  /** Only fire for these pointer types. Defaults to all. */
  readonly pointerType?: PointerType | readonly PointerType[] | undefined;
}

export interface PointerBindingServiceOptions {
  readonly isMac?: boolean | undefined;
  readonly capture?: boolean | undefined;
}

/** Bit flags for fast pointer-type filtering at dispatch. */
const enum PointerTypeMask {
  Mouse = 1,
  Pen = 2,
  Touch = 4,
  All = 7,
}

function pointerTypeMask(types: PointerType | readonly PointerType[] | undefined): number {
  if (types === undefined) {
    return PointerTypeMask.All;
  }
  const list = typeof types === 'string' ? [types] : types;
  let mask = 0;
  for (const type of list) {
    mask |= type === 'mouse' ? PointerTypeMask.Mouse : type === 'pen' ? PointerTypeMask.Pen : PointerTypeMask.Touch;
  }
  return mask;
}

function eventPointerTypeMask(pointerType: string): number {
  switch (pointerType) {
    case 'mouse':
      return PointerTypeMask.Mouse;
    case 'pen':
      return PointerTypeMask.Pen;
    case 'touch':
      return PointerTypeMask.Touch;
    default:
      return 0;
  }
}

interface PointerBinding {
  readonly handler: PointerBindingHandler;
  readonly when: (() => boolean) | undefined;
  readonly preventDefault: boolean;
  readonly stopPropagation: boolean;
  readonly typeMask: number;
}

/**
 * Dispatches pointer events against `KeyMod | MouseButton` encodings with an
 * optional pointer-type filter (`mouse` / `pen` / `touch`).
 *
 * For `move`/`enter`/`leave`/`cancel` events (where `button` is `-1`),
 * bindings registered on {@link MouseButton.Left} match regardless of which
 * buttons are held; use `when` with `event.buttons` for stricter filtering.
 */
export class PointerBindingService implements IDisposable {
  private readonly _target: EventTarget;
  private readonly _isMac: boolean;
  private readonly _capture: boolean;
  private _isDisposed = false;

  private readonly _byKind = new Map<PointerEventKind, Map<number, PointerBinding[]>>();
  private readonly _listeners = new Map<PointerEventKind, IDisposable>();

  constructor(target: EventTarget, options: PointerBindingServiceOptions = {}) {
    this._target = target;
    this._isMac = options.isMac ?? detectIsMac();
    this._capture = options.capture ?? false;
  }

  add(
    binding: number,
    kind: PointerEventKind,
    handler: PointerBindingHandler,
    options: PointerBindingOptions = {}
  ): IDisposable {
    if (this._isDisposed) {
      throw new Error('PointerBindingService has been disposed');
    }
    const parts = decodeKeybinding(binding, this._isMac);
    if (parts === null || parts.length !== 1) {
      throw new Error(`Invalid pointer binding: ${binding} (chords are not supported for pointer)`);
    }
    const part = parts[0]!;
    const hash = chordHashFromParts(part.ctrlKey, part.shiftKey, part.altKey, part.metaKey, part.keyCode);

    let map = this._byKind.get(kind);
    if (map === undefined) {
      map = new Map();
      this._byKind.set(kind, map);
    }
    let list = map.get(hash);
    if (list === undefined) {
      list = [];
      map.set(hash, list);
    }
    const record: PointerBinding = {
      handler,
      when: options.when,
      preventDefault: options.preventDefault ?? false,
      stopPropagation: options.stopPropagation ?? false,
      typeMask: pointerTypeMask(options.pointerType),
    };
    list.push(record);
    this._ensureListener(kind);

    return toDisposable(() => {
      const idx = list.indexOf(record);
      if (idx >= 0) {
        list.splice(idx, 1);
      }
      if (list.length === 0) {
        map.delete(hash);
      }
      if (map.size === 0) {
        this._byKind.delete(kind);
        this._listeners.get(kind)?.dispose();
        this._listeners.delete(kind);
      }
    });
  }

  dispose(): void {
    this._isDisposed = true;
    for (const listener of this._listeners.values()) {
      listener.dispose();
    }
    this._listeners.clear();
    this._byKind.clear();
  }

  private _ensureListener(kind: PointerEventKind): void {
    if (this._listeners.has(kind)) {
      return;
    }
    const domType = KIND_TO_DOM[kind] as keyof GlobalEventHandlersEventMap;
    this._listeners.set(
      kind,
      addDisposableListener(this._target, domType, (e) => this._onEvent(kind, e as PointerEvent), {
        capture: this._capture,
      })
    );
  }

  private _onEvent(kind: PointerEventKind, event: PointerEvent): void {
    const map = this._byKind.get(kind);
    if (map === undefined) {
      return;
    }
    // pointermove/enter/leave/cancel report button === -1; treat them as
    // Left so a single binding covers hover/drag flows.
    const code = event.button >= 0 ? event.button + 1 : MouseButton.Left;
    const hash = chordHashFromParts(event.ctrlKey, event.shiftKey, event.altKey, event.metaKey, code);
    const bindings = map.get(hash);
    if (bindings === undefined) {
      return;
    }
    const typeMask = eventPointerTypeMask(event.pointerType);
    // See KeybindingService._dispatch for why the index only advances when
    // the slot is stable (handlers may dispose bindings mid-dispatch).
    for (let i = 0; i < bindings.length; ) {
      const binding = bindings[i]!;
      if ((binding.typeMask & typeMask) === 0 || (binding.when !== undefined && !binding.when())) {
        i++;
        continue;
      }
      if (binding.preventDefault) {
        event.preventDefault();
      }
      if (binding.stopPropagation) {
        event.stopPropagation();
      }
      binding.handler(event);
      if (bindings[i] === binding) {
        i++;
      }
    }
  }
}

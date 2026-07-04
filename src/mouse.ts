import { chordHashFromParts, decodeKeybinding } from './keybindings.js';
import { addDisposableListener, toDisposable, type IDisposable } from './lifecycle.js';
import { detectIsMac } from './platform.js';

/**
 * Mouse buttons and wheel directions, encoded in the same low bits a
 * {@link KeyCode} would occupy so {@link KeyMod} flags compose with them:
 * `KeyMod.CtrlCmd | MouseButton.Left`.
 */
export enum MouseButton {
  Left = 1,
  Middle = 2,
  Right = 3,
  /** Typically "browser back". */
  X1 = 4,
  /** Typically "browser forward". */
  X2 = 5,
  WheelUp = 6,
  WheelDown = 7,
  WheelLeft = 8,
  WheelRight = 9,
}

/** `MouseEvent.button` (0-based) -> {@link MouseButton}. */
function buttonFromEvent(button: number): MouseButton | 0 {
  // MouseEvent.button: 0=left 1=middle 2=right 3=back 4=forward
  return button >= 0 && button <= 4 ? ((button + 1) as MouseButton) : 0;
}

function wheelDirection(event: WheelEvent): MouseButton | 0 {
  const { deltaX, deltaY } = event;
  if (Math.abs(deltaY) >= Math.abs(deltaX)) {
    if (deltaY < 0) return MouseButton.WheelUp;
    if (deltaY > 0) return MouseButton.WheelDown;
    return 0;
  }
  return deltaX < 0 ? MouseButton.WheelLeft : MouseButton.WheelRight;
}

export type MouseEventKind = 'down' | 'up' | 'click' | 'dblclick' | 'contextmenu' | 'wheel';

const KIND_TO_DOM: Record<MouseEventKind, string> = {
  down: 'mousedown',
  up: 'mouseup',
  click: 'click',
  dblclick: 'dblclick',
  contextmenu: 'contextmenu',
  wheel: 'wheel',
};

export type MouseBindingHandler<K extends MouseEventKind = MouseEventKind> = (
  event: K extends 'wheel' ? WheelEvent : MouseEvent
) => void;

export interface MouseBindingOptions {
  readonly when?: (() => boolean) | undefined;
  /** Defaults to `false` for mouse (unlike keyboard) — swallowing clicks/wheel by default breaks pages. */
  readonly preventDefault?: boolean | undefined;
  readonly stopPropagation?: boolean | undefined;
}

export interface MouseBindingServiceOptions {
  readonly isMac?: boolean | undefined;
  readonly capture?: boolean | undefined;
}

interface MouseBinding {
  readonly handler: (event: MouseEvent) => void;
  readonly when: (() => boolean) | undefined;
  readonly preventDefault: boolean;
  readonly stopPropagation: boolean;
}

/**
 * Dispatches mouse events against `KeyMod | MouseButton` encodings.
 *
 * DOM listeners are attached lazily per event kind (an app that only binds
 * `click` never installs a `wheel` listener) and removed when the last
 * binding of that kind is disposed. Wheel listeners are passive unless a
 * wheel binding requests `preventDefault`.
 */
export class MouseBindingService implements IDisposable {
  private readonly _target: EventTarget;
  private readonly _isMac: boolean;
  private readonly _capture: boolean;
  private _isDisposed = false;

  private readonly _byKind = new Map<MouseEventKind, Map<number, MouseBinding[]>>();
  private readonly _listeners = new Map<MouseEventKind, IDisposable>();

  constructor(target: EventTarget, options: MouseBindingServiceOptions = {}) {
    this._target = target;
    this._isMac = options.isMac ?? detectIsMac();
    this._capture = options.capture ?? false;
  }

  /**
   * Register a mouse binding, e.g.
   * `mouse.add(KeyMod.CtrlCmd | MouseButton.Left, 'click', handler)`.
   */
  add<K extends MouseEventKind>(
    binding: number,
    kind: K,
    handler: MouseBindingHandler<K>,
    options: MouseBindingOptions = {}
  ): IDisposable {
    if (this._isDisposed) {
      throw new Error('MouseBindingService has been disposed');
    }
    const parts = decodeKeybinding(binding, this._isMac);
    if (parts === null || parts.length !== 1) {
      throw new Error(`Invalid mouse binding: ${binding} (chords are not supported for mouse)`);
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
    const record: MouseBinding = {
      handler: handler as (event: MouseEvent) => void,
      when: options.when,
      preventDefault: options.preventDefault ?? false,
      stopPropagation: options.stopPropagation ?? false,
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

  private _ensureListener(kind: MouseEventKind): void {
    if (this._listeners.has(kind)) {
      return;
    }
    const domType = KIND_TO_DOM[kind] as keyof GlobalEventHandlersEventMap;
    const options: AddEventListenerOptions =
      kind === 'wheel' ? { capture: this._capture, passive: false } : { capture: this._capture };
    this._listeners.set(
      kind,
      addDisposableListener(
        this._target,
        domType,
        (e) => this._onEvent(kind, e as MouseEvent),
        options
      )
    );
  }

  private _onEvent(kind: MouseEventKind, event: MouseEvent): void {
    const map = this._byKind.get(kind);
    if (map === undefined) {
      return;
    }
    const code =
      kind === 'wheel' ? wheelDirection(event as WheelEvent) : buttonFromEvent(event.button);
    if (code === 0) {
      return;
    }
    const hash = chordHashFromParts(event.ctrlKey, event.shiftKey, event.altKey, event.metaKey, code);
    const bindings = map.get(hash);
    if (bindings === undefined) {
      return;
    }
    // See KeybindingService._dispatch for why the index only advances when
    // the slot is stable (handlers may dispose bindings mid-dispatch).
    for (let i = 0; i < bindings.length; ) {
      const binding = bindings[i]!;
      if (binding.when !== undefined && !binding.when()) {
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

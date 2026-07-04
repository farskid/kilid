import { chordHashFromParts, decodeKeybinding } from './keybindings.js';
import type { Unsubscribe } from './keyboard.js';
import { detectIsMac } from './platform.js';

/**
 * Buttons and wheel directions, encoded in the same low bits a key code
 * would occupy so `KeyMod` flags compose with them:
 * `KeyMod.CtrlCmd | MouseButton.Left`.
 */
export const MouseButton = {
  Left: 1,
  Middle: 2,
  Right: 3,
  /** Typically "browser back". */
  X1: 4,
  /** Typically "browser forward". */
  X2: 5,
  WheelUp: 6,
  WheelDown: 7,
  WheelLeft: 8,
  WheelRight: 9,
} as const;

export type MouseButton = (typeof MouseButton)[keyof typeof MouseButton];

/**
 * One service covers the full pointing surface. Pointer events subsume mouse
 * in every modern browser, so a separate mouse service would be ~85%
 * duplicated code; the only mouse-exclusive events are the click-family and
 * wheel, which are folded in here as extra kinds.
 */
export type PointerEventKind =
  | 'down'
  | 'up'
  | 'move'
  | 'enter'
  | 'leave'
  | 'cancel'
  | 'click'
  | 'dblclick'
  | 'contextmenu'
  | 'wheel';

const KIND_TO_DOM: Record<PointerEventKind, string> = {
  down: 'pointerdown',
  up: 'pointerup',
  move: 'pointermove',
  enter: 'pointerenter',
  leave: 'pointerleave',
  cancel: 'pointercancel',
  click: 'click',
  dblclick: 'dblclick',
  contextmenu: 'contextmenu',
  wheel: 'wheel',
};

export type PointerType = 'mouse' | 'pen' | 'touch';

export type PointerBindingHandler<K extends PointerEventKind = PointerEventKind> = (
  event: K extends 'wheel'
    ? WheelEvent
    : K extends 'click' | 'dblclick' | 'contextmenu'
      ? MouseEvent
      : PointerEvent
) => void;

export interface PointerBindingOptions {
  readonly when?: (() => boolean) | undefined;
  /** Defaults to `false` (unlike keyboard) — swallowing clicks/wheel by default breaks pages. */
  readonly preventDefault?: boolean | undefined;
  readonly stopPropagation?: boolean | undefined;
  /**
   * Only fire for these pointer types. Defaults to all. Events that don't
   * carry a `pointerType` (plain mouse-event kinds in older browsers) match
   * any filter.
   */
  readonly pointerType?: PointerType | readonly PointerType[] | undefined;
}

export interface PointerBindingsOptions {
  readonly isMac?: boolean | undefined;
  readonly capture?: boolean | undefined;
}

export interface PointerBindings {
  /**
   * Register a binding, e.g.
   * `pointer.add(KeyMod.CtrlCmd | MouseButton.Left, 'click', handler)`.
   * Chord encodings register nothing. Returns an unsubscribe function.
   */
  add<K extends PointerEventKind>(
    binding: number,
    kind: K,
    handler: PointerBindingHandler<K>,
    options?: PointerBindingOptions
  ): Unsubscribe;
  /** Remove all bindings and DOM listeners. */
  dispose(): void;
}

/** Bit flags for fast pointer-type filtering at dispatch. */
const TYPE_ALL = 7;

function typeMaskOf(types: PointerType | readonly PointerType[] | undefined): number {
  if (types === undefined) {
    return TYPE_ALL;
  }
  let mask = 0;
  for (const type of typeof types === 'string' ? [types] : types) {
    mask |= type === 'mouse' ? 1 : type === 'pen' ? 2 : 4;
  }
  return mask;
}

interface PointerBinding {
  readonly handler: (event: Event) => void;
  readonly when: (() => boolean) | undefined;
  readonly preventDefault: boolean;
  readonly stopPropagation: boolean;
  readonly typeMask: number;
}

function wheelDirection(event: WheelEvent): number {
  const { deltaX, deltaY } = event;
  if (Math.abs(deltaY) >= Math.abs(deltaX)) {
    return deltaY < 0 ? MouseButton.WheelUp : deltaY > 0 ? MouseButton.WheelDown : 0;
  }
  return deltaX < 0 ? MouseButton.WheelLeft : MouseButton.WheelRight;
}

/**
 * Create a pointer/mouse dispatcher on `target` matching
 * `KeyMod | MouseButton` encodings, with an optional pointer-type filter.
 *
 * DOM listeners are attached lazily per event kind (an app that only binds
 * `click` never installs a `move` listener) and removed when the last
 * binding of that kind is unsubscribed. Wheel listeners are non-passive so
 * bindings can `preventDefault`.
 *
 * For `move`/`enter`/`leave`/`cancel` events (where `button` is `-1`),
 * bindings registered on {@link MouseButton.Left} match regardless of which
 * buttons are held; use `when` with `event.buttons` for stricter filtering.
 */
export function pointerBindings(target: EventTarget, options: PointerBindingsOptions = {}): PointerBindings {
  const isMac = options.isMac ?? detectIsMac();
  const capture = options.capture ?? false;

  const byKind = new Map<PointerEventKind, Map<number, PointerBinding[]>>();
  const listeners = new Map<PointerEventKind, () => void>();

  const onEvent = (kind: PointerEventKind, event: MouseEvent): void => {
    const map = byKind.get(kind);
    if (map === undefined) {
      return;
    }
    const code =
      kind === 'wheel'
        ? wheelDirection(event as WheelEvent)
        : event.button >= 0
          ? event.button + 1
          : MouseButton.Left;
    if (code === 0) {
      return;
    }
    const hash = chordHashFromParts(event.ctrlKey, event.shiftKey, event.altKey, event.metaKey, code);
    const bindings = map.get(hash);
    if (bindings === undefined) {
      return;
    }
    // Events without a pointerType (wheel, click in older engines) match all
    // filters rather than none.
    const pt = (event as PointerEvent).pointerType;
    const eventMask = pt === 'mouse' ? 1 : pt === 'pen' ? 2 : pt === 'touch' ? 4 : TYPE_ALL;
    // Index only advances while the slot is stable (handlers may unsubscribe
    // bindings mid-dispatch); see keybindings() dispatch for rationale.
    for (let i = 0; i < bindings.length; ) {
      const binding = bindings[i]!;
      if ((binding.typeMask & eventMask) === 0 || (binding.when !== undefined && !binding.when())) {
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
  };

  const ensureListener = (kind: PointerEventKind): void => {
    if (listeners.has(kind)) {
      return;
    }
    const domType = KIND_TO_DOM[kind];
    const handler = (e: Event): void => onEvent(kind, e as MouseEvent);
    const opts: AddEventListenerOptions =
      kind === 'wheel' ? { capture, passive: false } : { capture };
    target.addEventListener(domType, handler, opts);
    listeners.set(kind, () => target.removeEventListener(domType, handler, opts));
  };

  return {
    add(binding, kind, handler, opts = {}) {
      const parts = decodeKeybinding(binding, isMac);
      if (parts === null || parts.length !== 1) {
        return () => {};
      }
      const part = parts[0]!;
      const hash = chordHashFromParts(part.ctrlKey, part.shiftKey, part.altKey, part.metaKey, part.keyCode);

      let map = byKind.get(kind);
      if (map === undefined) {
        map = new Map();
        byKind.set(kind, map);
      }
      let list = map.get(hash);
      if (list === undefined) {
        list = [];
        map.set(hash, list);
      }
      const record: PointerBinding = {
        handler: handler as (event: Event) => void,
        when: opts.when,
        preventDefault: opts.preventDefault ?? false,
        stopPropagation: opts.stopPropagation ?? false,
        typeMask: typeMaskOf(opts.pointerType),
      };
      list.push(record);
      ensureListener(kind);

      return () => {
        const idx = list.indexOf(record);
        if (idx >= 0) {
          list.splice(idx, 1);
        }
        if (list.length === 0) {
          map.delete(hash);
        }
        if (map.size === 0) {
          byKind.delete(kind);
          const off = listeners.get(kind);
          if (off !== undefined) {
            off();
            listeners.delete(kind);
          }
        }
      };
    },
    dispose() {
      for (const off of listeners.values()) {
        off();
      }
      listeners.clear();
      byKind.clear();
    },
  };
}

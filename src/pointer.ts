import { chordHashFromParts, decodeKeybinding, decodeKeybindingPart } from './keybindings.js';
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

/**
 * Kinds whose DOM events carry no meaningful `button` (`event.button` is
 * `-1`): bindings for these take no `MouseButton` — only optional modifiers.
 */
export type PointerButtonlessKind = 'move' | 'enter' | 'leave' | 'cancel';

const BUTTONLESS_KINDS: ReadonlySet<PointerEventKind> = /* @__PURE__ */ new Set<PointerEventKind>(
  ['move', 'enter', 'leave', 'cancel']
);

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
   * Register a buttonless binding (`move`/`enter`/`leave`/`cancel`), e.g.
   * `pointer.add('move', onDraw)`. Returns an unsubscribe function.
   */
  add<K extends PointerButtonlessKind>(
    kind: K,
    handler: PointerBindingHandler<K>,
    options?: PointerBindingOptions
  ): Unsubscribe;
  /**
   * Register a binding, e.g.
   * `pointer.add(KeyMod.CtrlCmd | MouseButton.Left, 'click', handler)`.
   *
   * For buttonless kinds the encoding must be modifier-only
   * (`pointer.add(KeyMod.Alt, 'move', handler)` = move while Alt is held);
   * button bits there register nothing (dev builds warn). Chord encodings
   * register nothing. Returns an unsubscribe function.
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
 * register with the buttonless overload — `add('move', handler)` — or a
 * modifier-only encoding (`add(KeyMod.Alt, 'move', handler)` fires only while
 * Alt is held). Use `when` with `event.buttons` to filter by held buttons.
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
    const buttonless = BUTTONLESS_KINDS.has(kind);
    const code = kind === 'wheel' ? wheelDirection(event as WheelEvent) : buttonless ? 0 : event.button + 1;
    if (code === 0 && !buttonless) {
      return;
    }
    const hash = chordHashFromParts(event.ctrlKey, event.shiftKey, event.altKey, event.metaKey, code);
    const bindings = map.get(hash);
    // Legacy: buttonless bindings registered pre-0.2 with MouseButton.Left.
    const legacy = buttonless
      ? map.get(chordHashFromParts(event.ctrlKey, event.shiftKey, event.altKey, event.metaKey, MouseButton.Left))
      : undefined;
    if (bindings === undefined && legacy === undefined) {
      return;
    }
    // Events without a pointerType (wheel, click in older engines) match all
    // filters rather than none.
    const pt = (event as PointerEvent).pointerType;
    const eventMask = pt === 'mouse' ? 1 : pt === 'pen' ? 2 : pt === 'touch' ? 4 : TYPE_ALL;
    // Index only advances while the slot is stable (handlers may unsubscribe
    // bindings mid-dispatch); see keybindings() dispatch for rationale.
    const run = (list: PointerBinding[] | undefined): void => {
      if (list === undefined) {
        return;
      }
      for (let i = 0; i < list.length; ) {
        const binding = list[i]!;
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
        if (list[i] === binding) {
          i++;
        }
      }
    };
    run(bindings);
    run(legacy);
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
    add(
      bindingOrKind: number | PointerButtonlessKind,
      kindOrHandler: PointerEventKind | PointerBindingHandler,
      handlerOrOpts?: PointerBindingHandler | PointerBindingOptions,
      maybeOpts?: PointerBindingOptions
    ) {
      // Normalize the buttonless overload: add('move', handler, opts?).
      let binding: number;
      let kind: PointerEventKind;
      let handler: PointerBindingHandler;
      let opts: PointerBindingOptions;
      if (typeof bindingOrKind === 'string') {
        binding = 0;
        kind = bindingOrKind;
        handler = kindOrHandler as PointerBindingHandler;
        opts = (handlerOrOpts as PointerBindingOptions | undefined) ?? {};
      } else {
        binding = bindingOrKind;
        kind = kindOrHandler as PointerEventKind;
        handler = handlerOrOpts as PointerBindingHandler;
        opts = maybeOpts ?? {};
      }

      const buttonless = BUTTONLESS_KINDS.has(kind);
      let hash: number;
      if (buttonless) {
        const buttonBits = binding & 0xff;
        if (buttonBits !== 0 && buttonBits !== MouseButton.Left) {
          // Middle/Right/etc. never fire for buttonless events — refuse loudly
          // in dev rather than registering a binding that can't match.
          if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
            console.warn(
              `[kilid] pointerBindings().add(${binding}, '${kind}'): '${kind}' events carry no button; ` +
                `use add('${kind}', handler) or a modifier-only encoding like add(KeyMod.Alt, '${kind}', handler). ` +
                'Nothing was registered.'
            );
          }
          return () => {};
        }
        if (
          buttonBits === MouseButton.Left &&
          typeof process !== 'undefined' &&
          process.env.NODE_ENV !== 'production'
        ) {
          console.warn(
            `[kilid] pointerBindings().add(${binding}, '${kind}'): MouseButton.Left is deprecated for ` +
              `'${kind}' — it matches any ${kind} event, not "left button held". ` +
              `Use add('${kind}', handler) or a modifier-only encoding instead.`
          );
        }
        const part = decodeKeybindingPart(binding, isMac);
        // Legacy Left bindings keep their historical hash (dispatch checks both).
        hash = chordHashFromParts(part.ctrlKey, part.shiftKey, part.altKey, part.metaKey, buttonBits);
      } else {
        const parts = decodeKeybinding(binding, isMac);
        if (parts === null || parts.length !== 1) {
          if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
            console.warn(
              `[kilid] pointerBindings().add(${binding}): ` +
                (parts === null
                  ? 'invalid binding encoding; nothing was registered.'
                  : 'chord encodings are keyboard-only; nothing was registered.')
            );
          }
          return () => {};
        }
        const part = parts[0]!;
        hash = chordHashFromParts(part.ctrlKey, part.shiftKey, part.altKey, part.metaKey, part.keyCode);
      }

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

import { isModifierKeyCode, keyCodeFromEvent } from './keyCodes.js';
import { chordHash, chordHashFromParts, decodeKeybinding } from './keybindings.js';
import { detectIsMac } from './platform.js';

export type KeybindingHandler = (event: KeyboardEvent) => void;

/** Removes the binding (or listener) it was returned for. Safe to call twice. */
export type Unsubscribe = () => void;

export interface KeybindingOptions {
  /** Dynamic guard evaluated at dispatch time; the binding only fires when it returns `true`. */
  readonly when?: (() => boolean) | undefined;
  /** Call `preventDefault()` on match. Defaults to `true`. */
  readonly preventDefault?: boolean | undefined;
  /** Call `stopPropagation()` on match. Defaults to `false`. */
  readonly stopPropagation?: boolean | undefined;
}

export interface KeybindingsOptions {
  /** Override platform detection (affects how `KeyMod.CtrlCmd`/`KeyMod.WinCtrl` resolve). */
  readonly isMac?: boolean | undefined;
  /** Attach listeners in the capture phase. Defaults to `false`. */
  readonly capture?: boolean | undefined;
}

export interface Keybindings {
  /**
   * Register a keybinding using the Monaco-style numeric encoding
   * (`KeyMod.CtrlCmd | KeyCode.KeyS`). For string bindings, parse explicitly:
   * `add(parseKeybinding('Ctrl+S'), ...)` — kept out of the core so the
   * parser only ships to bundles that use it. Chord encodings require
   * `chordKeybindings` from `kilid` (separate module); here they register
   * nothing, as do invalid encodings. Returns an unsubscribe function.
   */
  add(keybinding: number, handler: KeybindingHandler, options?: KeybindingOptions): Unsubscribe;
  /** Remove all bindings and the DOM listener. */
  dispose(): void;
}

/**
 * A registered binding. Monomorphic on purpose: every record has the same
 * shape so dispatch stays inline-cached in V8.
 * @internal shared with chordKeybindings.
 */
export interface Binding {
  readonly handler: KeybindingHandler;
  readonly when: (() => boolean) | undefined;
  readonly preventDefault: boolean;
  readonly stopPropagation: boolean;
}

/** @internal */
export const NOOP: Unsubscribe = () => {};

/** @internal */
export function makeBinding(handler: KeybindingHandler, opts: KeybindingOptions): Binding {
  return {
    handler,
    when: opts.when,
    preventDefault: opts.preventDefault ?? true,
    stopPropagation: opts.stopPropagation ?? false,
  };
}

/** @internal */
export function insert(map: Map<number, Binding[]>, hash: number, binding: Binding): Unsubscribe {
  let list = map.get(hash);
  if (list === undefined) {
    list = [];
    map.set(hash, list);
  }
  list.push(binding);
  return () => {
    const idx = list.indexOf(binding);
    if (idx >= 0) {
      list.splice(idx, 1);
    }
    if (list.length === 0) {
      map.delete(hash);
    }
  };
}

/** @internal */
export function dispatch(bindings: Binding[] | undefined, event: KeyboardEvent): boolean {
  if (bindings === undefined) {
    return false;
  }
  let fired = false;
  // Handlers may unsubscribe bindings (including their own) mid-dispatch. To
  // stay zero-allocation we don't snapshot the list; instead we only
  // advance the index while the slot still holds the binding we just ran.
  for (let i = 0; i < bindings.length; ) {
    const binding = bindings[i]!;
    if (binding.when !== undefined && !binding.when()) {
      i++;
      continue;
    }
    fired = true;
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
  return fired;
}

/** @internal Hash for a keydown event, or -1 for lone modifier presses. */
export function eventHash(event: KeyboardEvent): number {
  const keyCode = keyCodeFromEvent(event);
  // A lone modifier press must not resolve or cancel anything; the real
  // key of the combination is still on its way down.
  if (isModifierKeyCode(keyCode)) {
    return -1;
  }
  return chordHashFromParts(event.ctrlKey, event.shiftKey, event.altKey, event.metaKey, keyCode);
}

/**
 * Create a keybinding dispatcher on `target` for single-part bindings
 * (`Cmd+S`, `F2`, `Ctrl+Shift+P`) using one `keydown` listener.
 *
 * Two-part chords (`Ctrl+K Ctrl+S`) live in `chordKeybindings`, a separate
 * module, so bundles that never use chords don't ship the chord state
 * machine.
 *
 * Hot path per event: compute one integer hash from the event, one `Map`
 * lookup. No allocations.
 *
 * A factory (not a class) so every piece of internal state minifies to a
 * single-letter closure variable instead of an unmangleable property name.
 */
export function keybindings(target: EventTarget, options: KeybindingsOptions = {}): Keybindings {
  const isMac = options.isMac ?? detectIsMac();
  const capture = options.capture ?? false;

  /** Bindings keyed by chord hash. */
  const single = new Map<number, Binding[]>();

  const onKeyDown = (e: Event): void => {
    const hash = eventHash(e as KeyboardEvent);
    if (hash !== -1) {
      dispatch(single.get(hash), e as KeyboardEvent);
    }
  };

  target.addEventListener('keydown', onKeyDown, { capture });

  return {
    add(keybinding, handler, opts = {}) {
      const parts = decodeKeybinding(keybinding, isMac);
      // Chord encodings (parts.length === 2) belong to chordKeybindings.
      if (parts === null || parts.length !== 1) {
        return NOOP;
      }
      return insert(single, chordHash(parts[0]!), makeBinding(handler, opts));
    },
    dispose() {
      single.clear();
      target.removeEventListener('keydown', onKeyDown, { capture });
    },
  };
}

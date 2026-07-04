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
  /** Milliseconds before a pending chord prefix is abandoned. Defaults to `5000`. */
  readonly chordTimeout?: number | undefined;
}

export interface Keybindings {
  /**
   * Register a keybinding using the Monaco-style numeric encoding
   * (`KeyMod.CtrlCmd | KeyCode.KeyS`, `KeyChord(...)`). For string bindings,
   * parse explicitly: `add(parseKeybinding('Ctrl+K Ctrl+S'), ...)` — kept out
   * of the core so the parser only ships to bundles that use it.
   * Invalid encodings register nothing. Returns an unsubscribe function.
   */
  add(keybinding: number, handler: KeybindingHandler, options?: KeybindingOptions): Unsubscribe;
  /** Whether a chord prefix is currently pending (e.g. `Ctrl+K` was pressed). */
  readonly isChordPending: boolean;
  /** Remove all bindings and the DOM listener. */
  dispose(): void;
}

/**
 * A registered binding. Monomorphic on purpose: every record has the same
 * shape so dispatch stays inline-cached in V8.
 */
interface Binding {
  readonly handler: KeybindingHandler;
  readonly when: (() => boolean) | undefined;
  readonly preventDefault: boolean;
  readonly stopPropagation: boolean;
}

const NOOP: Unsubscribe = () => {};

function insert(map: Map<number, Binding[]>, hash: number, binding: Binding): Unsubscribe {
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

function dispatch(bindings: Binding[] | undefined, event: KeyboardEvent): boolean {
  if (bindings === undefined) {
    return false;
  }
  let fired = false;
  // Handlers may dispose bindings (including their own) mid-dispatch. To
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

/**
 * Create a keybinding dispatcher on `target`, including two-part chords
 * (`Ctrl+K Ctrl+S`), using a single `keydown` listener.
 *
 * Hot path per event: compute one integer hash from the event, one `Map`
 * lookup (two while a chord is pending). No allocations.
 *
 * A factory (not a class) so every piece of internal state minifies to a
 * single-letter closure variable instead of an unmangleable property name.
 */
export function keybindings(target: EventTarget, options: KeybindingsOptions = {}): Keybindings {
  const isMac = options.isMac ?? detectIsMac();
  const chordTimeout = options.chordTimeout ?? 5000;
  const capture = options.capture ?? false;

  /** Single-part bindings, keyed by chord hash. */
  const single = new Map<number, Binding[]>();
  /** Chord bindings: first-part hash -> second-part hash -> bindings. */
  const chords = new Map<number, Map<number, Binding[]>>();

  /** Hash of the pending first chord part, or -1. */
  let pending = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clearPending = (): void => {
    pending = -1;
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const onKeyDown = (e: Event): void => {
    const event = e as KeyboardEvent;
    const keyCode = keyCodeFromEvent(event);
    // A lone modifier press must not resolve or cancel anything; the real
    // key of the combination is still on its way down.
    if (isModifierKeyCode(keyCode)) {
      return;
    }
    const hash = chordHashFromParts(event.ctrlKey, event.shiftKey, event.altKey, event.metaKey, keyCode);

    if (pending !== -1) {
      const secondLevel = chords.get(pending);
      clearPending();
      if (secondLevel !== undefined && dispatch(secondLevel.get(hash), event)) {
        return;
      }
      // The second keypress neither completed a chord nor should it trigger
      // single bindings — VS Code swallows it too ("(Ctrl+K) was pressed,
      // waiting for second key" then an unmatched key just resets).
      return;
    }

    if (chords.has(hash)) {
      pending = hash;
      event.preventDefault();
      timer = setTimeout(clearPending, chordTimeout);
      return;
    }

    dispatch(single.get(hash), event);
  };

  target.addEventListener('keydown', onKeyDown, { capture });

  return {
    get isChordPending() {
      return pending !== -1;
    },
    add(keybinding, handler, opts = {}) {
      const parts = decodeKeybinding(keybinding, isMac);
      if (parts === null) {
        return NOOP;
      }
      const binding: Binding = {
        handler,
        when: opts.when,
        preventDefault: opts.preventDefault ?? true,
        stopPropagation: opts.stopPropagation ?? false,
      };
      const firstHash = chordHash(parts[0]!);
      const secondPart = parts[1];

      if (secondPart === undefined) {
        return insert(single, firstHash, binding);
      }

      let secondLevel = chords.get(firstHash);
      if (secondLevel === undefined) {
        secondLevel = new Map();
        chords.set(firstHash, secondLevel);
      }
      const remove = insert(secondLevel, chordHash(secondPart), binding);
      return () => {
        remove();
        if (secondLevel.size === 0) {
          chords.delete(firstHash);
        }
      };
    },
    dispose() {
      clearPending();
      single.clear();
      chords.clear();
      target.removeEventListener('keydown', onKeyDown, { capture });
    },
  };
}

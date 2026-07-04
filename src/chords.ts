/**
 * Chord-capable keybinding dispatcher — a superset of `keybindings()` that
 * also handles two-part sequences (`Ctrl+K Ctrl+S`).
 *
 * Separate module on purpose: most apps only use single-part bindings
 * (`Cmd+S`), so the chord state machine (pending-prefix tracking, timeout,
 * second-level maps, VS Code's swallow-unmatched-key semantics) only ships
 * to bundles that import `chordKeybindings`.
 */
import { chordHash, decodeKeybinding } from './keybindings.js';
import {
  NOOP,
  dispatch,
  eventHash,
  insert,
  makeBinding,
  type Binding,
  type Keybindings,
  type KeybindingsOptions,
} from './keyboard.js';
import { detectIsMac } from './platform.js';

export interface ChordKeybindingsOptions extends KeybindingsOptions {
  /** Milliseconds before a pending chord prefix is abandoned. Defaults to `5000`. */
  readonly chordTimeout?: number | undefined;
}

export interface ChordKeybindings extends Keybindings {
  /** Whether a chord prefix is currently pending (e.g. `Ctrl+K` was pressed). */
  readonly isChordPending: boolean;
}

/**
 * Create a keybinding dispatcher on `target` that handles both single-part
 * bindings and two-part chords (`KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK,
 * KeyMod.CtrlCmd | KeyCode.KeyS)`), using a single `keydown` listener.
 *
 * Chord semantics match VS Code: a chord prefix shadows single bindings on
 * the same combo, an unmatched second key is swallowed and resets the
 * pending state, and lone modifier presses neither resolve nor cancel a
 * pending chord.
 */
export function chordKeybindings(
  target: EventTarget,
  options: ChordKeybindingsOptions = {}
): ChordKeybindings {
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
    const hash = eventHash(event);
    if (hash === -1) {
      return;
    }

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
      const binding = makeBinding(handler, opts);
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

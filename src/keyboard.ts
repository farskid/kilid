import { isModifierKeyCode, keyCodeFromEvent } from './keyCodes.js';
import {
  chordHashFromParts,
  chordHash,
  decodeKeybinding,
  type ResolvedChord,
} from './keybindings.js';
import { addDisposableListener, DisposableStore, toDisposable, type IDisposable } from './lifecycle.js';
import { detectIsMac } from './platform.js';

export type KeybindingHandler = (event: KeyboardEvent) => void;

export interface KeybindingOptions {
  /** Dynamic guard evaluated at dispatch time; the binding only fires when it returns `true`. */
  readonly when?: (() => boolean) | undefined;
  /** Call `preventDefault()` on match. Defaults to `true`. */
  readonly preventDefault?: boolean | undefined;
  /** Call `stopPropagation()` on match. Defaults to `false`. */
  readonly stopPropagation?: boolean | undefined;
}

export interface KeybindingServiceOptions {
  /** Override platform detection (affects how `KeyMod.CtrlCmd`/`KeyMod.WinCtrl` resolve). */
  readonly isMac?: boolean | undefined;
  /** Attach listeners in the capture phase. Defaults to `false`. */
  readonly capture?: boolean | undefined;
  /** Milliseconds before a pending chord prefix is abandoned. Defaults to `5000`. */
  readonly chordTimeout?: number | undefined;
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

const NO_PENDING = -1;

/**
 * Dispatches keyboard events to registered keybindings, including two-part
 * chords (`Ctrl+K Ctrl+S`), using a single `keydown` listener.
 *
 * Hot path per event: compute one integer hash from the event, one `Map`
 * lookup (two while a chord is pending). No allocations.
 */
export class KeybindingService implements IDisposable {
  private readonly _isMac: boolean;
  private readonly _chordTimeout: number;
  private readonly _store = new DisposableStore();

  /** Single-part bindings, keyed by chord hash. */
  private readonly _single = new Map<number, Binding[]>();
  /** Chord bindings: first-part hash -> second-part hash -> bindings. */
  private readonly _chords = new Map<number, Map<number, Binding[]>>();

  /** Hash of the pending first chord part, or NO_PENDING. */
  private _pendingChord = NO_PENDING;
  private _chordTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(target: EventTarget, options: KeybindingServiceOptions = {}) {
    this._isMac = options.isMac ?? detectIsMac();
    this._chordTimeout = options.chordTimeout ?? 5000;
    this._store.add(
      addDisposableListener(target, 'keydown', (e) => this._onKeyDown(e), {
        capture: options.capture ?? false,
      })
    );
  }

  /** Whether a chord prefix is currently pending (e.g. `Ctrl+K` was pressed). */
  get isChordPending(): boolean {
    return this._pendingChord !== NO_PENDING;
  }

  /**
   * Register a keybinding using the Monaco-style numeric encoding
   * (`KeyMod.CtrlCmd | KeyCode.KeyS`, `KeyChord(...)`). For string bindings,
   * parse explicitly: `add(parseKeybinding('Ctrl+K Ctrl+S'), ...)` — kept out
   * of the core so the parser only ships to bundles that use it.
   * Returns a disposable that removes the binding.
   */
  add(keybinding: number, handler: KeybindingHandler, options: KeybindingOptions = {}): IDisposable {
    const parts = decodeKeybinding(keybinding, this._isMac);
    if (parts === null) {
      throw new Error(`Invalid keybinding: ${keybinding}`);
    }
    const binding: Binding = {
      handler,
      when: options.when,
      preventDefault: options.preventDefault ?? true,
      stopPropagation: options.stopPropagation ?? false,
    };

    const firstPart = parts[0] as ResolvedChord;
    const firstHash = chordHash(firstPart);
    const secondPart = parts[1];

    if (secondPart === undefined) {
      return this._insert(this._single, firstHash, binding);
    }

    let secondLevel = this._chords.get(firstHash);
    if (secondLevel === undefined) {
      secondLevel = new Map();
      this._chords.set(firstHash, secondLevel);
    }
    const disposable = this._insert(secondLevel, chordHash(secondPart), binding);
    const chords = this._chords;
    return toDisposable(() => {
      disposable.dispose();
      if (secondLevel.size === 0) {
        chords.delete(firstHash);
      }
    });
  }

  dispose(): void {
    this._clearPendingChord();
    this._single.clear();
    this._chords.clear();
    this._store.dispose();
  }

  private _insert(map: Map<number, Binding[]>, hash: number, binding: Binding): IDisposable {
    let list = map.get(hash);
    if (list === undefined) {
      list = [];
      map.set(hash, list);
    }
    list.push(binding);
    return toDisposable(() => {
      const idx = list.indexOf(binding);
      if (idx >= 0) {
        list.splice(idx, 1);
      }
      if (list.length === 0) {
        map.delete(hash);
      }
    });
  }

  private _onKeyDown(event: KeyboardEvent): void {
    const keyCode = keyCodeFromEvent(event);
    // A lone modifier press must not resolve or cancel anything; the real
    // key of the combination is still on its way down.
    if (isModifierKeyCode(keyCode)) {
      return;
    }
    const hash = chordHashFromParts(event.ctrlKey, event.shiftKey, event.altKey, event.metaKey, keyCode);

    if (this._pendingChord !== NO_PENDING) {
      const secondLevel = this._chords.get(this._pendingChord);
      this._clearPendingChord();
      if (secondLevel !== undefined && this._dispatch(secondLevel.get(hash), event)) {
        return;
      }
      // The second keypress neither completed a chord nor should it trigger
      // single bindings — VS Code swallows it too ("(Ctrl+K) was pressed,
      // waiting for second key" then an unmatched key just resets).
      return;
    }

    if (this._chords.has(hash)) {
      this._pendingChord = hash;
      event.preventDefault();
      this._chordTimer = setTimeout(() => this._clearPendingChord(), this._chordTimeout);
      return;
    }

    this._dispatch(this._single.get(hash), event);
  }

  private _dispatch(bindings: Binding[] | undefined, event: KeyboardEvent): boolean {
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

  private _clearPendingChord(): void {
    this._pendingChord = NO_PENDING;
    if (this._chordTimer !== undefined) {
      clearTimeout(this._chordTimer);
      this._chordTimer = undefined;
    }
  }
}

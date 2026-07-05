# kilid

[![CI](https://github.com/farskid/kilid/actions/workflows/ci.yml/badge.svg)](https://github.com/farskid/kilid/actions/workflows/ci.yml)

**Keyboard, mouse & pointer bindings without the weight.**

A zero-dependency TypeScript library for DOM keyboard, mouse and pointer event bindings — packed into a couple of kilobytes with zero-allocation dispatch.

**[Landing page & live demo →](https://farskid.github.io/kilid/)**

| | |
|---|---|
| Core (no chords) | **1.6 KB** gzip |
| With chords | **1.8 KB** gzip |
| Dependencies | **0** |
| Dispatch throughput | **~2.5M**/sec |

```bash
npm install @farskid/kilid
```

## Why kilid

- **Compact numeric encoding** — bindings are single numbers: `KeyMod.CtrlCmd | KeyCode.KeyS`, chords via `KeyChord(...)` — one integer per binding, resolved at registration.
- **Zero-allocation dispatch** — every event reduces to one integer hash and one `Map` lookup. No strings, objects or closures on the hot path — flat cost at any binding count.
- **Pay only for what you use** — chords, string parsing, the pointer service and the React adapter are separate modules. A `Cmd+S`-only app ships 1.6 KB.
- **Cross-platform by default** — `KeyMod.CtrlCmd` means Cmd on macOS and Ctrl elsewhere. One binding, correct everywhere, resolved once at registration.
- **Layout-independent** — bindings match physical keys via `KeyboardEvent.code`, with an `event.key` fallback for exotic keyboards.
- **One pointing surface** — pointer events subsume mouse. A single service covers down/move/click/wheel with the same modifier encoding, plus pen/touch filters.

## Quick start

```ts
import { KeyMod, KeyCode, keybindings } from '@farskid/kilid';

const keys = keybindings(window);

// Cmd+S on macOS, Ctrl+S elsewhere — a single-part binding
keys.add(KeyMod.CtrlCmd | KeyCode.KeyS, (e) => save());

// Guards and event control
const off = keys.add(KeyMod.CtrlCmd | KeyCode.KeyP, quickOpen, {
  when: () => !modalIsOpen,  // evaluated at dispatch
  preventDefault: true,       // default true for keyboard
});

off();          // add() returns an unsubscribe function
keys.dispose(); // removes all bindings and the DOM listener
```

## API reference

Everything ships from two entry points: `@farskid/kilid` (core) and `@farskid/kilid/react` (adapter). All factories return plain objects; all `add()` calls return an unsubscribe function. Invalid encodings register nothing — the core never throws; in development builds a `console.warn` explains why (stripped from production bundles via `process.env.NODE_ENV`).

### `keybindings(target, options?)`

Single-part keybinding dispatcher (`Cmd+S`, `F2`, `Ctrl+Shift+P`) using one `keydown` listener. Options: `isMac` (override platform detection), `capture`.

```ts
const keys = keybindings(element, { isMac: false });
const off = keys.add(encoded, handler, { when, preventDefault, stopPropagation });
keys.dispose();
```

### `chordKeybindings(target, options?)`

Drop-in superset of `keybindings` that also handles two-part chords (`Ctrl+K Ctrl+S`) with prefix-then-second-key semantics: a chord prefix shadows single bindings on the same combo, an unmatched second key is swallowed, and the pending prefix expires after `chordTimeout` (default 5000 ms). Separate module — apps without chords never ship the state machine.

Note: `Cmd+S` is a single binding with a modifier, *not* a chord; chords are two sequential keypresses.

```ts
import { KeyChord, chordKeybindings } from '@farskid/kilid';

const keys = chordKeybindings(window);
keys.add(
  KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyS),
  openKeyboardShortcuts
);
keys.isChordPending; // true between Ctrl+K and the second part
```

### `pointerBindings(target, options?)`

One service for the whole pointing surface. Event kinds: `down`, `up`, `move`, `enter`, `leave`, `cancel`, `click`, `dblclick`, `contextmenu`, `wheel`. DOM listeners attach lazily per kind and detach when the last binding of that kind unsubscribes. `preventDefault` defaults to `false` here.

```ts
import { KeyMod, MouseButton, pointerBindings } from '@farskid/kilid';

const pointer = pointerBindings(element);

pointer.add(KeyMod.CtrlCmd | MouseButton.Left, 'click', addToSelection);
pointer.add(MouseButton.Middle, 'down', startPan);
pointer.add(KeyMod.CtrlCmd | MouseButton.WheelUp, 'wheel', zoomIn, { preventDefault: true });

// pen/touch filters
pointer.add(MouseButton.Left, 'move', onDraw, { pointerType: ['pen', 'touch'] });
```

For `move`/`enter`/`leave`/`cancel` (where `button` is `-1`), bindings on `MouseButton.Left` match regardless of held buttons — use `when` with `event.buttons` for stricter filtering.

### Encoding: `KeyMod`, `KeyCode`, `MouseButton`, `KeyChord`

A binding is one 32-bit number with a fixed bit layout:

```
15 14 13 12 11 10  9  8  7 ... 0
 -  -  C  S  A  W  [ key code ]     C = CtrlCmd  S = Shift  A = Alt  W = WinCtrl

KeyChord(first, second)  // packs the second part into bits 16–31
```

| Export | Meaning |
|---|---|
| `KeyMod.CtrlCmd` | Cmd on macOS, Ctrl on Windows/Linux |
| `KeyMod.WinCtrl` | Ctrl on macOS, Win/Meta on Windows/Linux |
| `KeyMod.Shift`, `KeyMod.Alt` | Shift; Alt (Option on macOS) |
| `KeyCode.*` | Layout-independent key codes — `KeyA–Z`, `Digit0–9`, `F1–19`, `Numpad0–9`, `Enter`, `Escape`, arrows, punctuation, … (names match `KeyboardEvent.code`) |
| `MouseButton.*` | `Left`, `Middle`, `Right`, `X1`, `X2`, `WheelUp/Down/Left/Right` |
| `keyCodeFromEvent(e)` | Resolve a live `KeyboardEvent` to a key code |
| `isModifierKeyCode(c)` | True for Shift/Ctrl/Alt/Meta |
| `decodeKeybinding(n, isMac)` | Encoded binding → platform-resolved parts |

### Strings: `parseKeybinding` / `formatKeybinding`

String convenience lives in its own module with lazily built tables, so it only ships to bundles that import it. The core `add()` is numeric-only by design — the parser is never pulled in behind your back.

```ts
import { parseKeybinding, formatKeybinding } from '@farskid/kilid';

keys.add(parseKeybinding('Ctrl+Shift+P'), quickOpen);
keys.add(parseKeybinding('Ctrl+K Ctrl+S'), openShortcuts); // chordKeybindings only

formatKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS);                  // "Ctrl+S"
formatKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS, { isMac: true }); // "⌘S"
```

In strings, `Ctrl`, `Cmd`, `Meta` and `Mod` all map to `KeyMod.CtrlCmd` so one string works on every platform; use `WinCtrl`/`Super` for the secondary modifier. Also exported: `keyCodeToString`, `keyCodeFromString` (accepts aliases like `Esc`).

## Recipes

Common patterns that aren't separate API options — capture is a factory flag, one-shot bindings are a few lines of glue, and delegation is native DOM bubbling on whatever `EventTarget` you pass.

### Capture phase

Pass `capture: true` when creating the service. It applies to the whole dispatcher's DOM listener (all bindings on that instance), not per-binding. `keybindings`, `chordKeybindings`, and `pointerBindings` all accept it. React hooks pass it through as `capture` (service-level — hooks on the same target share a listener only when `capture` matches).

```ts
import { KeyMod, KeyCode, MouseButton, keybindings, pointerBindings } from '@farskid/kilid';

// Intercept before targets deeper in the tree (e.g. stop browser shortcuts early)
const keys = keybindings(document, { capture: true });
keys.add(KeyMod.CtrlCmd | KeyCode.KeyS, save);

const list = document.getElementById('list');
const pointer = pointerBindings(list, { capture: true });
pointer.add(MouseButton.Left, 'click', onRowClick);
```

### One-shot binding

There is no `{ once: true }` option — call the unsubscribe function returned by `add()` inside the handler when you only want one fire.

```ts
const keys = keybindings(window);

const off = keys.add(KeyMod.CtrlCmd | KeyCode.KeyS, (e) => {
  off(); // unregister before running — safe even if save throws
  save(e);
});

// same idea for pointer
const pointer = pointerBindings(element);
const offClick = pointer.add(MouseButton.Left, 'click', (e) => {
  offClick();
  confirmOnce(e);
});
```

### Event delegation (bubbling)

Attach to a parent; bubbling events from children reach the listener. There is no built-in selector API — filter with `event.target` and `Element.closest()` inside the handler. The `when` guard receives no event, so it can't filter by target; use it for app-state conditions (`() => !modalIsOpen`) instead. `pointerenter`/`pointerleave` do *not* bubble; bind those on the element you care about. `keydown` bubbles too, but its target is whatever element has focus — so keyboard bindings usually go on `window` rather than a container.

```ts
const list = document.getElementById('list');
const pointer = pointerBindings(list);

pointer.add(MouseButton.Left, 'click', (e) => {
  const row = e.target.closest('[data-id]');
  if (!row) return;
  select(row.dataset.id);
}, {
  when: () => !modalIsOpen, // app-state guard, checked before the handler runs
});
```

## React adapter

`@farskid/kilid/react` is a separate build entry with `react` as an optional peer dependency — if you never import it, no React-related code enters your bundle.

```tsx
import { KeyMod, KeyCode, MouseButton } from '@farskid/kilid';
import { useKeybinding, usePointerBinding } from '@farskid/kilid/react';

function Editor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS, save);   // window by default
  useKeybinding('Ctrl+K Ctrl+S', openShortcuts);        // strings OK here

  usePointerBinding(KeyMod.CtrlCmd | MouseButton.Left, 'click', addToSelection, {
    target: canvasRef,
  });
  usePointerBinding(MouseButton.Left, 'move', onDraw, {
    target: canvasRef,
    pointerType: ['pen', 'touch'],
  });

  return <canvas ref={canvasRef} />;
}
```

Hook options mirror the core API: `target` (EventTarget or ref, default `window`), `when`, `enabled`, `preventDefault`, `stopPropagation`, `capture`, `isMac`, `chordTimeout` (keyboard), and `pointerType` (pointer hook only). Option parity is enforced by `test/adapter-contract.test.ts` so future framework adapters stay aligned with the core.

- **Latest-ref handlers** — inline closures are fine; changing the handler or guard re-registers nothing and costs zero per-render work.
- **Structural deps only** — bindings re-register only when the encoding, target, kind or flags actually change; inline `pointerType` arrays cause no churn.
- **Refcounted service sharing** — hooks on the same target *and* the same service options (`capture`, `isMac`, …) share one listener; the last unmount disposes it.

## Performance & size

The hot path for every event: bitwise hash (modifiers + code packed into one int) → one integer-keyed `Map.get()` → handler call. Zero allocations, matched or not. Dispatch cost is flat with respect to the number of registered bindings (~2.5M dispatches/sec in benchmarks, 10 vs 500 bindings within 10%).

| Bundle scenario | Minified | Gzipped |
|---|---:|---:|
| `keybindings` only (no chords) | 3.3 KB | 1.6 KB |
| `chordKeybindings` | 3.7 KB | 1.8 KB |
| Keyboard + pointer | 5.1 KB | 2.3 KB |
| Everything incl. parse/format | 7.8 KB | 3.3 KB |
| React adapter (all hooks, react external) | 8.8 KB | 3.6 KB |

Sizes are enforced in CI with per-scenario budgets and reported as a comment on every pull request. Size-oriented design: factories instead of classes (state minifies to single-letter closure variables), the `KeyCode` table generated at runtime from packed strings (typed statically via a template-literal union), no reverse enum mappings, no defensive throws, and every convenience layer in its own tree-shakeable module.

Run `npm run bench` for numbers.

## Development

```bash
npm install
npm test              # unit tests (vitest + happy-dom)
npm run test:browser  # smoke tests (Playwright + Chromium)
npm run bench         # dispatch benchmarks
npm run size          # bundle-size report against budgets
npm run build         # tsup -> dist (esm + cjs + d.ts)
```

The landing page lives in `docs/` and deploys to [GitHub Pages](https://farskid.github.io/kilid/) on every push to `main` that touches `docs/**`.

## License

MIT

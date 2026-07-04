# kilid

[![CI](https://github.com/farskid/kilid/actions/workflows/ci.yml/badge.svg)](https://github.com/farskid/kilid/actions/workflows/ci.yml)

Fast, zero-dependency TypeScript keyboard, mouse and pointer management with a Monaco-style keybinding API. Optional tree-shakeable React adapter via `kilid/react`.

- **Monaco-compatible encoding** — `KeyMod.CtrlCmd | KeyCode.KeyS`, `KeyChord(...)`, same bit layout.
- **Chords, pay-per-use** — `Ctrl+K Ctrl+S` with a proper state machine and timeout, like VS Code, via `chordKeybindings()`; apps that only use single bindings (`Cmd+S`) never ship the chord machinery.
- **One pointing surface** — pointer events subsume mouse; a single service covers `down`/`move`/... plus `click`, `dblclick`, `contextmenu` and `wheel`, with `KeyMod` composing over `MouseButton` so `Cmd+Click` (mac) / `Ctrl+Click` (win/linux) is one binding.
- **Zero allocation dispatch** — each event is reduced to one integer hash and one `Map` lookup. No strings, objects or closures are created on the hot path.
- **Layout-independent** — bindings resolve against physical keys (`KeyboardEvent.code`), matching Monaco's behaviour.
- **~1.8 KB gzipped** for the keyboard core; sizes are budgeted in CI and reported on every PR.

## Install

```bash
npm install kilid
```

## Keyboard

```ts
import { KeyMod, KeyCode, keybindings } from 'kilid';

const keys = keybindings(window); // or any HTMLElement

// Monaco-style numeric encoding: one keypress + modifiers
keys.add(KeyMod.CtrlCmd | KeyCode.KeyS, (e) => save());

// String bindings parse explicitly — the parser only ships to bundles
// that import it, keeping the core lean.
import { parseKeybinding } from 'kilid';
keys.add(parseKeybinding('Ctrl+Shift+P'), quickOpen);

// Guards and event control
const off = keys.add(KeyMod.CtrlCmd | KeyCode.KeyP, quickOpen, {
  when: () => !modalIsOpen, // evaluated at dispatch
  preventDefault: true,     // default true for keyboard
});

off();          // add() returns an unsubscribe function
keys.dispose(); // removes all bindings and the DOM listener
```

### Chords (opt-in)

Two-part sequences like VS Code's `Ctrl+K Ctrl+S` live in `chordKeybindings`,
a drop-in superset of `keybindings` — same API plus chord support. It's a
separate module, so the chord state machine only ships to bundles that import
it. (Note: `Cmd+S` is a *single* binding with a modifier, not a chord — it
works in the base `keybindings`.)

```ts
import { KeyMod, KeyCode, KeyChord, chordKeybindings } from 'kilid';

const keys = chordKeybindings(window);

keys.add(
  KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyS),
  () => openKeyboardShortcuts()
);
keys.add(KeyMod.CtrlCmd | KeyCode.KeyS, save); // singles work here too

keys.isChordPending; // true between Ctrl+K and the second part
```

`KeyMod.CtrlCmd` resolves to `Cmd` on macOS and `Ctrl` elsewhere; `KeyMod.WinCtrl` is the inverse. Platform detection is automatic and overridable via `keybindings(target, { isMac })`.

In strings, `Ctrl`, `Cmd`, `Meta` and `Mod` all map to `KeyMod.CtrlCmd` so one string works everywhere; use `WinCtrl`/`Super` for the secondary platform modifier.

### Formatting / parsing

```ts
import { formatKeybinding, parseKeybinding } from 'kilid';

formatKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS);                  // "Ctrl+S"
formatKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS, { isMac: true }); // "⌘S"
parseKeybinding('Ctrl+K Ctrl+S'); // same number as the KeyChord() call above
```

## Pointer (and mouse)

Pointer events cover mouse in every modern browser, so kilid ships a single
service for the whole pointing surface — the click family and wheel are just
extra event kinds on it.

```ts
import { KeyMod, MouseButton, pointerBindings } from 'kilid';

const pointer = pointerBindings(element);

pointer.add(KeyMod.CtrlCmd | MouseButton.Left, 'click', (e) => addToSelection(e));
pointer.add(KeyMod.Alt | MouseButton.Left, 'down', startColumnSelect);
pointer.add(MouseButton.Middle, 'down', startPan);
pointer.add(KeyMod.CtrlCmd | MouseButton.WheelUp, 'wheel', zoomIn, { preventDefault: true });

// Pointer-type filters for pen/touch surfaces
pointer.add(MouseButton.Left, 'down', onPenDown, { pointerType: 'pen' });
pointer.add(MouseButton.Left, 'move', onDraw, { pointerType: ['pen', 'touch'] });
```

Event kinds: `'down' | 'up' | 'move' | 'enter' | 'leave' | 'cancel' | 'click' | 'dblclick' | 'contextmenu' | 'wheel'`.

- `preventDefault` defaults to `false` here (swallowing clicks by default breaks pages).
- DOM listeners attach lazily per event kind and detach when the last binding of that kind unsubscribes.
- For `move`/`enter`/`leave`/`cancel` (where `button` is `-1`), bindings on `MouseButton.Left` match regardless of held buttons; use `when` with `event.buttons` for stricter filtering.
- `add()` returns an unsubscribe function, same as the keyboard service.

## React

The React adapter lives in a separate subpath export, `kilid/react`. It is a
separate build entry with `react` as an optional peer dependency — if you never
import it, no React-related code enters your bundle (verified with esbuild:
a core-only bundle contains zero references to React).

```tsx
import { KeyMod, KeyCode, MouseButton } from 'kilid';
import { useKeybinding, usePointerBinding } from 'kilid/react';

function Editor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Binds to window by default; unbinds on unmount.
  useKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS, save);
  useKeybinding('Ctrl+K Ctrl+S', openShortcuts);

  // Element-scoped via ref targets.
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

Hook options: `target` (EventTarget or ref, default `window`), `when`,
`enabled`, `preventDefault`, `stopPropagation`, and `pointerType` (pointer
hook only).

The adapter is built for render-heavy apps:

- **Latest-ref handlers** — inline closures are fine. Changing the handler or
  `when` guard re-registers nothing; the registered listener reads the current
  function from a ref at dispatch. Zero per-render work.
- **Structural deps only** — bindings re-register only when the encoded
  binding, target, event kind, or dispatch flags actually change. Inline
  `pointerType` arrays are serialized to a primitive dep, so new array
  identities per render cause no churn.
- **Refcounted service sharing** — all hooks bound to the same target share
  one service instance, so the whole app has one `keydown` listener no matter
  how many components use hotkeys. The last unmounting hook disposes it.

## Performance

The hot path for every event is: bitwise hash (modifiers + code packed into one int) → one `Map<number, ...>.get()` → handler call.

- Zero allocations per dispatched event, matched or not.
- One DOM listener per event type per service, regardless of binding count.
- String bindings are parsed once at registration; platform modifier resolution also happens at registration, never at dispatch.
- Chord state is a single pending-hash integer plus a timeout handle.

Run `npm run bench` for numbers. Dispatch cost is flat with respect to the number of registered bindings.

## Bundle size

Sizes are enforced in CI (`npm run size`) with per-scenario budgets, and every
PR gets a size-report comment. Current numbers (esbuild, minified / gzipped):

| Scenario | Minified | Gzipped |
|---|---:|---:|
| `keybindings` only (no chords) | 3.3 KB | 1.6 KB |
| `chordKeybindings` | 3.7 KB | 1.8 KB |
| Keyboard + pointer | 5.1 KB | 2.3 KB |
| Everything incl. parse/format | 7.8 KB | 3.3 KB |

Size-oriented design choices:

- **Factories, not classes** — internal state lives in closure variables that
  minify to single letters; class property names survive minification.
- **Data shipped as data** — the `KeyCode` table is generated at runtime from
  packed strings and tiny loops (derived families like `KeyA–Z`, `F1–19` and
  `Numpad0–9` ship no names at all); the static shape is preserved through a
  type-level union, so `KeyCode.KeyS` still autocompletes.
- **No reverse enum mappings** — `KeyCode`/`MouseButton` are const objects, and
  `KeyCode` member names double as the `KeyboardEvent.code` lookup table.
- **String parsing/formatting is opt-in** — `parseKeybinding` /
  `formatKeybinding` live in a separate module with lazily built tables; the
  core API is numeric-only, so the parser is never pulled in behind your back.
- **No defensive throws in the core** — invalid encodings register nothing.
- **Chords are opt-in** — the pending-prefix state machine ships only with
  `chordKeybindings`; the base dispatcher is a hash-and-lookup.

## Development

```bash
npm install
npm test              # unit tests (vitest + happy-dom)
npm run test:browser  # smoke tests (Playwright + Chromium)
npm run bench         # dispatch benchmarks
npm run size          # bundle-size report against budgets
npm run build         # tsup -> dist (esm + cjs + d.ts)
```

## License

MIT

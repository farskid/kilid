# kilid

[![CI](https://github.com/farskid/kilid/actions/workflows/ci.yml/badge.svg)](https://github.com/farskid/kilid/actions/workflows/ci.yml)

Fast, zero-dependency TypeScript keyboard, mouse and pointer management with a Monaco-style keybinding API. Optional tree-shakeable React adapter via `kilid/react`.

- **Monaco-compatible encoding** — `KeyMod.CtrlCmd | KeyCode.KeyS`, `KeyChord(...)`, same bit layout.
- **Chords** — `Ctrl+K Ctrl+S` with a proper state machine and timeout, like VS Code.
- **Mouse & pointer** — the same `KeyMod` flags compose with `MouseButton`, so `Cmd+Click` (mac) / `Ctrl+Click` (win/linux) is one binding.
- **Zero dependencies, zero allocation dispatch** — each event is reduced to one integer hash and one `Map` lookup. No strings, objects or closures are created on the hot path.
- **Layout-independent** — bindings resolve against physical keys (`KeyboardEvent.code`), matching Monaco's behaviour.

## Install

```bash
npm install kilid
```

## Keyboard

```ts
import { KeyMod, KeyCode, KeyChord, KeybindingService } from 'kilid';

const keys = new KeybindingService(window); // or any HTMLElement

// Monaco-style numeric encoding
keys.add(KeyMod.CtrlCmd | KeyCode.KeyS, (e) => save());

// Chords
keys.add(
  KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyS),
  () => openKeyboardShortcuts()
);

// Strings parse to the same encoding (once, at registration)
keys.add('Ctrl+K Ctrl+S', () => openKeyboardShortcuts());

// Guards and event control
const binding = keys.add(KeyMod.CtrlCmd | KeyCode.KeyP, quickOpen, {
  when: () => !modalIsOpen, // evaluated at dispatch
  preventDefault: true,     // default true for keyboard
});

binding.dispose(); // every add() returns an IDisposable
keys.dispose();    // removes all listeners
```

`KeyMod.CtrlCmd` resolves to `Cmd` on macOS and `Ctrl` elsewhere; `KeyMod.WinCtrl` is the inverse. Platform detection is automatic and overridable via `new KeybindingService(target, { isMac })`.

In strings, `Ctrl`, `Cmd`, `Meta` and `Mod` all map to `KeyMod.CtrlCmd` so one string works everywhere; use `WinCtrl`/`Super` for the secondary platform modifier.

### Formatting / parsing

```ts
import { formatKeybinding, parseKeybinding } from 'kilid';

formatKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS);                  // "Ctrl+S"
formatKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS, { isMac: true }); // "⌘S"
parseKeybinding('Ctrl+K Ctrl+S'); // same number as the KeyChord() call above
```

## Mouse

```ts
import { KeyMod, MouseButton, MouseBindingService } from 'kilid';

const mouse = new MouseBindingService(element);

mouse.add(KeyMod.CtrlCmd | MouseButton.Left, 'click', (e) => addToSelection(e));
mouse.add(KeyMod.Alt | MouseButton.Left, 'down', startColumnSelect);
mouse.add(MouseButton.Middle, 'down', startPan);
mouse.add(KeyMod.CtrlCmd | MouseButton.WheelUp, 'wheel', zoomIn, { preventDefault: true });
```

Event kinds: `'down' | 'up' | 'click' | 'dblclick' | 'contextmenu' | 'wheel'`.
`preventDefault` defaults to `false` for mouse (swallowing clicks by default breaks pages).
DOM listeners attach lazily per event kind and detach when the last binding of that kind is disposed.

## Pointer

```ts
import { MouseButton, PointerBindingService } from 'kilid';

const pointer = new PointerBindingService(element);

pointer.add(MouseButton.Left, 'down', onPenDown, { pointerType: 'pen' });
pointer.add(MouseButton.Left, 'move', onDraw, { pointerType: ['pen', 'touch'] });
```

Event kinds: `'down' | 'up' | 'move' | 'enter' | 'leave' | 'cancel'`.
For `move`/`enter`/`leave`/`cancel` (where `button` is `-1`), bindings on `MouseButton.Left` match regardless of held buttons; use `when` with `event.buttons` for stricter filtering.

## React

The React adapter lives in a separate subpath export, `kilid/react`. It is a
separate build entry with `react` as an optional peer dependency — if you never
import it, no React-related code enters your bundle (verified with esbuild:
a core-only bundle contains zero references to React).

```tsx
import { KeyMod, KeyCode, MouseButton } from 'kilid';
import { useKeybinding, useMouseBinding, usePointerBinding } from 'kilid/react';

function Editor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Binds to window by default; unbinds on unmount.
  useKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS, save);
  useKeybinding('Ctrl+K Ctrl+S', openShortcuts);

  // Element-scoped via ref targets.
  useMouseBinding(KeyMod.CtrlCmd | MouseButton.Left, 'click', addToSelection, {
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

## Development

```bash
npm install
npm test              # unit tests (vitest + happy-dom)
npm run test:browser  # smoke tests (Playwright + Chromium)
npm run bench         # dispatch benchmarks
npm run build         # tsup -> dist (esm + cjs + d.ts)
```

## License

MIT

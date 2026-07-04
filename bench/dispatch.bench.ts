import { bench, describe } from 'vitest';
import { KeyChord, KeyCode, KeyMod, chordKeybindings } from '../src/index.js';

// Benchmarks run against a detached element in happy-dom; numbers are
// relative (dispatch cost per event), not absolute browser figures.

function makeService(bindingCount: number): {
  target: HTMLElement;
  service: ReturnType<typeof chordKeybindings>;
} {
  const target = document.createElement('div');
  const service = chordKeybindings(target, { isMac: false });
  // Spread bindings across many combos so the maps are realistically sized.
  for (let i = 0; i < bindingCount; i++) {
    const keyCode = KeyCode.KeyA + (i % 26);
    const mods =
      i % 3 === 0 ? KeyMod.CtrlCmd : i % 3 === 1 ? KeyMod.CtrlCmd | KeyMod.Shift : KeyMod.Alt;
    service.add(mods | keyCode, () => {});
  }
  service.add(KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyS), () => {});
  return { target, service };
}

function keyEvent(code: string, ctrl: boolean): KeyboardEvent {
  return new KeyboardEvent('keydown', { code, ctrlKey: ctrl, cancelable: true, bubbles: true });
}

describe('keydown dispatch', () => {
  const small = makeService(10);
  const large = makeService(500);
  const hit = keyEvent('KeyA', true);
  const miss = keyEvent('F9', false);

  bench('hit, 10 bindings', () => {
    small.target.dispatchEvent(hit);
  });

  bench('hit, 500 bindings', () => {
    large.target.dispatchEvent(hit);
  });

  bench('miss, 500 bindings', () => {
    large.target.dispatchEvent(miss);
  });
});

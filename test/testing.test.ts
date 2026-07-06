import { KeyMod, KeyCode, KeyChord, MouseButton, chordKeybindings, keybindings, pointerBindings } from '@farskid/kilid';
import {
  dispatchKeybinding,
  dispatchKeyPart,
  dispatchKeybindingString,
  dispatchPointerBinding,
} from '../src/testing/index.js';
import { describe, expect, it, vi } from 'vitest';

describe('@farskid/kilid/testing', () => {
  it('dispatchKeyPart fires a registered keybinding', () => {
    const handler = vi.fn();
    const keys = keybindings(window);
    keys.add(KeyMod.CtrlCmd | KeyCode.KeyS, handler);
    dispatchKeyPart(window, KeyMod.CtrlCmd | KeyCode.KeyS);
    expect(handler).toHaveBeenCalledTimes(1);
    keys.dispose();
  });

  it('dispatchKeybinding dispatches chord sequences in order', () => {
    const handler = vi.fn();
    const keys = chordKeybindings(window);
    const chord = KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyS);
    keys.add(chord, handler);
    dispatchKeyPart(window, KeyMod.CtrlCmd | KeyCode.KeyK);
    expect(handler).not.toHaveBeenCalled();
    dispatchKeyPart(window, KeyMod.CtrlCmd | KeyCode.KeyS);
    expect(handler).toHaveBeenCalledTimes(1);
    keys.dispose();
  });

  it('dispatchKeybindingString parses and dispatches', () => {
    const handler = vi.fn();
    const keys = keybindings(window);
    keys.add(KeyMod.CtrlCmd | KeyCode.KeyP, handler);
    dispatchKeybindingString(window, 'Ctrl+P');
    expect(handler).toHaveBeenCalledTimes(1);
    keys.dispose();
  });

  it('dispatchPointerBinding fires pointer down bindings', () => {
    const el = document.createElement('div');
    const handler = vi.fn();
    const pointer = pointerBindings(el);
    pointer.add(MouseButton.Left, 'down', handler);
    dispatchPointerBinding(el, MouseButton.Left, 'down');
    expect(handler).toHaveBeenCalledTimes(1);
    pointer.dispose();
  });

  it('dispatchPointerBinding respects modifier encodings', () => {
    const el = document.createElement('div');
    const handler = vi.fn();
    const pointer = pointerBindings(el);
    pointer.add(KeyMod.Shift | MouseButton.Left, 'click', handler);
    dispatchPointerBinding(el, MouseButton.Left, 'click');
    expect(handler).not.toHaveBeenCalled();
    dispatchPointerBinding(el, KeyMod.Shift | MouseButton.Left, 'click');
    expect(handler).toHaveBeenCalledTimes(1);
    pointer.dispose();
  });
});

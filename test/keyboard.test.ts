import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyChord, KeyCode, KeyMod, keybindings, parseKeybinding } from '../src/index.js';

function key(
  target: EventTarget,
  code: string,
  mods: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean } = {}
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    code,
    ctrlKey: mods.ctrl ?? false,
    shiftKey: mods.shift ?? false,
    altKey: mods.alt ?? false,
    metaKey: mods.meta ?? false,
    cancelable: true,
    bubbles: true,
  });
  target.dispatchEvent(event);
  return event;
}

describe('keybindings', () => {
  let target: HTMLElement;
  let service: ReturnType<typeof keybindings>;

  beforeEach(() => {
    target = document.createElement('div');
    service = keybindings(target, { isMac: false });
  });

  afterEach(() => {
    service.dispose();
  });

  it('fires on exact modifier+key match only', () => {
    const handler = vi.fn();
    service.add(KeyMod.CtrlCmd | KeyCode.KeyS, handler);

    key(target, 'KeyS');
    key(target, 'KeyS', { ctrl: true, shift: true });
    expect(handler).not.toHaveBeenCalled();

    key(target, 'KeyS', { ctrl: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('resolves CtrlCmd to meta on mac', () => {
    const macService = keybindings(target, { isMac: true });
    const handler = vi.fn();
    macService.add(KeyMod.CtrlCmd | KeyCode.KeyS, handler);

    key(target, 'KeyS', { ctrl: true });
    expect(handler).not.toHaveBeenCalled();
    key(target, 'KeyS', { meta: true });
    expect(handler).toHaveBeenCalledTimes(1);
    macService.dispose();
  });

  it('accepts string bindings', () => {
    const handler = vi.fn();
    service.add(parseKeybinding('Ctrl+Shift+P'), handler);
    key(target, 'KeyP', { ctrl: true, shift: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('prevents default by default and can opt out', () => {
    service.add(KeyMod.CtrlCmd | KeyCode.KeyS, () => {});
    expect(key(target, 'KeyS', { ctrl: true }).defaultPrevented).toBe(true);

    service.add(KeyMod.CtrlCmd | KeyCode.KeyO, () => {}, { preventDefault: false });
    expect(key(target, 'KeyO', { ctrl: true }).defaultPrevented).toBe(false);
  });

  it('respects when guards', () => {
    let enabled = false;
    const handler = vi.fn();
    service.add(KeyCode.Escape, handler, { when: () => enabled });

    key(target, 'Escape');
    expect(handler).not.toHaveBeenCalled();
    enabled = true;
    key(target, 'Escape');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes a single binding', () => {
    const handler = vi.fn();
    const off = service.add(KeyCode.F2, handler);
    key(target, 'F2');
    off();
    key(target, 'F2');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores lone modifier keydowns', () => {
    const handler = vi.fn();
    service.add(KeyMod.CtrlCmd | KeyCode.KeyS, handler);
    key(target, 'ControlLeft', { ctrl: true });
    key(target, 'KeyS', { ctrl: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('chord encodings register nothing (chords live in chordKeybindings)', () => {
    const handler = vi.fn();
    const off = service.add(
      KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyS),
      handler
    );
    key(target, 'KeyK', { ctrl: true });
    key(target, 'KeyS', { ctrl: true });
    expect(handler).not.toHaveBeenCalled();
    off(); // unsubscribing the no-op is safe
  });

  it('handler disposing its own binding does not skip others', () => {
    const calls: string[] = [];
    const off1 = service.add(
      KeyCode.F3,
      () => {
        calls.push('first');
        off1();
      },
      { preventDefault: false }
    );
    service.add(KeyCode.F3, () => calls.push('second'), { preventDefault: false });

    key(target, 'F3');
    key(target, 'F3');
    expect(calls).toEqual(['first', 'second', 'second']);
  });
});

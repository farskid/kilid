import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyChord, KeyCode, KeyMod, chordKeybindings, parseKeybinding } from '../src/index.js';

function key(
  target: EventTarget,
  code: string,
  mods: { ctrl?: boolean; shift?: boolean } = {}
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    code,
    ctrlKey: mods.ctrl ?? false,
    shiftKey: mods.shift ?? false,
    cancelable: true,
    bubbles: true,
  });
  target.dispatchEvent(event);
  return event;
}

describe('chordKeybindings', () => {
  let target: HTMLElement;
  let service: ReturnType<typeof chordKeybindings>;

  beforeEach(() => {
    target = document.createElement('div');
    service = chordKeybindings(target, { isMac: false });
  });

  afterEach(() => {
    service.dispose();
  });

  it('invalid encodings register nothing and warn in dev', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const off = service.add(0, vi.fn());
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('invalid'));
    off();
    warn.mockRestore();
  });

  it('handles single-part bindings too (superset of keybindings)', () => {
    const handler = vi.fn();
    service.add(KeyMod.CtrlCmd | KeyCode.KeyS, handler);
    key(target, 'KeyS', { ctrl: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('fires after both parts', () => {
    const handler = vi.fn();
    service.add(KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyS), handler);

    key(target, 'KeyK', { ctrl: true });
    expect(handler).not.toHaveBeenCalled();
    expect(service.isChordPending).toBe(true);

    key(target, 'KeyS', { ctrl: true });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(service.isChordPending).toBe(false);
  });

  it('modifier keydown between parts does not break the chord', () => {
    const handler = vi.fn();
    service.add(parseKeybinding('Ctrl+K Ctrl+S'), handler);
    key(target, 'KeyK', { ctrl: true });
    key(target, 'ControlLeft', { ctrl: true });
    key(target, 'KeyS', { ctrl: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('an unmatched second key resets and is swallowed', () => {
    const chordHandler = vi.fn();
    const singleHandler = vi.fn();
    service.add(parseKeybinding('Ctrl+K Ctrl+S'), chordHandler);
    service.add(parseKeybinding('Ctrl+X'), singleHandler);

    key(target, 'KeyK', { ctrl: true });
    key(target, 'KeyX', { ctrl: true });
    expect(chordHandler).not.toHaveBeenCalled();
    expect(singleHandler).not.toHaveBeenCalled();
    expect(service.isChordPending).toBe(false);

    // Once the chord state is reset, singles work again.
    key(target, 'KeyX', { ctrl: true });
    expect(singleHandler).toHaveBeenCalledTimes(1);
  });

  it('a chord prefix shadows a single binding on the same combo', () => {
    const single = vi.fn();
    const chord = vi.fn();
    service.add(parseKeybinding('Ctrl+K'), single);
    service.add(parseKeybinding('Ctrl+K Ctrl+S'), chord);

    key(target, 'KeyK', { ctrl: true });
    expect(single).not.toHaveBeenCalled();
    key(target, 'KeyS', { ctrl: true });
    expect(chord).toHaveBeenCalledTimes(1);
  });

  it('pending chord expires after the timeout', () => {
    vi.useFakeTimers();
    try {
      const handler = vi.fn();
      service.add(parseKeybinding('Ctrl+K Ctrl+S'), handler);
      key(target, 'KeyK', { ctrl: true });
      expect(service.isChordPending).toBe(true);
      vi.advanceTimersByTime(5001);
      expect(service.isChordPending).toBe(false);
      key(target, 'KeyS', { ctrl: true });
      expect(handler).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('two chords sharing a prefix both work', () => {
    const a = vi.fn();
    const b = vi.fn();
    service.add(parseKeybinding('Ctrl+K Ctrl+S'), a);
    service.add(parseKeybinding('Ctrl+K Ctrl+C'), b);

    key(target, 'KeyK', { ctrl: true });
    key(target, 'KeyC', { ctrl: true });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing the last chord on a prefix stops the prefix from swallowing', () => {
    const single = vi.fn();
    const off = service.add(parseKeybinding('Ctrl+K Ctrl+S'), () => {});
    service.add(parseKeybinding('Ctrl+K'), single, { preventDefault: false });

    off();
    key(target, 'KeyK', { ctrl: true });
    expect(service.isChordPending).toBe(false);
    expect(single).toHaveBeenCalledTimes(1);
  });
});

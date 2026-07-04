import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyChord, KeyCode, KeyMod, KeybindingService, parseKeybinding } from '../src/index.js';

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

describe('KeybindingService', () => {
  let target: HTMLElement;
  let service: KeybindingService;

  beforeEach(() => {
    target = document.createElement('div');
    service = new KeybindingService(target, { isMac: false });
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
    const macService = new KeybindingService(target, { isMac: true });
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

  it('dispose removes a single binding', () => {
    const handler = vi.fn();
    const disposable = service.add(KeyCode.F2, handler);
    key(target, 'F2');
    disposable.dispose();
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

  describe('chords', () => {
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
  });

  it('handler disposing its own binding does not skip others', () => {
    const calls: string[] = [];
    const d1 = service.add(
      KeyCode.F3,
      () => {
        calls.push('first');
        d1.dispose();
      },
      { preventDefault: false }
    );
    service.add(KeyCode.F3, () => calls.push('second'), { preventDefault: false });

    key(target, 'F3');
    key(target, 'F3');
    expect(calls).toEqual(['first', 'second', 'second']);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyMod, MouseButton, pointerBindings } from '../src/index.js';

function pointer(
  target: EventTarget,
  type: string,
  init: { button?: number; pointerType?: string; ctrl?: boolean; shift?: boolean } = {}
): PointerEvent {
  // happy-dom may not expose a PointerEvent constructor with full init
  // support, so fall back to a MouseEvent with the extra fields patched on.
  const base: PointerEventInit & MouseEventInit = {
    button: init.button ?? 0,
    ctrlKey: init.ctrl ?? false,
    shiftKey: init.shift ?? false,
    cancelable: true,
    bubbles: true,
  };
  let event: Event;
  if (typeof PointerEvent !== 'undefined') {
    event = new PointerEvent(type, { ...base, pointerType: init.pointerType ?? 'mouse' });
  } else {
    event = new MouseEvent(type, base);
  }
  if ((event as PointerEvent).pointerType !== (init.pointerType ?? 'mouse')) {
    Object.defineProperty(event, 'pointerType', { value: init.pointerType ?? 'mouse' });
  }
  target.dispatchEvent(event);
  return event as PointerEvent;
}

function mouse(
  target: EventTarget,
  type: string,
  button: number,
  mods: { ctrl?: boolean; shift?: boolean; meta?: boolean } = {}
): MouseEvent {
  const event = new MouseEvent(type, {
    button,
    ctrlKey: mods.ctrl ?? false,
    shiftKey: mods.shift ?? false,
    metaKey: mods.meta ?? false,
    cancelable: true,
    bubbles: true,
  });
  target.dispatchEvent(event);
  return event;
}

function wheel(target: EventTarget, deltaY: number, mods: { ctrl?: boolean } = {}): WheelEvent {
  const event = new WheelEvent('wheel', {
    deltaY,
    ctrlKey: mods.ctrl ?? false,
    cancelable: true,
    bubbles: true,
  });
  // happy-dom's WheelEvent constructor drops the MouseEvent modifier init.
  if (event.ctrlKey !== (mods.ctrl ?? false)) {
    Object.defineProperty(event, 'ctrlKey', { value: mods.ctrl ?? false });
  }
  target.dispatchEvent(event);
  return event;
}

describe('pointerBindings', () => {
  let target: HTMLElement;
  let service: ReturnType<typeof pointerBindings>;

  beforeEach(() => {
    target = document.createElement('div');
    service = pointerBindings(target, { isMac: false });
  });

  afterEach(() => {
    service.dispose();
  });

  it('matches pointerdown with modifiers', () => {
    const handler = vi.fn();
    service.add(KeyMod.Shift | MouseButton.Left, 'down', handler);

    pointer(target, 'pointerdown', { button: 0 });
    expect(handler).not.toHaveBeenCalled();
    pointer(target, 'pointerdown', { button: 0, shift: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('filters by pointer type', () => {
    const penOnly = vi.fn();
    const penOrTouch = vi.fn();
    service.add(MouseButton.Left, 'down', penOnly, { pointerType: 'pen' });
    service.add(MouseButton.Left, 'down', penOrTouch, { pointerType: ['pen', 'touch'] });

    pointer(target, 'pointerdown', { pointerType: 'mouse' });
    expect(penOnly).not.toHaveBeenCalled();
    expect(penOrTouch).not.toHaveBeenCalled();

    pointer(target, 'pointerdown', { pointerType: 'pen' });
    pointer(target, 'pointerdown', { pointerType: 'touch' });
    expect(penOnly).toHaveBeenCalledTimes(1);
    expect(penOrTouch).toHaveBeenCalledTimes(2);
  });

  it('treats move events (button === -1) as Left', () => {
    const handler = vi.fn();
    service.add(MouseButton.Left, 'move', handler);
    pointer(target, 'pointermove', { button: -1 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('dispose removes all listeners', () => {
    const handler = vi.fn();
    service.add(MouseButton.Left, 'down', handler);
    service.dispose();
    pointer(target, 'pointerdown', { button: 0 });
    expect(handler).not.toHaveBeenCalled();
  });

  describe('mouse-event kinds', () => {
    it('matches button + modifiers per event kind', () => {
      const handler = vi.fn();
      service.add(KeyMod.CtrlCmd | MouseButton.Left, 'click', handler);

      mouse(target, 'click', 0);
      mouse(target, 'mousedown', 0, { ctrl: true });
      mouse(target, 'click', 1, { ctrl: true });
      expect(handler).not.toHaveBeenCalled();

      mouse(target, 'click', 0, { ctrl: true });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('resolves CtrlCmd to cmd+click on mac', () => {
      const macService = pointerBindings(target, { isMac: true });
      const handler = vi.fn();
      macService.add(KeyMod.CtrlCmd | MouseButton.Left, 'click', handler);

      mouse(target, 'click', 0, { ctrl: true });
      expect(handler).not.toHaveBeenCalled();
      mouse(target, 'click', 0, { meta: true });
      expect(handler).toHaveBeenCalledTimes(1);
      macService.dispose();
    });

    it('plain MouseEvents (no pointerType) match any pointerType filter', () => {
      const handler = vi.fn();
      service.add(MouseButton.Right, 'contextmenu', handler, { pointerType: 'pen' });
      const e = new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true });
      Object.defineProperty(e, 'pointerType', { value: undefined });
      target.dispatchEvent(e);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('maps wheel deltas to directions', () => {
      const up = vi.fn();
      const down = vi.fn();
      service.add(KeyMod.CtrlCmd | MouseButton.WheelUp, 'wheel', up);
      service.add(KeyMod.CtrlCmd | MouseButton.WheelDown, 'wheel', down);

      wheel(target, -100, { ctrl: true });
      wheel(target, 100, { ctrl: true });
      wheel(target, 100); // no modifier -> no match
      expect(up).toHaveBeenCalledTimes(1);
      expect(down).toHaveBeenCalledTimes(1);
    });

    it('does not preventDefault unless asked', () => {
      service.add(MouseButton.Left, 'click', () => {});
      expect(mouse(target, 'click', 0).defaultPrevented).toBe(false);

      service.add(MouseButton.Right, 'contextmenu', () => {}, { preventDefault: true });
      expect(mouse(target, 'contextmenu', 2).defaultPrevented).toBe(true);
    });

    it('attaches listeners lazily and detaches on last unsubscribe', () => {
      const spyAdd = vi.spyOn(target, 'addEventListener');
      const spyRemove = vi.spyOn(target, 'removeEventListener');

      const offA = service.add(MouseButton.Left, 'click', () => {});
      const offB = service.add(MouseButton.Right, 'click', () => {});
      expect(spyAdd).toHaveBeenCalledTimes(1); // one shared 'click' listener

      offA();
      expect(spyRemove).not.toHaveBeenCalled();
      offB();
      expect(spyRemove).toHaveBeenCalledTimes(1);
    });

    it('chord encodings register nothing and warn in dev', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const handler = vi.fn();
      const off = service.add((MouseButton.Left | (MouseButton.Left << 16)) >>> 0, 'click', handler);
      mouse(target, 'click', 0);
      expect(handler).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('keyboard-only'));
      off(); // and unsubscribing the no-op is safe
      warn.mockRestore();
    });
  });
});

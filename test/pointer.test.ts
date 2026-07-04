import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyMod, MouseButton, PointerBindingService } from '../src/index.js';

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

describe('PointerBindingService', () => {
  let target: HTMLElement;
  let service: PointerBindingService;

  beforeEach(() => {
    target = document.createElement('div');
    service = new PointerBindingService(target, { isMac: false });
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
});

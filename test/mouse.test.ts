import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyMod, MouseBindingService, MouseButton } from '../src/index.js';

function mouse(
  target: EventTarget,
  type: string,
  button: number,
  mods: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean } = {}
): MouseEvent {
  const event = new MouseEvent(type, {
    button,
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

describe('MouseBindingService', () => {
  let target: HTMLElement;
  let service: MouseBindingService;

  beforeEach(() => {
    target = document.createElement('div');
    service = new MouseBindingService(target, { isMac: false });
  });

  afterEach(() => {
    service.dispose();
  });

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
    const macService = new MouseBindingService(target, { isMac: true });
    const handler = vi.fn();
    macService.add(KeyMod.CtrlCmd | MouseButton.Left, 'click', handler);

    mouse(target, 'click', 0, { ctrl: true });
    expect(handler).not.toHaveBeenCalled();
    mouse(target, 'click', 0, { meta: true });
    expect(handler).toHaveBeenCalledTimes(1);
    macService.dispose();
  });

  it('supports middle/right buttons and contextmenu', () => {
    const middle = vi.fn();
    const context = vi.fn();
    service.add(MouseButton.Middle, 'down', middle);
    service.add(MouseButton.Right, 'contextmenu', context);

    mouse(target, 'mousedown', 1);
    mouse(target, 'contextmenu', 2);
    expect(middle).toHaveBeenCalledTimes(1);
    expect(context).toHaveBeenCalledTimes(1);
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

  it('attaches listeners lazily and detaches on last dispose', () => {
    const spyAdd = vi.spyOn(target, 'addEventListener');
    const spyRemove = vi.spyOn(target, 'removeEventListener');

    const a = service.add(MouseButton.Left, 'click', () => {});
    const b = service.add(MouseButton.Right, 'click', () => {});
    expect(spyAdd).toHaveBeenCalledTimes(1); // one shared 'click' listener

    a.dispose();
    expect(spyRemove).not.toHaveBeenCalled();
    b.dispose();
    expect(spyRemove).toHaveBeenCalledTimes(1);
  });

  it('rejects chord encodings', () => {
    expect(() => service.add((MouseButton.Left | (MouseButton.Left << 16)) >>> 0, 'click', () => {})).toThrow();
  });
});

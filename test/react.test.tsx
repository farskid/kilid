import { act, cleanup, render } from '@testing-library/react';
import { useRef, useState, type RefObject } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyCode, KeyMod, MouseButton } from '../src/index.js';
import { useKeybinding, useParsedKeybinding, usePointerBinding } from '../src/react/index.js';

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

afterEach(cleanup);

describe('useKeybinding', () => {
  it('binds to window by default and unbinds on unmount', () => {
    const handler = vi.fn();
    function Comp() {
      useKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS, handler);
      return null;
    }
    const { unmount } = render(<Comp />);

    key(window, 'KeyS', { ctrl: true });
    expect(handler).toHaveBeenCalledTimes(1);

    unmount();
    key(window, 'KeyS', { ctrl: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('calls service dispose (removes keydown listener) when the last hook unmounts', () => {
    const spyRemove = vi.spyOn(window, 'removeEventListener');
    const handler = vi.fn();
    function Comp() {
      useKeybinding(KeyCode.F1, handler);
      return null;
    }
    const { unmount } = render(<Comp />);

    unmount();
    expect(spyRemove).toHaveBeenCalledWith('keydown', expect.any(Function), expect.any(Object));
    key(window, 'F1');
    expect(handler).not.toHaveBeenCalled();
    spyRemove.mockRestore();
  });

  it('does not dispose the shared service until the last hook on a target unmounts', () => {
    const spyRemove = vi.spyOn(window, 'removeEventListener');
    const a = vi.fn();
    const b = vi.fn();
    let showA = true;
    function Parent() {
      return (
        <>
          {showA ? <CompA /> : null}
          <CompB />
        </>
      );
    }
    function CompA() {
      useKeybinding(KeyCode.F5, a);
      return null;
    }
    function CompB() {
      useKeybinding(KeyCode.F6, b);
      return null;
    }
    const { rerender } = render(<Parent />);

    showA = false;
    rerender(<Parent />);
    expect(spyRemove).not.toHaveBeenCalled();
    key(window, 'F6');
    expect(b).toHaveBeenCalledTimes(1);

    cleanup();
    expect(spyRemove).toHaveBeenCalledWith('keydown', expect.any(Function), expect.any(Object));
    key(window, 'F6');
    expect(b).toHaveBeenCalledTimes(1);
    spyRemove.mockRestore();
  });

  it('accepts string bindings via useParsedKeybinding', () => {
    const handler = vi.fn();
    function Comp() {
      useParsedKeybinding('Ctrl+Shift+P', handler);
      return null;
    }
    render(<Comp />);
    key(window, 'KeyP', { ctrl: true, shift: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('always calls the latest handler without re-registering', () => {
    const calls: number[] = [];
    let setValue: (n: number) => void = () => {};
    function Comp() {
      const [value, set] = useState(0);
      setValue = set;
      // Inline closure: a new function identity every render.
      useKeybinding(KeyCode.F2, () => calls.push(value));
      return null;
    }
    render(<Comp />);

    key(window, 'F2');
    act(() => setValue(42));
    key(window, 'F2');
    expect(calls).toEqual([0, 42]);
  });

  it('shares one service (and DOM listener) across hooks on the same target', () => {
    const spyAdd = vi.spyOn(window, 'addEventListener');
    const a = vi.fn();
    const b = vi.fn();
    function Comp() {
      useKeybinding(KeyCode.F5, a);
      useKeybinding(KeyCode.F6, b);
      return null;
    }
    const { unmount } = render(<Comp />);

    const keydownAdds = spyAdd.mock.calls.filter(([type]) => type === 'keydown');
    expect(keydownAdds).toHaveLength(1);

    key(window, 'F5');
    key(window, 'F6');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    unmount();
    spyAdd.mockRestore();
  });

  it('shares one capture-phase service when capture matches', () => {
    const spyAdd = vi.spyOn(window, 'addEventListener');
    function Comp() {
      useKeybinding(KeyCode.F5, vi.fn(), { capture: true });
      useKeybinding(KeyCode.F6, vi.fn(), { capture: true });
      return null;
    }
    render(<Comp />);
    const keydownAdds = spyAdd.mock.calls.filter(([type]) => type === 'keydown');
    expect(keydownAdds).toHaveLength(1);
    expect(keydownAdds[0]![2]).toEqual({ capture: true });
    spyAdd.mockRestore();
  });

  it('respects enabled and a changing when guard without re-registering', () => {
    const handler = vi.fn();
    let setAllowed: (v: boolean) => void = () => {};
    function Comp() {
      const [allowed, set] = useState(false);
      setAllowed = set;
      useKeybinding(KeyCode.Escape, handler, { when: () => allowed });
      return null;
    }
    render(<Comp />);

    key(window, 'Escape');
    expect(handler).not.toHaveBeenCalled();
    act(() => setAllowed(true));
    key(window, 'Escape');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('binds to a ref target once it mounts', () => {
    const handler = vi.fn();
    let elRef: RefObject<HTMLDivElement | null> = { current: null };
    function Comp() {
      const ref = useRef<HTMLDivElement>(null);
      elRef = ref;
      useKeybinding(KeyCode.Enter, handler, { target: ref, preventDefault: false });
      return <div ref={ref} tabIndex={0} />;
    }
    render(<Comp />);

    expect(elRef.current).not.toBeNull();
    key(elRef.current!, 'Enter');
    expect(handler).toHaveBeenCalledTimes(1);

    // Window is not bound.
    handler.mockClear();
    key(window, 'Enter');
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire when disabled', () => {
    const handler = vi.fn();
    function Comp({ on }: { on: boolean }) {
      useKeybinding(KeyCode.F4, handler, { enabled: on });
      return null;
    }
    const { rerender } = render(<Comp on={false} />);
    key(window, 'F4');
    expect(handler).not.toHaveBeenCalled();

    rerender(<Comp on={true} />);
    key(window, 'F4');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('usePointerBinding with mouse kinds', () => {
  it('dispatches modifier+button per kind', () => {
    const handler = vi.fn();
    let elRef: RefObject<HTMLDivElement | null> = { current: null };
    function Comp() {
      const ref = useRef<HTMLDivElement>(null);
      elRef = ref;
      usePointerBinding(KeyMod.Shift | MouseButton.Left, 'click', handler, { target: ref });
      return <div ref={ref} />;
    }
    render(<Comp />);

    elRef.current!.dispatchEvent(new MouseEvent('click', { button: 0, bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
    elRef.current!.dispatchEvent(
      new MouseEvent('click', { button: 0, shiftKey: true, bubbles: true })
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('usePointerBinding', () => {
  it('unbinds and disposes on unmount when it is the last hook on the target', () => {
    const handler = vi.fn();
    let elRef: RefObject<HTMLDivElement | null> = { current: null };
    const spyRemove = vi.spyOn(HTMLElement.prototype, 'removeEventListener');
    function Comp() {
      const ref = useRef<HTMLDivElement>(null);
      elRef = ref;
      usePointerBinding(MouseButton.Left, 'down', handler, { target: ref });
      return <div ref={ref} />;
    }
    const { unmount } = render(<Comp />);
    const el = elRef.current!;

    el.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);

    unmount();
    expect(spyRemove).toHaveBeenCalledWith('pointerdown', expect.any(Function), expect.any(Object));
    el.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    spyRemove.mockRestore();
  });

  it('filters by pointer type with inline arrays (no re-register churn)', () => {
    const handler = vi.fn();
    let elRef: RefObject<HTMLDivElement | null> = { current: null };
    function Comp() {
      const ref = useRef<HTMLDivElement>(null);
      elRef = ref;
      usePointerBinding(MouseButton.Left, 'down', handler, {
        target: ref,
        pointerType: ['pen', 'touch'], // new array identity every render
      });
      return <div ref={ref} />;
    }
    const { rerender } = render(<Comp />);
    rerender(<Comp />);

    const down = (pointerType: string) => {
      const e = new MouseEvent('pointerdown', { button: 0, bubbles: true });
      Object.defineProperty(e, 'pointerType', { value: pointerType });
      elRef.current!.dispatchEvent(e);
    };
    down('mouse');
    expect(handler).not.toHaveBeenCalled();
    down('pen');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('buttonless overload: usePointerBinding("move", handler)', () => {
    const handler = vi.fn();
    let elRef: RefObject<HTMLDivElement | null> = { current: null };
    function Comp() {
      const ref = useRef<HTMLDivElement>(null);
      elRef = ref;
      usePointerBinding('move', handler, { target: ref });
      return <div ref={ref} />;
    }
    render(<Comp />);
    elRef.current!.dispatchEvent(new MouseEvent('pointermove', { button: -1, bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('modifier-only overload: move while Alt is held', () => {
    const handler = vi.fn();
    let elRef: RefObject<HTMLDivElement | null> = { current: null };
    function Comp() {
      const ref = useRef<HTMLDivElement>(null);
      elRef = ref;
      usePointerBinding(KeyMod.Alt, 'move', handler, { target: ref });
      return <div ref={ref} />;
    }
    render(<Comp />);
    elRef.current!.dispatchEvent(new MouseEvent('pointermove', { button: -1, bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
    elRef.current!.dispatchEvent(
      new MouseEvent('pointermove', { button: -1, altKey: true, bubbles: true })
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

import { act, cleanup, render } from '@testing-library/react';
import { useRef, useState, type RefObject } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyCode, KeyMod, MouseButton } from '../src/index.js';
import { useKeybinding, useMouseBinding, usePointerBinding } from '../src/react/index.js';

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

  it('accepts string bindings', () => {
    const handler = vi.fn();
    function Comp() {
      useKeybinding('Ctrl+Shift+P', handler);
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

describe('useMouseBinding', () => {
  it('dispatches modifier+button per kind', () => {
    const handler = vi.fn();
    let elRef: RefObject<HTMLDivElement | null> = { current: null };
    function Comp() {
      const ref = useRef<HTMLDivElement>(null);
      elRef = ref;
      useMouseBinding(KeyMod.Shift | MouseButton.Left, 'click', handler, { target: ref });
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
});

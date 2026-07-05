import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  KEYBOARD_ADAPTER_BINDING_OPTION_KEYS,
  KEYBOARD_ADAPTER_SERVICE_OPTION_KEYS,
  POINTER_ADAPTER_BINDING_OPTION_KEYS,
  POINTER_ADAPTER_SERVICE_OPTION_KEYS,
  hasOptionKeys,
  type KeyboardAdapterBindingOptions,
  type KeyboardAdapterServiceOptions,
  type PointerAdapterBindingOptions,
  type PointerAdapterServiceOptions,
} from '../src/adapter-contract.js';
import { KeyCode, KeyMod, MouseButton } from '../src/index.js';
import type { UseKeybindingOptions, UsePointerBindingOptions } from '../src/react/index.js';
import { useKeybinding, usePointerBinding } from '../src/react/index.js';

/** Compile-time: adapter hook options must expose every contract key. */
type MissingKeys<Required, Actual> = Exclude<keyof Required, keyof Actual>;
type AssertCovers<Required, Actual> = MissingKeys<Required, Actual> extends never
  ? true
  : `adapter missing keys: ${MissingKeys<Required, Actual> & string}`;

type _ReactKeyboardService = AssertCovers<KeyboardAdapterServiceOptions, UseKeybindingOptions>;
type _ReactKeyboardBinding = AssertCovers<KeyboardAdapterBindingOptions, UseKeybindingOptions>;
type _ReactPointerService = AssertCovers<PointerAdapterServiceOptions, UsePointerBindingOptions>;
type _ReactPointerBinding = AssertCovers<PointerAdapterBindingOptions, UsePointerBindingOptions>;

const _compileTimeContract: [
  _ReactKeyboardService,
  _ReactKeyboardBinding,
  _ReactPointerService,
  _ReactPointerBinding,
] = [true, true, true, true];

void _compileTimeContract;

afterEach(cleanup);

function key(
  target: EventTarget,
  code: string,
  mods: { ctrl?: boolean; meta?: boolean } = {}
): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      code,
      ctrlKey: mods.ctrl ?? false,
      metaKey: mods.meta ?? false,
      cancelable: true,
      bubbles: true,
    })
  );
}

describe('adapter contract: option key registry', () => {
  it('lists every keyboard service option the core exposes to adapters', () => {
    expect(KEYBOARD_ADAPTER_SERVICE_OPTION_KEYS).toEqual(['capture', 'isMac', 'chordTimeout']);
  });

  it('lists every pointer service option the core exposes to adapters', () => {
    expect(POINTER_ADAPTER_SERVICE_OPTION_KEYS).toEqual(['capture', 'isMac']);
  });

  it('lists keyboard and pointer binding options adapters must passthrough', () => {
    expect(KEYBOARD_ADAPTER_BINDING_OPTION_KEYS).toEqual([
      'when',
      'preventDefault',
      'stopPropagation',
      'enabled',
    ]);
    expect(POINTER_ADAPTER_BINDING_OPTION_KEYS).toEqual([
      'when',
      'preventDefault',
      'stopPropagation',
      'pointerType',
      'enabled',
    ]);
  });
});

describe('adapter contract: React behavioral coverage', () => {
  it('accepts every keyboard service option without throwing', () => {
    const handler = vi.fn();
    function Comp() {
      useKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS, handler, {
        capture: true,
        isMac: true,
        chordTimeout: 1000,
      });
      return null;
    }
    expect(() => render(<Comp />)).not.toThrow();
    expect(
      hasOptionKeys(
        { capture: true, isMac: true, chordTimeout: 1000 } satisfies KeyboardAdapterServiceOptions,
        KEYBOARD_ADAPTER_SERVICE_OPTION_KEYS
      )
    ).toBe(true);
  });

  it('accepts every keyboard binding option without throwing', () => {
    const handler = vi.fn();
    function Comp() {
      useKeybinding(KeyCode.Escape, handler, {
        when: () => true,
        preventDefault: false,
        stopPropagation: true,
        enabled: true,
      });
      return null;
    }
    expect(() => render(<Comp />)).not.toThrow();
    expect(
      hasOptionKeys(
        {
          when: () => true,
          preventDefault: false,
          stopPropagation: true,
          enabled: true,
        } satisfies KeyboardAdapterBindingOptions,
        KEYBOARD_ADAPTER_BINDING_OPTION_KEYS
      )
    ).toBe(true);
  });

  it('accepts every pointer service and binding option without throwing', () => {
    const handler = vi.fn();
    function Comp() {
      const ref = useRef<HTMLDivElement>(null);
      usePointerBinding(MouseButton.Left, 'click', handler, {
        target: ref,
        capture: true,
        isMac: false,
        when: () => true,
        preventDefault: true,
        stopPropagation: true,
        pointerType: ['pen'],
        enabled: true,
      });
      return <div ref={ref} />;
    }
    expect(() => render(<Comp />)).not.toThrow();
    expect(
      hasOptionKeys({ capture: true, isMac: false } satisfies PointerAdapterServiceOptions, [
        ...POINTER_ADAPTER_SERVICE_OPTION_KEYS,
      ])
    ).toBe(true);
    expect(
      hasOptionKeys(
        {
          when: () => true,
          preventDefault: true,
          stopPropagation: true,
          pointerType: ['pen'],
          enabled: true,
        } satisfies PointerAdapterBindingOptions,
        POINTER_ADAPTER_BINDING_OPTION_KEYS
      )
    ).toBe(true);
  });

  it('wires capture: true on keyboard hooks to the DOM listener', () => {
    const spyAdd = vi.spyOn(window, 'addEventListener');
    function Comp() {
      useKeybinding(KeyCode.F1, vi.fn(), { capture: true });
      return null;
    }
    render(<Comp />);
    expect(spyAdd).toHaveBeenCalledWith('keydown', expect.any(Function), { capture: true });
    spyAdd.mockRestore();
  });

  it('wires capture: true on pointer hooks to the DOM listener', () => {
    const spyAdd = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    function Comp() {
      const ref = useRef<HTMLDivElement>(null);
      usePointerBinding(MouseButton.Left, 'click', vi.fn(), { target: ref, capture: true });
      return <div ref={ref} />;
    }
    render(<Comp />);
    expect(spyAdd).toHaveBeenCalledWith('click', expect.any(Function), { capture: true });
    spyAdd.mockRestore();
  });

  it('uses separate keyboard services when capture differs on the same target', () => {
    const spyAdd = vi.spyOn(window, 'addEventListener');
    function Comp() {
      useKeybinding(KeyCode.F1, vi.fn());
      useKeybinding(KeyCode.F2, vi.fn(), { capture: true });
      return null;
    }
    render(<Comp />);
    const keydownAdds = spyAdd.mock.calls.filter(([type]) => type === 'keydown');
    expect(keydownAdds).toHaveLength(2);
    expect(
      keydownAdds.some(([, , opts]) => (opts as AddEventListenerOptions).capture === true)
    ).toBe(true);
    expect(
      keydownAdds.some(([, , opts]) => (opts as AddEventListenerOptions).capture === false)
    ).toBe(true);
    spyAdd.mockRestore();
  });

  it('passes isMac to the underlying keyboard service', () => {
    const handler = vi.fn();
    function Comp() {
      useKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS, handler, { isMac: true });
      return null;
    }
    render(<Comp />);
    // On "mac", CtrlCmd resolves to metaKey — not ctrlKey.
    key(window, 'KeyS', { meta: true });
    expect(handler).toHaveBeenCalledTimes(1);
    key(window, 'KeyS', { ctrl: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

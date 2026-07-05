import { describe, expect, it, vi } from 'vitest';
import { KeyCode, KeyMod, MouseButton } from '../src/index.js';
import { bindKeybinding, bindPointerBinding } from '../src/svelte/index.js';

describe('svelte adapter (bind helpers)', () => {
  it('bindKeybinding registers on window', () => {
    const handler = vi.fn();
    const off = bindKeybinding(window, KeyMod.CtrlCmd | KeyCode.KeyS, handler);
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyS', ctrlKey: true, bubbles: true })
    );
    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });

  it('bindPointerBinding registers pointer down', () => {
    const el = document.createElement('div');
    const handler = vi.fn();
    const off = bindPointerBinding(el, MouseButton.Left, 'down', handler);
    el.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });
});

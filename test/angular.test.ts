import { describe, expect, it, vi } from 'vitest';
import { KeyCode, KeyMod } from '../src/index.js';
import { bindKeybinding } from '../src/angular/index.js';

describe('angular adapter (bind helpers)', () => {
  it('bindKeybinding registers on target', () => {
    const handler = vi.fn();
    const off = bindKeybinding(window, KeyMod.CtrlCmd | KeyCode.KeyS, handler);
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyS', ctrlKey: true, bubbles: true })
    );
    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });
});

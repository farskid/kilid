import { createRoot } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { KeyCode, KeyMod } from '../src/index.js';
import { createKeybinding } from '../src/solid/index.js';

describe('solid adapter', () => {
  it('createKeybinding fires on keydown', async () => {
    const handler = vi.fn();
    let dispose!: () => void;
    createRoot((d) => {
      dispose = d;
      createKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS, () => handler);
    });
    await Promise.resolve();
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyS', ctrlKey: true, bubbles: true })
    );
    expect(handler).toHaveBeenCalledTimes(1);
    dispose();
  });
});

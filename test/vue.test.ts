import { defineComponent, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { KeyCode, KeyMod, MouseButton } from '../src/index.js';
import { useKeybinding, usePointerBinding } from '../src/vue/index.js';

describe('vue adapter', () => {
  it('useKeybinding registers and fires', () => {
    const handler = vi.fn();
    const Comp = defineComponent({
      setup() {
        useKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS, handler);
      },
      template: '<div />',
    });
    mount(Comp);
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyS', ctrlKey: true, bubbles: true })
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('usePointerBinding registers pointer down on window', async () => {
    const handler = vi.fn();
    const Comp = defineComponent({
      setup() {
        usePointerBinding(MouseButton.Left, 'down', handler);
      },
      template: '<div />',
    });
    mount(Comp);
    await nextTick();
    window.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

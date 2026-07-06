/**
 * Test helpers for dispatching DOM events that match kilid binding encodings.
 *
 * Import from `@farskid/kilid/testing` in Vitest, Playwright, or Storybook.
 * Keeps tests aligned with the same numeric / string encodings production uses.
 */
export { dispatchKeybinding, dispatchKeyPart, type DispatchKeyOptions } from './dispatch-key.js';
export { dispatchPointerBinding, type DispatchPointerOptions } from './dispatch-pointer.js';
export { dispatchKeybindingString } from './dispatch-string.js';
export { keyCodeToDomCode, POINTER_KIND_TO_DOM } from './internal.js';

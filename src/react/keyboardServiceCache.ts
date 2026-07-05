import type { KeyboardAdapterServiceOptions } from '../adapter-contract.js';
import { keybindings, type Keybindings } from '../keyboard.js';
import { keyboardServiceKey } from './shared.js';
import { createServiceCache } from './serviceCache.js';

export const keyboardServices = /* @__PURE__ */ createServiceCache<
  Keybindings,
  KeyboardAdapterServiceOptions
>((target, options) => keybindings(target, options), keyboardServiceKey);

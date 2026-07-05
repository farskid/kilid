import type { KeyboardAdapterServiceOptions } from '../adapter-contract.js';
import { chordKeybindings, type ChordKeybindings } from '../chords.js';
import { keybindings, type Keybindings } from '../keyboard.js';
import { keyboardServiceKey } from './options.js';
import { createServiceCache } from './serviceCache.js';

export const keyboardServices = /* @__PURE__ */ createServiceCache<
  Keybindings,
  KeyboardAdapterServiceOptions
>((target, options) => keybindings(target, options), keyboardServiceKey);

export const chordServices = /* @__PURE__ */ createServiceCache<
  ChordKeybindings,
  KeyboardAdapterServiceOptions
>((target, options) => chordKeybindings(target, options), keyboardServiceKey);

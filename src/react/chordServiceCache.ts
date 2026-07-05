import type { KeyboardAdapterServiceOptions } from '../adapter-contract.js';
import { chordKeybindings, type ChordKeybindings } from '../chords.js';
import { keyboardServiceKey } from './shared.js';
import { createServiceCache } from './serviceCache.js';

export const chordServices = /* @__PURE__ */ createServiceCache<
  ChordKeybindings,
  KeyboardAdapterServiceOptions
>((target, options) => chordKeybindings(target, options), keyboardServiceKey);

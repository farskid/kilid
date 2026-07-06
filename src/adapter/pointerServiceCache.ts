import type { PointerAdapterServiceOptions } from '../adapter-contract.js';
import { pointerBindings, type PointerBindings } from '../pointer.js';
import { pointerServiceKey } from './options.js';
import { createServiceCache } from './serviceCache.js';

export const pointerServices = /* @__PURE__ */ createServiceCache<
  PointerBindings,
  PointerAdapterServiceOptions
>((target, options) => pointerBindings(target, options), pointerServiceKey);

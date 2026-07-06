import type { KeyboardAdapterServiceOptions } from '../adapter-contract.js';
import type { KeybindingHandler, KeybindingOptions, Keybindings } from '../keyboard.js';
import type { ServiceCache } from './serviceCache.js';

export function subscribeKeybinding(
  encoded: number,
  getHandler: () => KeybindingHandler,
  getWhen: () => KeybindingOptions['when'],
  target: EventTarget,
  serviceOptions: KeyboardAdapterServiceOptions,
  bindingOptions: Pick<KeybindingOptions, 'preventDefault' | 'stopPropagation'>,
  services: ServiceCache<Keybindings, KeyboardAdapterServiceOptions>
): () => void {
  const service = services.acquire(target, serviceOptions);
  const off = service.add(encoded, (e) => getHandler()(e), {
    when: () => {
      const w = getWhen();
      return w === undefined || w();
    },
    preventDefault: bindingOptions.preventDefault,
    stopPropagation: bindingOptions.stopPropagation,
  });
  return () => {
    off();
    services.release(target, serviceOptions);
  };
}

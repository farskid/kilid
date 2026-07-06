import type { PointerAdapterServiceOptions } from '../adapter-contract.js';
import type {
  PointerBindingHandler,
  PointerBindingOptions,
  PointerBindings,
  PointerEventKind,
  PointerType,
} from '../pointer.js';
import { pointerTypeKey } from './options.js';
import type { ServiceCache } from './serviceCache.js';

export function subscribePointerBinding<K extends PointerEventKind>(
  binding: number,
  kind: K,
  getHandler: () => PointerBindingHandler<K>,
  getWhen: () => PointerBindingOptions['when'],
  target: EventTarget,
  serviceOptions: PointerAdapterServiceOptions,
  bindingOptions: Pick<PointerBindingOptions, 'preventDefault' | 'stopPropagation'> & {
    readonly pointerType?: PointerType | readonly PointerType[] | undefined;
  },
  services: ServiceCache<PointerBindings, PointerAdapterServiceOptions>
): () => void {
  const service = services.acquire(target, serviceOptions);
  const typeKey = pointerTypeKey(bindingOptions.pointerType);
  const off = service.add(binding, kind, ((e) => getHandler()(e)) as PointerBindingHandler<K>, {
    when: () => {
      const w = getWhen();
      return w === undefined || w();
    },
    preventDefault: bindingOptions.preventDefault,
    stopPropagation: bindingOptions.stopPropagation,
    pointerType: typeKey === '' ? undefined : (typeKey.split(',') as PointerType[]),
  });
  return () => {
    off();
    services.release(target, serviceOptions);
  };
}

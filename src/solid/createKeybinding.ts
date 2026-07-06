import { createEffect, onCleanup, type Accessor } from 'solid-js';
import type { KeybindingHandler } from '../keyboard.js';
import { keyboardServices, chordServices } from '../adapter/keyboardServiceCache.js';
import { subscribeKeybinding } from '../adapter/subscribeKeybinding.js';
import { keyboardServiceOptions, type KeyboardHookOptions } from '../adapter/options.js';
import { resolveAdapterTarget } from '../adapter/resolveTarget.js';
import { isKeyChordEncoding } from '../keybindings.js';
import { parseKeybinding } from '../format.js';

function createKeyboardBinding(
  getBinding: Accessor<number>,
  handler: Accessor<KeybindingHandler>,
  options: KeyboardHookOptions,
  services: typeof keyboardServices
): void {
  createEffect(() => {
    if (!(options.enabled ?? true)) return;
    const target = resolveAdapterTarget(options.target);
    if (target === null) return;
    const encoded = getBinding();
    onCleanup(
      subscribeKeybinding(
        encoded,
        handler,
        () => options.when,
        target,
        keyboardServiceOptions(options),
        { preventDefault: options.preventDefault, stopPropagation: options.stopPropagation },
        services
      )
    );
  });
}

export function createKeybinding(
  binding: Accessor<number> | number,
  handler: Accessor<KeybindingHandler>,
  options: KeyboardHookOptions = {}
): void {
  const getBinding = typeof binding === 'function' ? binding : () => binding;
  createKeyboardBinding(getBinding, handler, options, keyboardServices);
}

export function createChordKeybinding(
  binding: Accessor<number> | number,
  handler: Accessor<KeybindingHandler>,
  options: KeyboardHookOptions = {}
): void {
  const getBinding = typeof binding === 'function' ? binding : () => binding;
  createKeyboardBinding(getBinding, handler, options, chordServices);
}

export function createParsedKeybinding(
  binding: Accessor<string> | string,
  handler: Accessor<KeybindingHandler>,
  options: KeyboardHookOptions = {}
): void {
  const getBinding = typeof binding === 'function' ? binding : () => binding;
  createEffect(() => {
    if (!(options.enabled ?? true)) return;
    const target = resolveAdapterTarget(options.target);
    if (target === null) return;
    const encoded = parseKeybinding(getBinding());
    const services = isKeyChordEncoding(encoded) ? chordServices : keyboardServices;
    onCleanup(
      subscribeKeybinding(
        encoded,
        handler,
        () => options.when,
        target,
        keyboardServiceOptions(options),
        { preventDefault: options.preventDefault, stopPropagation: options.stopPropagation },
        services
      )
    );
  });
}

import { parseKeybinding } from '../format.js';
import { dispatchKeybinding, type DispatchKeyOptions } from './dispatch-key.js';

/**
 * Parse a string binding and dispatch matching keydown event(s).
 * Pulls in `parseKeybinding` — use {@link dispatchKeybinding} with numeric
 * encodings when you want to avoid the parser module.
 */
export function dispatchKeybindingString(
  target: EventTarget,
  binding: string,
  options: DispatchKeyOptions = {}
): KeyboardEvent[] {
  return dispatchKeybinding(target, parseKeybinding(binding), options);
}

/**
 * React adapter for kilid.
 *
 * Import from `@farskid/kilid/react` — this entry is built separately and is never
 * included in your bundle unless you import it.
 *
 * Hooks are split so tree-shaking works: importing `useKeybinding` does not pull
 * in pointer bindings, chord state, or the string parser. Use
 * `useChordKeybinding` for chords and `useParsedKeybinding` for string bindings.
 *
 * Performance design:
 * - Handler and `when` guard live in refs (latest-ref pattern), so changing
 *   them re-registers nothing: no listener churn, no binding Map mutation,
 *   zero work per render.
 * - Bindings only re-register when something structural changes: the encoded
 *   binding, the target, event kind, or dispatch flags.
 * - All hooks bound to the same EventTarget share one refcounted service
 *   (one DOM listener per event type across the whole app).
 */
export type { BindingTarget, CommonHookOptions, UseKeybindingOptions, UsePointerBindingOptions } from './shared.js';
export { useKeybinding } from './useKeybinding.js';
export { useChordKeybinding } from './useChordKeybinding.js';
export { useParsedKeybinding } from './useParsedKeybinding.js';
export { usePointerBinding } from './usePointerBinding.js';

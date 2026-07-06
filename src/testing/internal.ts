/**
 * Map a {@link KeyCode} value to `KeyboardEvent.code`.
 * Member names match DOM codes except arrows and left-modifier aliases.
 */
import { KeyCode, type KeyCodeName } from '../keyCodes.js';

const MEMBER_TO_DOM_CODE: Partial<Record<KeyCodeName, string>> = {
  LeftArrow: 'ArrowLeft',
  UpArrow: 'ArrowUp',
  RightArrow: 'ArrowRight',
  DownArrow: 'ArrowDown',
  Shift: 'ShiftLeft',
  Ctrl: 'ControlLeft',
  Alt: 'AltLeft',
  Meta: 'MetaLeft',
};

export function keyCodeToDomCode(keyCode: number): string {
  for (const name of Object.keys(KeyCode) as KeyCodeName[]) {
    if (KeyCode[name] === keyCode) {
      const mapped = MEMBER_TO_DOM_CODE[name];
      if (mapped !== undefined) {
        return mapped;
      }
      if (
        name.startsWith('Key') ||
        name.startsWith('Digit') ||
        name.startsWith('Numpad') ||
        (name.startsWith('F') && name.length <= 3)
      ) {
        return name;
      }
      return name;
    }
  }
  return 'Unidentified';
}

/** DOM event type for each pointer binding kind (mirrors core). */
export const POINTER_KIND_TO_DOM = {
  down: 'pointerdown',
  up: 'pointerup',
  move: 'pointermove',
  enter: 'pointerenter',
  leave: 'pointerleave',
  cancel: 'pointercancel',
  click: 'click',
  dblclick: 'dblclick',
  contextmenu: 'contextmenu',
  wheel: 'wheel',
} as const;

export type TestPointerKind = keyof typeof POINTER_KIND_TO_DOM;

/** Mouse / wheel button encoded in the low bits of a pointer binding. */
export function buttonFromPointerBinding(binding: number): number {
  return binding & 0xff;
}

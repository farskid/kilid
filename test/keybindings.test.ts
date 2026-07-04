import { describe, expect, it } from 'vitest';
import {
  KeyChord,
  KeyCode,
  KeyMod,
  decodeKeybinding,
  formatKeybinding,
  keyCodeFromEvent,
  keyCodeFromString,
  keyCodeToString,
  parseKeybinding,
} from '../src/index.js';

describe('encoding', () => {
  it('packs modifiers and key code like Monaco', () => {
    const kb = KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyP;
    expect(kb).toBe(2048 | 1024 | KeyCode.KeyP);
  });

  it('KeyChord packs the second part into the high 16 bits', () => {
    const first = KeyMod.CtrlCmd | KeyCode.KeyK;
    const second = KeyMod.CtrlCmd | KeyCode.KeyS;
    const chord = KeyChord(first, second);
    expect(chord & 0xffff).toBe(first);
    expect(chord >>> 16).toBe(second);
  });

  it('decodes CtrlCmd as ctrl on win/linux and meta on mac', () => {
    const kb = KeyMod.CtrlCmd | KeyCode.KeyS;
    const win = decodeKeybinding(kb, false)!;
    expect(win[0]).toMatchObject({ ctrlKey: true, metaKey: false, keyCode: KeyCode.KeyS });
    const mac = decodeKeybinding(kb, true)!;
    expect(mac[0]).toMatchObject({ ctrlKey: false, metaKey: true, keyCode: KeyCode.KeyS });
  });

  it('decodes WinCtrl as meta on win/linux and ctrl on mac', () => {
    const kb = KeyMod.WinCtrl | KeyCode.KeyS;
    expect(decodeKeybinding(kb, false)![0]).toMatchObject({ ctrlKey: false, metaKey: true });
    expect(decodeKeybinding(kb, true)![0]).toMatchObject({ ctrlKey: true, metaKey: false });
  });

  it('returns null for empty/invalid encodings', () => {
    expect(decodeKeybinding(0, false)).toBeNull();
    expect(decodeKeybinding(KeyMod.CtrlCmd, false)).toBeNull();
  });
});

describe('parseKeybinding', () => {
  it('parses single parts', () => {
    expect(parseKeybinding('Ctrl+S')).toBe(KeyMod.CtrlCmd | KeyCode.KeyS);
    expect(parseKeybinding('ctrl+shift+p')).toBe(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyP);
    expect(parseKeybinding('Alt+F4')).toBe(KeyMod.Alt | KeyCode.F4);
    expect(parseKeybinding('Cmd+K')).toBe(KeyMod.CtrlCmd | KeyCode.KeyK);
    expect(parseKeybinding('Mod+Enter')).toBe(KeyMod.CtrlCmd | KeyCode.Enter);
  });

  it('parses chords', () => {
    expect(parseKeybinding('Ctrl+K Ctrl+S')).toBe(
      KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyS)
    );
  });

  it('parses punctuation and named keys', () => {
    expect(parseKeybinding('Ctrl+=')).toBe(KeyMod.CtrlCmd | KeyCode.Equal);
    expect(parseKeybinding('Ctrl+Backquote')).toBe(KeyMod.CtrlCmd | KeyCode.Backquote);
    expect(parseKeybinding('Escape')).toBe(KeyCode.Escape);
    expect(parseKeybinding('shift+esc')).toBe(KeyMod.Shift | KeyCode.Escape);
  });

  it('throws on garbage', () => {
    expect(() => parseKeybinding('')).toThrow();
    expect(() => parseKeybinding('Ctrl+')).toThrow();
    expect(() => parseKeybinding('Frob+X')).toThrow();
    expect(() => parseKeybinding('A B C')).toThrow();
  });
});

describe('formatKeybinding', () => {
  it('round-trips with parse', () => {
    for (const s of ['Ctrl+S', 'Ctrl+Shift+P', 'Ctrl+K Ctrl+S', 'Alt+F4']) {
      expect(formatKeybinding(parseKeybinding(s))).toBe(s);
    }
  });

  it('uses mac symbols', () => {
    expect(formatKeybinding(KeyMod.CtrlCmd | KeyCode.KeyS, { isMac: true })).toBe('⌘S');
    expect(
      formatKeybinding(KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.KeyP, { isMac: true })
    ).toBe('⌥⇧⌘P');
  });
});

describe('key code resolution', () => {
  it('maps KeyboardEvent.code first, falls back to key', () => {
    expect(keyCodeFromEvent(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'y' }))).toBe(
      KeyCode.KeyZ
    );
    expect(keyCodeFromEvent(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(KeyCode.Enter);
    expect(keyCodeFromEvent(new KeyboardEvent('keydown', { key: '☃' }))).toBe(KeyCode.Unknown);
  });

  it('resolves derived code families without table entries', () => {
    const cases: Array<[string, KeyCode]> = [
      ['KeyA', KeyCode.KeyA],
      ['Digit7', KeyCode.Digit7],
      ['F12', KeyCode.F12],
      ['Numpad5', KeyCode.Numpad5],
      ['NumpadEnter', KeyCode.NumpadEnter],
      ['Semicolon', KeyCode.Semicolon],
      ['BracketLeft', KeyCode.BracketLeft],
      ['ArrowLeft', KeyCode.LeftArrow],
      ['ShiftRight', KeyCode.Shift],
      ['MetaLeft', KeyCode.Meta],
      ['Pause', KeyCode.PauseBreak],
    ];
    for (const [code, expected] of cases) {
      expect(keyCodeFromEvent(new KeyboardEvent('keydown', { code })), code).toBe(expected);
    }
  });

  it('resolves single-char key values (letters, digits, punctuation)', () => {
    const cases: Array<[string, KeyCode]> = [
      ['k', KeyCode.KeyK],
      ['K', KeyCode.KeyK],
      ['3', KeyCode.Digit3],
      [' ', KeyCode.Space],
      [';', KeyCode.Semicolon],
      ["'", KeyCode.Quote],
      ['\\', KeyCode.Backslash],
    ];
    for (const [key, expected] of cases) {
      expect(keyCodeFromEvent(new KeyboardEvent('keydown', { key })), JSON.stringify(key)).toBe(expected);
    }
  });

  it('round-trips labels', () => {
    expect(keyCodeToString(KeyCode.KeyK)).toBe('K');
    expect(keyCodeToString(KeyCode.Digit0)).toBe('0');
    expect(keyCodeToString(KeyCode.PageUp)).toBe('PageUp');
    expect(keyCodeToString(KeyCode.Semicolon)).toBe(';');
    expect(keyCodeFromString('K')).toBe(KeyCode.KeyK);
    expect(keyCodeFromString('pageup')).toBe(KeyCode.PageUp);
    expect(keyCodeFromString(';')).toBe(KeyCode.Semicolon);
    expect(keyCodeFromString('semicolon')).toBe(KeyCode.Semicolon);
    expect(keyCodeFromString('esc')).toBe(KeyCode.Escape);
    expect(keyCodeFromString('bogus')).toBe(KeyCode.Unknown);
  });
});

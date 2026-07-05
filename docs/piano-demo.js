import { KeyCode, MouseButton, pointerBindings } from 'https://esm.sh/@farskid/kilid@0.1.0';

/** One octave starting at C4. */
const PIANO = [
  { note: 'C', pc: 0, type: 'white', freq: 261.63, code: KeyCode.KeyA, label: 'A' },
  { note: 'C#', pc: 1, type: 'black', freq: 277.18, code: KeyCode.KeyW, label: 'W' },
  { note: 'D', pc: 2, type: 'white', freq: 293.66, code: KeyCode.KeyS, label: 'S' },
  { note: 'D#', pc: 3, type: 'black', freq: 311.13, code: KeyCode.KeyE, label: 'E' },
  { note: 'E', pc: 4, type: 'white', freq: 329.63, code: KeyCode.KeyD, label: 'D' },
  { note: 'F', pc: 5, type: 'white', freq: 349.23, code: KeyCode.KeyF, label: 'F' },
  { note: 'F#', pc: 6, type: 'black', freq: 369.99, code: KeyCode.KeyT, label: 'T' },
  { note: 'G', pc: 7, type: 'white', freq: 392.0, code: KeyCode.KeyG, label: 'G' },
  { note: 'G#', pc: 8, type: 'black', freq: 415.3, code: KeyCode.KeyY, label: 'Y' },
  { note: 'A', pc: 9, type: 'white', freq: 440.0, code: KeyCode.KeyH, label: 'H' },
  { note: 'A#', pc: 10, type: 'black', freq: 466.16, code: KeyCode.KeyU, label: 'U' },
  { note: 'B', pc: 11, type: 'white', freq: 493.88, code: KeyCode.KeyJ, label: 'J' },
];

/** Selected pitch classes → chord name (demo lookup table). */
const CHORDS = [
  { name: 'C', pcs: [0, 4, 7] },
  { name: 'Cm', pcs: [0, 3, 7] },
  { name: 'Dm', pcs: [2, 5, 9] },
  { name: 'Em', pcs: [4, 7, 11] },
  { name: 'F', pcs: [5, 9, 0] },
  { name: 'G', pcs: [7, 11, 2] },
  { name: 'Am', pcs: [9, 0, 4] },
  { name: 'Bdim', pcs: [11, 2, 5] },
  { name: 'Cmaj7', pcs: [0, 4, 7, 11] },
  { name: 'G7', pcs: [7, 11, 2, 5] },
];

const BY_EVENT_CODE = Object.fromEntries(PIANO.map((k) => ['Key' + k.label, k]));

const demoEl = document.getElementById('piano-demo');
const pianoEl = document.getElementById('piano');
const chordEl = document.getElementById('piano-chord');
const notesEl = document.getElementById('piano-notes');
const countEl = document.getElementById('piano-binding-count');
const clearEl = document.getElementById('piano-clear');

if (!pianoEl || !chordEl || !notesEl) {
  throw new Error('Piano demo markup missing');
}

const TOGGLE_MODE = window.matchMedia('(pointer: coarse)').matches;
const active = new Map();
const heldKeys = new Set();
let bindingCount = 0;
let audioCtx;

function sigFromPcs(pcs) {
  return [...pcs].sort((a, b) => a - b).join(',');
}

const CHORD_BY_SIG = Object.fromEntries(CHORDS.map((c) => [sigFromPcs(c.pcs), c.name]));

function ensureAudio() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq) {
  const ctx = ensureAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.4);
}

function updateDisplay() {
  const names = [...active.values()].map((k) => k.note);
  notesEl.textContent = names.length ? names.join(' + ') : '\u2014';

  if (clearEl) clearEl.hidden = names.length === 0;

  if (names.length === 0) {
    chordEl.textContent = 'select notes';
    chordEl.dataset.state = 'idle';
    return;
  }

  const sig = sigFromPcs([...active.keys()]);
  const match = CHORD_BY_SIG[sig];
  if (match) {
    chordEl.textContent = match;
    chordEl.dataset.state = 'match';
    return;
  }

  chordEl.dataset.state = 'partial';
  if (names.length === 1) {
    chordEl.textContent = 'add more notes';
  } else {
    chordEl.textContent = 'no chord match';
  }
}

function latchKey(key) {
  if (active.has(key.pc)) return;
  active.set(key.pc, key);
  key.el.classList.add('down', 'latched');
  playTone(key.freq);
  updateDisplay();
}

function unlatchKey(key) {
  if (!active.has(key.pc)) return;
  active.delete(key.pc);
  key.el.classList.remove('down', 'latched');
  updateDisplay();
}

function toggleKey(key) {
  if (active.has(key.pc)) unlatchKey(key);
  else latchKey(key);
}

function clearAll() {
  [...active.values()].forEach((key) => {
    key.el.classList.remove('down', 'latched');
  });
  active.clear();
  heldKeys.clear();
  updateDisplay();
}

function buildPiano() {
  const whiteWrap = document.createElement('div');
  whiteWrap.className = 'piano-whites';
  const blackWrap = document.createElement('div');
  blackWrap.className = 'piano-blacks';

  PIANO.filter((k) => k.type === 'white').forEach((key) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'piano-key white';
    el.setAttribute('aria-label', key.note);
    el.innerHTML =
      '<span class="note" aria-hidden="true">' + key.note + '</span>' +
      '<span class="kbd" aria-hidden="true">' + key.label + '</span>';
    key.el = el;
    whiteWrap.appendChild(el);
  });

  PIANO.filter((k) => k.type === 'black').forEach((key) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'piano-key black';
    el.setAttribute('aria-label', key.note);
    el.innerHTML =
      '<span class="note" aria-hidden="true">' + key.note.replace('#', '\u266f') + '</span>' +
      '<span class="kbd" aria-hidden="true">' + key.label + '</span>';
    key.el = el;
    blackWrap.appendChild(el);
  });

  pianoEl.appendChild(whiteWrap);
  pianoEl.appendChild(blackWrap);
}

function registerPointerBindings() {
  PIANO.forEach((key) => {
    const pointer = pointerBindings(key.el);

    if (TOGGLE_MODE) {
      pointer.add(
        MouseButton.Left,
        'down',
        (e) => {
          e.preventDefault();
          toggleKey(key);
        },
        { preventDefault: true }
      );
      bindingCount += 1;
      return;
    }

    pointer.add(
      MouseButton.Left,
      'down',
      (e) => {
        e.preventDefault();
        if (!active.has(key.pc)) {
          latchKey(key);
          try {
            key.el.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }
      },
      { preventDefault: true }
    );
    bindingCount += 1;

    pointer.add(
      MouseButton.Left,
      'up',
      () => {
        if (active.has(key.pc)) unlatchKey(key);
      },
      { preventDefault: true }
    );
    bindingCount += 1;

    pointer.add(MouseButton.Left, 'leave', (e) => {
      if ((e.buttons & 1) && active.has(key.pc)) unlatchKey(key);
    });
    bindingCount += 1;
  });
}

function registerKeyboard() {
  if (TOGGLE_MODE) return;

  pianoEl.tabIndex = -1;
  pianoEl.addEventListener('pointerdown', () => pianoEl.focus({ preventScroll: true }));

  pianoEl.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = BY_EVENT_CODE[e.code];
    if (!key || e.repeat || heldKeys.has(key.pc)) return;
    e.preventDefault();
    heldKeys.add(key.pc);
    latchKey(key);
  });
  pianoEl.addEventListener('keyup', (e) => {
    const key = BY_EVENT_CODE[e.code];
    if (!key) return;
    e.preventDefault();
    heldKeys.delete(key.pc);
    unlatchKey(key);
  });
}

if (demoEl) {
  demoEl.addEventListener(
    'touchstart',
    (e) => {
      if (e.target.closest('.piano-key')) e.preventDefault();
    },
    { passive: false }
  );
}

if (clearEl) {
  clearEl.hidden = false;
  clearEl.addEventListener('click', (e) => {
    e.preventDefault();
    clearAll();
  });
}

buildPiano();
registerPointerBindings();
registerKeyboard();

if (countEl) {
  countEl.textContent =
    bindingCount +
    ' pointerBindings on piano keys' +
    (TOGGLE_MODE ? ' (tap toggles)' : ' (hold to play)');
}

updateDisplay();

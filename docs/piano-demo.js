import {
  KeyChord,
  KeyCode,
  MouseButton,
  chordKeybindings,
  pointerBindings,
} from 'https://esm.sh/@farskid/kilid@0.1.0';

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

/** Pitch-class sets for simultaneous hold → chord name. */
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

const NOTE_BY_PC = Object.fromEntries(PIANO.map((k) => [k.pc, k.note]));
const BY_EVENT_CODE = Object.fromEntries(PIANO.map((k) => ['Key' + k.label, k]));

const pianoEl = document.getElementById('piano');
const chordEl = document.getElementById('piano-chord');
const notesEl = document.getElementById('piano-notes');
const countEl = document.getElementById('piano-binding-count');
const hintEl = document.getElementById('demo-hint');

if (!pianoEl || !chordEl || !notesEl) {
  throw new Error('Piano demo markup missing');
}

const active = new Map();
const heldKeys = new Set();
let bindingCount = 0;
let audioCtx;

function sigFromPcs(pcs) {
  return [...pcs].sort((a, b) => a - b).join(',');
}

const CHORD_BY_SIG = Object.fromEntries(CHORDS.map((c) => [sigFromPcs(c.pcs), c.name]));

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq) {
  const ctx = ensureAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
  return osc;
}

function updateDisplay(matchedChord) {
  const names = [...active.values()].map((k) => k.note);
  notesEl.textContent = names.length ? names.join(' \u00b7 ') : '\u2014';
  if (matchedChord) {
    chordEl.textContent = matchedChord;
    chordEl.dataset.state = 'match';
  } else if (names.length) {
    chordEl.textContent = names.length >= 2 ? '\u2026' : names[0];
    chordEl.dataset.state = 'partial';
  } else {
    chordEl.textContent = 'play a chord';
    chordEl.dataset.state = 'idle';
  }
}

function matchHeldChord() {
  if (active.size === 0) {
    updateDisplay(null);
    return null;
  }
  const sig = sigFromPcs([...active.keys()]);
  const name = CHORD_BY_SIG[sig] ?? null;
  updateDisplay(name);
  return name;
}

function pressKey(key, pointerId) {
  if (active.has(key.pc)) return;
  active.set(key.pc, key);
  key.el.classList.add('down');
  key.osc = playTone(key.freq);
  if (pointerId !== undefined) {
    try {
      key.el.setPointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  }
  matchHeldChord();
}

function releaseKey(key) {
  if (!active.has(key.pc)) return;
  active.delete(key.pc);
  key.el.classList.remove('down');
  if (key.osc) {
    try {
      key.osc.stop();
    } catch {
      /* already stopped */
    }
    key.osc = undefined;
  }
  matchHeldChord();
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
    el.dataset.note = key.note;
    el.innerHTML =
      '<span class="note">' + key.note + '</span><span class="kbd">' + key.label + '</span>';
    key.el = el;
    whiteWrap.appendChild(el);
  });

  PIANO.filter((k) => k.type === 'black').forEach((key, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'piano-key black';
    el.style.setProperty('--i', String(i));
    el.dataset.note = key.note;
    el.innerHTML =
      '<span class="note">' +
      key.note.replace('#', '\u266f') +
      '</span><span class="kbd">' +
      key.label +
      '</span>';
    key.el = el;
    blackWrap.appendChild(el);
  });

  pianoEl.appendChild(whiteWrap);
  pianoEl.appendChild(blackWrap);
}

function registerPointerBindings() {
  PIANO.forEach((key) => {
    const pointer = pointerBindings(key.el);
    pointer.add(
      MouseButton.Left,
      'down',
      (e) => {
        pressKey(key, e.pointerId);
      },
      { preventDefault: true }
    );
    bindingCount += 1;
    pointer.add(MouseButton.Left, 'up', () => releaseKey(key), { preventDefault: true });
    bindingCount += 1;
    pointer.add(MouseButton.Left, 'leave', (e) => {
      if (e.buttons & 1) releaseKey(key);
    });
    bindingCount += 1;
  });
}

/** Two-note sequences → chord names via chordKeybindings (kilid chord API). */
function registerChordBindings() {
  pianoEl.tabIndex = 0;
  pianoEl.addEventListener('pointerdown', () => pianoEl.focus());

  const seq = chordKeybindings(pianoEl, { chordTimeout: 900 });
  let registered = 0;

  CHORDS.forEach((chord) => {
    const a = PIANO.find((k) => k.pc === chord.pcs[0]);
    const b = PIANO.find((k) => k.pc === chord.pcs[1]);
    if (!a || !b) return;
    seq.add(KeyChord(a.code, b.code), () => {
      chordEl.textContent = chord.name + ' (arpeggio)';
      chordEl.dataset.state = 'match';
      notesEl.textContent = chord.pcs.map((pc) => NOTE_BY_PC[pc]).join(' \u2192 ');
    });
    registered += 1;
  });

  bindingCount += registered;
  return registered;
}

function registerKeyboard() {
  pianoEl.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = BY_EVENT_CODE[e.code];
    if (!key || e.repeat || heldKeys.has(key.pc)) return;
    e.preventDefault();
    heldKeys.add(key.pc);
    pressKey(key);
  });
  pianoEl.addEventListener('keyup', (e) => {
    const key = BY_EVENT_CODE[e.code];
    if (!key) return;
    e.preventDefault();
    heldKeys.delete(key.pc);
    releaseKey(key);
  });
}

buildPiano();
registerPointerBindings();
const arpeggioBindings = registerChordBindings();
registerKeyboard();

if (countEl) {
  countEl.textContent =
    bindingCount +
    ' kilid bindings (' +
    PIANO.length * 3 +
    ' pointer on keys + ' +
    arpeggioBindings +
    ' chord sequences)';
}

const coarse = window.matchMedia('(pointer: coarse)').matches;
if (hintEl) {
  hintEl.textContent = coarse
    ? 'Hold keys to name a chord — each key uses pointerBindings'
    : 'Hold keys for a chord, or play two letters in a row for chordKeybindings';
}

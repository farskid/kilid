import {
  KeyChord,
  KeyCode,
  KeyMod,
  chordKeybindings,
} from 'https://esm.sh/@farskid/kilid@0.1.0';

const CHORD_TIMEOUT = 3000;
const isMac = /mac|iphone|ipad/i.test(navigator.platform || '');
const MOD_LABEL = isMac ? '\u2318' : 'Ctrl+';

/**
 * Each row is one binding. `parts` describe the graph nodes; the encoded
 * keybinding below is what actually gets registered with kilid.
 */
const ROWS = [
  {
    action: 'Open keyboard shortcuts',
    parts: [
      { label: MOD_LABEL + 'K', code: 'KeyK', mod: true },
      { label: MOD_LABEL + 'S', code: 'KeyS', mod: true },
    ],
    encoded: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyS),
  },
  {
    action: 'Zen mode',
    parts: [
      { label: MOD_LABEL + 'K', code: 'KeyK', mod: true },
      { label: 'Z', code: 'KeyZ', mod: false },
    ],
    encoded: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyZ),
  },
  {
    action: 'Go to definition',
    parts: [
      { label: 'G', code: 'KeyG', mod: false },
      { label: 'D', code: 'KeyD', mod: false },
    ],
    encoded: KeyChord(KeyCode.KeyG, KeyCode.KeyD),
  },
];

const graphEl = document.getElementById('chord-graph');
const statusEl = document.getElementById('chord-status');
const countEl = document.getElementById('chord-binding-count');

if (!graphEl || !statusEl) {
  throw new Error('Chord demo markup missing');
}

document.documentElement.style.setProperty('--chord-timeout', CHORD_TIMEOUT + 'ms');

// ---------------------------------------------------------------------------
// The actual library usage: one chordKeybindings service, one add() per row.
// ---------------------------------------------------------------------------
const seq = chordKeybindings(window, { chordTimeout: CHORD_TIMEOUT });

ROWS.forEach((row) => {
  seq.add(row.encoded, () => fire(row));
});

// ---------------------------------------------------------------------------
// Graph rendering
// ---------------------------------------------------------------------------
function buildGraph() {
  ROWS.forEach((row) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'chord-row';

    row.nodeEls = [];
    row.edgeEls = [];

    row.parts.forEach((part, i) => {
      if (i > 0) {
        const edge = document.createElement('span');
        edge.className = 'cedge';
        edge.textContent = '\u2192';
        edge.setAttribute('aria-hidden', 'true');
        row.edgeEls.push(edge);
        rowEl.appendChild(edge);
      }
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'cnode';
      node.innerHTML =
        '<span class="fill" aria-hidden="true"></span>' +
        '<span class="cnode-label">' + part.label + '</span>';
      node.setAttribute('aria-label', 'Simulate pressing ' + part.label);
      // Tapping a node dispatches a real KeyboardEvent, so the exact same
      // kilid bindings run on touch devices.
      node.addEventListener('click', () => simulate(part));
      row.nodeEls.push(node);
      rowEl.appendChild(node);
    });

    const action = document.createElement('span');
    action.className = 'caction';
    action.textContent = row.action;
    row.actionEl = action;
    rowEl.appendChild(action);

    graphEl.appendChild(rowEl);
  });
}

function simulate(part) {
  const init = {
    code: part.code,
    key: part.code.replace(/^Key/, '').toLowerCase(),
    bubbles: true,
    cancelable: true,
  };
  if (part.mod) {
    if (isMac) init.metaKey = true;
    else init.ctrlKey = true;
  }
  window.dispatchEvent(new KeyboardEvent('keydown', init));
}

// ---------------------------------------------------------------------------
// UI state, driven by the service's real isChordPending flag
// ---------------------------------------------------------------------------
let pendingTimer;
let flashTimer;

function clearRowStates() {
  ROWS.forEach((row) => {
    row.nodeEls.forEach((n) => n.classList.remove('lit', 'pending', 'next', 'done'));
    row.edgeEls.forEach((e) => e.classList.remove('lit', 'done'));
    row.actionEl.classList.remove('done');
  });
}

function setIdle(text) {
  clearTimeout(pendingTimer);
  clearRowStates();
  statusEl.dataset.state = 'idle';
  statusEl.textContent = text || 'press a sequence\u2026';
}

function eventMatchesPart(e, part) {
  if (e.code !== part.code) return false;
  const mod = isMac ? e.metaKey : e.ctrlKey;
  return part.mod ? mod : !mod && !e.metaKey && !e.ctrlKey;
}

function showPending(e) {
  clearTimeout(pendingTimer);
  clearTimeout(flashTimer);
  clearRowStates();

  let prefixLabel = '';
  ROWS.forEach((row) => {
    if (!eventMatchesPart(e, row.parts[0])) return;
    prefixLabel = row.parts[0].label;
    const [first, second] = row.nodeEls;
    first.classList.add('pending');
    // restart the CSS fill animation
    const fill = first.querySelector('.fill');
    fill.style.transition = 'none';
    fill.style.transform = 'scaleX(0)';
    void fill.offsetWidth;
    fill.style.transition = '';
    fill.style.transform = '';
    row.edgeEls[0].classList.add('lit');
    second.classList.add('next');
  });

  if (!prefixLabel) return;

  statusEl.dataset.state = 'pending';
  statusEl.textContent = '(' + prefixLabel + ') pressed \u2014 waiting for the second key\u2026';

  pendingTimer = setTimeout(() => {
    if (!seq.isChordPending) setIdle('timed out \u2014 try again');
  }, CHORD_TIMEOUT + 50);
}

function fire(row) {
  clearTimeout(pendingTimer);
  clearTimeout(flashTimer);
  clearRowStates();

  row.nodeEls.forEach((n) => n.classList.add('done'));
  row.edgeEls.forEach((e) => e.classList.add('done'));
  row.actionEl.classList.add('done');

  statusEl.dataset.state = 'fired';
  statusEl.textContent = '\u2713 ' + row.action;

  flashTimer = setTimeout(() => setIdle(), 1800);
}

// Runs after kilid's own listener (registered first on the same target),
// so seq.isChordPending is already up to date for this event.
window.addEventListener('keydown', (e) => {
  if (e.key === 'Control' || e.key === 'Meta' || e.key === 'Shift' || e.key === 'Alt') return;
  if (seq.isChordPending) {
    showPending(e);
  } else if (statusEl.dataset.state === 'pending') {
    setIdle('sequence broken \u2014 try again');
  }
});

buildGraph();

if (countEl) {
  countEl.textContent =
    ROWS.length + ' chord bindings \u00b7 one chordKeybindings(window) service \u00b7 ' +
    CHORD_TIMEOUT / 1000 + 's timeout';
}

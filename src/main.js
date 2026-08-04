// Wiring: intake, the viewfinder, the readouts, and the keyboard.

import { store, createItem, activeItem } from './state.js';
import { createViewfinder } from './viewfinder.js';
import { createSizePicker } from './sizepicker.js';
import { createFilmstrip } from './filmstrip.js';
import { autoFrame, refit } from './autoframe.js';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#canvas');
const stage = $('#stage');
const fileInput = $('#file');

function announce(message) {
  const el = $('#status');
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = message; });
}

const view = createViewfinder({
  canvas,
  stage,
  // The viewfinder owns the live transform; the store owns the decision.
  onFrameChange(framing) {
    const item = activeItem();
    const { target } = store.get();
    // The frame animates between shapes, so a framing read mid-morph has an
    // aspect that belongs to neither size. Record only once it has arrived —
    // otherwise pressing Enter through a batch stores half-morphed crops.
    const settled = Math.abs(framing.cropW / framing.cropH - target.w / target.h) < 0.005;
    if (item && settled) item.frame = framing;
    updateReadout(framing);
    syncStripSoon();
  },
});

// onFrameChange fires every animation frame; the thumbnail only needs to catch
// up once the framing stops moving.
let stripTimer = null;
function syncStripSoon() {
  clearTimeout(stripTimer);
  stripTimer = setTimeout(() => strip.sync(store.get()), 160);
}

// ---- readouts --------------------------------------------------------------

function updateReadout(framing) {
  const { target } = store.get();
  if (!framing) return;
  const w = Math.round(framing.cropW);
  const h = Math.round(framing.cropH);
  $('#cropSize').textContent = `${w} × ${h}`;

  // How much real detail is behind each output pixel. Below 1.0 we are
  // enlarging, which is the only thing that actually costs quality here.
  const ratio = Math.min(framing.cropW / target.w, framing.cropH / target.h);
  const chip = $('#qualityChip');
  const label = $('#quality');
  chip.className = 'chip';
  if (ratio >= 1) { label.textContent = 'sharp'; chip.classList.add('good'); }
  else if (ratio >= 0.75) { label.textContent = `${Math.round(ratio * 100)}% — soft`; chip.classList.add('warn'); }
  else { label.textContent = `${Math.round(ratio * 100)}% — blurry`; chip.classList.add('bad'); }
}

function setChromeVisible(on) {
  $('#empty').hidden = on;
  $('#readout').hidden = !on;
  $('#hints').hidden = !on;
}

// ---- intake ----------------------------------------------------------------

function decode(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Could not open ${file.name}`)); };
    img.src = url;
  });
}

async function addFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/'));
  if (!files.length) { announce('No images in that drop'); return; }

  const decoded = await Promise.allSettled(files.map(decode));
  const items = [];
  decoded.forEach((result, i) => {
    if (result.status === 'fulfilled') items.push(createItem(files[i], result.value));
  });
  if (!items.length) { announce('None of those images could be opened'); return; }

  const s = store.get();
  const firstNew = s.items.length;
  for (const item of items) preframe(item, s.target);
  store.set({ items: [...s.items, ...items] });
  activate(s.activeIndex < 0 ? firstNew : s.activeIndex);
  announce(`${items.length} image${items.length === 1 ? '' : 's'} added`);
}

const targetKey = (t) => `${t.w}x${t.h}`;

// Give an item an opening crop. Only ever applied to frames the user has not
// taken responsibility for — an approved framing is never second-guessed.
function preframe(item, target) {
  item.frame = autoFrame(item.image, target.w / target.h);
  item.framedFor = targetKey(target);
  item.auto = true;
}

// Bring one item's crop up to date with the current target. Suggestions get
// re-suggested; decisions get reshaped around the point the user picked. Every
// item is kept current, not just the visible one — export reads all of them.
function reframe(item, target) {
  if (item.framedFor === targetKey(target)) return;
  if (item.auto) {
    preframe(item, target);
  } else {
    item.frame = refit(item.image, item.frame, target.w / target.h);
    item.framedFor = targetKey(target);
  }
}

function activate(index) {
  const s = store.get();
  const item = s.items[index];
  if (!item) return;
  reframe(item, s.target);
  store.set({ activeIndex: index });
  $('#filename').textContent = item.file.name;
  setChromeVisible(true);
  view.setImage(item.image, item.frame);
  strip.sync(store.get());
  strip.scrollToActive(store.get());
  canvas.focus();
}

// ---- approval --------------------------------------------------------------

const strip = createFilmstrip({
  root: $('#strip'),
  rail: $('#stripRail'),
  bar: $('#progressBar'),
  text: $('#progressText'),
  approveAll: $('#approveAll'),
  onActivate: activate,
  onApproveAll: approveRest,
});

function approve() {
  const item = activeItem();
  if (!item) return;
  item.approved = true;
  item.auto = false;
  strip.sync(store.get());
  strip.celebrate(store.get());

  const s = store.get();
  const next = s.items.findIndex((i, idx) => !i.approved && idx > s.activeIndex);
  const wrapped = next >= 0 ? next : s.items.findIndex((i) => !i.approved);
  if (wrapped >= 0) {
    activate(wrapped);
    announce(`Kept. ${s.items.filter((i) => i.approved).length} of ${s.items.length} framed`);
  } else {
    strip.sync(store.get());
    announce(`All ${s.items.length} framed and ready`);
  }
}

// Accept every remaining auto-suggested crop as-is.
function approveRest() {
  const s = store.get();
  for (const item of s.items) {
    if (item.approved) continue;
    reframe(item, s.target);
    item.approved = true;
    item.auto = false;
  }
  strip.sync(store.get());
  announce(`All ${s.items.length} framed and ready`);
}

function step(delta) {
  const s = store.get();
  if (s.items.length < 2) return;
  activate((s.activeIndex + delta + s.items.length) % s.items.length);
}

// ---- target size -----------------------------------------------------------

function applyTarget({ w, h, name }) {
  if (!(w > 0 && h > 0)) return;
  store.set({ target: { w, h, label: name } });
  view.setTarget(w, h);

  $('#sizeName').textContent = name;
  $('#sizeDims').textContent = `${w} × ${h}`;
  // Mirror the frame's new shape in the panel chip.
  const swatch = $('#sizeSwatch');
  const long = 26;
  swatch.style.width = `${w >= h ? long : Math.max(6, (long * w) / h)}px`;
  swatch.style.height = `${w >= h ? Math.max(6, (long * h) / w) : long}px`;

  // Every queued crop follows the new shape immediately, so the filmstrip is
  // always a truthful preview of what would be exported right now.
  const s = store.get();
  for (const queued of s.items) reframe(queued, s.target);
  const item = activeItem();
  if (item) {
    view.setImage(item.image, item.frame);
    updateReadout(view.getFraming());
  }
  strip.sync(store.get());
  announce(`${name}, ${w} by ${h} pixels`);
}

createSizePicker({
  root: $('#picker'),
  input: $('#pickerInput'),
  list: $('#pickerList'),
  trigger: $('#sizeButton'),
  onPick: (r) => applyTarget({ w: r.w, h: r.h, name: r.name }),
});

// ---- events ----------------------------------------------------------------

const openPicker = () => { fileInput.value = ''; fileInput.click(); };
$('#add').onclick = openPicker;
$('#emptyAdd').onclick = openPicker;
fileInput.onchange = (e) => addFiles(e.target.files);

let dragDepth = 0;
for (const name of ['dragenter', 'dragleave', 'dragover', 'drop']) {
  document.addEventListener(name, (e) => {
    if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault();
    if (name === 'dragenter') { dragDepth++; document.body.classList.add('dragging'); }
    if (name === 'dragleave' && !--dragDepth) document.body.classList.remove('dragging');
    if (name === 'drop') {
      dragDepth = 0;
      document.body.classList.remove('dragging');
      addFiles(e.dataTransfer.files);
    }
  });
}

document.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) addFiles(files);
});

document.addEventListener('keydown', (e) => {
  // The target is not always an element (and not always one with .matches),
  // so ask the document what has focus instead of trusting the event.
  const focused = document.activeElement;
  if (focused && focused.matches?.('input, select, textarea')) return;
  if (!view.hasImage()) return;
  // Arrows fine-tune the framing; brackets (or j/k) move through the queue.
  // Nudging is the more frequent act, so it keeps the arrows.
  const px = e.shiftKey ? 40 : 8;
  const actions = {
    ArrowLeft: () => view.nudge(px, 0),
    ArrowRight: () => view.nudge(-px, 0),
    ArrowUp: () => view.nudge(0, px),
    ArrowDown: () => view.nudge(0, -px),
    '0': () => view.fill(),
    '=': () => view.zoomBy(1.2),
    '+': () => view.zoomBy(1.2),
    '-': () => view.zoomBy(1 / 1.2),
    Enter: approve,
    ' ': approve,
    ']': () => step(1),
    '[': () => step(-1),
    j: () => step(1),
    k: () => step(-1),
  };
  const action = actions[e.key];
  if (!action) return;
  e.preventDefault();
  action();
});

// The filmstrip appearing changes the stage height, so watch the element
// itself rather than the window.
new ResizeObserver(() => view.resize()).observe(stage);

// ---- boot ------------------------------------------------------------------

setChromeVisible(false);
const boot = store.get().target;
applyTarget({ w: boot.w, h: boot.h, name: boot.label });
view.resize();

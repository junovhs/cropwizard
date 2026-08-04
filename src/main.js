// Wiring: intake, the viewfinder, the readouts, and the keyboard.

import { store, createItem, activeItem } from './state.js';
import { createViewfinder } from './viewfinder.js';
import { createSizePicker } from './sizepicker.js';

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
    if (item) item.frame = framing;
    updateReadout(framing);
  },
});

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
  store.set({ items: [...s.items, ...items] });
  activate(s.activeIndex < 0 ? firstNew : s.activeIndex);
  announce(`${items.length} image${items.length === 1 ? '' : 's'} added`);
}

function activate(index) {
  const s = store.get();
  const item = s.items[index];
  if (!item) return;
  store.set({ activeIndex: index });
  $('#filename').textContent = item.file.name;
  setChromeVisible(true);
  view.setImage(item.image, item.frame);
  canvas.focus();
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

  if (activeItem()) updateReadout(view.getFraming());
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
  if (e.target.matches('input, select, textarea')) return;
  if (!view.hasImage()) return;
  const step = e.shiftKey ? 40 : 8;
  const actions = {
    ArrowLeft: () => view.nudge(step, 0),
    ArrowRight: () => view.nudge(-step, 0),
    ArrowUp: () => view.nudge(0, step),
    ArrowDown: () => view.nudge(0, -step),
    '0': () => view.fill(),
    '=': () => view.zoomBy(1.2),
    '+': () => view.zoomBy(1.2),
    '-': () => view.zoomBy(1 / 1.2),
  };
  const action = actions[e.key];
  if (!action) return;
  e.preventDefault();
  action();
});

addEventListener('resize', () => view.resize());

// ---- boot ------------------------------------------------------------------

setChromeVisible(false);
const boot = store.get().target;
applyTarget({ w: boot.w, h: boot.h, name: boot.label });
view.resize();

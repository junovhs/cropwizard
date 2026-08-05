// Wiring: intake, the viewfinder, the readouts, and the keyboard.

import { store, createItem, activeItem } from './state.js';
import { createViewfinder } from './viewfinder.js';
import { createSizePicker } from './sizepicker.js';
import { createFilmstrip } from './filmstrip.js';
import { autoFrame, refit } from './autoframe.js';
import { FORMATS, DEFAULT_TEMPLATE, expandName, exportAll } from './export.js';
import { paintIcons } from './icons.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
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
  stripTimer = setTimeout(() => syncUI(), 160);
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
  $('#fitToggle').hidden = !on;
}

// ---- true size vs fit ------------------------------------------------------

// The frame is the output at its real size (DEC-03). Two things need saying:
// which mode you are in, and — when the target is bigger than the stage — that
// what you are looking at is a reduction rather than the real thing.
function syncFitChrome() {
  const fit = view.isFit();
  const percent = Math.round(view.getFrameScale() * 100);
  $('#fitToggle').setAttribute('aria-pressed', String(fit));
  $('#fitLabel').textContent = fit ? 'True size' : 'Fit to stage';

  const capped = !fit && percent < 100;
  const chip = $('#scaleChip');
  chip.hidden = !fit && !capped;
  chip.classList.toggle('warn', capped);
  chip.textContent = fit
    ? `Fit to stage — ${percent}%`
    : capped ? `Bigger than the stage — shown at ${percent}%` : '';
}

function toggleFit() {
  const next = !view.isFit();
  view.setFit(next);
  syncFitChrome();
  announce(next ? 'Fit to stage' : 'True size');
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

// Every way an image can arrive — drop, paste, file picker — comes through
// here, and none of them stops to ask anything. Standing a modal in the doorway
// only made sense if cropping to a preset were the one thing anyone ever wanted;
// it is not, and even when it is, the size is easier to answer once you can see
// the picture. So the image lands, and the size stays one keystroke away.
async function intake(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/'));
  if (!files.length) { announce('No images in that drop'); return; }

  const decoded = await Promise.allSettled(files.map(decode));
  const items = [];
  decoded.forEach((result, i) => {
    if (result.status === 'fulfilled') items.push(createItem(files[i], result.value));
  });
  if (!items.length) { announce('None of those images could be opened'); return; }

  const s = store.get();
  for (const item of items) preframe(item, s.target);

  // Single mode is a replacement, not an append: the new image takes the stage
  // and every setting stays exactly where it was (DEC-02).
  if (!s.batch) {
    const replaced = s.items.length > 0;
    const kept = items[0];
    store.set({ items: [kept], activeIndex: -1 });
    activate(0);
    if (replaced || items.length > 1) strip.flashOffer();
    announce(items.length > 1
      ? `Showing ${kept.file.name}. Turn on batch to keep all ${items.length}`
      : replaced ? `Replaced with ${kept.file.name}` : `${kept.file.name} loaded`);
    return;
  }

  const firstNew = s.items.length;
  store.set({ items: [...s.items, ...items] });
  activate(s.activeIndex < 0 ? firstNew : s.activeIndex);
  announce(`${items.length} image${items.length === 1 ? '' : 's'} added`);
}

// Batch is entered deliberately and never left by accident, so there is an on
// and no off: the way back to one image is to drop one.
function enableBatch() {
  if (store.get().batch) return;
  store.set({ batch: true });
  syncUI();
  announce('Batch on. Drop as many images as you like');
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
  syncUI();
  strip.scrollToActive(store.get());
  canvas.focus();
}

// ---- approval --------------------------------------------------------------

// The filmstrip and the export panel both describe the same queue, so they are
// always refreshed together.
function syncUI() {
  strip.sync(store.get());
  refreshExport();
}

const strip = createFilmstrip({
  root: $('#strip'),
  rail: $('#stripRail'),
  bar: $('#progressBar'),
  text: $('#progressText'),
  note: $('#batchNote'),
  approveAll: $('#approveAll'),
  enableBatch: $('#enableBatch'),
  onActivate: activate,
  onApproveAll: approveRest,
  onEnableBatch: enableBatch,
});

function approve() {
  const item = activeItem();
  if (!item) return;
  item.approved = true;
  item.auto = false;
  syncUI();
  strip.celebrate(store.get());

  const s = store.get();
  const next = s.items.findIndex((i, idx) => !i.approved && idx > s.activeIndex);
  const wrapped = next >= 0 ? next : s.items.findIndex((i) => !i.approved);
  if (wrapped >= 0) {
    activate(wrapped);
    announce(`Kept. ${s.items.filter((i) => i.approved).length} of ${s.items.length} framed`);
  } else {
    syncUI();
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
  syncUI();
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
  syncFitChrome();

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
  syncUI();
  announce(`${name}, ${w} by ${h} pixels`);
}

// Until a size has actually been chosen the panel is only showing a default.
// That used to be enforced with a modal; it is now said where the answer lives,
// so an unanswered question nags instead of blocking.
let sizeChosen = false;

function syncSizeConfidence() {
  $('#sizeButton').classList.toggle('is-provisional', !sizeChosen);
  $('#sizeNote').classList.toggle('is-unsettled', !sizeChosen);
  $('#sizeNote').textContent = sizeChosen
    ? 'Search by name, pixels or shape.'
    : 'Suggested size — press ⌘K to set the one you actually need.';
}

createSizePicker({
  root: $('#picker'),
  input: $('#pickerInput'),
  list: $('#pickerList'),
  trigger: $('#sizeButton'),
  // The image on the stage is also an answer to the size question — the whole
  // "use this as the template" move, now reachable whenever it is wanted rather
  // than only in the half-second the file was arriving.
  getTemplate: () => {
    const item = activeItem();
    return item ? { w: item.image.naturalWidth, h: item.image.naturalHeight } : null;
  },
  onPick: (r) => {
    sizeChosen = true;
    applyTarget({ w: r.w, h: r.h, name: r.name });
    syncSizeConfidence();
  },
});

// ---- export ----------------------------------------------------------------

const options = { format: 'png', quality: 0.86, template: DEFAULT_TEMPLATE };
let exporting = false;

// ---- file names ------------------------------------------------------------

// The template engine stays; nobody has to look at it. The three questions
// people actually have about a filename — is my name still in it, does it say
// the size, are they numbered — are asked as questions, and the answers are
// compiled into a template behind the panel.
const naming = { keep: true, size: true, number: false };
// Set once the template is edited by hand: from then on the typed template
// wins, until a checkbox is ticked and takes the wheel back.
let customTemplate = null;

function composeTemplate() {
  const parts = [];
  if (naming.keep) parts.push('{name}');
  if (naming.size) parts.push('{w}x{h}');
  if (naming.number) parts.push('{n}');
  // Nothing chosen still has to produce distinct files, so fall back to the
  // number — and the live preview says so rather than hiding it.
  return parts.join('-') || '{n}';
}

function syncNaming() {
  options.template = customTemplate ?? composeTemplate();
  // Mirror the compiled template into the advanced box — but never rewrite it
  // underneath someone who is typing in it.
  if (!customTemplate && document.activeElement !== $('#template')) {
    $('#template').value = options.template;
  }
  $('#naming').classList.toggle('is-overridden', !!customTemplate);
  $('#namingOverride').hidden = !customTemplate;
  refreshExport();
}

function refreshExport() {
  const { items, target } = store.get();
  const count = items.length;
  const button = $('#export');
  button.disabled = !count || exporting;
  $('#exportLabel').textContent = exporting
    ? 'Exporting…'
    : count > 1 ? `Export ${count} images` : 'Export';

  // The preview is the contract: whatever it says is what lands on disk. With
  // nothing loaded it still has to demonstrate the naming, so it stands in a
  // plausible name rather than going blank.
  const sample = items[Math.max(0, store.get().activeIndex)] || items[0];
  $('#namePreview').textContent = expandName(options.template, {
    name: sample ? sample.name : 'photo', index: 0, total: Math.max(count, 1),
    w: target.w, h: target.h, ext: FORMATS[options.format].ext, label: target.label,
  });

  const pending = items.filter((i) => !i.approved).length;
  $('#exportNote').textContent = !count
    ? 'Nothing to export yet.'
    : count === 1 ? 'Downloads as a single image.'
    : pending ? `Downloads as one ZIP. ${pending} still using the suggested crop.`
    : 'Downloads as one ZIP.';
}

function setFormat(format) {
  options.format = format;
  for (const b of $$('.segmented button')) {
    b.setAttribute('aria-checked', String(b.dataset.format === format));
  }
  $('#qualityRow').hidden = !FORMATS[format].lossy;
  refreshExport();
}

for (const button of $$('.segmented button')) {
  button.addEventListener('click', () => setFormat(button.dataset.format));
}
$('#qualityInput').addEventListener('input', (e) => {
  options.quality = +e.target.value / 100;
  $('#qualityValue').textContent = e.target.value;
});
for (const [id, key] of [['#nameKeep', 'keep'], ['#nameSize', 'size'], ['#nameNumber', 'number']]) {
  $(id).addEventListener('change', (e) => {
    naming[key] = e.target.checked;
    customTemplate = null;      // the plain-language controls take the wheel back
    syncNaming();
  });
}
$('#template').addEventListener('input', (e) => {
  customTemplate = e.target.value || null;
  options.template = customTemplate || DEFAULT_TEMPLATE;
  syncNaming();
});

$('#export').addEventListener('click', async () => {
  const { items, target } = store.get();
  if (!items.length || exporting) return;
  exporting = true;
  const button = $('#export');
  const fill = $('#exportFill');
  button.classList.remove('is-done');
  fill.style.opacity = '1';
  fill.style.width = '0%';
  refreshExport();
  announce(`Exporting ${items.length} image${items.length === 1 ? '' : 's'}`);

  try {
    const result = await exportAll(items, target, { ...options, label: target.label },
      (progress) => { fill.style.width = `${progress * 100}%`; });
    button.classList.add('is-done');
    $('#exportLabel').textContent = 'Downloaded';
    announce(`${result.count} image${result.count === 1 ? '' : 's'} downloaded as ${result.filename}`);
    setTimeout(() => { button.classList.remove('is-done'); refreshExport(); }, 1600);
  } catch (error) {
    announce(`Export failed: ${error.message}`);
    $('#exportNote').textContent = `Export failed: ${error.message}`;
  } finally {
    fill.style.opacity = '0';
    exporting = false;
    refreshExport();
  }
});

// ---- events ----------------------------------------------------------------

const openPicker = () => { fileInput.value = ''; fileInput.click(); };
$('#add').onclick = openPicker;
$('#emptyAdd').onclick = openPicker;
fileInput.onchange = (e) => intake(e.target.files);

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
      intake(e.dataTransfer.files);
    }
  });
}

// Ctrl/Cmd+V arrives here as a paste event, wherever the focus happens to be —
// so a clipboard image takes exactly the same road as a dropped one.
document.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;
  e.preventDefault();
  intake(files);
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
    f: toggleFit,
    F: toggleFit,
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
new ResizeObserver(() => { view.resize(); syncFitChrome(); }).observe(stage);

$('#fitToggle').addEventListener('click', toggleFit);

// ---- boot ------------------------------------------------------------------

paintIcons();
setChromeVisible(false);
syncNaming();
const boot = store.get().target;
applyTarget({ w: boot.w, h: boot.h, name: boot.label });
syncSizeConfidence();
view.resize();

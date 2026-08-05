// Wiring: intake, the viewfinder, the readouts, and the keyboard.

import { store, createItem, activeItem } from './state.js';
import { createViewfinder } from './viewfinder.js';
import { createSizePicker } from './sizepicker.js';
import { createFilmstrip } from './filmstrip.js';
import { scaledTarget } from './export.js';
import { createAdjustPanel, neutral } from './adjust.js';
import { paintIcons } from './icons.js';
import { createExportPanel, type ExportPanelController } from './presentation/export-panel.js';
import { acceptFrame, fitFrameToTarget, suggestFrame, targetKey, useWholeImage, wholeFrame } from './application/framing.js';
import { decodeImage } from './infrastructure/image-decoder.js';
import { requiredElement, requiredElements } from './infrastructure/dom.js';
import { createHistory } from './history.js';
import type {
  AppState, CropItem, Framing, OutputTarget, SizeResult,
} from './domain/types.js';

const $ = <T extends Element = HTMLElement>(selector: string): T => requiredElement<T>(selector);
const $$ = <T extends Element = HTMLElement>(selector: string): T[] => requiredElements<T>(selector);
const canvas = $<HTMLCanvasElement>('#canvas');
const stage = $<HTMLElement>('#stage');
const fileInput = $<HTMLInputElement>('#file');

let exportPanel: ExportPanelController | null = null;

function announce(message: string): void {
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
    if (item && settled) {
      store.updateItem(item.id, (current) => {
        const previous = current.frame;
        const unchanged = previous
          && Math.abs(previous.cx - framing.cx) < 0.01
          && Math.abs(previous.cy - framing.cy) < 0.01
          && Math.abs(previous.cropW - framing.cropW) < 0.01
          && Math.abs(previous.cropH - framing.cropH) < 0.01;
        return unchanged ? current : { ...current, frame: framing };
      });
    }
    updateReadout(framing);
    syncStripSoon();
  },
});

// onFrameChange fires every animation frame; the thumbnail only needs to catch
// up once the framing stops moving.
let stripTimer: ReturnType<typeof setTimeout> | null = null;
function syncStripSoon(): void {
  if (stripTimer !== null) clearTimeout(stripTimer);
  stripTimer = setTimeout(() => syncUI(), 160);
}

// ---- readouts --------------------------------------------------------------

function updateReadout(framing: Framing | null): void {
  const { target } = store.get();
  if (!framing) return;
  const w = Math.round(framing.cropW);
  const h = Math.round(framing.cropH);
  $('#cropSize').textContent = `${w} × ${h}`;

  // How much real detail is behind each output pixel. Below 1.0 we are
  // enlarging, which is the only thing that actually costs quality here. The
  // export multiplier is part of that sum: at 4x the file wants four times the
  // pixels in each direction, and the chip has to say so while it can still be
  // changed for free.
  const out = scaledTarget(target, exportPanel?.getScale() ?? 1);
  const ratio = Math.min(framing.cropW / out.w, framing.cropH / out.h);
  const chip = $('#qualityChip');
  const label = $('#quality');
  chip.className = 'chip';
  // A crop that is exactly the output size is the common case now that an image
  // opens at its own resolution, and it arrives through a spring, so it lands a
  // ten-thousandth short of 1 as often as not. Calling that "soft" would be a
  // lie told by floating point.
  if (ratio >= 0.999) { label.textContent = 'sharp'; chip.classList.add('good'); }
  else if (ratio >= 0.75) { label.textContent = `${Math.round(ratio * 100)}% — soft`; chip.classList.add('warn'); }
  else { label.textContent = `${Math.round(ratio * 100)}% — blurry`; chip.classList.add('bad'); }
}

// The top bar names the file and states the pixels it arrived with. Both are
// machine facts about the source, so both are set in mono and neither changes
// as you crop — the crop's own numbers live in the readout on the stage.
function showFileIdentity(item: CropItem): void {
  $('#filename').textContent = item.file.name;
  $('#fileDims').textContent = `${item.image.naturalWidth} × ${item.image.naturalHeight}`;
}

// ---- mode ------------------------------------------------------------------

// Cropping and adjusting are two jobs on one image, so they are two modes on
// one stage rather than two doors at the entrance: you pick after you can see
// the picture, and you can change your mind for free.
type Mode = 'crop' | 'adjust';
let mode: Mode = 'crop';
let hasImage = false;

// One place decides what is on the stage, because visibility depends on both
// facts at once — whether there is an image, and which job you are doing.
function syncStageChrome(): void {
  const cropping = mode === 'crop';
  $('#empty').hidden = hasImage;
  // The two modes are the app's navigation now, so they stay on screen and go
  // quiet instead of disappearing: an empty rail reads as a broken rail.
  $<HTMLButtonElement>('#modeCrop').disabled = !hasImage;
  $<HTMLButtonElement>('#modeAdjust').disabled = !hasImage;
  $('#adjust').hidden = !hasImage || cropping;
  // The crop readouts describe a framing decision, so they are only true while
  // that is the decision being made.
  $('#readout').hidden = !hasImage || !cropping;
  $('#hints').hidden = !hasImage || !cropping;
  $('#fitToggle').hidden = !hasImage || !cropping;
  $('#modeCrop').setAttribute('aria-selected', String(cropping));
  $('#modeAdjust').setAttribute('aria-selected', String(!cropping));
}

function setMode(next: Mode): void {
  if (next === mode) return;
  mode = next;
  syncStageChrome();
  announce(next === 'crop'
    ? 'Crop. Drag to move the image under the frame'
    : 'Adjust. The crop is left exactly as it was');
  if (next === 'crop') canvas.focus();
}

function setChromeVisible(on: boolean): void {
  hasImage = on;
  syncStageChrome();
  // What the size panel can honestly say about an unchosen size depends on
  // whether there is a picture for it to have come from.
  syncSizeConfidence();
}

// ---- adjustments -----------------------------------------------------------

// The panel is a view of one item's numbers, never a store of its own: it is
// loaded from whatever is on the stage and writes straight back to it, so the
// answers belong to the image and cannot follow you to the next one.
const adjustPanel = createAdjustPanel({
  rows: $('#adjustRows'),
  reset: $('#adjustReset'),
  note: $('#adjustUnsupported'),
  onAnnounce: announce,
  onChange(adjust) {
    const item = activeItem();
    if (item) store.updateItem(item.id, (current) => ({ ...current, adjust }));
    view.setAdjust(adjust);
    // The filmstrip is a contact sheet of what would be exported, so it has to
    // carry the adjustment too — but only once the slider stops moving.
    syncStripSoon();
  },
});

function showAdjust(item: CropItem): void {
  view.setAdjust(adjustPanel.load(item.adjust || neutral()));
}

// ---- true size vs fit ------------------------------------------------------

// The frame is the output at its real size (DEC-03). Two things need saying:
// which mode you are in, and — when the target is bigger than the stage — that
// what you are looking at is a reduction rather than the real thing.
function syncFitChrome(): void {
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

function toggleFit(): void {
  const next = !view.isFit();
  view.setFit(next);
  syncFitChrome();
  announce(next ? 'Fit to stage' : 'True size');
}

// ---- intake ----------------------------------------------------------------

// Every way an image can arrive — drop, paste, file picker — comes through
// here, and none of them stops to ask anything. Standing a modal in the doorway
// only made sense if cropping to a preset were the one thing anyone ever wanted;
// it is not, and even when it is, the size is easier to answer once you can see
// the picture. So the image lands, and the size stays one keystroke away.
async function intake(fileList: FileList | readonly File[]): Promise<void> {
  const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'));
  if (!files.length) { announce('No images in that drop'); return; }

  const decoded = await Promise.allSettled(files.map(decodeImage));
  let items: CropItem[] = [];
  decoded.forEach((result, index) => {
    const file = files[index];
    if (file && result.status === 'fulfilled') items.push(createItem(file, result.value));
  });
  if (!items.length) { announce('None of those images could be opened'); return; }

  // Nobody has said what size they need yet, and the image itself is the best
  // answer to that question: its own pixels, nothing cut. Guessing a square
  // meant every unasked-for arrival was cropped before it was even looked at.
  // The size stays provisional, so choosing a real one is still one click away.
  if (!sizeChosen) adoptImageSize(items[0]);

  const s = store.get();
  items = items.map((item) => suggestFrame(item, s.target));
  // The lead image is the one the target was taken from, so it is the whole
  // rectangle exactly — said outright rather than rounded to by the autoframer.
  if (!sizeChosen) {
    const lead = items[0];
    if (lead) items[0] = { ...lead, frame: wholeFrame(lead), framedFor: targetKey(s.target) };
  }

  // A stack is its own answer to the question the app used to ask (DEC-04):
  // dropping twelve files is the deliberate act, so it is honoured rather than
  // queried. Showing one of the twelve and flashing a switch made the user say
  // the same thing twice. Entering this way is never silent, and the switch
  // that turned it on turns it off again.
  if (!s.batch && items.length > 1) {
    store.set({ batch: true, items, activeIndex: -1 });
    activate(0);
    syncBatchChrome();
    announce(`${items.length} images loaded. Batch is on — frame each one, then keep it`);
    return;
  }

  // Single mode is a replacement, not an append: the new image takes the stage
  // and every setting stays exactly where it was (DEC-04).
  if (!s.batch) {
    const replaced = s.items.length > 0;
    const kept = items[0];
    store.set({ items: [kept], activeIndex: -1 });
    activate(0);
    announce(replaced ? `Replaced with ${kept.file.name}` : `${kept.file.name} loaded`);
    return;
  }

  const firstNew = s.items.length;
  store.set({ items: [...s.items, ...items] });
  activate(s.activeIndex < 0 ? firstNew : s.activeIndex);
  announce(`${items.length} image${items.length === 1 ? '' : 's'} added`);
}

// Batch is a mode, so it is one switch that works in both directions (DEC-04).
// Turning it off is not a way to lose work by accident: the image you are
// looking at survives, and only the queue behind it goes.
function setBatch(on: boolean): void {
  const state = store.get();
  if (state.batch === on) return;

  if (on) {
    store.set({ batch: true });
    syncBatchChrome();
    syncUI();
    announce('Batch on. Drop as many images as you like');
    return;
  }

  const kept = activeItem(state);
  store.set({
    batch: false,
    items: kept ? [kept] : [],
    activeIndex: kept ? 0 : -1,
  });
  syncBatchChrome();
  syncUI();
  announce(kept
    ? `Batch off. Keeping ${kept.file.name}, the rest of the queue is gone`
    : 'Batch off. One image at a time');
}

// What the rail switch says about itself, and what it promises next.
function syncBatchChrome(): void {
  const on = store.get().batch;
  $('#enableBatch').setAttribute('aria-pressed', String(on));
  $('#batchState').textContent = on ? 'On' : 'Off';
  $('#batchNote').textContent = on
    ? 'Frame each image, then keep it. Turn off to go back to one.'
    : 'Frame a whole stack in one pass.';
}

// Take the output size from the picture while the size is still provisional.
function adoptImageSize(item: CropItem): void {
  applyTarget({
    w: item.image.naturalWidth,
    h: item.image.naturalHeight,
    name: 'This image',
  });
}

function activate(index: number): void {
  const state = store.get();
  const source = state.items[index];
  if (!source) return;
  const framed = fitFrameToTarget(source, state.target);
  store.transact((current) => ({
    ...current,
    activeIndex: index,
    items: current.items.map((item) => item.id === framed.id ? framed : item),
  }));
  const item = activeItem();
  if (!item) return;
  showFileIdentity(item);
  setChromeVisible(true);
  view.setImage(item.image, item.frame);
  showAdjust(item);
  syncUI();
  strip.scrollToActive(store.get());
  canvas.focus();
}

// ---- approval --------------------------------------------------------------

// The filmstrip and the export panel both describe the same queue, so they are
// always refreshed together.
function syncUI(): void {
  strip.sync(store.get());
  // The scale row states the pixels that would be written right now, so it is
  // refreshed with everything else that describes the pending export.
  exportPanel?.sync();
}

const strip = createFilmstrip({
  root: $('#strip'),
  rail: $('#stripRail'),
  bar: $('#progressBar'),
  text: $('#progressText'),
  empty: $('#stripEmpty'),
  approveAll: $('#approveAll'),
  onActivate: activate,
  onApproveAll: approveRest,
  onAdd: () => openPicker(),
});

function approve(): void {
  const item = activeItem();
  if (!item) return;
  store.updateItem(item.id, (current) => (acceptFrame(current)));
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
function approveRest(): void {
  const state = store.transact((current) => ({
    ...current,
    items: current.items.map((item) => {
      if (item.approved) return item;
      return acceptFrame(fitFrameToTarget(item, current.target));
    }),
  }));
  syncUI();
  announce(`All ${state.items.length} framed and ready`);
}

function step(delta: number): void {
  const s = store.get();
  if (s.items.length < 2) return;
  activate((s.activeIndex + delta + s.items.length) % s.items.length);
}

// ---- target size -----------------------------------------------------------

interface TargetSelection { readonly w: number; readonly h: number; readonly name: string; }

// What the panel says about the chosen size. Split out of applyTarget because
// undo restores a target that was never re-applied — it only has to be shown.
function showTarget(target: OutputTarget): void {
  $('#sizeName').textContent = target.label;
  $('#sizeDims').textContent = `${target.w} × ${target.h}`;
  // Mirror the frame's shape in the panel chip.
  const swatch = $('#sizeSwatch');
  const long = 26;
  const { w, h } = target;
  swatch.style.width = `${w >= h ? long : Math.max(6, (long * w) / h)}px`;
  swatch.style.height = `${w >= h ? Math.max(6, (long * h) / w) : long}px`;
}

function applyTarget({ w, h, name }: TargetSelection): void {
  if (!(w > 0 && h > 0)) return;
  store.transact((current) => {
    const target = { w, h, label: name };
    return { ...current, target, items: current.items.map((item) => fitFrameToTarget(item, target)) };
  });
  view.setTarget(w, h);
  syncFitChrome();

  showTarget({ w, h, label: name });

  // Every queued crop follows the new shape immediately, so the filmstrip is
  // always a truthful preview of what would be exported right now.
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

function syncSizeConfidence(): void {
  $('#sizeButton').classList.toggle('is-provisional', !sizeChosen);
  $('#sizeNote').classList.toggle('is-unsettled', !sizeChosen);
  $('#sizeNote').textContent = sizeChosen
    ? 'Search by name, pixels or shape.'
    : hasImage
      ? 'Your image’s own size, nothing cropped. Click above to crop it to something else.'
      : 'Just a suggestion — click above to set the size you need.';
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
  onPick: (r: SizeResult) => {
    sizeChosen = true;
    applyTarget({ w: r.w, h: r.h, name: r.name });
    // "Whole image" is a promise about the result, not just a size, so the crop
    // is stated outright rather than arrived at. The obvious route — set the
    // target, then fill the frame — cannot be trusted here: filling measures
    // against the frame rect, and that rect spends the next few hundred ms
    // animating out of the old shape, so a fill lands on an aspect belonging to
    // neither size and the file ships with bars down two edges. Export reads
    // item.frame, so naming the whole rectangle is both the truth and the thing
    // written to disk, with no animation to wait on.
    if (r.kind === 'whole') {
      const item = activeItem();
      if (item) {
        const updated = useWholeImage(item, { w: r.w, h: r.h, label: r.name });
        store.updateItem(item.id, () => updated);
        view.setImage(updated.image, updated.frame);
      }
      announce(`Whole image at ${r.w} by ${r.h} pixels. Nothing cropped`);
    }
    syncSizeConfidence();
  },
});

// ---- export ----------------------------------------------------------------

exportPanel = createExportPanel({
  getState: () => store.get(),
  getFraming: () => view.hasImage() ? view.getFraming() : null,
  announce,
  onScaleChange: updateReadout,
});

// ---- history ---------------------------------------------------------------

// Undo restores a whole past state, so the screen has to be rebuilt from it
// rather than nudged: the target, the framing on the canvas, the adjustment
// sliders and the queue all describe that state and none of them can be left
// showing the one it replaced.
function showState(state: AppState): void {
  showTarget(state.target);
  view.setTarget(state.target.w, state.target.h);

  const item = state.items[state.activeIndex] ?? null;
  if (item) {
    showFileIdentity(item);
    setChromeVisible(true);
    view.setImage(item.image, item.frame);
    showAdjust(item);
    updateReadout(view.getFraming());
  } else {
    setChromeVisible(false);
  }
  syncFitChrome();
  syncBatchChrome();
  syncUI();
}

const history = createHistory({
  onChange: () => {
    $<HTMLButtonElement>('#undo').disabled = !history.canUndo();
    $<HTMLButtonElement>('#redo').disabled = !history.canRedo();
  },
  onRestore: showState,
});

$('#undo').addEventListener('click', () => {
  if (history.undo()) announce('Undone');
});
$('#redo').addEventListener('click', () => {
  if (history.redo()) announce('Redone');
});

// ---- events ----------------------------------------------------------------

const openPicker = () => { fileInput.value = ''; fileInput.click(); };
$('#add').onclick = openPicker;
$('#emptyAdd').onclick = openPicker;
fileInput.onchange = () => { if (fileInput.files) void intake(fileInput.files); };

let dragDepth = 0;
for (const name of ['dragenter', 'dragleave', 'dragover', 'drop'] as const) {
  document.addEventListener(name, (event) => {
    const e = event as DragEvent;
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

// Undo is the one shortcut that has to work from anywhere and in either mode,
// so it is read before the framing keys and their guards.
document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
  const focused = document.activeElement;
  if (focused && focused.matches?.('input, select, textarea')) return;
  e.preventDefault();
  const redoing = e.shiftKey;
  const moved = redoing ? history.redo() : history.undo();
  announce(moved
    ? (redoing ? 'Redone' : 'Undone')
    : (redoing ? 'Nothing to redo' : 'Nothing to undo'));
});

document.addEventListener('keydown', (e) => {
  // The target is not always an element (and not always one with .matches),
  // so ask the document what has focus instead of trusting the event.
  const focused = document.activeElement;
  if (focused && focused.matches?.('input, select, textarea')) return;
  if (!view.hasImage()) return;
  if (e.ctrlKey || e.metaKey) return;

  // Every key below moves the framing or the queue. None of them belongs to
  // adjusting, and a stray arrow that quietly re-crops the image you were only
  // trying to brighten is exactly the kind of thing that costs trust. Switching
  // job is a labelled button on the stage, deliberately not a letter to learn.
  if (mode !== 'crop') return;

  // Arrows fine-tune the framing; brackets (or j/k) move through the queue.
  // Nudging is the more frequent act, so it keeps the arrows.
  const px = e.shiftKey ? 40 : 8;
  const actions: Readonly<Record<string, () => void>> = {
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
$('#enableBatch').addEventListener('click', () => setBatch(!store.get().batch));
$('#modeCrop').addEventListener('click', () => setMode('crop'));
$('#modeAdjust').addEventListener('click', () => setMode('adjust'));

// ---- boot ------------------------------------------------------------------

paintIcons();
setChromeVisible(false);
syncBatchChrome();
syncUI();
const boot = store.get().target;
applyTarget({ w: boot.w, h: boot.h, name: boot.label });
syncSizeConfidence();
view.resize();

// Wiring: intake, the viewfinder, the readouts, and the keyboard.

import { store, createItem, activeItem } from './state.js';
import { createViewfinder, type FrameView } from './viewfinder.js';
import { createSizePicker } from './sizepicker.js';
import { createFilmstrip } from './filmstrip.js';
import { scaledTarget } from './export.js';
import { createAdjustPanel, neutral } from './adjust.js';
import { paintIcons } from './icons.js';
import { createExportPanel, type ExportPanelController } from './presentation/export-panel.js';
import { createConvertPanel, type ConvertPanelController } from './presentation/convert-panel.js';
import { acceptFrame, fitFrameToTarget, suggestFrame, targetKey, useWholeImage, wholeFrame } from './application/framing.js';
import {
  FREEFORM_LABEL, commitFreeform, enterFreeform, exitFreeform, releaseFreeform,
} from './application/freeform.js';
import { tickFromZoom, zoomFromTick, type ZoomRange } from './application/zoom.js';
import { decodeImage } from './infrastructure/image-decoder.js';
import { requiredElement, requiredElements } from './infrastructure/dom.js';
import { loadPinned, pinId, removePinned } from './pinned.js';
import { createHistory } from './history.js';
import type {
  AppState, CropItem, Framing, OutputTarget, PinnedSize, SizeResult,
} from './domain/types.js';

const $ = <T extends Element = HTMLElement>(selector: string): T => requiredElement<T>(selector);
const $$ = <T extends Element = HTMLElement>(selector: string): T[] => requiredElements<T>(selector);
const canvas = $<HTMLCanvasElement>('#canvas');
const stage = $<HTMLElement>('#stage');
const fileInput = $<HTMLInputElement>('#file');

let exportPanel: ExportPanelController | null = null;
let convertPanel: ConvertPanelController | null = null;

// Where the app goes back to when Freeform is turned off and there is no preset
// to restore — the size it booted with, before anything had been chosen.
const DEFAULT_TARGET: OutputTarget = { ...store.get().target };

const isFreeform = (): boolean => store.get().cropMode === 'freeform';
// The one breakpoint the script needs to know about: below it the panel is a
// screen of its own and the stage has no room for anything it does not need.
const narrow = (): boolean => matchMedia('(max-width: 900px)').matches;

function announce(message: string): void {
  const el = $('#status');
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = message; });
}

// A sentence about something the app did on your behalf. It is not an error and
// there is nothing to answer, so it says its piece and leaves.
let noticeTimer: ReturnType<typeof setTimeout> | null = null;
function showNotice(message: string): void {
  const el = $('#notice');
  el.textContent = message;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('open'));
  if (noticeTimer !== null) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    el.classList.remove('open');
    noticeTimer = setTimeout(() => { el.hidden = true; }, 220);
  }, 4_200);
}

const view = createViewfinder({
  canvas,
  stage,
  // A freeform crop is finished the moment it is released, and the size it
  // stands for is its own pixels. Setting that target is what sends the frame
  // home — the same recentre every other commit uses, with the source crop
  // stated outright first so the animation cannot move it.
  onFreeformCommit(framing) {
    const state = store.transact((current) => commitFreeform(current, framing));
    if (state.cropMode !== 'freeform') return;
    view.setTarget(state.target.w, state.target.h);
    showTarget(state.target);
    markActivePin();
    syncFitChrome();
    syncUI();
  },
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
  syncZoom();
  const w = Math.round(framing.cropW);
  const h = Math.round(framing.cropH);

  // In Freeform the output *is* the crop, so both the panel that normally names
  // a chosen size and the chip on the stage state the pixels being cut — live,
  // while they change. Against a preset the crop's own size answers nothing the
  // export cares about, so the chip stays away.
  const freeform = isFreeform();
  $('#cropChip').hidden = !freeform;
  if (freeform) {
    $('#cropSize').textContent = `${w} × ${h}`;
    $('#sizeName').textContent = FREEFORM_LABEL;
    $('#sizeDims').textContent = `${w} × ${h}`;
  }

  // How much real detail is behind each output pixel. Below 1.0 we are
  // enlarging, which is the only thing that actually costs quality here. The
  // export multiplier is part of that sum: at 4x the file wants four times the
  // pixels in each direction, and the chip has to say so while it can still be
  // changed for free.
  const out = scaledTarget(target, exportPanel?.getScale() ?? 1);
  const ratio = Math.min(framing.cropW / out.w, framing.cropH / out.h);
  const chip = $('#qualityChip');
  const label = $('#quality');
  chip.className = 'chip zoom-quality';
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

// ---- rooms -----------------------------------------------------------------

// Three rooms rather than two jobs and a switch. Crop and Adjust are two things
// to do to the picture in front of you; Batch is a different proposition
// entirely — a queue, a beat, and an export that writes many files — and it was
// previously a flag laid over the other two. That leaked: the queue appeared
// before there was a queue, stayed on screen after you had left it, and leaving
// destroyed it. A room you are either in or not in cannot do any of that.
// Convert joined them later and belongs by the same test: it is a thing you
// came here to do to an image, not a setting on the way out. The export panel
// changes the format of a crop; Convert changes the format of a file and
// touches nothing else about it.
type Room = 'crop' | 'adjust' | 'batch' | 'convert';
let room: Room = 'crop';
let hasImage = false;

// The framing surface belongs to two of the four rooms: Batch is Crop with a
// queue attached, so the frame, the zoom and the readouts are all still the job.
// Adjust and Convert both leave the framing alone, so neither shows its chrome.
const framingRoom = (): boolean => room !== 'adjust' && room !== 'convert';

// One place decides what is on the stage, because visibility depends on both
// facts at once — whether there is an image, and which room you are in.
function syncStageChrome(): void {
  const framing = framingRoom();
  const batching = room === 'batch';
  $('#empty').hidden = hasImage;
  // The rooms are the app's navigation, so they stay on screen and go quiet
  // instead of disappearing: an empty rail reads as a broken rail. Batch is the
  // exception — it is a door to somewhere else, and it opens with no picture.
  $<HTMLButtonElement>('#modeCrop').disabled = !hasImage;
  $<HTMLButtonElement>('#modeAdjust').disabled = !hasImage;
  $<HTMLButtonElement>('#modeConvert').disabled = !hasImage;
  $('#adjust').hidden = !hasImage || room !== 'adjust';
  $('#convert').hidden = !hasImage || room !== 'convert';
  // The crop readouts describe a framing decision, so they are only true while
  // that is the decision being made.
  $('#readout').hidden = !hasImage || !framing;
  $('#hints').hidden = !hasImage || !framing;
  // Visibility depends on the frame's room as well as the mode, so it is
  // settled in one place — syncFitChrome, which is also what resize calls.
  syncFitChrome();
  // Zoom is a fact about the framing, so it is on screen exactly as long as the
  // framing is the job in hand.
  $('#zoomTool').hidden = !hasImage || !framing;
  // Freeform is one image's answer, so it is not on offer in the room whose
  // whole basis is a size every image shares.
  $('#freeform').hidden = !hasImage || !framing || batching;
  $('#modeCrop').setAttribute('aria-selected', String(room === 'crop'));
  $('#modeAdjust').setAttribute('aria-selected', String(room === 'adjust'));
  $('#modeConvert').setAttribute('aria-selected', String(room === 'convert'));
  $('#modeBatch').setAttribute('aria-selected', String(batching));
  if (room === 'convert') convertPanel?.sync();
  syncFramingChrome();
}

// ---- framing a batch -------------------------------------------------------

// Approving a crop is the one thing a batch cannot do for you, and a keyboard
// shortcut nobody has been told about is not an interface. So the beat gets a
// button, the button says its own shortcut, and while a crop is still owed the
// rest of the screen steps back so there is one obvious thing to do.
function syncFramingChrome(): void {
  const state = store.get();
  const item = activeItem(state);
  const framing = room === 'batch' && !!item;
  $('#framing').hidden = !framing;

  if (!framing || !item) {
    document.body.classList.remove('is-framing');
    return;
  }

  const total = state.items.length;
  const done = state.items.filter((i) => i.approved).length;
  const owed = !item.approved;

  $<HTMLButtonElement>('#finalize').hidden = !owed;
  // The narrow layout's copy of the same beat, living in the queue's own row.
  $<HTMLButtonElement>('#finalizeSmall').hidden = !owed;
  $('#framingStep').textContent = owed
    ? `Image ${state.activeIndex + 1} of ${total}${done ? ` · ${done} framed` : ''}`
    : done === total
      ? `All ${total} framed — export them below`
      : `${done} of ${total} framed`;
  $('#framingStep').classList.toggle('is-done', !owed && done === total);
  // Nothing is dimmed once the queue is finished: the next thing to look at is
  // the export button, and it lives in the panel that was being held back.
  document.body.classList.toggle('is-framing', owed);
}

// The explainer DEC-04 requires whenever a drop puts the app into batch by
// itself. It states the loop, then gets out of the way.
function openCoach(count: number): void {
  $('#coachTitle').textContent = `${count} images — one crop at a time`;
  const coach = $('#coach');
  coach.hidden = false;
  requestAnimationFrame(() => {
    coach.classList.add('open');
    $<HTMLButtonElement>('#coachGo').focus();
  });
}

function closeCoach(): void {
  const coach = $('#coach');
  if (coach.hidden) return;
  coach.classList.remove('open');
  coach.hidden = true;
  canvas.focus();
}

const ROOM_SAID: Readonly<Record<Room, string>> = {
  crop: 'Crop. Move or resize the frame, then it recentres with your crop',
  adjust: 'Adjust. The crop is left exactly as it was',
  batch: 'Batch. Frame each image, then keep it',
  convert: 'Convert. Change the format and keep every pixel',
};

/**
 * Go to a room.
 *
 * Batch is the one with a door rather than a light switch. Entering it needs a
 * queue, so with nothing queued it asks for one and waits — the room does not
 * open, and nothing about the screen changes, until images actually arrive.
 * That is the whole fix for a filmstrip that used to appear the instant the
 * control was touched and stay after you had gone.
 *
 * Leaving keeps the queue. Navigating away from a room is not a decision to
 * throw its contents out, and coming back to find the work gone is the kind of
 * thing that costs trust once and for good.
 */
function goTo(next: Room): void {
  if (next === room) return;

  if (next === 'batch' && store.get().items.length < 2) {
    awaitingBatchSize = true;
    announce('Choose the images to frame');
    openPicker();
    return;
  }

  room = next;
  store.set({ batch: next === 'batch' });
  syncStageChrome();
  syncUI();
  announce(ROOM_SAID[next]);
  if (next !== 'adjust') canvas.focus();
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

// ---- how large the frame is drawn ------------------------------------------

// The frame is the output at its real size (DEC-03), and the other two views
// are departures from it: closer for detail, further back for composition.
// Two things need saying: which of them you are in, and — whenever what you are
// looking at is not the real thing — how far off it is.
function syncFitChrome(): void {
  // An option that would show the same picture is not an option. A crop bigger
  // than the stage is already capped, so enlarging offers nothing; a frame
  // already down at the floor cannot usefully shrink. Each one leaves the row
  // rather than sitting in it doing nothing, and when neither is on offer the
  // question itself goes away.
  const canEnlarge = view.canEnlarge();
  const canShrink = view.canShrink();

  // A view can also stop being available underneath you — a new output size, a
  // resized stage — and leaving you standing in one that no longer exists would
  // light nothing in the control. True size is always there, so it is the way
  // back.
  let current = view.getFrameView();
  if ((current === 'fit' && !canEnlarge) || (current === 'small' && !canShrink)) {
    view.setFrameView('true');
    current = 'true';
  }
  const percent = Math.round(view.getFrameScale() * 100);
  $('#viewMode').hidden = !hasImage || !framingRoom() || (!canEnlarge && !canShrink);
  for (const option of $$<HTMLButtonElement>('#viewMode [role="radio"]')) {
    const value = option.dataset.view ?? 'true';
    option.setAttribute('aria-checked', String(value === current));
    option.hidden = value === 'fit' ? !canEnlarge : value === 'small' ? !canShrink : false;
  }

  // True size is a claim about the screen, so it has to be withdrawn when the
  // stage is too small to honour it — that is the one case where the view you
  // picked and the thing you are seeing are not the same.
  const capped = current === 'true' && percent < 100;
  const chip = $('#scaleChip');
  chip.hidden = current === 'true' && !capped;
  chip.classList.toggle('warn', capped);
  // Enlarging only has somewhere to go while the crop is smaller than the
  // stage; past that the stage is the limit in both views and they show the
  // same picture, which is worth saying rather than leaving you to click back
  // and forth looking for the difference.
  chip.textContent = current === 'fit'
    ? percent > 100
      ? `Enlarged — ${percent}% of true size`
      : `As large as the stage allows — ${percent}% of true size`
    : current === 'small'
      ? `Standing back — ${percent}% of true size`
      : capped ? `Too big for the stage — shown at ${percent}% of true size` : '';
}

// ---- zoom ------------------------------------------------------------------

// Zoom is a quantity, so it gets a control that can express one. The slider is
// logarithmic — every step is the same proportion of where you already are, so
// it is as fine at 700% as at 101% and there are no jumps anywhere along it —
// and the field is for when you already know the number.
const ZOOM_TICKS = 1000;
const zoomSlider = $<HTMLInputElement>('#zoomSlider');
const zoomField = $<HTMLInputElement>('#zoomValue');

// The range runs either side of 100% now — out to a picture sitting inside the
// frame, in to eight times it — so the slider is anchored at both ends rather
// than at 1 and a ceiling.
const zoomRange = (): ZoomRange => ({ min: view.getMinZoom(), max: view.getMaxZoom() });
const tickToZoom = (tick: number): number => zoomFromTick(tick, ZOOM_TICKS, zoomRange());
const zoomToTick = (zoom: number): number => tickFromZoom(zoom, ZOOM_TICKS, zoomRange());

// Whole numbers most of the time, a tenth when the tenth is the point.
const showPercent = (zoom: number): string => {
  const percent = Math.round(zoom * 1000) / 10;
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1);
};

// The zoom can move without the control being touched — wheel, pinch, a new
// image, a change of size — so the control is refreshed from the viewfinder
// every frame rather than only when it is the thing that caused the change.
// Whatever has focus is being typed or dragged, and is left alone.
function syncZoom(): void {
  const zoom = view.getZoom();
  const focused = document.activeElement;
  if (focused !== zoomSlider) zoomSlider.value = String(zoomToTick(zoom));
  if (focused !== zoomField) zoomField.value = showPercent(zoom);
}

zoomSlider.addEventListener('input', () => {
  view.setZoom(tickToZoom(Number(zoomSlider.value)));
});

// Enter and leaving the field are the same act: take the number if it is one,
// and say what actually happened by writing the landed value back.
function commitTypedZoom(): void {
  const typed = Number.parseFloat(zoomField.value.replace(/[^\d.]/g, ''));
  if (Number.isFinite(typed)) view.setZoom(typed / 100);
  zoomField.value = showPercent(view.getZoom());
  zoomSlider.value = String(zoomToTick(view.getZoom()));
}
zoomField.addEventListener('change', commitTypedZoom);
// syncZoom leaves a focused field alone, so the zoom can move underneath it
// while you are in there. Leaving is the moment to catch up.
zoomField.addEventListener('blur', () => { zoomField.value = showPercent(view.getZoom()); });
zoomSlider.addEventListener('blur', () => { zoomSlider.value = String(zoomToTick(view.getZoom())); });
zoomField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); commitTypedZoom(); canvas.focus(); }
});
$('#zoomIn').addEventListener('click', () => view.zoomBy(1.1));
$('#zoomOut').addEventListener('click', () => view.zoomBy(1 / 1.1));

const VIEW_NAMES: Readonly<Record<FrameView, string>> = {
  small: 'Standing back',
  true: 'True size',
  fit: 'Enlarged for editing',
};

// Picking a view is not the same act as flipping between them: the radio says
// which one it wants and asking for the one you are in is nothing at all.
function setViewMode(next: FrameView): void {
  if (view.getFrameView() === next) return;
  view.setFrameView(next);
  syncFitChrome();
  announce(VIEW_NAMES[next]);
}

// The f key is a cycle, because a key has no side to press — and with three
// views there is no side to press toward either. Views that would show the same
// picture are stepped over rather than landed on, so the key never appears to
// do nothing.
function cycleView(): void {
  const order: readonly FrameView[] = ['small', 'true', 'fit'];
  const available = order.filter((v) =>
    v === 'true' || (v === 'fit' ? view.canEnlarge() : view.canShrink()));
  const at = available.indexOf(view.getFrameView());
  const next = available[(at + 1) % available.length];
  if (next) setViewMode(next);
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

  // A stack is a statement that these images share a destination, which is the
  // one thing Freeform does not have. The drop is the deliberate act (DEC-04),
  // so it wins and the preset comes back with it.
  if (files.length > 1 && isFreeform()) {
    setFreeform(false);
    showNotice('Freeform turned off — a stack needs one output size.');
  }

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
  const first = items[0];
  if (isFreeform() && first) applyFreeformSize(first.image.naturalWidth, first.image.naturalHeight);
  else if (!sizeChosen) adoptImageSize(items[0]);

  const s = store.get();
  items = items.map((item) => suggestFrame(item, s.target));
  // The lead image is the one the target was taken from, so it is the whole
  // rectangle exactly — said outright rather than rounded to by the autoframer.
  if (!sizeChosen || isFreeform()) {
    const lead = items[0];
    if (lead) items[0] = { ...lead, frame: wholeFrame(lead), framedFor: targetKey(s.target) };
  }

  // A stack chosen by going to Batch is the answer to "which images", so it is
  // the queue — and the room opens now, on the images, rather than the moment
  // the control was touched. One image chosen this way is a stack of one and
  // still opens the room; the door was walked through on purpose.
  if (awaitingBatchSize) {
    awaitingBatchSize = false;
    enterBatchWith(items);
    announce(`${items.length} image${items.length === 1 ? '' : 's'} ready to frame`);
    // The one question left is the size they all have to come out at, asked now
    // by the control that answers it rather than left as a sentence to find.
    sizePicker.open();
    return;
  }

  // A stack is its own answer to the question the app used to ask (DEC-04):
  // dropping twelve files is the deliberate act, so it is honoured rather than
  // queried. Entering this way is never silent — the explainer says what the
  // room asks of you, once, because you did not ask to be in it.
  if (room !== 'batch' && items.length > 1) {
    enterBatchWith(items);
    openCoach(items.length);
    announce(`${items.length} images loaded. Batch — frame each one, then keep it`);
    return;
  }

  // Outside Batch a drop is a replacement, not an append: the new image takes
  // the stage and every setting stays exactly where it was (DEC-04).
  if (room !== 'batch') {
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

// Set while a deliberate entry into Batch is waiting for its images: the flow is
// pick the stack, then the size, then frame — one question at a time, each one
// asked by the thing that answers it.
let awaitingBatchSize = false;

// Entering Batch is the act of choosing a stack, and until a stack exists there
// is no room to be in. This is the only path that turns the queue on.
function enterBatchWith(items: readonly CropItem[]): void {
  room = 'batch';
  store.set({ batch: true, items, activeIndex: -1 });
  activate(0);
  syncStageChrome();
  syncUI();
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
  // Where you are in the queue is part of the same description.
  syncFramingChrome();
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

// Keeping a crop is the beat of the whole batch, and it happens on the picture
// rather than in a sentence somewhere: the frame flashes the app's one accent
// and the thumbnail lights up as the next image arrives.
function flashKept(): void {
  stage.classList.remove('just-kept');
  void stage.offsetWidth;
  stage.classList.add('just-kept');
}

function approve(): void {
  const item = activeItem();
  if (!item) return;
  store.updateItem(item.id, (current) => (acceptFrame(current)));
  syncUI();
  flashKept();
  strip.celebrate(store.get());

  const s = store.get();
  const next = s.items.findIndex((i, idx) => !i.approved && idx > s.activeIndex);
  const wrapped = next >= 0 ? next : s.items.findIndex((i) => !i.approved);
  if (wrapped >= 0) {
    activate(wrapped);
    announce(`Kept. ${s.items.filter((i) => i.approved).length} of ${s.items.length} framed`);
  } else {
    syncUI();
    flashExport();
    announce(`All ${s.items.length} framed and ready`);
  }
}

// The queue is finished, so the thing that was dim all the way through is now
// the only thing left to do. Say so where the eye already is.
function flashExport(): void {
  // On a phone the export button is inside a screen you have not opened yet, so
  // the thing that opens it is what has to catch the eye. Whichever is on
  // screen, the finished queue points at the one thing left to do.
  const button = narrow() ? $('#sheetOpen') : $('#export');
  button.classList.remove('just-ready');
  void button.offsetWidth;
  button.classList.add('just-ready');
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
  flashExport();
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
  // The top bar's compact half of the same control.
  $('#sizeChipDims').textContent = `${target.w} × ${target.h}`;
  // Mirror the frame's shape in the panel chip.
  const swatch = $('#sizeSwatch');
  const long = 26;
  const { w, h } = target;
  swatch.style.width = `${w >= h ? long : Math.max(6, (long * w) / h)}px`;
  swatch.style.height = `${w >= h ? Math.max(6, (long * h) / w) : long}px`;
}

// ---- pinned sizes ----------------------------------------------------------

// The size picker is a good answer to "what size?" and a poor one to "the same
// size as the last nine times". A pin is the second question's answer: the
// sizes this person actually uses, sitting in the top bar where a decision that
// is already made belongs.
function renderPins(list: readonly PinnedSize[] = loadPinned()): void {
  const host = $('#pins');
  host.textContent = '';
  host.hidden = list.length === 0;

  for (const pin of list) {
    const chip = document.createElement('span');
    chip.className = 'pin-chip';
    chip.dataset.pin = pin.id;

    // Two acts on one chip: use this size, or stop keeping it. The big half is
    // the one you want, and the ✕ has to be deliberate to hit.
    const use = document.createElement('button');
    use.type = 'button';
    use.className = 'pin-use';
    const name = document.createElement('strong');
    name.textContent = pin.name;
    const dims = document.createElement('span');
    dims.textContent = `${pin.w} × ${pin.h}`;
    use.append(name, dims);
    use.title = `${pin.name} — ${pin.w} × ${pin.h}`;
    use.addEventListener('click', () => {
      sizeChosen = true;
      applyTarget({ w: pin.w, h: pin.h, name: pin.name });
      syncSizeConfidence();
    });

    const drop = document.createElement('button');
    drop.type = 'button';
    drop.className = 'pin-drop';
    drop.textContent = '✕';
    drop.title = `Unpin ${pin.name}`;
    drop.setAttribute('aria-label', `Unpin ${pin.name}`);
    drop.addEventListener('click', () => renderPins(removePinned(pin.id)));

    chip.append(use, drop);
    host.append(chip);
  }
  markActivePin();
}

// A pin is not a mode, but it is worth saying which one you are looking at.
function markActivePin(): void {
  const { target } = store.get();
  const active = pinId(target.w, target.h);
  for (const chip of $('#pins').querySelectorAll<HTMLElement>('.pin-chip')) {
    chip.classList.toggle('is-active', chip.dataset.pin === active);
  }
}

// Everything the screen owes a new output size. The store move differs by route
// — a preset refits every crop, Freeform states one outright — but what has to
// be redrawn afterwards is the same either way.
function showAppliedTarget(target: OutputTarget): void {
  view.setTarget(target.w, target.h);
  syncFitChrome();
  showTarget(target);
  markActivePin();

  // Every queued crop follows the new shape immediately, so the filmstrip is
  // always a truthful preview of what would be exported right now.
  const item = activeItem();
  if (item) {
    view.setImage(item.image, item.frame);
    updateReadout(view.getFraming());
  }
  syncUI();
}

function applyTarget({ w, h, name }: TargetSelection): void {
  if (!(w > 0 && h > 0)) return;
  const state = store.transact((current) => {
    const target = { w, h, label: name };
    // Naming a size is the plainest possible way of saying the crop has a
    // destination again, so it is also how you leave Freeform.
    const base = releaseFreeform(current);
    return { ...base, target, items: base.items.map((item) => fitFrameToTarget(item, target)) };
  });
  view.setFreeform(false);
  showAppliedTarget(state.target);
  syncFreeformChrome();
  announce(`${name}, ${w} by ${h} pixels`);
}

// ---- freeform --------------------------------------------------------------

// The preset is suspended rather than unavailable while Freeform is on, and the
// Batch room asks for a size on the way in — so neither has to be disabled and
// neither has to explain itself in a sentence nobody reads.
function syncFreeformChrome(): void {
  const on = isFreeform();
  $('#freeform').setAttribute('aria-pressed', String(on));
  $('#sizeButton').classList.toggle('is-suspended', on);
  syncSizeConfidence();
}

function setFreeform(on: boolean): void {
  if (isFreeform() === on) return;

  if (on) {
    const before = store.get();
    const framing = view.hasImage() ? view.getFraming() : null;
    const state = store.transact((current) => enterFreeform(current, framing));
    view.setFreeform(true);
    // Freeform is one image's answer, so it cannot be given in the room whose
    // whole basis is a size every image shares. Leaving is a move between
    // rooms, not a deletion: the queue is exactly where it was.
    if (room === 'batch') room = 'crop';
    showAppliedTarget(state.target);
    syncStageChrome();
    syncFreeformChrome();
    if (before.batch) showNotice('Left Batch — Freeform applies to one image.');
    announce('Freeform crop enabled. Aspect ratio unlocked');
    return;
  }

  const state = store.transact((current) => exitFreeform(current, DEFAULT_TARGET));
  view.setFreeform(false);
  showAppliedTarget(state.target);
  syncFreeformChrome();
  announce(`Freeform crop disabled. Restored ${state.target.w} by ${state.target.h} preset`);
}

// A picture arriving in Freeform has no size to inherit — the last crop's pixel
// count is a fact about a different image — so it starts as the whole of itself.
function applyFreeformSize(w: number, h: number): void {
  const state = store.set({ target: { w, h, label: FREEFORM_LABEL } });
  showAppliedTarget(state.target);
}

// Until a size has actually been chosen the panel is only showing a default.
// That used to be enforced with a modal; it is now said where the answer lives,
// so an unanswered question nags instead of blocking.
let sizeChosen = false;

function syncSizeConfidence(): void {
  // In Freeform the size is not unsettled, it is superseded — and the way out
  // is the control itself, so that is what the line says.
  const freeform = isFreeform();
  const unsettled = !sizeChosen && !freeform;
  $('#sizeButton').classList.toggle('is-provisional', unsettled);
  $('#sizeNote').classList.toggle('is-unsettled', unsettled);
  $('#sizeNote').textContent = freeform
    ? 'Choose an output size to exit Freeform.'
    : sizeChosen
      ? 'Search by name, pixels or shape.'
      : hasImage
        ? 'Your image’s own size, nothing cropped. Click above to crop it to something else.'
        : 'Just a suggestion — click above to set the size you need.';
}

const sizePicker = createSizePicker({
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
  onPinsChange: renderPins,
  // Clicking a suspended preset is one act, not two: it means "I want a size
  // again", so Freeform ends and the list opens on the same click. The preset
  // that was suspended comes back with it, so dismissing without choosing
  // leaves you exactly where the click implied — out of Freeform, on the size
  // you had before it.
  onBeforeOpen: () => { if (isFreeform()) setFreeform(false); },
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

convertPanel = createConvertPanel({
  getState: () => store.get(),
  announce,
});

// ---- history ---------------------------------------------------------------

// Undo restores a whole past state, so the screen has to be rebuilt from it
// rather than nudged: the target, the framing on the canvas, the adjustment
// sliders and the queue all describe that state and none of them can be left
// showing the one it replaced.
function showState(state: AppState): void {
  showTarget(state.target);
  view.setTarget(state.target.w, state.target.h);
  // The mode is part of the state being restored, so the lock, the button and
  // the suspended preset all come back with it rather than being left behind.
  view.setFreeform(state.cropMode === 'freeform');
  syncFreeformChrome();

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
  // The room is part of the state being restored, since the queue's presence is.
  if (state.batch !== (room === 'batch')) room = state.batch ? 'batch' : 'crop';
  syncStageChrome();
  syncFitChrome();
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
  // The explainer is modal: Enter belongs to its button, not to the crop
  // waiting behind it.
  if (!$('#coach').hidden) {
    if (e.key === 'Escape') { e.preventDefault(); closeCoach(); }
    return;
  }

  // Every key below moves the framing or the queue. None of them belongs to
  // adjusting, and a stray arrow that quietly re-crops the image you were only
  // trying to brighten is exactly the kind of thing that costs trust. Switching
  // job is a labelled button on the stage, deliberately not a letter to learn.
  if (!framingRoom()) return;

  // Arrows fine-tune the framing; brackets (or j/k) move through the queue.
  // Nudging is the more frequent act, so it keeps the arrows.
  const px = e.shiftKey ? 40 : 8;
  const actions: Readonly<Record<string, () => void>> = {
    ArrowLeft: () => view.nudge(px, 0),
    ArrowRight: () => view.nudge(-px, 0),
    ArrowUp: () => view.nudge(0, px),
    ArrowDown: () => view.nudge(0, -px),
    '0': () => view.fill(),
    f: cycleView,
    F: cycleView,
    '=': () => view.zoomBy(1.1),
    '+': () => view.zoomBy(1.1),
    '-': () => view.zoomBy(1 / 1.1),
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

for (const option of $$<HTMLButtonElement>('#viewMode [role="radio"]')) {
  option.addEventListener('click', () => setViewMode((option.dataset.view ?? 'true') as FrameView));
}
$('#freeform').addEventListener('click', () => setFreeform(!isFreeform()));
// The size question, asked from the top bar as well as from the panel.
$('#sizeChip').addEventListener('click', () => sizePicker.open());
// A live pixel count you cannot touch is a number that looks like a field and
// is not one. In Freeform the crop's size *is* the output size, so tapping it
// asks the only question it could be asking: make this an exact size instead.
$('#cropChip').addEventListener('click', () => { if (isFreeform()) sizePicker.open(); });
// The button, its narrow-layout twin and the Enter key are one act.
$('#finalize').addEventListener('click', approve);
$('#finalizeSmall').addEventListener('click', approve);
$('#coachGo').addEventListener('click', closeCoach);
$('#coach').addEventListener('mousedown', (event) => {
  if (event.target === $('#coach')) closeCoach();
});
$('#modeCrop').addEventListener('click', () => goTo('crop'));
$('#modeAdjust').addEventListener('click', () => goTo('adjust'));
$('#modeConvert').addEventListener('click', () => goTo('convert'));
$('#modeBatch').addEventListener('click', () => goTo('batch'));

// ---- boot ------------------------------------------------------------------

paintIcons();
renderPins();
setChromeVisible(false);
syncFreeformChrome();
syncUI();
const boot = store.get().target;
applyTarget({ w: boot.w, h: boot.h, name: boot.label });
syncSizeConfidence();
view.resize();

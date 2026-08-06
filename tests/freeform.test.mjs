import test from 'node:test';
import assert from 'node:assert/strict';

import { frameFit } from '../dist/src/application/frame-view.js';
import { tickFromZoom, zoomFromTick } from '../dist/src/application/zoom.js';
import {
  FREEFORM_LABEL,
  commitFreeform,
  enterFreeform,
  exitFreeform,
  exportItems,
  freeformTarget,
  releaseFreeform,
  resizeFree,
} from '../dist/src/application/freeform.js';

const adjustment = Object.freeze({ exposure: 0, contrast: 0, saturation: 0 });
const PRESET = { w: 540, h: 312, label: 'Hot Deals' };

function fakeItem(id, overrides = {}) {
  return {
    id,
    file: { name: `${id}.jpg` },
    image: { naturalWidth: 2400, naturalHeight: 1600 },
    name: id,
    frame: { cx: 1200, cy: 800, cropW: 1834, cropH: 1059 },
    adjust: adjustment,
    approved: false,
    auto: true,
    framedFor: '540x312',
    ...overrides,
  };
}

function presetState(overrides = {}) {
  return {
    target: PRESET,
    items: [fakeItem('a')],
    activeIndex: 0,
    batch: false,
    cropMode: 'preset',
    previousTarget: null,
    ...overrides,
  };
}

const active = (state) => state.items[state.activeIndex];

test('entering freeform keeps the preset and adopts the crop’s own pixels', () => {
  const before = presetState();
  const framing = { cx: 900, cy: 700, cropW: 1834.4, cropH: 1067.2 };
  const state = enterFreeform(before, framing);

  assert.equal(state.cropMode, 'freeform');
  assert.deepEqual(state.previousTarget, PRESET, 'the suspended preset is kept, not cleared');
  assert.deepEqual(state.target, { w: 1834, h: 1067, label: FREEFORM_LABEL });
  // The crop the user was looking at survives the mode change untouched, and it
  // is now a decision rather than a suggestion.
  assert.deepEqual(active(state).frame, framing);
  assert.equal(active(state).auto, false);
  assert.equal(active(state).framedFor, '1834x1067');
  assert.equal(before.cropMode, 'preset', 'the input state is not mutated');
});

test('entering freeform is idempotent and survives having no crop yet', () => {
  const once = enterFreeform(presetState(), null);
  assert.equal(once.target.label, FREEFORM_LABEL);
  assert.equal(once.target.w, 1834, 'falls back to the item’s stored frame');

  const empty = enterFreeform({ ...presetState(), items: [], activeIndex: -1 }, null);
  assert.deepEqual(empty.target, { ...PRESET, label: FREEFORM_LABEL });

  const again = enterFreeform(once, { cx: 1, cy: 1, cropW: 10, cropH: 10 });
  assert.equal(again, once, 'already freeform: nothing happens');
});

test('freeform and batch cannot both be on, and nothing is unloaded', () => {
  const batched = presetState({
    batch: true,
    items: [fakeItem('a'), fakeItem('b', { approved: true }), fakeItem('c')],
  });
  const state = enterFreeform(batched, null);

  assert.equal(state.batch, false);
  assert.equal(state.items.length, 3, 'the queue is still loaded');
  assert.equal(state.items[1].approved, true, 'finished work is untouched');
  // ...but only the image on the stage is what an export would write.
  assert.deepEqual(exportItems(state).map((item) => item.id), ['a']);
  assert.equal(exportItems(batched).length, 3, 'outside freeform the queue exports whole');
});

test('a released freeform crop becomes the output size at 1:1', () => {
  const state = enterFreeform(presetState(), null);
  const drawn = { cx: 700, cy: 500, cropW: 812.6, cropH: 1290.4 };
  const next = commitFreeform(state, drawn);

  assert.deepEqual(next.target, { w: 813, h: 1290, label: FREEFORM_LABEL });
  assert.deepEqual(active(next).frame, drawn, 'the source crop is kept exactly as released');
  assert.equal(next.cropMode, 'freeform');
  assert.equal(next.previousTarget, state.previousTarget);
  // The recentre scales the image so the crop fills the canonical frame. That
  // frame is the target at true size, so the landing zoom is 1:1 — no
  // enlargement, and a 1× export writes the crop's native pixels.
  assert.ok(Math.abs(next.target.w / drawn.cropW - 1) < 0.001);

  assert.equal(commitFreeform(presetState(), drawn).cropMode, 'preset');
});

test('leaving freeform restores the preset around the same focal point', () => {
  const state = commitFreeform(
    enterFreeform(presetState(), null),
    { cx: 1500, cy: 900, cropW: 1200, cropH: 900 },
  );
  const restored = exitFreeform(state, { w: 1080, h: 1080, label: 'Square post' });

  assert.equal(restored.cropMode, 'preset');
  assert.equal(restored.previousTarget, null);
  assert.deepEqual(restored.target, PRESET);

  const frame = active(restored).frame;
  assert.equal(frame.cx, 1500, 'the centre the user composed around is kept');
  assert.equal(frame.cy, 900);
  assert.ok(Math.abs(frame.cropW / frame.cropH - PRESET.w / PRESET.h) < 1e-9, 'preset ratio applied');
  assert.ok(frame.cx - frame.cropW / 2 >= 0 && frame.cx + frame.cropW / 2 <= 2400);
  assert.ok(frame.cy - frame.cropH / 2 >= 0 && frame.cy + frame.cropH / 2 <= 1600);
});

test('leaving freeform with no preset to restore falls back to the default size', () => {
  const fallback = { w: 1080, h: 1080, label: 'Square post' };
  const stranded = { ...enterFreeform(presetState(), null), previousTarget: null };
  assert.deepEqual(exitFreeform(stranded, fallback).target, fallback);

  const untouched = presetState();
  assert.equal(exitFreeform(untouched, fallback), untouched, 'not freeform: nothing happens');
});

test('opening the size list leaves freeform without restoring anything', () => {
  const state = enterFreeform(presetState(), null);
  const released = releaseFreeform(state);

  assert.equal(released.cropMode, 'preset');
  assert.equal(released.previousTarget, null);
  // The picker is open and about to name a size, so the crop is left alone
  // until it does — one click did both, and nothing flickered in between.
  assert.deepEqual(released.target, state.target);
  assert.equal(released.items, state.items);
});

test('freeform resizing moves each edge on its own', () => {
  const image = { x: 0, y: 0, w: 800, h: 600 };
  const limits = { image, minW: 20, minH: 20 };
  const start = { x: 200, y: 150, w: 300, h: 200 };

  // A corner changes width and height independently — the opposite corner stays.
  const corner = resizeFree(start, 'se', { x: 620, y: 260 }, limits);
  assert.deepEqual(corner, { x: 200, y: 150, w: 420, h: 110 });

  // Edges change one dimension only.
  assert.deepEqual(resizeFree(start, 'e', { x: 700, y: 999 }, limits), { x: 200, y: 150, w: 500, h: 200 });
  assert.deepEqual(resizeFree(start, 'w', { x: 100, y: 999 }, limits), { x: 100, y: 150, w: 400, h: 200 });
  assert.deepEqual(resizeFree(start, 'n', { x: 999, y: 50 }, limits), { x: 200, y: 50, w: 300, h: 300 });
  assert.deepEqual(resizeFree(start, 's', { x: 999, y: 500 }, limits), { x: 200, y: 150, w: 300, h: 350 });

  const ratio = start.w / start.h;
  assert.notEqual(corner.w / corner.h, ratio, 'the aspect really is unlocked');
});

test('a freeform crop cannot leave the image or collapse', () => {
  const image = { x: 40, y: 30, w: 800, h: 600 };
  const limits = { image, minW: 44, minH: 44 };
  const start = { x: 200, y: 150, w: 300, h: 200 };

  // Past the edge of the source, the edge of the source is where it stops.
  assert.deepEqual(resizeFree(start, 'se', { x: 5000, y: 5000 }, limits), {
    x: 200, y: 150, w: 640, h: 480,
  });
  assert.deepEqual(resizeFree(start, 'nw', { x: -5000, y: -5000 }, limits), {
    x: 40, y: 30, w: 460, h: 320,
  });

  // And it can never be dragged smaller than the minimum in either direction.
  const crushed = resizeFree(start, 'se', { x: 0, y: 0 }, limits);
  assert.equal(crushed.w, 44);
  assert.equal(crushed.h, 44);
  const crushedNw = resizeFree(start, 'nw', { x: 9999, y: 9999 }, limits);
  assert.equal(crushedNw.w, 44);
  assert.equal(crushedNw.h, 44);
});

test('the zoom slider runs from covering the frame to eight times it', () => {
  const range = { min: 1, max: 8 };
  const TICKS = 1000;

  // The floor is exactly "the picture covers the frame". Below it the frame
  // would be larger than the picture, which is not a crop of anything.
  assert.equal(zoomFromTick(0, TICKS, range), 1);
  assert.ok(Math.abs(zoomFromTick(TICKS, TICKS, range) - 8) < 1e-12);

  // Logarithmic: the same number of ticks is the same proportional step
  // wherever you are, which is the point of the control.
  const step = 100;
  const low = zoomFromTick(step, TICKS, range) / zoomFromTick(0, TICKS, range);
  const high = zoomFromTick(TICKS, TICKS, range) / zoomFromTick(TICKS - step, TICKS, range);
  assert.ok(Math.abs(low - high) < 1e-9);

  for (const zoom of [1, 1.5, 2.5, 8]) {
    const round = zoomFromTick(tickFromZoom(zoom, TICKS, range), TICKS, range);
    assert.ok(Math.abs(round - zoom) / zoom < 0.005, `${zoom} survives the round trip`);
  }
});

test('the three views change the frame’s size on screen and nothing else', () => {
  // A 600px output on a stage with room for twice that: true size is true size,
  // enlarging fills the stage, standing back halves it.
  const roomy = 2;
  assert.equal(frameFit('true', roomy, 600).scale, 1);
  assert.equal(frameFit('fit', roomy, 600).scale, 2);
  assert.equal(frameFit('small', roomy, 600).scale, 0.5);

  // Standing back is measured from what you would otherwise see, so a frame the
  // stage has already capped shrinks from the capped size, not from 100%.
  const capped = frameFit('small', 0.4, 4000);
  assert.ok(Math.abs(capped.scale - 0.2) < 1e-12);
  assert.equal(frameFit('true', 0.4, 4000).scale, 0.4);
});

test('a view that would show the same picture is not offered', () => {
  // Room to spare: both departures say something.
  const roomy = frameFit('true', 2, 600);
  assert.equal(roomy.enlargeable, true);
  assert.equal(roomy.shrinkable, true);

  // Already capped by the stage: enlarging is the picture you are looking at.
  assert.equal(frameFit('true', 0.4, 4000).enlargeable, false);

  // A small output has nowhere to stand back to — halving 90px leaves corners
  // nobody can grab, so the floor holds it at true size and the option goes.
  const tiny = frameFit('small', 3, 90);
  assert.equal(tiny.shrinkable, false);
  assert.equal(tiny.scale, 1, 'and asking for it changes nothing');

  // Just past the floor, it starts to mean something again.
  const past = frameFit('small', 3, 320);
  assert.equal(past.shrinkable, true);
  assert.ok(past.scale > 0.4 && past.scale < 1);
});

test('the freeform target is the crop, rounded to whole pixels', () => {
  assert.deepEqual(freeformTarget({ cx: 0, cy: 0, cropW: 1833.6, cropH: 1066.5 }), {
    w: 1834, h: 1067, label: FREEFORM_LABEL,
  });
  assert.deepEqual(freeformTarget({ cx: 0, cy: 0, cropW: 0.2, cropH: 0.2 }), {
    w: 1, h: 1, label: FREEFORM_LABEL,
  });
});

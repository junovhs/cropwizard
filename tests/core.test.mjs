import test from 'node:test';
import assert from 'node:assert/strict';

import { acceptFrame, targetKey, useWholeImage } from '../dist/src/application/framing.js';
import { expandName } from '../dist/src/export.js';
import { ratioLabel, search, wholeImageInside } from '../dist/src/search.js';
import { createAppStore } from '../dist/src/state.js';
import { makeZip } from '../dist/src/zip.js';

const adjustment = Object.freeze({ exposure: 0, contrast: 0, saturation: 0 });

function fakeItem(overrides = {}) {
  return {
    id: 'item-1',
    file: { name: 'photo.jpg' },
    image: { naturalWidth: 2400, naturalHeight: 1600 },
    name: 'photo',
    frame: { cx: 1200, cy: 800, cropW: 1600, cropH: 1600 },
    adjust: adjustment,
    approved: false,
    auto: true,
    framedFor: '1080x1080',
    ...overrides,
  };
}

test('filename expansion sanitizes output and preserves known tokens', () => {
  const name = expandName('{name}-{size}-{n}', {
    name: 'Summer / Launch',
    index: 1,
    total: 12,
    w: 1200,
    h: 630,
    ext: 'png',
    label: 'Social',
  });
  assert.equal(name, 'Summer-Launch-1200x630-02.png');
});

test('size search accepts semantic names and exact dimensions', () => {
  const semantic = search('instagram story');
  assert.ok(semantic.some((result) => result.w === 1080 && result.h === 1920));

  const exact = search('1200 x 630');
  assert.ok(exact.some((result) => result.kind === 'custom' && result.w === 1200 && result.h === 630));
  assert.equal(ratioLabel(1920, 1080), '16:9');
  assert.deepEqual(wholeImageInside({ w: 2000, h: 1000 }, { w: 800, h: 800 }), { w: 800, h: 400 });
});

test('framing commands are immutable and explicit', () => {
  const source = fakeItem();
  const accepted = acceptFrame(source);
  assert.notEqual(accepted, source);
  assert.equal(accepted.approved, true);
  assert.equal(accepted.auto, false);
  assert.equal(source.approved, false);

  const whole = useWholeImage(source, { w: 2400, h: 1600, label: 'Original' });
  assert.deepEqual(whole.frame, { cx: 1200, cy: 800, cropW: 2400, cropH: 1600 });
  assert.equal(whole.framedFor, '2400x1600');
  assert.equal(targetKey({ w: 1200, h: 630, label: 'Card' }), '1200x630');
});

test('store publishes one frozen state per atomic change', () => {
  const item = fakeItem();
  const store = createAppStore({
    target: { w: 1080, h: 1080, label: 'Square' },
    items: [item],
    activeIndex: 0,
    batch: false,
  });

  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls += 1; });
  assert.equal(calls, 1);

  store.updateItem('item-1', (current) => current);
  assert.equal(calls, 1, 'a no-op update must not publish');

  store.updateItem('item-1', (current) => ({ ...current, approved: true }));
  assert.equal(calls, 2);
  assert.equal(store.get().items[0].approved, true);
  assert.ok(Object.isFrozen(store.get()));
  assert.ok(Object.isFrozen(store.get().items[0]));
  assert.ok(Object.isFrozen(store.get().items[0].adjust));
  assert.ok(Object.isFrozen(store.get().items[0].frame));
  unsubscribe();
});

test('ZIP writer emits a valid empty-free archive envelope', async () => {
  const zip = await makeZip([
    { name: 'a.txt', blob: new Blob(['alpha'], { type: 'text/plain' }) },
    { name: 'b.txt', blob: new Blob(['beta'], { type: 'text/plain' }) },
  ]);
  const bytes = new Uint8Array(await zip.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(zip.type, 'application/zip');
});

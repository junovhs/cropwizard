// One store, one notification path. Views subscribe; nothing reaches into
// another view's DOM.

function createStore(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    // Patch is shallow-merged, so callers only name what actually changed.
    set(patch) {
      const next = typeof patch === 'function' ? patch(value) : patch;
      value = { ...value, ...next };
      for (const fn of listeners) fn(value);
      return value;
    },
    subscribe(fn) {
      listeners.add(fn);
      fn(value);
      return () => listeners.delete(fn);
    },
  };
}

// A queued image. `frame` is the user's framing decision for this item, kept in
// source-image pixel space so it survives target-size changes and re-layout.
export function createItem(file, image) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    image,
    name: file.name.replace(/\.[^.]+$/, '') || 'image',
    frame: null,     // {cx, cy, scale} — set on first activation
    approved: false,
  };
}

export const store = createStore({
  target: { w: 1080, h: 1080, label: 'Square post' },
  items: [],
  activeIndex: -1,
});

export const activeItem = (s = store.get()) => s.items[s.activeIndex] || null;

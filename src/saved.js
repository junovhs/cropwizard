// Sizes you named yourself.
//
// A saved size is only ever a name and a pair of dimensions — deliberately not
// a format, a framing or an export setting, so it stays the same kind of thing
// as a built-in preset and can be searched beside one.

const KEY = 'cropwizard.saved';

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    if (!Array.isArray(list)) return [];
    // Anything malformed is dropped rather than trusted: this list is rendered
    // and applied straight to the crop target.
    return list.filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string'
      && s.w > 0 && s.h > 0)
      .map((s) => ({ id: s.id, name: s.name, w: Math.round(s.w), h: Math.round(s.h) }));
  } catch {
    return [];
  }
}

function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); }
  catch { /* private mode: the size still applies, it just will not outlive the tab */ }
  return list;
}

export const loadSaved = read;

// Newest first — the one you just made is the one you are about to look for.
export function addSaved(name, w, h) {
  const item = {
    id: `saved-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: String(name).trim() || `${w} × ${h}`,
    w: Math.round(w),
    h: Math.round(h),
  };
  return write([item, ...read()]);
}

export function renameSaved(id, name) {
  return write(read().map((s) => (s.id === id ? { ...s, name: String(name).trim() || s.name } : s)));
}

export function removeSaved(id) {
  return write(read().filter((s) => s.id !== id));
}

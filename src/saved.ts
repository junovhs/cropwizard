// User-defined output sizes persisted in localStorage.

import type { SavedSize } from './domain/types.js';

const KEY = 'cropwizard.saved';

function isSavedSize(value: unknown): value is SavedSize {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SavedSize>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.w === 'number'
    && typeof candidate.h === 'number'
    && candidate.w > 0
    && candidate.h > 0;
}

function read(): SavedSize[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isSavedSize)
      .map((size) => ({
        id: size.id,
        name: size.name,
        w: Math.round(size.w),
        h: Math.round(size.h),
      }));
  } catch {
    return [];
  }
}

function write(list: readonly SavedSize[]): SavedSize[] {
  const copy = list.map((size) => ({ ...size }));
  try {
    localStorage.setItem(KEY, JSON.stringify(copy));
  } catch {
    // Private mode: the size remains available for this session.
  }
  return copy;
}

export const loadSaved = read;

export function addSaved(name: string, w: number, h: number): SavedSize[] {
  const list = read();
  const width = Math.round(w);
  const height = Math.round(h);
  // A size is its pixels, so saving the same pair twice is one size with two
  // names — and a list that grows every time you pin, unpin and pin again. The
  // name you just gave wins; there is only ever one row for 300 × 400.
  const already = list.find((size) => size.w === width && size.h === height);
  if (already) {
    return write(list.map((size) => (
      size.id === already.id ? { ...size, name: name.trim() || size.name } : size
    )));
  }

  const item: SavedSize = {
    id: `saved-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || `${width} × ${height}`,
    w: width,
    h: height,
  };
  return write([item, ...list]);
}

export function renameSaved(id: string, name: string): SavedSize[] {
  return write(read().map((size) => (
    size.id === id ? { ...size, name: name.trim() || size.name } : size
  )));
}

export function removeSaved(id: string): SavedSize[] {
  return write(read().filter((size) => size.id !== id));
}

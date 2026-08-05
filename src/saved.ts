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
  const item: SavedSize = {
    id: `saved-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || `${w} × ${h}`,
    w: Math.round(w),
    h: Math.round(h),
  };
  return write([item, ...read()]);
}

export function renameSaved(id: string, name: string): SavedSize[] {
  return write(read().map((size) => (
    size.id === id ? { ...size, name: name.trim() || size.name } : size
  )));
}

export function removeSaved(id: string): SavedSize[] {
  return write(read().filter((size) => size.id !== id));
}

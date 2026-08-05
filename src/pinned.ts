// Output sizes kept one click away in the top bar.
//
// Saved sizes (saved.ts) answer "what sizes exist for me?"; pins answer "which
// of them am I using today?". So a pin is not a size of its own — it is a
// reference to some pixels, identified by those pixels, and pinning the same
// rectangle twice under two names is one pin, not two.

import type { PinnedSize } from './domain/types.js';

const KEY = 'cropwizard.pinned';
const MAX_PINS = 8;

export const pinId = (w: number, h: number): string => `${Math.round(w)}x${Math.round(h)}`;

function isPinnedSize(value: unknown): value is PinnedSize {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PinnedSize>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.w === 'number'
    && typeof candidate.h === 'number'
    && candidate.w > 0
    && candidate.h > 0;
}

function read(): PinnedSize[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isPinnedSize)
      .map((pin) => ({
        id: pinId(pin.w, pin.h),
        name: pin.name,
        w: Math.round(pin.w),
        h: Math.round(pin.h),
      }))
      .slice(0, MAX_PINS);
  } catch {
    return [];
  }
}

function write(list: readonly PinnedSize[]): PinnedSize[] {
  const copy = list.slice(0, MAX_PINS).map((pin) => ({ ...pin }));
  try {
    localStorage.setItem(KEY, JSON.stringify(copy));
  } catch {
    // Private mode: the pins remain available for this session.
  }
  return copy;
}

export const loadPinned = read;

/** Whether these exact pixels are already on the top bar. */
export function isPinned(list: readonly PinnedSize[], w: number, h: number): boolean {
  const id = pinId(w, h);
  return list.some((pin) => pin.id === id);
}

/**
 * Pin these pixels, or unpin them if they are already there. One control does
 * both, because "pinned" is a state you toggle rather than two separate acts.
 * New pins go on the end, so the bar does not reshuffle under the cursor.
 */
export function togglePinned(name: string, w: number, h: number): PinnedSize[] {
  const list = read();
  const id = pinId(w, h);
  if (list.some((pin) => pin.id === id)) {
    return write(list.filter((pin) => pin.id !== id));
  }
  return write([...list, {
    id,
    name: name.trim() || `${Math.round(w)} × ${Math.round(h)}`,
    w: Math.round(w),
    h: Math.round(h),
  }]);
}

/** Drop one pin — what the chip's own ✕ does. */
export function removePinned(id: string): PinnedSize[] {
  return write(read().filter((pin) => pin.id !== id));
}

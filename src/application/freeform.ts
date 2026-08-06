// Freeform: cropping when the destination has not been decided yet.
//
// The app is output-first — you say 540 × 312 and the frame holds you to it.
// Freeform is the temporary opposite: the crop you draw *is* the output, so the
// ratio is unlocked and the target follows the rectangle instead of leading it.
// It is an override of the current preset, never a second workspace: the preset
// is kept, not cleared, and turning Freeform off puts it straight back.
//
// Everything here is a pure state-to-state move so the mode's rules can be
// tested without a canvas.

import { fitFrameToTarget, targetKey } from './framing.js';
import type { AppState, CropItem, Framing, OutputTarget } from '../domain/types.js';

export const FREEFORM_LABEL = 'Freeform crop';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** What the crop is worth on disk: its own pixels, rounded to whole ones. */
export const freeformTarget = (framing: Framing): OutputTarget => ({
  w: Math.max(1, Math.round(framing.cropW)),
  h: Math.max(1, Math.round(framing.cropH)),
  label: FREEFORM_LABEL,
});

const activeOf = (state: AppState): CropItem | null => state.items[state.activeIndex] ?? null;

// A crop drawn by hand is a decision, so it is written down as one: `auto` goes
// off and the frame is stated outright. Left on `auto`, the next size change
// would quietly re-suggest a crop over the top of the one just composed.
function keepFrame(item: CropItem, framing: Framing, target: OutputTarget): CropItem {
  return { ...item, frame: framing, auto: false, framedFor: targetKey(target) };
}

function withActiveFrame(state: AppState, framing: Framing, target: OutputTarget): readonly CropItem[] {
  const active = activeOf(state);
  if (!active) return state.items;
  return state.items.map((item) => (item.id === active.id ? keepFrame(item, framing, target) : item));
}

/**
 * Turn Freeform on. The preset is remembered rather than replaced, the visible
 * crop is preserved as-is, and the output size becomes that crop's own pixels.
 * Batch goes off with it — a shared output contract is the whole basis of a
 * batch, and Freeform is precisely the absence of one — but nothing is unloaded.
 */
export function enterFreeform(state: AppState, framing: Framing | null): AppState {
  if (state.cropMode === 'freeform') return state;
  const active = activeOf(state);
  const crop = framing ?? active?.frame ?? null;
  const target: OutputTarget = crop ? freeformTarget(crop) : { ...state.target, label: FREEFORM_LABEL };
  return {
    ...state,
    cropMode: 'freeform',
    previousTarget: state.target,
    target,
    batch: false,
    items: crop ? withActiveFrame(state, crop, target) : state.items,
  };
}

/** A finished freeform drag: the rectangle is kept, and the target follows it. */
export function commitFreeform(state: AppState, framing: Framing): AppState {
  if (state.cropMode !== 'freeform') return state;
  const target = freeformTarget(framing);
  return { ...state, target, items: withActiveFrame(state, framing, target) };
}

/**
 * Turn Freeform off. The suspended preset comes back and every crop is adapted
 * to its ratio around the centre it already had — `fitFrameToTarget` is the same
 * path any other size change takes, so nothing is reset that did not have to be.
 */
export function exitFreeform(state: AppState, fallback: OutputTarget): AppState {
  if (state.cropMode !== 'freeform') return state;
  const target = state.previousTarget ?? fallback;
  return {
    ...state,
    cropMode: 'preset',
    previousTarget: null,
    target,
    items: state.items.map((item) => fitFrameToTarget(item, target)),
  };
}

/**
 * Leave Freeform for a size the user is about to choose. The preset is not
 * restored — the picker is open and about to name one — but the mode is already
 * off, so a single click both suspends Freeform and opens the list.
 */
export function releaseFreeform(state: AppState): AppState {
  if (state.cropMode !== 'freeform') return state;
  return { ...state, cropMode: 'preset', previousTarget: null };
}

/**
 * What an export would actually write. Freeform describes one rectangle of one
 * image, so it exports the image on the stage even when a queue is still loaded
 * behind it from a batch that Freeform switched off.
 */
export function exportItems(state: AppState): readonly CropItem[] {
  if (state.cropMode !== 'freeform') return state.items;
  const active = activeOf(state);
  return active ? [active] : [];
}

const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), Math.max(low, high));

export interface FreeLimits {
  /** The source image on screen. The crop may not leave it. */
  readonly image: Rect;
  readonly minW: number;
  readonly minH: number;
}

/**
 * Resize with the ratio unlocked: every edge moves on its own and the opposite
 * one stays put. Corners move two edges, so width and height change together
 * but independently — which is the entire difference from the preset path,
 * where one number decides the other.
 */
export function resizeFree(
  start: Rect,
  handle: string,
  p: Point,
  { image, minW, minH }: FreeLimits,
): Rect {
  const imageRight = image.x + image.w;
  const imageBottom = image.y + image.h;
  let left = start.x;
  let right = start.x + start.w;
  let top = start.y;
  let bottom = start.y + start.h;

  if (handle.includes('w')) left = clamp(p.x, image.x, right - minW);
  if (handle.includes('e')) right = clamp(p.x, left + minW, imageRight);
  if (handle.includes('n')) top = clamp(p.y, image.y, bottom - minH);
  if (handle.includes('s')) bottom = clamp(p.y, top + minH, imageBottom);

  return { x: left, y: top, w: Math.max(1, right - left), h: Math.max(1, bottom - top) };
}

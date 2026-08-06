// What part of the crop frame a pointer is reaching for.
//
// The handles drawn on the frame are small because the frame is furniture, not
// a control panel. The region that counts as reaching for one is not: it is
// sized for the thing doing the reaching, which is a 1px cursor on a desktop
// and about 9mm of fingertip on a phone — landing somewhere you cannot see,
// because your finger is on top of it.

export interface Point { readonly x: number; readonly y: number; }
export interface Rect { readonly x: number; readonly y: number; readonly w: number; readonly h: number; }

export type FrameHandle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const CORNER_HIT = 18;
const EDGE_HIT = 12;
/** How much further a finger may be from a handle and still be reaching for it. */
const COARSE_HIT = 2.4;
/**
 * The middle a small frame keeps for itself. Capping each handle at half a side
 * is not enough — two halves meet exactly at the centre, and the crop becomes a
 * box you can resize from anywhere and move from nowhere.
 */
const MIN_MIDDLE = 24;

const near = (a: number, b: number, reach: number): boolean => Math.abs(a - b) <= reach;

/** As far as the pointer allows, or as far as the frame can spare. */
const reachOn = (base: number, grow: number, side: number): number =>
  Math.max(0, Math.min(base * grow, (side - MIN_MIDDLE) / 2));

/**
 * The handle under `p`, or `move` anywhere else inside the frame, or null
 * outside it entirely — which the caller reads as the picture rather than the
 * crop box.
 *
 * `coarse` should come from the pointer that is actually touching the screen
 * rather than from the device: a tablet with a stylus and a laptop with a
 * touchscreen are each, at different moments, either kind of machine.
 */
export function handleAt(p: Point, f: Rect, coarse = false): FrameHandle | null {
  const grow = coarse ? COARSE_HIT : 1;
  // On a small frame a generous reach would swallow the middle — the part that
  // moves the crop — leaving a box with edges and no inside.
  const cornerX = reachOn(CORNER_HIT, grow, f.w);
  const cornerY = reachOn(CORNER_HIT, grow, f.h);
  const edgeX = reachOn(EDGE_HIT, grow, f.w);
  const edgeY = reachOn(EDGE_HIT, grow, f.h);

  const right = f.x + f.w;
  const bottom = f.y + f.h;
  const atLeft = near(p.x, f.x, cornerX);
  const atRight = near(p.x, right, cornerX);
  const atTop = near(p.y, f.y, cornerY);
  const atBottom = near(p.y, bottom, cornerY);
  const across = p.x >= f.x - cornerX && p.x <= right + cornerX;
  const down = p.y >= f.y - cornerY && p.y <= bottom + cornerY;

  if (atLeft && atTop) return 'nw';
  if (atRight && atTop) return 'ne';
  if (atRight && atBottom) return 'se';
  if (atLeft && atBottom) return 'sw';
  if (atTop && across && near(p.y, f.y, edgeY)) return 'n';
  if (atRight && down && near(p.x, right, edgeX)) return 'e';
  if (atBottom && across && near(p.y, bottom, edgeY)) return 's';
  if (atLeft && down && near(p.x, f.x, edgeX)) return 'w';

  const inside = p.x >= f.x && p.x <= right && p.y >= f.y && p.y <= bottom;
  return inside ? 'move' : null;
}

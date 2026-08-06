// The viewfinder.
//
// The frame is the direct manipulation surface. While you work, it can be moved
// and resized over the image like a conventional crop box. On release, the crop
// itself is kept exactly as chosen, then the frame glides back to the canonical
// centred output rectangle while the image is re-scaled and translated beneath
// it. The result is the familiar "draw the crop" gesture without leaving the
// workspace with a tiny, off-centre frame.
//
// The image outside the frame remains visible as a ghost, so moving or enlarging
// the crop always has spatial context. Wheel, pinch and the zoom control remain
// available as alternate ways to change the same persisted source rectangle.

import { Spring, Pulse, createLoop, clamp } from './juice.js';
import { filterFor } from './adjust.js';
import { resizeFree } from './application/freeform.js';
import { frameFit, type FrameView } from './application/frame-view.js';
import { handleAt, type FrameHandle } from './application/handles.js';
import { canvasContext } from './infrastructure/dom.js';
import type { Adjustment, Framing } from './domain/types.js';

const GHOST_IDLE = 0.12;      // what you keep seeing of the discarded image
const GHOST_ACTIVE = 0.34;    // ...and how much it lifts while you work
const FRAME_PAD = 76;         // most breathing room between frame and stage edge
const FRAME_PAD_MIN = 22;     // ...and the least, once the stage is a phone
const FRAME_PAD_SHARE = 0.085; // in between, a share of the smaller dimension
// Extra room top and bottom on a narrow stage, where the tools and the readouts
// sit right on the picture and a frame paying no attention to them ends up
// underneath them.
const CHROME_PAD = 34;
const NARROW_STAGE = 620;
const MAX_ZOOM = 8;           // relative to the minimum covering scale
// The floor is exactly "the picture covers the frame". Going below it was tried
// and taken back out: it made the frame bigger than the picture, which is a
// crop box that no longer describes a crop, and it quietly turned the export
// into a matte nobody asked for. Wanting a smaller *view* is a real wish, but
// it is a question about the frame's size on screen — which is what `frameView`
// answers — not about how much picture is behind it.
const MIN_ZOOM = 1;
const SNAP_PX = 7;            // magnetic pull toward a centred framing
const MIN_FRAME_PX = 44;       // smallest useful crop box on screen

export type { FrameView };

interface Point { readonly x: number; readonly y: number; }
interface FrameRect { readonly x: number; readonly y: number; readonly w: number; readonly h: number; }
/** `pan` is the one gesture that moves the picture rather than the crop box. */
type DragKind = FrameHandle | 'pan';
interface DragState {
  readonly pointerId: number;
  readonly handle: DragKind;
  readonly from: Point;
  readonly frame: FrameRect;
}
interface PinchState { readonly dist: number; readonly mid: Point; }

export interface ViewfinderOptions {
  readonly canvas: HTMLCanvasElement;
  readonly stage: HTMLElement;
  readonly onFrameChange?: (framing: Framing) => void;
  /**
   * A freeform edit has been released. The crop is final; the caller decides
   * what output size it now stands for and sets it, which is what sends the
   * frame home through the ordinary recentre.
   */
  readonly onFreeformCommit?: (framing: Framing) => void;
}

export interface ViewfinderController {
  setImage(image: HTMLImageElement | null, framing?: Framing | null): void;
  setAdjust(adjustment: Adjustment): void;
  setTarget(w: number, h: number): void;
  /** Unlock the frame's aspect. Everything else about the gesture is unchanged. */
  setFreeform(on: boolean): void;
  setFrameView(view: FrameView): void;
  getFrameView(): FrameView;
  getFrameScale(): number;
  canEnlarge(): boolean;
  /** Whether standing back would actually show you anything different. */
  canShrink(): boolean;
  getZoom(): number;
  getMaxZoom(): number;
  getMinZoom(): number;
  setZoom(zoom: number): void;
  nudge(dx: number, dy: number): void;
  zoomBy(factor: number): void;
  fill(): void;
  resize(): void;
  getFraming(): Framing;
  hasImage(): boolean;
}

export function createViewfinder(
  { canvas, stage, onFrameChange, onFreeformCommit }: ViewfinderOptions,
): ViewfinderController {
  const ctx = canvasContext(canvas);

  let image: HTMLImageElement | null = null;
  let filter = 'none';
  let aspect = 1;
  // Freeform only changes what a resize is allowed to do. The frame is still
  // the thing being manipulated, and release still recentres.
  let freeform = false;
  let targetW = 1, targetH = 1;
  // DEC-03: the frame is the output at its real size on screen. `frameView` is
  // the explicit opt-out — closer for detail, further back for composition;
  // `frameScale` is how much of true size the frame is actually showing (below 1
  // means the stage forced a cap, or you asked to stand back).
  let frameView: FrameView = 'true';
  let frameScale = 1;
  // Whether either opt-out has anywhere to go. Once the stage is the limit,
  // enlarging offers nothing; once the frame is already small, so does shrinking.
  let enlargeable = false;
  let shrinkable = false;
  // The framing to hold on to while the frame itself is changing shape or size.
  let morph: Framing | null = null;
  let vw = 1, vh = 1, dpr = 1;
  let dragging: DragState | null = null;
  let hoverHandle: FrameHandle | null = null;
  const pointers = new Map<number, Point>();
  let snapped = { x: false, y: false };

  const frameX = new Spring(0, { stiffness: 210, damping: 24 });
  const frameY = new Spring(0, { stiffness: 210, damping: 24 });
  const frameW = new Spring(0, { stiffness: 210, damping: 24 });
  const frameH = new Spring(0, { stiffness: 210, damping: 24 });
  const scale = new Spring(1, { stiffness: 240, damping: 30 });
  const tx = new Spring(0, { stiffness: 240, damping: 30 });
  const ty = new Spring(0, { stiffness: 240, damping: 30 });
  const ghost = new Spring(GHOST_IDLE, { stiffness: 150, damping: 22, precision: 0.001 });
  const guides = new Spring(0, { stiffness: 180, damping: 24, precision: 0.001 });
  const snapPulse = new Pulse(0.5);
  const springs = [frameX, frameY, frameW, frameH, scale, tx, ty, ghost, guides];

  const loop = createLoop((dt) => {
    let moving = false;
    for (const s of springs) moving = s.step(dt) || moving;
    moving = snapPulse.step(dt) || moving;
    // The frame's morph changes both what counts as legal and what the same
    // crop maps to on screen. Re-deriving the transform from the crop we started
    // with keeps the cut itself untouched while the frame grows or shrinks —
    // which is what makes switching between true size and fit a pure change of
    // magnification rather than a change of framing.
    const morphing = !frameX.settled || !frameY.settled || !frameW.settled || !frameH.settled;
    if (!dragging) {
      if (morph) {
        applyFraming(morph);
        if (!morphing) { morph = null; settle(); }
      } else if (morphing) settle();
    }
    draw();
    // Publish every frame, not just on release: the spring is what decides the
    // final crop, so anything that reads the framing must see where it landed.
    publish();
    return moving;
  });

  // ---- geometry ------------------------------------------------------------

  const frameRect = (): FrameRect => ({
    x: frameX.v,
    y: frameY.v,
    w: frameW.v,
    h: frameH.v,
  });

  function imageRect(): FrameRect {
    if (!image) return { x: 0, y: 0, w: 0, h: 0 };
    return {
      x: tx.v,
      y: ty.v,
      w: image.naturalWidth * scale.v,
      h: image.naturalHeight * scale.v,
    };
  }

  // Air around the frame, as a share of the stage rather than a fixed number:
  // 76px is right beside a desktop stage and most of a phone.
  function framePad(): Point {
    const base = Math.min(FRAME_PAD, Math.max(FRAME_PAD_MIN, Math.min(vw, vh) * FRAME_PAD_SHARE));
    return { x: base, y: base + (vw < NARROW_STAGE ? CHROME_PAD : 0) };
  }

  function canonicalFrame(): FrameRect {
    const pad = framePad();
    const roomW = Math.max(40, vw - pad.x * 2);
    const roomH = Math.max(40, vh - pad.y * 2);
    const fit = frameFit(frameView, Math.min(roomW / targetW, roomH / targetH), Math.max(targetW, targetH));
    frameScale = fit.scale;
    enlargeable = fit.enlargeable;
    shrinkable = fit.shrinkable;
    const w = Math.max(8, targetW * frameScale);
    const h = Math.max(8, targetH * frameScale);
    return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
  }

  // Smallest scale at which the image still covers the frame. This is the floor
  // for every zoom: the frame is never allowed to contain empty space.
  function minScale(): number {
    if (!image) return 1;
    return Math.max(frameW.v / image.naturalWidth, frameH.v / image.naturalHeight);
  }

  function bounds(): { readonly x: readonly [number, number]; readonly y: readonly [number, number] } {
    const current = image;
    if (!current) return { x: [0, 0], y: [0, 0] };
    const f = frameRect();
    const s = scale.v;
    return {
      x: [f.x + f.w - current.naturalWidth * s, f.x],
      y: [f.y + f.h - current.naturalHeight * s, f.y],
    };
  }

  function centred(): Point {
    const current = image;
    if (!current) return { x: vw / 2, y: vh / 2 };
    const f = frameRect();
    return {
      x: f.x + f.w / 2 - (current.naturalWidth * scale.v) / 2,
      y: f.y + f.h / 2 - (current.naturalHeight * scale.v) / 2,
    };
  }

  // True size by default: a 32x64 target is a 32x64 rectangle on screen, so the
  // smallness of a small crop is a fact you can see rather than a number you
  // have to imagine. Anything larger than the stage is capped down to fit, and
  // `frameScale` records by how much so the UI can say so.
  function layoutFrame(immediate = false): void {
    const next = canonicalFrame();
    if (immediate) {
      frameX.jump(next.x);
      frameY.jump(next.y);
      frameW.jump(next.w);
      frameH.jump(next.h);
    } else {
      frameX.set(next.x);
      frameY.set(next.y);
      frameW.set(next.w);
      frameH.set(next.h);
    }
  }

  // Nearest legal framing, with a magnet at dead centre on each axis
  // independently — so you can be centred horizontally and free vertically.
  function legal(x: number, y: number): Point {
    const b = bounds();
    const c = centred();
    let lx = clamp(x, b.x[0], b.x[1]);
    let ly = clamp(y, b.y[0], b.y[1]);
    const hitX = Math.abs(lx - c.x) < SNAP_PX && c.x >= b.x[0] && c.x <= b.x[1];
    const hitY = Math.abs(ly - c.y) < SNAP_PX && c.y >= b.y[0] && c.y <= b.y[1];
    if (hitX) lx = c.x;
    if (hitY) ly = c.y;
    if ((hitX && !snapped.x) || (hitY && !snapped.y)) snapPulse.fire();
    snapped = { x: hitX, y: hitY };
    return { x: lx, y: ly };
  }

  // Send the transform to its resting place. Called on pointer release, after a
  // zoom, and every frame the frame itself is still morphing.
  function settle(): void {
    if (!image) return;
    const min = minScale();
    if (scale.v < min * MIN_ZOOM) scale.set(min * MIN_ZOOM);
    // A magnet on exact fit, kept narrow: the zoom is a number you can set to
    // 101% on purpose now, and a wide magnet would quietly overrule you.
    else if (Math.abs(scale.v - min) / min < 0.004) scale.set(min);
    const l = legal(tx.v, ty.v);
    tx.set(l.x);
    ty.set(l.y);
    publish();
  }

  // A frame edit is committed by preserving the source rectangle currently
  // under it, then sending the frame back to the standard centred output size.
  // applyFraming() runs throughout that travel, so the crop is visually stable
  // while the image supplies the compensating zoom and translation.
  function normalizeFrame(): void {
    if (!image) return;
    morph = readFraming();
    layoutFrame(false);
    loop.kick();
  }

  // A new pointer can interrupt the return animation. Freeze the frame where it
  // is and keep the exact crop represented at that instant; otherwise a quick
  // second drag would fight springs that are still heading for the centre.
  function interruptMorph(): void {
    if (!morph && frameX.settled && frameY.settled && frameW.settled && frameH.settled) return;
    const framing = image ? readFraming() : null;
    frameX.jump(frameX.v);
    frameY.jump(frameY.v);
    frameW.jump(frameW.v);
    frameH.jump(frameH.v);
    morph = null;
    if (framing) applyFraming(framing);
  }

  // Wheel, pinch, keyboard and slider gestures operate on the image rather
  // than the crop box. If one begins while the frame is still returning home,
  // finish that return immediately while preserving the crop, then apply the
  // image gesture against the stable canonical frame.
  function normalizeFrameImmediately(): void {
    if (!image) return;
    const home = canonicalFrame();
    const alreadyHome = !morph
      && Math.abs(frameX.v - home.x) < 0.01
      && Math.abs(frameY.v - home.y) < 0.01
      && Math.abs(frameW.v - home.w) < 0.01
      && Math.abs(frameH.v - home.h) < 0.01;
    if (alreadyHome) return;
    const framing = readFraming();
    morph = null;
    frameX.jump(home.x);
    frameY.jump(home.y);
    frameW.jump(home.w);
    frameH.jump(home.h);
    applyFraming(framing);
  }

  function publish(): void {
    if (!image || !onFrameChange) return;
    onFrameChange(readFraming());
  }

  // ---- framing, in source-image pixels -------------------------------------
  // Persisted per item so it survives resize, target changes and re-activation.

  function readFraming(): Framing {
    const f = frameRect();
    const s = scale.v;
    const cropW = f.w / s;
    const cropH = f.h / s;
    return {
      cx: (f.x - tx.v) / s + cropW / 2,
      cy: (f.y - ty.v) / s + cropH / 2,
      cropW,
      cropH,
    };
  }

  function applyFraming(framing?: Framing | null): void {
    if (!image) return;
    const f = frameRect();
    const iw = image.naturalWidth, ih = image.naturalHeight;
    // Re-fit the stored crop to the current aspect, keeping its centre. The crop
    // is never allowed out of the picture: a rectangle that reaches past the
    // edge is not a crop of anything.
    let cropW = framing ? framing.cropW : Math.min(iw, ih * aspect);
    let cropH = cropW / aspect;
    const fitting = Math.min(1, iw / cropW, ih / cropH);
    cropW *= fitting;
    cropH *= fitting;
    const cx = clamp(framing ? framing.cx : iw / 2, cropW / 2, iw - cropW / 2);
    const cy = clamp(framing ? framing.cy : ih / 2, cropH / 2, ih - cropH / 2);
    const s = f.w / cropW;
    scale.jump(s);
    tx.jump(f.x - (cx - cropW / 2) * s);
    ty.jump(f.y - (cy - cropH / 2) * s);
    publish();
  }

  // ---- painting ------------------------------------------------------------

  function draw(): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Cleared rather than filled: the surround is the workspace's own paper,
    // showing through from the stage's CSS background. Painting a colour here
    // meant the canvas carried a second palette that had to be remembered
    // separately every time the theme moved — and didn't get remembered.
    ctx.clearRect(0, 0, vw, vh);
    if (!image) return;

    const w = image.naturalWidth * scale.v;
    const h = image.naturalHeight * scale.v;
    const f = frameRect();

    // The adjustment rides on both passes, so the ghost you are cutting away is
    // the same picture as the one you are keeping. The chrome below is drawn
    // unfiltered — the frame is furniture, not part of the photograph.
    ctx.filter = filter;

    // 1. the whole image, faint — this is the part you are cutting away.
    ctx.globalAlpha = ghost.v;
    ctx.drawImage(image, tx.v, ty.v, w, h);
    ctx.globalAlpha = 1;

    // 2. the same image again at full strength, clipped to the frame.
    ctx.save();
    ctx.beginPath();
    ctx.rect(f.x, f.y, f.w, f.h);
    ctx.clip();
    ctx.drawImage(image, tx.v, ty.v, w, h);
    ctx.restore();

    ctx.filter = 'none';
    drawChrome(f);
  }

  function drawChrome(f: FrameRect): void {
    // Thirds guides, present only while you are actually framing.
    if (guides.v > 0.01) {
      ctx.strokeStyle = `rgba(255,255,255,${0.28 * guides.v})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < 3; i++) {
        ctx.moveTo(Math.round(f.x + (f.w * i) / 3) + 0.5, f.y);
        ctx.lineTo(Math.round(f.x + (f.w * i) / 3) + 0.5, f.y + f.h);
        ctx.moveTo(f.x, Math.round(f.y + (f.h * i) / 3) + 0.5);
        ctx.lineTo(f.x + f.w, Math.round(f.y + (f.h * i) / 3) + 0.5);
      }
      ctx.stroke();
    }

    // The frame edge itself: hairline, corner brackets, and short midpoint
    // grips. They are real controls now, so the same crop language that invites
    // the gesture is also the thing the pointer can actually move.
    const arm = Math.min(26, f.w / 5, f.h / 5);
    const corners = () => {
      ctx.beginPath();
      const cornerSpecs: readonly (readonly [number, number, number, number])[] = [
        [f.x, f.y, 1, 1], [f.x + f.w, f.y, -1, 1],
        [f.x, f.y + f.h, 1, -1], [f.x + f.w, f.y + f.h, -1, -1],
      ];
      for (const [cx, cy, sx, sy] of cornerSpecs) {
        ctx.moveTo(cx + sx * arm, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + sy * arm);
      }
      ctx.stroke();
    };

    ctx.lineCap = 'square';
    ctx.strokeStyle = 'rgba(0,0,0,.4)';
    ctx.lineWidth = 3.5;
    ctx.strokeRect(f.x, f.y, f.w, f.h);
    ctx.lineWidth = 5;
    corners();

    ctx.strokeStyle = 'rgba(255,255,255,.92)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(f.x, f.y, f.w, f.h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    corners();

    const mx = f.x + f.w / 2;
    const my = f.y + f.h / 2;
    const edgeArm = Math.min(24, Math.max(12, Math.min(f.w, f.h) / 5));
    const edgeBars = () => {
      ctx.beginPath();
      ctx.moveTo(mx - edgeArm / 2, f.y); ctx.lineTo(mx + edgeArm / 2, f.y);
      ctx.moveTo(mx - edgeArm / 2, f.y + f.h); ctx.lineTo(mx + edgeArm / 2, f.y + f.h);
      ctx.moveTo(f.x, my - edgeArm / 2); ctx.lineTo(f.x, my + edgeArm / 2);
      ctx.moveTo(f.x + f.w, my - edgeArm / 2); ctx.lineTo(f.x + f.w, my + edgeArm / 2);
      ctx.stroke();
    };

    ctx.strokeStyle = 'rgba(0,0,0,.45)';
    ctx.lineWidth = 5;
    edgeBars();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    edgeBars();

    // A tiny accent lift confirms which part of the frame is live without
    // turning the crop into a selection marquee.
    // 'pan' is excluded by name, not by luck: it contains an "n" and would
    // otherwise light the north edge every time you dragged the picture.
    const active = dragging?.handle ?? hoverHandle;
    if (active && active !== 'move' && active !== 'pan') {
      ctx.strokeStyle = 'rgba(186, 88, 44, .95)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (active.includes('n')) { ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + f.w, f.y); }
      if (active.includes('s')) { ctx.moveTo(f.x, f.y + f.h); ctx.lineTo(f.x + f.w, f.y + f.h); }
      if (active.includes('w')) { ctx.moveTo(f.x, f.y); ctx.lineTo(f.x, f.y + f.h); }
      if (active.includes('e')) { ctx.moveTo(f.x + f.w, f.y); ctx.lineTo(f.x + f.w, f.y + f.h); }
      ctx.stroke();
    }

    // Snap acknowledgement: a crosshair that blooms and dies.
    const p = snapPulse.value;
    if (p > 0.01) {
      // The product accent, so a snap is acknowledged in the same colour every
      // other selection in the app uses.
      ctx.strokeStyle = `rgba(186, 88, 44, ${0.9 * p})`;
      ctx.lineWidth = 1;
      const r = 14 + 22 * (1 - p);
      ctx.beginPath();
      if (snapped.x) { ctx.moveTo(mx, my - r); ctx.lineTo(mx, my + r); }
      if (snapped.y) { ctx.moveTo(mx - r, my); ctx.lineTo(mx + r, my); }
      ctx.stroke();
    }
  }

  // ---- interaction ---------------------------------------------------------

  const localPoint = (event: PointerEvent | WheelEvent): Point => {
    const r = canvas.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  };

  function beginInteraction(): void {
    ghost.set(GHOST_ACTIVE);
    guides.set(1);
    loop.kick();
  }

  function endInteraction(): void {
    ghost.set(GHOST_IDLE);
    guides.set(0);
    snapped = { x: false, y: false };
    loop.kick();
  }

  const hitTest = (p: Point, coarse = false): FrameHandle | null =>
    handleAt(p, frameRect(), coarse);

  function cursorFor(handle: FrameHandle | null): string {
    // Outside the frame is the picture, and the picture can be dragged.
    if (!handle) return 'grab';
    if (handle === 'move') return 'move';
    if (handle === 'n' || handle === 's') return 'ns-resize';
    if (handle === 'e' || handle === 'w') return 'ew-resize';
    if (handle === 'nw' || handle === 'se') return 'nwse-resize';
    return 'nesw-resize';
  }

  function setFrame(next: FrameRect): void {
    frameX.jump(next.x);
    frameY.jump(next.y);
    frameW.jump(next.w);
    frameH.jump(next.h);
    publish();
    loop.kick();
  }

  function legalFramePosition(x: number, y: number, w: number, h: number): Point {
    const im = imageRect();
    const maxX = im.x + im.w - w;
    const maxY = im.y + im.h - h;
    let nextX = clamp(x, im.x, Math.max(im.x, maxX));
    let nextY = clamp(y, im.y, Math.max(im.y, maxY));
    const centreX = im.x + (im.w - w) / 2;
    const centreY = im.y + (im.h - h) / 2;
    const hitX = Math.abs(nextX - centreX) < SNAP_PX;
    const hitY = Math.abs(nextY - centreY) < SNAP_PX;
    if (hitX) nextX = centreX;
    if (hitY) nextY = centreY;
    if ((hitX && !snapped.x) || (hitY && !snapped.y)) snapPulse.fire();
    snapped = { x: hitX, y: hitY };
    return { x: nextX, y: nextY };
  }

  function resizeFrame(start: FrameRect, handle: Exclude<FrameHandle, 'move'>, p: Point): FrameRect {
    const im = imageRect();
    const right = im.x + im.w;
    const bottom = im.y + im.h;
    const ratio = start.w / start.h || aspect;
    const minShort = Math.max(8, Math.min(MIN_FRAME_PX, Math.min(start.w, start.h) * 0.6));
    const visualMinW = Math.max(minShort, minShort * ratio);
    // Handle-resizing is another zoom route, so it honours the same ceiling as
    // wheel/pinch/slider zoom. At 400%, for example, the box may shrink by only
    // another half before it reaches the shared 800% maximum.
    const currentMinScale = image
      ? Math.max(start.w / image.naturalWidth, start.h / image.naturalHeight)
      : 1;
    const currentZoom = currentMinScale > 0 ? scale.v / currentMinScale : 1;
    const zoomMinW = start.w * currentZoom / MAX_ZOOM;
    const minW = Math.max(visualMinW, zoomMinW);

    // With no ratio to honour, every edge is its own answer. The floors are the
    // same two the preset path enforces — a box you can still grab, and the
    // shared zoom ceiling — applied to each axis rather than to the pair.
    if (freeform) {
      return resizeFree(start, handle, p, {
        image: im,
        minW: Math.max(minShort, zoomMinW),
        minH: Math.max(minShort, start.h * currentZoom / MAX_ZOOM),
      });
    }

    if (handle.length === 2) {
      const west = handle.includes('w');
      const north = handle.includes('n');
      const ax = west ? start.x + start.w : start.x;
      const ay = north ? start.y + start.h : start.y;
      const fromX = Math.max(0, west ? ax - p.x : p.x - ax);
      const fromY = Math.max(0, north ? ay - p.y : p.y - ay) * ratio;
      const width = Math.abs(fromX - start.w) >= Math.abs(fromY - start.w) ? fromX : fromY;
      const maxHorizontal = west ? ax - im.x : right - ax;
      const maxVertical = north ? ay - im.y : bottom - ay;
      const maxW = Math.max(8, Math.min(maxHorizontal, maxVertical * ratio));
      const w = clamp(width, Math.min(minW, maxW), maxW);
      const h = w / ratio;
      return {
        x: west ? ax - w : ax,
        y: north ? ay - h : ay,
        w,
        h,
      };
    }

    if (handle === 'e' || handle === 'w') {
      const west = handle === 'w';
      const ax = west ? start.x + start.w : start.x;
      const cy = start.y + start.h / 2;
      const desired = Math.max(0, west ? ax - p.x : p.x - ax);
      const maxHorizontal = west ? ax - im.x : right - ax;
      const maxVertical = 2 * Math.min(cy - im.y, bottom - cy);
      const maxW = Math.max(8, Math.min(maxHorizontal, maxVertical * ratio));
      const w = clamp(desired, Math.min(minW, maxW), maxW);
      const h = w / ratio;
      return { x: west ? ax - w : ax, y: cy - h / 2, w, h };
    }

    const north = handle === 'n';
    const ay = north ? start.y + start.h : start.y;
    const cx = start.x + start.w / 2;
    const desiredH = Math.max(0, north ? ay - p.y : p.y - ay);
    const maxVertical = north ? ay - im.y : bottom - ay;
    const maxHorizontal = 2 * Math.min(cx - im.x, right - cx);
    const maxH = Math.max(8, Math.min(maxVertical, maxHorizontal / ratio));
    const minH = minW / ratio;
    const h = clamp(desiredH, Math.min(minH, maxH), maxH);
    const w = h * ratio;
    return { x: cx - w / 2, y: north ? ay - h : ay, w, h };
  }

  function onPointerDown(e: PointerEvent): void {
    if (!image) return;
    const p = localPoint(e);

    // The second finger may land outside the frame; once a gesture is already
    // under way it still belongs to that gesture.
    if (pointers.size === 0) {
      // Outside the frame is not "nothing to do": it is the part of the picture
      // you are about to bring in, so the drag pans the image beneath the crop.
      // Returning early here also lost the pointer itself — it was never
      // registered, so a second finger read as a first one and a pinch that
      // began anywhere but inside the crop box could not start at all.
      const handle = hitTest(p, e.pointerType !== 'mouse');
      // A gesture on the frame takes over the return animation where it stands.
      // A gesture on the picture is an image gesture like the wheel or a pinch,
      // so it lets the frame finish going home first — otherwise a stray tap on
      // the ghost would leave the frame stranded halfway back.
      if (handle) interruptMorph();
      else normalizeFrameImmediately();
      dragging = { pointerId: e.pointerId, handle: handle ?? 'pan', from: p, frame: frameRect() };
      hoverHandle = handle;
      canvas.style.cursor = handle === null ? 'grabbing'
        : handle === 'move' ? 'grabbing' : cursorFor(handle);
      beginInteraction();
    }

    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      // Pinch remains a direct image gesture. Preserve any crop movement the
      // first finger made, normalize it instantly, then hand off to zoom/pan.
      normalizeFrameImmediately();
      dragging = null;
      startPinch();
    }
  }

  let pinch: PinchState | null = null;
  function startPinch(): void {
    const [a, b] = [...pointers.values()];
    pinch = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
    beginInteraction();
  }

  function onPointerMove(e: PointerEvent): void {
    if (!image) return;
    const point = localPoint(e);
    // Where this pointer was a moment ago, read before it is overwritten: a pan
    // is the step it just took, not the distance from where it started.
    const previous = pointers.get(e.pointerId) ?? point;
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, point);

    if (pointers.size === 0) {
      const next = hitTest(point, e.pointerType !== 'mouse');
      if (next !== hoverHandle) {
        hoverHandle = next;
        canvas.style.cursor = cursorFor(next);
        loop.kick();
      }
      return;
    }

    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinch.dist > 0) zoomAt(dist / pinch.dist, mid.x, mid.y, true);
      // Two-finger drag pans as well as zooms.
      panBy(mid.x - pinch.mid.x, mid.y - pinch.mid.y);
      pinch = { dist, mid };
      loop.kick();
      return;
    }

    if (!dragging || dragging.pointerId !== e.pointerId) return;
    const dx = point.x - dragging.from.x;
    const dy = point.y - dragging.from.y;
    if (dragging.handle === 'pan') {
      // Outside the frame the picture moves, not the box. By the step just
      // taken rather than the distance from where the finger went down: the
      // image is clamped as it goes, and an absolute offset would keep piling
      // up against a wall it has already reached.
      panBy(point.x - previous.x, point.y - previous.y);
      loop.kick();
    } else if (dragging.handle === 'move') {
      const l = legalFramePosition(
        dragging.frame.x + dx,
        dragging.frame.y + dy,
        dragging.frame.w,
        dragging.frame.h,
      );
      setFrame({ ...dragging.frame, x: l.x, y: l.y });
    } else {
      snapped = { x: false, y: false };
      setFrame(resizeFrame(dragging.frame, dragging.handle, point));
    }
  }

  function panBy(dx: number, dy: number): void {
    const l = legal(tx.v + dx, ty.v + dy);
    tx.jump(l.x);
    ty.jump(l.y);
  }

  function onPointerUp(e: PointerEvent): void {
    // A pan moved the picture under a frame that never left home, so there is
    // nothing to recentre — only the transform to let settle.
    const frameEdited = !!dragging && dragging.handle !== 'pan';
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      dragging = null;
      hoverHandle = null;
      canvas.style.cursor = 'default';
      if (frameEdited) {
        // The crop is settled the instant the pointer lifts. In freeform the
        // caller turns it into the new output size first, so the frame's way
        // home is already the right shape; the recentre itself is the same one
        // every other commit takes, and the source crop is untouched by it.
        if (freeform && image) onFreeformCommit?.(readFraming());
        normalizeFrame();
      } else settle();
      endInteraction();
    }
  }

  // `immediate` skips the settle, because a pinch settles on release instead.
  function zoomAt(factor: number, ax: number, ay: number, immediate = false): void {
    if (!image) return;
    const min = minScale();
    const from = scale.v;
    const to = clamp(from * factor, min * MIN_ZOOM, min * MAX_ZOOM);
    if (Math.abs(to - from) < 1e-6) return;
    // Keep the point under the cursor pinned to the cursor.
    scale.jump(to);
    tx.jump(ax - (ax - tx.v) * (to / from));
    ty.jump(ay - (ay - ty.v) * (to / from));
    // Zooming out can uncover an edge; clamp hard rather than let background
    // flash through the frame for a frame or two.
    const l = legal(tx.v, ty.v);
    tx.jump(l.x);
    ty.jump(l.y);
    if (!immediate) settle();
  }

  let wheelIdle: ReturnType<typeof setTimeout> | null = null;
  function onWheel(e: WheelEvent): void {
    if (!image) return;
    e.preventDefault();
    normalizeFrameImmediately();
    const p = localPoint(e);
    // A wheel reports in lines or pages as readily as in pixels, and a notch
    // that means 3 lines on one machine and 100px on another is why zoom used to
    // land somewhere different on every mouse.
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh : 1);
    // Trackpad pinch arrives as ctrl+wheel; plain wheel zooms too, since there
    // is nothing else on this canvas to scroll. The plain wheel is deliberately
    // gentle — a notch is a few percent, not a fifth of the picture — because
    // the size of the step is the whole complaint about wheel zoom. Anything
    // exact is done on the slider or typed into the field.
    const factor = Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0006));
    beginInteraction();
    zoomAt(factor, p.x, p.y, true);
    if (wheelIdle !== null) clearTimeout(wheelIdle);
    wheelIdle = setTimeout(() => { settle(); endInteraction(); }, 140);
    loop.kick();
  }

  // ---- public surface ------------------------------------------------------

  function resize(): void {
    // Read the framing against the *old* stage before anything moves — it is
    // measured relative to the frame rect, which depends on vw/vh.
    const framing = image ? readFraming() : null;
    const r = stage.getBoundingClientRect();
    dpr = Math.max(1, devicePixelRatio || 1);
    vw = Math.max(1, Math.round(r.width));
    vh = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    layoutFrame(true);
    if (image) applyFraming(framing);
    loop.kick();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', () => { fill(); });

  function fill(): void {
    if (!image) return;
    normalizeFrameImmediately();
    applyFraming(null);
    snapPulse.fire();
    loop.kick();
  }

  return {
    setImage(next: HTMLImageElement | null, framing?: Framing | null): void {
      image = next;
      hoverHandle = null;
      canvas.style.cursor = 'default';
      if (next) {
        applyFraming(framing);
        // An image can arrive while the frame is still travelling toward a new
        // target — dropping a photo now sets the size from the photo, so this is
        // the ordinary case, not a corner. Framing against a rectangle that is
        // on its way somewhere else bakes in the magnification it happened to
        // have at that instant, and the picture lands cropped. Hand the crop to
        // the morph so it is re-derived until the frame actually arrives.
        if (!frameX.settled || !frameY.settled || !frameW.settled || !frameH.settled) {
          morph = readFraming();
        }
      }
      loop.kick();
    },
    // The live adjustment for whatever is on the stage. Only the pixels change:
    // the framing, the springs and the frame itself never hear about it.
    setAdjust(adjust: Adjustment): void {
      const next = filterFor(adjust);
      if (next === filter) return;
      filter = next;
      loop.kick();
    },
    setTarget(w: number, h: number): void {
      targetW = w;
      targetH = h;
      aspect = w / h;
      morph = image ? readFraming() : null;
      layoutFrame(false);
      loop.kick();
    },
    // The ratio lock, and nothing else. The frame stays where it is: whatever
    // is on screen when the mode changes is a crop the user is looking at, and
    // moving it under them would be the app taking the composition back.
    setFreeform(on: boolean): void {
      freeform = on;
    },
    // How large to draw the frame. Only the magnification changes: the crop is
    // carried across the morph untouched, so standing back and leaning in are
    // statements about the view and never about the file.
    setFrameView(next: FrameView): void {
      if (frameView === next) return;
      frameView = next;
      morph = image ? readFraming() : null;
      layoutFrame(false);
      loop.kick();
    },
    getFrameView: () => frameView,
    // 1 while the frame is at true size; below 1 once the stage has capped it
    // — or once you have asked to stand back from it.
    getFrameScale: () => frameScale,
    canEnlarge: () => enlargeable,
    canShrink: () => shrinkable,
    // Zoom is stated against the smallest scale that still fills the frame, so
    // 100% is "the whole picture, nothing wasted" and every larger number is how
    // far in you have gone. That is the only reading the frame can support: the
    // floor moves with the frame's shape, and a percentage of the source pixels
    // would change under you every time the target did.
    getZoom(): number {
      if (!image) return 1;
      const min = minScale();
      return min > 0 ? scale.v / min : 1;
    },
    getMaxZoom: () => MAX_ZOOM,
    getMinZoom: () => MIN_ZOOM,
    // Set from a control rather than a gesture: there is no cursor to keep a
    // point under, so the frame's own centre holds still.
    setZoom(zoom: number): void {
      if (!image) return;
      normalizeFrameImmediately();
      const min = minScale();
      const from = scale.v;
      const to = clamp(zoom, MIN_ZOOM, MAX_ZOOM) * min;
      if (from <= 0 || Math.abs(to - from) / from < 1e-6) return;
      beginInteraction();
      // Immediate: a slider is already a continuous gesture, and springing to
      // each value you drag through turns it into a lag.
      zoomAt(to / from, vw / 2, vh / 2, true);
      if (wheelIdle !== null) clearTimeout(wheelIdle);
      wheelIdle = setTimeout(() => { settle(); endInteraction(); }, 400);
      loop.kick();
    },
    nudge(dx: number, dy: number): void {
      if (!image) return;
      normalizeFrameImmediately();
      beginInteraction();
      panBy(dx, dy);
      settle();
      if (wheelIdle !== null) clearTimeout(wheelIdle);
      wheelIdle = setTimeout(endInteraction, 400);
      loop.kick();
    },
    zoomBy(factor: number): void {
      if (!image) return;
      normalizeFrameImmediately();
      beginInteraction();
      zoomAt(factor, vw / 2, vh / 2);
      if (wheelIdle !== null) clearTimeout(wheelIdle);
      wheelIdle = setTimeout(endInteraction, 400);
      loop.kick();
    },
    fill,
    resize,
    getFraming: readFraming,
    hasImage: () => !!image,
  };
}

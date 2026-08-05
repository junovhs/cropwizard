// The viewfinder.
//
// The crop frame is a fixed rectangle, locked to the centre of the stage at the
// target's aspect ratio. It never moves. The image moves underneath it, and the
// part of the image outside the frame stays on screen as a ghost so you always
// see what you are cutting away.
//
// Everything the pointer touches is expressed as three springs (scale, tx, ty).
// While a pointer is down they are jumped so dragging is exactly 1:1; on
// release their targets are set to the nearest legal framing and they ease home.

import { Spring, Pulse, createLoop, clamp, rubber } from './juice.js';
import { filterFor } from './adjust.js';

const GHOST_IDLE = 0.12;      // what you keep seeing of the discarded image
const GHOST_ACTIVE = 0.34;    // ...and how much it lifts while you work
const FRAME_PAD = 56;         // breathing room between frame and stage edge
const MAX_ZOOM = 8;           // relative to the minimum covering scale
const SNAP_PX = 7;            // magnetic pull toward a centred framing
const OVERSHOOT = 140;        // how far past the edge a hard drag can reach

export function createViewfinder({ canvas, stage, onFrameChange }) {
  const ctx = canvas.getContext('2d');

  let image = null;
  let filter = 'none';
  let aspect = 1;
  let targetW = 1, targetH = 1;
  // DEC-03: the frame is the output at its real size on screen. `fitMode` is the
  // explicit opt-out for close work; `frameScale` is how much of true size the
  // frame is actually showing (below 1 means the stage forced a cap).
  let fitMode = false;
  let frameScale = 1;
  // The framing to hold on to while the frame itself is changing shape or size.
  let morph = null;
  let vw = 1, vh = 1, dpr = 1;
  let dragging = null;
  const pointers = new Map();
  let snapped = { x: false, y: false };

  const frameW = new Spring(0, { stiffness: 210, damping: 24 });
  const frameH = new Spring(0, { stiffness: 210, damping: 24 });
  const scale = new Spring(1, { stiffness: 240, damping: 30 });
  const tx = new Spring(0, { stiffness: 240, damping: 30 });
  const ty = new Spring(0, { stiffness: 240, damping: 30 });
  const ghost = new Spring(GHOST_IDLE, { stiffness: 150, damping: 22, precision: 0.001 });
  const guides = new Spring(0, { stiffness: 180, damping: 24, precision: 0.001 });
  const snapPulse = new Pulse(0.5);
  const springs = [frameW, frameH, scale, tx, ty, ghost, guides];

  const loop = createLoop((dt) => {
    let moving = false;
    for (const s of springs) moving = s.step(dt) || moving;
    moving = snapPulse.step(dt) || moving;
    // The frame's morph changes both what counts as legal and what the same
    // crop maps to on screen. Re-deriving the transform from the crop we started
    // with keeps the cut itself untouched while the frame grows or shrinks —
    // which is what makes switching between true size and fit a pure change of
    // magnification rather than a change of framing.
    const morphing = !frameW.settled || !frameH.settled;
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

  const frameRect = () => ({
    x: (vw - frameW.v) / 2,
    y: (vh - frameH.v) / 2,
    w: frameW.v,
    h: frameH.v,
  });

  // Smallest scale at which the image still covers the frame. This is the floor
  // for every zoom: the frame is never allowed to contain empty space.
  function minScale() {
    if (!image) return 1;
    return Math.max(frameW.v / image.naturalWidth, frameH.v / image.naturalHeight);
  }

  function bounds() {
    const f = frameRect();
    const s = scale.v;
    return {
      x: [f.x + f.w - image.naturalWidth * s, f.x],
      y: [f.y + f.h - image.naturalHeight * s, f.y],
    };
  }

  function centred() {
    const f = frameRect();
    return {
      x: f.x + f.w / 2 - (image.naturalWidth * scale.v) / 2,
      y: f.y + f.h / 2 - (image.naturalHeight * scale.v) / 2,
    };
  }

  // True size by default: a 32x64 target is a 32x64 rectangle on screen, so the
  // smallness of a small crop is a fact you can see rather than a number you
  // have to imagine. Anything larger than the stage is capped down to fit, and
  // `frameScale` records by how much so the UI can say so.
  function layoutFrame(immediate = false) {
    const roomW = Math.max(40, vw - FRAME_PAD * 2);
    const roomH = Math.max(40, vh - FRAME_PAD * 2);
    const fits = Math.min(roomW / targetW, roomH / targetH);
    frameScale = fitMode ? fits : Math.min(1, fits);
    // A sub-pixel frame would be unusable; a handful of pixels still reads.
    const width = Math.max(8, targetW * frameScale);
    const height = Math.max(8, targetH * frameScale);
    if (immediate) { frameW.jump(width); frameH.jump(height); }
    else { frameW.set(width); frameH.set(height); }
  }

  // Nearest legal framing, with a magnet at dead centre on each axis
  // independently — so you can be centred horizontally and free vertically.
  function legal(x, y) {
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
  function settle() {
    if (!image) return;
    const min = minScale();
    if (scale.v < min - 0.0001) scale.set(min);
    else if (Math.abs(scale.v - min) / min < 0.015) scale.set(min); // snap to fit
    const l = legal(tx.v, ty.v);
    tx.set(l.x);
    ty.set(l.y);
    publish();
  }

  function publish() {
    if (!image || !onFrameChange) return;
    onFrameChange(readFraming());
  }

  // ---- framing, in source-image pixels -------------------------------------
  // Persisted per item so it survives resize, target changes and re-activation.

  function readFraming() {
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

  function applyFraming(framing) {
    if (!image) return;
    const f = frameRect();
    const iw = image.naturalWidth, ih = image.naturalHeight;
    // Re-fit the stored crop to the current aspect, keeping its centre.
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

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.fillStyle = '#0b0e13';
    ctx.fillRect(0, 0, vw, vh);
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

  function drawChrome(f) {
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

    // The frame edge itself: hairline, plus corner brackets that read as a
    // viewfinder rather than a selection marquee. Each is drawn twice — a dark
    // under-stroke first — so the frame stays legible on pale images too.
    const arm = Math.min(26, f.w / 5, f.h / 5);
    const corners = () => {
      ctx.beginPath();
      for (const [cx, cy, sx, sy] of [
        [f.x, f.y, 1, 1], [f.x + f.w, f.y, -1, 1],
        [f.x, f.y + f.h, 1, -1], [f.x + f.w, f.y + f.h, -1, -1],
      ]) {
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

    // Snap acknowledgement: a crosshair that blooms and dies.
    const p = snapPulse.value;
    if (p > 0.01) {
      ctx.strokeStyle = `rgba(120,190,255,${0.9 * p})`;
      ctx.lineWidth = 1;
      const mx = f.x + f.w / 2, my = f.y + f.h / 2, r = 14 + 22 * (1 - p);
      ctx.beginPath();
      if (snapped.x) { ctx.moveTo(mx, my - r); ctx.lineTo(mx, my + r); }
      if (snapped.y) { ctx.moveTo(mx - r, my); ctx.lineTo(mx + r, my); }
      ctx.stroke();
    }
  }

  // ---- interaction ---------------------------------------------------------

  const localPoint = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function beginInteraction() {
    ghost.set(GHOST_ACTIVE);
    guides.set(1);
    loop.kick();
  }

  function endInteraction() {
    ghost.set(GHOST_IDLE);
    guides.set(0);
    snapped = { x: false, y: false };
    loop.kick();
  }

  function onPointerDown(e) {
    if (!image) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, localPoint(e));
    if (pointers.size === 1) {
      const p = localPoint(e);
      dragging = { from: p, tx: tx.v, ty: ty.v };
      canvas.style.cursor = 'grabbing';
      beginInteraction();
    } else if (pointers.size === 2) {
      dragging = null;         // hand off to pinch
      startPinch();
    }
  }

  let pinch = null;
  function startPinch() {
    const [a, b] = [...pointers.values()];
    pinch = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
    beginInteraction();
  }

  function onPointerMove(e) {
    if (!image) return;
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, localPoint(e));

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

    if (!dragging) return;
    const p = localPoint(e);
    // Legal position first, then let the excess through with resistance, so
    // pulling past the edge feels like stretching rather than hitting a wall.
    const wantX = dragging.tx + (p.x - dragging.from.x);
    const wantY = dragging.ty + (p.y - dragging.from.y);
    const l = legal(wantX, wantY);
    tx.jump(l.x + rubber(wantX - l.x, OVERSHOOT));
    ty.jump(l.y + rubber(wantY - l.y, OVERSHOOT));
    publish();
    loop.kick();
  }

  function panBy(dx, dy) {
    const l = legal(tx.v + dx, ty.v + dy);
    tx.jump(l.x);
    ty.jump(l.y);
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      dragging = null;
      canvas.style.cursor = image ? 'grab' : 'default';
      settle();            // ...and this is the ease back home
      endInteraction();
    }
  }

  // `immediate` skips the settle, because a pinch settles on release instead.
  function zoomAt(factor, ax, ay, immediate = false) {
    if (!image) return;
    const min = minScale();
    const from = scale.v;
    const to = clamp(from * factor, min, min * MAX_ZOOM);
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

  let wheelIdle = null;
  function onWheel(e) {
    if (!image) return;
    e.preventDefault();
    const p = localPoint(e);
    // Trackpad pinch arrives as ctrl+wheel; plain wheel zooms too, since there
    // is nothing else on this canvas to scroll.
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022));
    beginInteraction();
    zoomAt(factor, p.x, p.y, true);
    clearTimeout(wheelIdle);
    wheelIdle = setTimeout(() => { settle(); endInteraction(); }, 140);
    loop.kick();
  }

  // ---- public surface ------------------------------------------------------

  function resize() {
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

  function fill() {
    if (!image) return;
    applyFraming(null);
    snapPulse.fire();
    loop.kick();
  }

  return {
    setImage(next, framing) {
      image = next;
      canvas.style.cursor = next ? 'grab' : 'default';
      if (next) {
        applyFraming(framing);
        // An image can arrive while the frame is still travelling toward a new
        // target — dropping a photo now sets the size from the photo, so this is
        // the ordinary case, not a corner. Framing against a rectangle that is
        // on its way somewhere else bakes in the magnification it happened to
        // have at that instant, and the picture lands cropped. Hand the crop to
        // the morph so it is re-derived until the frame actually arrives.
        if (!frameW.settled || !frameH.settled) morph = readFraming();
      }
      loop.kick();
    },
    // The live adjustment for whatever is on the stage. Only the pixels change:
    // the framing, the springs and the frame itself never hear about it.
    setAdjust(adjust) {
      const next = filterFor(adjust);
      if (next === filter) return;
      filter = next;
      loop.kick();
    },
    setTarget(w, h) {
      targetW = w;
      targetH = h;
      aspect = w / h;
      morph = image ? readFraming() : null;
      layoutFrame(false);
      loop.kick();
    },
    // The fit toggle. Only the magnification changes: the crop is carried across
    // the morph untouched.
    setFit(on) {
      if (fitMode === on) return;
      fitMode = on;
      morph = image ? readFraming() : null;
      layoutFrame(false);
      loop.kick();
    },
    isFit: () => fitMode,
    // 1 while the frame is at true size; below 1 once the stage has capped it.
    getFrameScale: () => frameScale,
    nudge(dx, dy) {
      if (!image) return;
      beginInteraction();
      panBy(dx, dy);
      settle();
      clearTimeout(wheelIdle);
      wheelIdle = setTimeout(endInteraction, 400);
      loop.kick();
    },
    zoomBy(factor) {
      beginInteraction();
      zoomAt(factor, vw / 2, vh / 2);
      clearTimeout(wheelIdle);
      wheelIdle = setTimeout(endInteraction, 400);
      loop.kick();
    },
    fill,
    resize,
    getFraming: readFraming,
    hasImage: () => !!image,
  };
}

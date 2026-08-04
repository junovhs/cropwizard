// Where to put the frame before the user touches it.
//
// A centred crop is right maybe half the time; the other half it slices the
// subject in two. This finds the busiest band of the image instead — cheap
// local-contrast energy summed over candidate windows — so most images open
// already framed and the user only has to disagree occasionally.

const SAMPLE = 96;       // long edge of the analysis buffer, in pixels
const CENTRE_BIAS = 0.35; // how strongly ties resolve toward the middle

// Detail is edges, and colour matters more than luma for "is this the subject".
function energyMap(image) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const scale = SAMPLE / Math.max(iw, ih);
  const w = Math.max(2, Math.round(iw * scale));
  const h = Math.max(2, Math.round(ih * scale));

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);

  let data;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null; // tainted canvas — fall back to a centred crop
  }

  const lum = new Float32Array(w * h);
  const sat = new Float32Array(w * h);
  for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    sat[i] = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  }

  const energy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const dx = Math.abs(lum[i - 1] - lum[i + 1]);
      const dy = Math.abs(lum[i - w] - lum[i + w]);
      energy[i] = dx + dy + sat[i] * 40;
    }
  }
  return { energy, w, h };
}

// Row/column prefix sums are all we need: the covering crop only ever has slack
// on one axis, so the search is one-dimensional.
function axisTotals(map, vertical) {
  const { energy, w, h } = map;
  const n = vertical ? h : w;
  const totals = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      totals[vertical ? y : x] += energy[y * w + x];
    }
  }
  const prefix = new Float32Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + totals[i];
  return prefix;
}

/**
 * Reshape an existing crop to a new aspect without moving what it is pointing
 * at. Used when the target size changes under a framing the user already chose:
 * their decision was about *where*, and that survives a change of shape.
 * @returns {{cx:number, cy:number, cropW:number, cropH:number}} in source pixels
 */
export function refit(image, framing, aspect) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!framing) return autoFrame(image, aspect);

  let cropW = framing.cropW;
  let cropH = cropW / aspect;
  const fitting = Math.min(1, iw / cropW, ih / cropH);
  cropW *= fitting;
  cropH *= fitting;
  return {
    cropW,
    cropH,
    cx: Math.min(Math.max(framing.cx, cropW / 2), iw - cropW / 2),
    cy: Math.min(Math.max(framing.cy, cropH / 2), ih - cropH / 2),
  };
}

/**
 * Choose an opening crop of the given aspect ratio.
 * @returns {{cx:number, cy:number, cropW:number, cropH:number}} in source pixels
 */
export function autoFrame(image, aspect) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;

  // The largest window of this aspect that fits: slack exists on one axis only.
  let cropW = Math.min(iw, ih * aspect);
  let cropH = cropW / aspect;
  if (cropH > ih) { cropH = ih; cropW = cropH * aspect; }

  const centre = { cx: iw / 2, cy: ih / 2, cropW, cropH };
  const vertical = ih - cropH > iw - cropW;
  const slack = vertical ? ih - cropH : iw - cropW;
  if (slack < 1) return centre;

  const map = energyMap(image);
  if (!map) return centre;

  const prefix = axisTotals(map, vertical);
  const sampleLen = vertical ? map.h : map.w;
  const sourceLen = vertical ? ih : iw;
  const scale = sampleLen / sourceLen;
  const windowLen = Math.max(1, Math.round((vertical ? cropH : cropW) * scale));
  const span = sampleLen - windowLen;
  if (span < 1) return centre;

  const total = prefix[sampleLen] || 1;
  // The share of the energy a uniform window would hold. Scaling the centre
  // penalty by it keeps the bias meaningful on a busy image and decisive on a
  // flat one — where every window scores zero and only the penalty separates
  // them, so a featureless image lands centred instead of jammed against the
  // left edge.
  const baseline = windowLen / sampleLen;
  let bestStart = Math.round(span / 2);
  let bestScore = -Infinity;
  for (let start = 0; start <= span; start++) {
    const sum = (prefix[start + windowLen] - prefix[start]) / total;
    const middle = start + windowLen / 2;
    const offCentre = Math.abs(middle - sampleLen / 2) / (sampleLen / 2);
    const score = sum - CENTRE_BIAS * baseline * offCentre;
    if (score > bestScore) { bestScore = score; bestStart = start; }
  }

  // windowLen was rounded to whole sample pixels, so scaling back can overshoot
  // the source by a pixel or two. Clamp: the crop must stay inside the image.
  const cropLen = vertical ? cropH : cropW;
  const half = cropLen / 2;
  const offset = Math.min(Math.max(bestStart / scale + half, half), sourceLen - half);
  return vertical
    ? { cx: iw / 2, cy: offset, cropW, cropH }
    : { cx: offset, cy: ih / 2, cropW, cropH };
}

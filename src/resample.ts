// Downscaling, done where the light actually adds up.
//
// A pixel value in a file is not a quantity of light, it is a code for one:
// sRGB spends more codes on the dark end because eyes do. Averaging the codes —
// which is what every canvas drawImage does — therefore averages the wrong
// numbers, and the error is not subtle: mid-grey between black and white comes
// out at 128 (a code) instead of 188 (the code for half the light). Fine
// checkerboards, thin bright lines on dark ground, and starfields all lose
// brightness as they shrink, which is why a resized photo can look muddier than
// the original for no reason anyone can point at.
//
// So: decode to light, resample there, and re-encode at the end. The filter is a
// separable Lanczos-3 whose support widens with the reduction, which is the same
// thing as low-pass filtering before you throw pixels away — the reason a proper
// resize keeps detail that a box average smears.

const A = 3;                       // Lanczos lobes
const LINEAR_STEPS = 8192;

const TO_LINEAR = (() => {
  const table = new Float32Array(256);
  for (let i = 0; i < 256; i += 1) {
    const c = i / 255;
    table[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  return table;
})();

// The way back, as a table: the curve is steep near black, so it is sampled
// finely enough that the rounding to a byte is what decides the answer.
const TO_SRGB = (() => {
  const table = new Uint8Array(LINEAR_STEPS + 1);
  for (let i = 0; i <= LINEAR_STEPS; i += 1) {
    const l = i / LINEAR_STEPS;
    const c = l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055;
    table[i] = Math.round(Math.min(1, Math.max(0, c)) * 255);
  }
  return table;
})();

const encode = (linear: number): number =>
  TO_SRGB[Math.round(Math.min(1, Math.max(0, linear)) * LINEAR_STEPS)] as number;

function lanczos(x: number): number {
  if (x === 0) return 1;
  const ax = Math.abs(x);
  if (ax >= A) return 0;
  const px = Math.PI * x;
  return (A * Math.sin(px) * Math.sin(px / A)) / (px * px);
}

interface Taps {
  /** Flat [dst * width] source indices, already clamped to the edge. */
  readonly offsets: Int32Array;
  readonly weights: Float32Array;
  readonly width: number;
}

/**
 * The contribution every destination sample takes from the source. When
 * shrinking, the kernel is stretched by the same factor — that widening is the
 * low-pass filter, and leaving it out is what makes naive resizing alias.
 */
function taps(srcSize: number, dstSize: number): Taps {
  const scale = dstSize / srcSize;
  const support = scale < 1 ? A / scale : A;
  const width = Math.min(srcSize, Math.ceil(support) * 2 + 1);
  const offsets = new Int32Array(dstSize * width);
  const weights = new Float32Array(dstSize * width);

  for (let d = 0; d < dstSize; d += 1) {
    // The destination sample sits at the centre of the source span it covers.
    const centre = (d + 0.5) / scale - 0.5;
    const first = Math.ceil(centre - support);
    let sum = 0;
    const base = d * width;
    for (let i = 0; i < width; i += 1) {
      const at = first + i;
      const weight = lanczos(scale < 1 ? (at - centre) * scale : at - centre);
      offsets[base + i] = Math.min(srcSize - 1, Math.max(0, at));
      weights[base + i] = weight;
      sum += weight;
    }
    // Normalise: the tail of the kernel and the edge clamping both leak energy,
    // and a row that does not sum to one is a row that changes the exposure.
    if (sum !== 0) for (let i = 0; i < width; i += 1) weights[base + i] = (weights[base + i] as number) / sum;
  }
  return { offsets, weights, width };
}

const opaque = (data: Uint8ClampedArray): boolean => {
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) return false;
  return true;
};

/**
 * Resample to an exact size, in linear light. Alpha is carried premultiplied so
 * that transparent pixels cannot bleed their colour into their neighbours.
 */
export function resample(source: ImageData, dstW: number, dstH: number): ImageData {
  const { width: srcW, height: srcH, data } = source;
  const flat = opaque(data);
  const ch = flat ? 3 : 4;

  const horizontal = taps(srcW, dstW);
  const vertical = taps(srcH, dstH);

  // One row of the source in light, reused: the horizontal pass is what turns
  // codes into quantities, so nothing bigger than a row is ever held as bytes.
  const mid = new Float32Array(dstW * srcH * ch);

  for (let y = 0; y < srcH; y += 1) {
    const rowStart = y * srcW * 4;
    const outRow = y * dstW * ch;
    for (let d = 0; d < dstW; d += 1) {
      const base = d * horizontal.width;
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < horizontal.width; i += 1) {
        const w = horizontal.weights[base + i] as number;
        if (w === 0) continue;
        const at = rowStart + (horizontal.offsets[base + i] as number) * 4;
        if (flat) {
          r += (TO_LINEAR[data[at] as number] as number) * w;
          g += (TO_LINEAR[data[at + 1] as number] as number) * w;
          b += (TO_LINEAR[data[at + 2] as number] as number) * w;
        } else {
          const alpha = (data[at + 3] as number) / 255;
          r += (TO_LINEAR[data[at] as number] as number) * alpha * w;
          g += (TO_LINEAR[data[at + 1] as number] as number) * alpha * w;
          b += (TO_LINEAR[data[at + 2] as number] as number) * alpha * w;
          a += alpha * w;
        }
      }
      const out = outRow + d * ch;
      mid[out] = r; mid[out + 1] = g; mid[out + 2] = b;
      if (!flat) mid[out + 3] = a;
    }
  }

  const result = new ImageData(dstW, dstH);
  const out = result.data;

  for (let d = 0; d < dstH; d += 1) {
    const base = d * vertical.width;
    const outRow = d * dstW * 4;
    for (let x = 0; x < dstW; x += 1) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < vertical.width; i += 1) {
        const w = vertical.weights[base + i] as number;
        if (w === 0) continue;
        const at = ((vertical.offsets[base + i] as number) * dstW + x) * ch;
        r += (mid[at] as number) * w;
        g += (mid[at + 1] as number) * w;
        b += (mid[at + 2] as number) * w;
        if (!flat) a += (mid[at + 3] as number) * w;
      }
      const at = outRow + x * 4;
      if (flat) {
        out[at] = encode(r); out[at + 1] = encode(g); out[at + 2] = encode(b);
        out[at + 3] = 255;
      } else if (a > 1e-6) {
        // Back out of premultiplication before re-encoding: the colour of a
        // half-transparent pixel is what it would be at full strength.
        out[at] = encode(r / a); out[at + 1] = encode(g / a); out[at + 2] = encode(b / a);
        out[at + 3] = Math.round(Math.min(1, a) * 255);
      } else {
        out[at] = 0; out[at + 1] = 0; out[at + 2] = 0; out[at + 3] = 0;
      }
    }
  }

  return result;
}

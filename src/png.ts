// A PNG writer that tries to say the same thing in fewer bytes.
//
// The canvas gives us a PNG for free, but it is always the same PNG: 32 bits a
// pixel, one filter strategy, one shot at deflate. Most of what people crop is
// cheaper than that — a screenshot has a handful of colours, a photograph has no
// transparency to store — and the format has had a way to say so since 1996.
//
// So we encode it ourselves as well and keep whichever blob is smaller. The
// pixels are identical either way: everything here is lossless, and the choices
// are only about how the same numbers are spelled.
//
// Deflate comes from the platform (CompressionStream), so this stays inside
// DEC-01: no dependency, nothing fetched.

import { crc32 } from './zip.js';

const SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// PNG colour types, by the numbers the spec gives them.
const enum ColorType { RGB = 2, PALETTE = 3, RGBA = 6 }

interface Plan {
  readonly colorType: ColorType;
  readonly depth: 1 | 2 | 4 | 8;
  /** Palette entries as 0xRRGGBBAA, in the order they will be written. */
  readonly palette: readonly number[];
  /** Palette index by colour key, for the packing pass. */
  readonly index: ReadonlyMap<number, number>;
}

/**
 * What is actually in the picture: how many distinct colours, and whether any of
 * them is see-through. Gives up early on the palette question, because past 256
 * colours the answer cannot change anything.
 */
function survey(data: Uint8ClampedArray): { readonly colors: number[] | null; readonly opaque: boolean } {
  const seen = new Set<number>();
  let colors: number[] | null = [];
  let opaque = true;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] as number;
    if (a !== 255) opaque = false;
    if (colors === null) {
      // Still worth finishing the scan: transparency decides RGB vs RGBA.
      if (!opaque) break;
      continue;
    }
    const key = ((data[i] as number) << 24 | (data[i + 1] as number) << 16
      | (data[i + 2] as number) << 8 | a) >>> 0;
    if (!seen.has(key)) {
      if (seen.size === 256) { colors = null; continue; }
      seen.add(key);
      colors.push(key);
    }
  }
  return { colors, opaque };
}

/** The cheapest representation this image is entitled to. */
function plan(data: Uint8ClampedArray): Plan {
  const { colors, opaque } = survey(data);

  if (colors !== null) {
    // Transparent entries first: tRNS is a prefix of the palette, so the fewer
    // entries it has to cover, the shorter it is.
    const ordered = [...colors].sort((a, b) => (a & 0xff) - (b & 0xff));
    const index = new Map<number, number>(ordered.map((key, at) => [key, at]));
    const depth = ordered.length <= 2 ? 1 : ordered.length <= 4 ? 2 : ordered.length <= 16 ? 4 : 8;
    return { colorType: ColorType.PALETTE, depth, palette: ordered, index };
  }

  return {
    colorType: opaque ? ColorType.RGB : ColorType.RGBA,
    depth: 8,
    palette: [],
    index: new Map(),
  };
}

// ---- scanlines -------------------------------------------------------------

/** Bytes per pixel as stored — also the filter's step back to the left. */
const strideOf = (p: Plan): number => p.colorType === ColorType.RGBA ? 4 : p.colorType === ColorType.RGB ? 3 : 1;

/**
 * The five filters PNG defines, scored by the usual heuristic: the row whose
 * bytes are closest to zero is the row deflate will compress hardest. Palette
 * rows skip this — an index is not a quantity, so subtracting one index from
 * another produces noise rather than a small number.
 */
/** One filter applied across a row, into `out`; returns its heuristic score. */
function applyFilter(
  type: number, row: Uint8Array, prev: Uint8Array, bpp: number, out: Uint8Array,
): number {
  const width = row.length;
  let score = 0;
  for (let i = 0; i < width; i += 1) {
    const a = i >= bpp ? (row[i - bpp] as number) : 0;
    const b = prev[i] as number;
    const c = i >= bpp ? (prev[i - bpp] as number) : 0;
    const x = row[i] as number;
    let value: number;
    switch (type) {
      case 0: value = x; break;
      case 1: value = x - a; break;
      case 2: value = x - b; break;
      case 3: value = x - ((a + b) >> 1); break;
      default: {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        value = x - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
    }
    const byte = value & 0xff;
    out[i] = byte;
    // Signed magnitude: 200 as a byte is -56 as a difference, and it is the
    // difference deflate sees a run of.
    score += byte < 128 ? byte : 256 - byte;
  }
  return score;
}

/**
 * Write one filtered scanline, deciding the filter when asked to and otherwise
 * reusing the one already chosen. Trying all five costs five passes over the
 * row, which is worth it on a screenshot and not worth a second and a half on a
 * six-megapixel photograph — neighbouring rows of a photograph want the same
 * filter anyway, so on large images the decision is sampled rather than remade.
 */
function filterRow(
  raw: Uint8Array, at: number, row: Uint8Array, prev: Uint8Array, bpp: number,
  candidate: Uint8Array, best: Uint8Array, decide: boolean, previousType: number,
): { readonly at: number; readonly type: number } {
  const width = row.length;
  let bestType = previousType;

  if (decide) {
    let bestScore = Infinity;
    for (let type = 0; type <= 4; type += 1) {
      const score = applyFilter(type, row, prev, bpp, candidate);
      if (score < bestScore) {
        bestScore = score;
        bestType = type;
        best.set(candidate);
      }
    }
  } else {
    applyFilter(bestType, row, prev, bpp, best);
  }

  raw[at] = bestType;
  raw.set(best, at + 1);
  return { at: at + 1 + width, type: bestType };
}

/** Pack one row of palette indices at 1, 2, 4 or 8 bits. */
function packIndices(indices: Uint8Array, depth: number, out: Uint8Array): void {
  if (depth === 8) { out.set(indices); return; }
  const per = 8 / depth;
  out.fill(0);
  for (let i = 0; i < indices.length; i += 1) {
    const shift = 8 - depth * ((i % per) + 1);
    const at = (i / per) | 0;
    out[at] = (out[at] as number) | ((indices[i] as number) << shift);
  }
}

/** Every scanline, each behind its filter byte — the exact input IDAT wants. */
function rawScanlines(image: ImageData, p: Plan): Uint8Array {
  const { width, height, data } = image;
  const bpp = strideOf(p);
  const rowBytes = p.colorType === ColorType.PALETTE
    ? Math.ceil((width * p.depth) / 8)
    : width * bpp;
  const raw = new Uint8Array((rowBytes + 1) * height);

  // Four buffers for the whole image rather than four per row: the current row,
  // the one above it that the filters refer back to, and the filter's scratch.
  let row = new Uint8Array(rowBytes);
  let prev = new Uint8Array(rowBytes);
  const candidate = new Uint8Array(rowBytes);
  const best = new Uint8Array(rowBytes);
  const indices = p.colorType === ColorType.PALETTE ? new Uint8Array(width) : null;
  let at = 0;
  // Below a couple of megapixels every row gets its own answer; above it, one
  // row in eight decides for its neighbours.
  const every = width * height > 2_000_000 ? 8 : 1;
  let type = 0;

  for (let y = 0; y < height; y += 1) {
    let source = y * width * 4;
    if (indices) {
      for (let x = 0; x < width; x += 1, source += 4) {
        const key = ((data[source] as number) << 24 | (data[source + 1] as number) << 16
          | (data[source + 2] as number) << 8 | (data[source + 3] as number)) >>> 0;
        indices[x] = p.index.get(key) ?? 0;
      }
      packIndices(indices, p.depth, row);
      // Filtering indexed rows is a loss, so they go out as filter 0.
      raw[at] = 0;
      raw.set(row, at + 1);
      at += 1 + rowBytes;
      continue;
    }

    for (let x = 0; x < width; x += 1, source += 4) {
      const out = x * bpp;
      row[out] = data[source] as number;
      row[out + 1] = data[source + 1] as number;
      row[out + 2] = data[source + 2] as number;
      if (bpp === 4) row[out + 3] = data[source + 3] as number;
    }
    const written = filterRow(raw, at, row, prev, bpp, candidate, best, y % every === 0, type);
    at = written.at;
    type = written.type;
    // Filters refer back to the *unfiltered* row above, so this row becomes the
    // next one's `prev` and its buffer is handed over to be overwritten.
    const spent = prev;
    prev = row;
    row = spent;
  }
  return raw;
}

// ---- chunks ----------------------------------------------------------------

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(body.length + 12);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  view.setUint32(out.length - 4, crc32(out.subarray(4, out.length - 4)));
  return out;
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  // CompressionStream('deflate') is zlib-wrapped, which is exactly what IDAT is.
  const stream = new Blob([bytes as BlobPart]).stream()
    .pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Encode an image as a PNG, choosing the representation that costs least.
 * Resolves null when the platform cannot help (no CompressionStream) or the
 * image is too big to hold twice — the caller keeps the canvas's own PNG.
 */
export async function encodePng(image: ImageData): Promise<Blob | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const p = plan(image.data);
    const idat = await deflate(rawScanlines(image, p));

    const ihdr = new Uint8Array(13);
    const view = new DataView(ihdr.buffer);
    view.setUint32(0, image.width);
    view.setUint32(4, image.height);
    ihdr[8] = p.depth;
    ihdr[9] = p.colorType;
    // Deflate, adaptive filtering, no interlace — the only combination anything
    // in the wild actually reads.
    ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

    const parts: Uint8Array[] = [SIGNATURE, chunk('IHDR', ihdr)];

    if (p.colorType === ColorType.PALETTE) {
      const plte = new Uint8Array(p.palette.length * 3);
      let alphaCount = 0;
      p.palette.forEach((key, at) => {
        plte[at * 3] = (key >>> 24) & 0xff;
        plte[at * 3 + 1] = (key >>> 16) & 0xff;
        plte[at * 3 + 2] = (key >>> 8) & 0xff;
        if ((key & 0xff) !== 255) alphaCount = at + 1;
      });
      parts.push(chunk('PLTE', plte));
      if (alphaCount > 0) {
        const trns = new Uint8Array(alphaCount);
        for (let at = 0; at < alphaCount; at += 1) trns[at] = (p.palette[at] as number) & 0xff;
        parts.push(chunk('tRNS', trns));
      }
    }

    parts.push(chunk('IDAT', idat), chunk('IEND', new Uint8Array(0)));
    return new Blob(parts as BlobPart[], { type: 'image/png' });
  } catch {
    // Any surprise here costs nothing: the canvas already has an answer.
    return null;
  }
}

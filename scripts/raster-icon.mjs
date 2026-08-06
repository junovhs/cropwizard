// The crop mark, rasterised.
//
// The SVG favicon covers browser tabs. iOS does not use it for a home-screen
// icon — that has to be a PNG — so the same mark is drawn here as four bars and
// encoded by hand. Every bar is axis-aligned, which is why no antialiasing is
// needed and none is done: at these sizes a straight edge on a pixel boundary is
// sharper than any average of two colours could be.
//
// No dependencies (DEC-01). Node's own zlib does the compression; the rest of
// PNG is four chunks and a checksum.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const PAPER = [0xf7, 0xf5, 0xf1];
const ACCENT = [0xac, 0x47, 0x14];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const body = Buffer.concat([name, data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/**
 * The crop glyph from src/icons.ts, with its rounded corners squared off — an
 * arc of radius 2 in a 24-unit glyph is a pixel and a half at this size, and a
 * pixel and a half of curve is just a softer edge.
 */
function drawCropMark(pixels, size) {
  const scale = (size * 0.72) / 24;
  const inset = (size - 24 * scale) / 2;
  const at = (u) => Math.round(inset + u * scale);
  const stroke = Math.max(2, Math.round(2.4 * scale));

  const fill = ([r, g, b], x0, y0, x1, y1) => {
    for (let y = Math.max(0, y0); y < Math.min(size, y1); y += 1) {
      for (let x = Math.max(0, x0); x < Math.min(size, x1); x += 1) {
        const at4 = (y * size + x) * 4;
        pixels[at4] = r;
        pixels[at4 + 1] = g;
        pixels[at4 + 2] = b;
        pixels[at4 + 3] = 255;
      }
    }
  };

  fill(PAPER, 0, 0, size, size);
  // The near L: down the left, then across the bottom.
  fill(ACCENT, at(6), at(2), at(6) + stroke, at(18) + stroke);
  fill(ACCENT, at(6), at(18), at(22), at(18) + stroke);
  // ...and the far L, the same shape turned about the centre.
  fill(ACCENT, at(18), at(6), at(18) + stroke, at(22));
  fill(ACCENT, at(2), at(6), at(18) + stroke, at(6) + stroke);
}

/** One square PNG of the crop mark, at whatever size is asked for. */
export function writeIcon(path, size) {
  const pixels = Buffer.alloc(size * size * 4);
  drawCropMark(pixels, size);

  // Each row is prefixed with its filter type. Zero — "none" — because the
  // image is four flat rectangles and there is nothing for a filter to predict.
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;   // bits per channel
  header[9] = 6;   // truecolour with alpha
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

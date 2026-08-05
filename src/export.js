// Turning framings into files.

import { makeZip } from './zip.js';
import { filterFor } from './adjust.js';

export const FORMATS = {
  png:  { mime: 'image/png',  ext: 'png',  label: 'PNG',  lossy: false, alpha: true },
  jpeg: { mime: 'image/jpeg', ext: 'jpg',  label: 'JPEG', lossy: true,  alpha: false },
  webp: { mime: 'image/webp', ext: 'webp', label: 'WebP', lossy: true,  alpha: true },
};

export const DEFAULT_TEMPLATE = '{name}-{w}x{h}';

/**
 * Render one item's framing and adjustment at exactly the target pixel size.
 * Large reductions are done in halving steps: a single drawImage that shrinks
 * by more than 2x undersamples and comes out mushy.
 */
export function renderItem(item, target, format) {
  const f = item.frame;
  let src = item.image;
  let sx = f.cx - f.cropW / 2;
  let sy = f.cy - f.cropH / 2;
  let sw = f.cropW;
  let sh = f.cropH;

  while (sw > target.w * 2 && sh > target.h * 2) {
    const step = document.createElement('canvas');
    step.width = Math.max(1, Math.round(sw / 2));
    step.height = Math.max(1, Math.round(sh / 2));
    const sctx = step.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(src, sx, sy, sw, sh, 0, 0, step.width, step.height);
    src = step;
    sx = 0; sy = 0;
    sw = step.width; sh = step.height;
  }

  const out = document.createElement('canvas');
  out.width = target.w;
  out.height = target.h;
  const ctx = out.getContext('2d');
  // JPEG has no alpha; without this, transparency composites to black.
  if (!FORMATS[format].alpha) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, target.w, target.h);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // The adjustment is baked once, on the final draw. The halving steps above
  // must stay untouched: filtering each of them would apply the same contrast
  // curve two or three times over and the file would not match the stage.
  // It also goes on after the white JPEG backdrop, which is not the photograph.
  ctx.filter = filterFor(item.adjust);
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, target.w, target.h);
  ctx.filter = 'none';
  return out;
}

const EXT_BY_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const ENCODE_TIMEOUT = 20000;

export function encode(canvas, format, quality) {
  const { mime, lossy, label } = FORMATS[format];
  return new Promise((resolve, reject) => {
    // A browser without a given encoder may simply never call back rather than
    // reporting failure, which would wedge the whole export. Fail loudly.
    const timer = setTimeout(
      () => reject(new Error(`${label} is not supported by this browser`)),
      ENCODE_TIMEOUT,
    );
    canvas.toBlob((blob) => {
      clearTimeout(timer);
      if (blob) resolve(blob);
      else reject(new Error(`Could not encode ${label}`));
    }, mime, lossy ? quality : undefined);
  });
}


// Filenames use an allowlist, not a blocklist: keep letters, digits, dot,
// underscore and dash; collapse everything else to a single separator. That
// covers every path-hostile and control character without enumerating them,
// and \p{L}/\p{N} keep non-English names intact.
const sanitize = (s) => s.replace(/[^\p{L}\p{N}._-]+/gu, '-')
  .replace(/-{2,}/g, '-')                 // a stripped token can leave a double dash
  .replace(/^[.-]+|[.-]+$/g, '') || 'image';

const pad = (n, width) => String(n).padStart(width, '0');

/**
 * Expand a filename template. Unknown tokens are left alone rather than
 * silently deleted, so a typo is visible in the preview instead of vanishing.
 */
export function expandName(template, ctx) {
  const tokens = {
    name: ctx.name,
    n: pad(ctx.index + 1, String(ctx.total).length),
    i: String(ctx.index + 1),
    w: String(ctx.w),
    h: String(ctx.h),
    size: `${ctx.w}x${ctx.h}`,
    label: ctx.label || '',
    date: new Date().toISOString().slice(0, 10),
  };
  const body = template.replace(/\{(\w+)\}/g, (whole, key) =>
    (key in tokens ? tokens[key] : whole));
  return `${sanitize(body)}.${ctx.ext}`;
}

// Two source files can share a stem, and a template need not include {n}.
// Collisions would silently drop entries from the archive, so disambiguate.
function unique(names) {
  const seen = new Map();
  return names.map((name) => {
    const key = name.toLowerCase();
    const count = seen.get(key) || 0;
    seen.set(key, count + 1);
    if (!count) return name;
    const dot = name.lastIndexOf('.');
    return `${name.slice(0, dot)}-${count + 1}${name.slice(dot)}`;
  });
}

/**
 * Render, encode and name every item.
 * @returns {Promise<Array<{name: string, blob: Blob}>>}
 */
export async function buildFiles(items, target, options, onProgress) {
  const { format, quality, template, label } = options;
  const files = [];

  for (const [index, item] of items.entries()) {
    const canvas = renderItem(item, target, format);
    const blob = await encode(canvas, format, quality);
    // Name the file after what was actually produced. A browser that quietly
    // substitutes PNG for an unsupported type must not yield a lying extension.
    const ext = EXT_BY_MIME[blob.type] || FORMATS[format].ext;
    files.push({
      name: expandName(template, {
        name: item.name, index, total: items.length,
        w: target.w, h: target.h, ext, label,
      }),
      blob,
    });
    onProgress?.((index + 1) / items.length);
    // Let the frame breathe so the progress bar actually animates.
    await new Promise((r) => setTimeout(r, 0));
  }

  const names = unique(files.map((f) => f.name));
  return files.map((f, i) => ({ ...f, name: names[i] }));
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * One image downloads as itself; several download as one archive.
 * @returns {Promise<{filename: string, count: number}>}
 */
export async function exportAll(items, target, options, onProgress) {
  const files = await buildFiles(items, target, options, onProgress);
  if (files.length === 1) {
    download(files[0].blob, files[0].name);
    return { filename: files[0].name, count: 1 };
  }
  const zip = await makeZip(files);
  // The archive is named after the product first so a folder of exports sorts
  // together; the size label, when there is one, follows it.
  const filename = `${sanitize(`cropwizard ${options.label || ''}`)}-${target.w}x${target.h}.zip`;
  download(zip, filename);
  return { filename, count: files.length };
}

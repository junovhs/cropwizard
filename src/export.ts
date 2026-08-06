// Turning framings into files.

import { makeZip } from './zip.js';
import { encodePng } from './png.js';
import { resample } from './resample.js';
import { filterFor } from './adjust.js';
import { canvasContext } from './infrastructure/dom.js';
import type {
  CropItem,
  ExportFormat,
  ExportOptions,
  ExportScale,
  FilenameContext,
  OutputTarget,
} from './domain/types.js';

export interface FormatDescriptor {
  readonly mime: 'image/png' | 'image/jpeg' | 'image/webp';
  readonly ext: 'png' | 'jpg' | 'webp';
  readonly label: string;
  readonly lossy: boolean;
  readonly alpha: boolean;
}

export const FORMATS: Readonly<Record<ExportFormat, FormatDescriptor>> = {
  png:  { mime: 'image/png',  ext: 'png',  label: 'PNG',  lossy: false, alpha: true },
  jpeg: { mime: 'image/jpeg', ext: 'jpg',  label: 'JPEG', lossy: true,  alpha: false },
  webp: { mime: 'image/webp', ext: 'webp', label: 'WebP', lossy: true,  alpha: true },
};

export const DEFAULT_TEMPLATE = '{name}-{w}x{h}';
export const SCALES: readonly ExportScale[] = [1, 2, 4];

export const scaledTarget = (target: OutputTarget, scale: ExportScale = 1): OutputTarget => ({
  ...target,
  w: Math.max(1, Math.round(target.w * scale)),
  h: Math.max(1, Math.round(target.h * scale)),
});

/**
 * The crop at its own resolution, as pixels we can do arithmetic on. Rounded
 * outward to whole pixels because a fractional source rectangle is a resample in
 * itself, and one done by the canvas in the wrong colour space at that.
 */
function cropPixels(item: CropItem, f: NonNullable<CropItem['frame']>): ImageData | null {
  const iw = item.image.naturalWidth;
  const ih = item.image.naturalHeight;
  // Not clamped into the picture: zoomed out below 100% the crop is deliberately
  // larger than what is in it, and clamping would silently return the sides the
  // user had just decided to keep room around. The rectangle is cut at the size
  // asked for and the picture is drawn into its place inside it — whatever is
  // left over stays transparent, which is exactly what the frame was showing.
  const x = Math.round(f.cx - f.cropW / 2);
  const y = Math.round(f.cy - f.cropH / 2);
  const w = Math.max(1, Math.round(f.cropW));
  const h = Math.max(1, Math.round(f.cropH));
  if (x >= iw || y >= ih || x + w <= 0 || y + h <= 0) return null;

  const cut = document.createElement('canvas');
  cut.width = w;
  cut.height = h;
  const ctx = canvasContext(cut);
  ctx.drawImage(item.image, 0, 0, iw, ih, -x, -y, iw, ih);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Shrink in linear light when there is enough shrinking to be worth it. Returns
 * null whenever the good path does not apply — too little reduction to matter,
 * an upscale, or anything at all going wrong — and the caller falls back to the
 * canvas, which is what shipped before this and is no worse than it was.
 */
function resampled(item: CropItem, target: OutputTarget): HTMLCanvasElement | null {
  const f = item.frame;
  if (!f) return null;
  if (f.cropW < target.w * 1.05 || f.cropH < target.h * 1.05) return null;
  try {
    const pixels = cropPixels(item, f);
    if (!pixels) return null;
    const done = resample(pixels, target.w, target.h);
    const canvas = document.createElement('canvas');
    canvas.width = target.w;
    canvas.height = target.h;
    canvasContext(canvas).putImageData(done, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

/** Render one item at exactly the target pixel size. */
export function renderItem(
  item: CropItem,
  target: OutputTarget,
  format: ExportFormat,
): HTMLCanvasElement {
  const f = item.frame;
  if (!f) throw new Error(`Cannot export ${item.file.name}: no framing is available`);

  const fine = resampled(item, target);
  let src: CanvasImageSource = fine ?? item.image;
  let sx = fine ? 0 : f.cx - f.cropW / 2;
  let sy = fine ? 0 : f.cy - f.cropH / 2;
  let sw = fine ? target.w : f.cropW;
  let sh = fine ? target.h : f.cropH;

  while (sw > target.w * 2 && sh > target.h * 2) {
    const step = document.createElement('canvas');
    step.width = Math.max(1, Math.round(sw / 2));
    step.height = Math.max(1, Math.round(sh / 2));
    const sctx = canvasContext(step);
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(src, sx, sy, sw, sh, 0, 0, step.width, step.height);
    src = step;
    sx = 0;
    sy = 0;
    sw = step.width;
    sh = step.height;
  }

  const out = document.createElement('canvas');
  out.width = target.w;
  out.height = target.h;
  const ctx = canvasContext(out);
  if (!FORMATS[format].alpha) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, target.w, target.h);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.filter = filterFor(item.adjust);
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, target.w, target.h);
  ctx.filter = 'none';
  return out;
}

const EXT_BY_MIME: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const ENCODE_TIMEOUT = 20_000;

function toBlob(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  quality: number,
): Promise<Blob> {
  const { mime, lossy, label } = FORMATS[format];
  return new Promise<Blob>((resolve, reject) => {
    const timer = window.setTimeout(
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

export async function encode(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  quality: number,
): Promise<Blob> {
  const blob = await toBlob(canvas, format, quality);
  if (format !== 'png') return blob;

  // PNG is lossless, so a smaller PNG of the same pixels is free money — but
  // only if it is actually smaller, which for a photograph it often is not.
  // Both are the same picture, so the choice can be made on size alone.
  const ours = await encodePng(canvasContext(canvas).getImageData(0, 0, canvas.width, canvas.height));
  return ours && ours.size < blob.size ? ours : blob;
}

const sanitize = (value: string): string => value.replace(/[^\p{L}\p{N}._-]+/gu, '-')
  .replace(/-{2,}/g, '-')
  .replace(/^[.-]+|[.-]+$/g, '') || 'image';

const pad = (value: number, width: number): string => String(value).padStart(width, '0');

type FilenameToken = 'name' | 'n' | 'i' | 'w' | 'h' | 'size' | 'label' | 'date';

export function expandName(template: string, ctx: FilenameContext): string {
  const tokens: Record<FilenameToken, string> = {
    name: ctx.name,
    n: pad(ctx.index + 1, String(ctx.total).length),
    i: String(ctx.index + 1),
    w: String(ctx.w),
    h: String(ctx.h),
    size: `${ctx.w}x${ctx.h}`,
    label: ctx.label ?? '',
    date: new Date().toISOString().slice(0, 10),
  };
  const body = template.replace(/\{(\w+)\}/g, (whole: string, key: string) =>
    Object.hasOwn(tokens, key) ? tokens[key as FilenameToken] : whole);
  return `${sanitize(body)}.${ctx.ext}`;
}

function unique(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const key = name.toLowerCase();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (!count) return name;
    const dot = name.lastIndexOf('.');
    return `${name.slice(0, dot)}-${count + 1}${name.slice(dot)}`;
  });
}

export interface ExportedFile {
  readonly name: string;
  readonly blob: Blob;
}

export type ExportProgress = (fraction: number) => void;

export async function buildFiles(
  items: readonly CropItem[],
  target: OutputTarget,
  options: ExportOptions,
  onProgress?: ExportProgress,
): Promise<ExportedFile[]> {
  const { format, quality, template, label, scale } = options;
  const out = scaledTarget(target, scale);
  const files: ExportedFile[] = [];

  for (const [index, item] of items.entries()) {
    const canvas = renderItem(item, out, format);
    const blob = await encode(canvas, format, quality);
    const ext = EXT_BY_MIME[blob.type] ?? FORMATS[format].ext;
    files.push({
      name: expandName(template, {
        name: item.name,
        index,
        total: items.length,
        w: out.w,
        h: out.h,
        ext,
        label,
      }),
      blob,
    });
    onProgress?.((index + 1) / items.length);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  const names = unique(files.map((file) => file.name));
  return files.map((file, index) => ({ ...file, name: names[index] ?? file.name }));
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

export interface ExportResult {
  readonly filename: string;
  readonly count: number;
}

export async function exportAll(
  items: readonly CropItem[],
  target: OutputTarget,
  options: ExportOptions,
  onProgress?: ExportProgress,
): Promise<ExportResult> {
  const files = await buildFiles(items, target, options, onProgress);
  const first = files[0];
  if (!first) throw new Error('Nothing to export');

  if (files.length === 1) {
    download(first.blob, first.name);
    return { filename: first.name, count: 1 };
  }

  const zip = await makeZip(files);
  const out = scaledTarget(target, options.scale);
  const filename = `${sanitize(`cropwizard ${options.label}`)}-${out.w}x${out.h}.zip`;
  download(zip, filename);
  return { filename, count: files.length };
}

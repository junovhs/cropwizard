// Converting: changing the container, not the contents.
//
// Crop answers "what part of this, and how big?". Convert answers neither. It
// takes the pixels exactly as they arrived — every one of them, at the size they
// already are — and writes them into a different format. That restraint is the
// whole feature: the one thing a converter must never do is quietly resize or
// recompose what you gave it, because then you cannot tell whether the file got
// smaller because the format is better or because you lost half the picture.
//
// So this deliberately does not reuse `renderItem` from export.ts. That path
// crops to the frame, scales to a target and applies the adjustment, which are
// the three things that must not happen here. It shares the parts below the
// pixels instead — the encoders, the naming, the ZIP — because those are about
// files rather than about images.

import { makeZip } from './zip.js';
import { FORMATS, download, encode, expandName, sanitize, unique } from './export.js';
import { canvasContext } from './infrastructure/dom.js';
import type { CropItem, ExportFormat } from './domain/types.js';

export interface ConvertOptions {
  readonly format: ExportFormat;
  readonly quality: number;
  readonly template: string;
}

export interface ConvertedFile {
  readonly name: string;
  readonly blob: Blob;
  /** What the source weighed, so the panel can report the trade honestly. */
  readonly fromBytes: number;
}

/**
 * The image on a canvas at its own natural size, ready to encode. Drawn 1:1, so
 * there is no resampling to get wrong — smoothing settings are irrelevant when
 * source and destination are the same rectangle.
 *
 * A format without an alpha channel gets white underneath first. Otherwise a
 * transparent PNG converted to JPEG comes out with black where the nothing was,
 * which is the canvas being literal about undefined pixels rather than anyone's
 * intent.
 */
export function surfaceOf(image: HTMLImageElement, format: ExportFormat): HTMLCanvasElement {
  const w = Math.max(1, image.naturalWidth);
  const h = Math.max(1, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvasContext(canvas);
  if (!FORMATS[format].alpha) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(image, 0, 0);
  return canvas;
}

/**
 * One image, converted. The pixel dimensions of the result equal the source's.
 *
 * A canvas asked for a type it cannot write does not refuse — the spec has it
 * fall back to PNG, silently — so a browser without WebP would hand back a PNG
 * and everything downstream would carry on as though the request had been
 * honoured. Convert exists to change the format, so the one failure it must
 * never paper over is failing to change the format. PNG is exempt from the
 * check because our own encoder legitimately answers for it (PERF-01).
 */
export async function convertOne(
  item: CropItem,
  { format, quality }: Pick<ConvertOptions, 'format' | 'quality'>,
): Promise<Blob> {
  const blob = await encode(surfaceOf(item.image, format), format, quality);
  const { mime, label } = FORMATS[format];
  if (format !== 'png' && blob.type && blob.type !== mime) {
    throw new Error(`This browser cannot write ${label}`);
  }
  return blob;
}

const EXT_BY_MIME: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export type ConvertProgress = (fraction: number) => void;

export async function convertAll(
  items: readonly CropItem[],
  options: ConvertOptions,
  onProgress?: ConvertProgress,
): Promise<ConvertedFile[]> {
  const files: ConvertedFile[] = [];

  for (const [index, item] of items.entries()) {
    const blob = await convertOne(item, options);
    const ext = EXT_BY_MIME[blob.type] ?? FORMATS[options.format].ext;
    files.push({
      name: expandName(options.template, {
        name: item.name,
        index,
        total: items.length,
        // The source's own dimensions, because they are what the file will
        // have. {w}x{h} in a Convert filename must not describe a crop target
        // the user is not using.
        w: item.image.naturalWidth,
        h: item.image.naturalHeight,
        ext,
        label: FORMATS[options.format].label,
      }),
      blob,
      fromBytes: item.file.size,
    });
    onProgress?.((index + 1) / items.length);
    // The same yield the export path takes: a long queue must not lock the tab.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  const names = unique(files.map((file) => file.name));
  return files.map((file, index) => ({ ...file, name: names[index] ?? file.name }));
}

export interface ConvertResult {
  readonly filename: string;
  readonly count: number;
  readonly fromBytes: number;
  readonly toBytes: number;
}

const total = (files: readonly ConvertedFile[], of: (file: ConvertedFile) => number): number =>
  files.reduce((sum, file) => sum + of(file), 0);

export async function convertAndDownload(
  items: readonly CropItem[],
  options: ConvertOptions,
  onProgress?: ConvertProgress,
): Promise<ConvertResult> {
  const files = await convertAll(items, options, onProgress);
  const first = files[0];
  if (!first) throw new Error('Nothing to convert');

  const fromBytes = total(files, (file) => file.fromBytes);

  if (files.length === 1) {
    download(first.blob, first.name);
    return { filename: first.name, count: 1, fromBytes, toBytes: first.blob.size };
  }

  const zip = await makeZip(files);
  const filename = `${sanitize(`cropwizard ${FORMATS[options.format].label}`)}.zip`;
  download(zip, filename);
  // The ZIP's own size, not the sum of what went into it. The sentence this
  // feeds says what you got against what you had, and what you got is the file
  // that landed in your downloads.
  return { filename, count: files.length, fromBytes, toBytes: zip.size };
}

/**
 * Bytes as a person reads them. Kept to three significant figures at most,
 * because the fourth is never the point of the sentence it appears in.
 */
export function readableBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 * 1000) return `${(bytes / 1000).toFixed(bytes < 10_000 ? 1 : 0)} KB`;
  return `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;
}

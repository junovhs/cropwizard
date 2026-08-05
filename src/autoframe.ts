// Cheap content-aware opening crop.

import type { Framing } from './domain/types.js';
import { canvasContext } from './infrastructure/dom.js';

const SAMPLE = 96;
const CENTRE_BIAS = 0.35;

interface EnergyMap {
  readonly energy: Float32Array;
  readonly w: number;
  readonly h: number;
}

function imageWidth(image: CanvasImageSource): number {
  if (image instanceof HTMLImageElement) return image.naturalWidth || image.width;
  if (image instanceof HTMLCanvasElement) return image.width;
  if (image instanceof ImageBitmap) return image.width;
  return 0;
}

function imageHeight(image: CanvasImageSource): number {
  if (image instanceof HTMLImageElement) return image.naturalHeight || image.height;
  if (image instanceof HTMLCanvasElement) return image.height;
  if (image instanceof ImageBitmap) return image.height;
  return 0;
}

function energyMap(image: CanvasImageSource): EnergyMap | null {
  const iw = imageWidth(image);
  const ih = imageHeight(image);
  const scale = SAMPLE / Math.max(iw, ih);
  const w = Math.max(2, Math.round(iw * scale));
  const h = Math.max(2, Math.round(ih * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvasContext(canvas, { willReadFrequently: true });
  context.drawImage(image, 0, 0, w, h);

  let data: Uint8ClampedArray;
  try {
    data = context.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }

  const luminance = new Float32Array(w * h);
  const saturation = new Float32Array(w * h);
  for (let index = 0, pixel = 0; index < luminance.length; index += 1, pixel += 4) {
    const red = data[pixel] ?? 0;
    const green = data[pixel + 1] ?? 0;
    const blue = data[pixel + 2] ?? 0;
    luminance[index] = 0.299 * red + 0.587 * green + 0.114 * blue;
    saturation[index] = (Math.max(red, green, blue) - Math.min(red, green, blue)) / 255;
  }

  const energy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const index = y * w + x;
      const dx = Math.abs((luminance[index - 1] ?? 0) - (luminance[index + 1] ?? 0));
      const dy = Math.abs((luminance[index - w] ?? 0) - (luminance[index + w] ?? 0));
      energy[index] = dx + dy + (saturation[index] ?? 0) * 40;
    }
  }
  return { energy, w, h };
}

function axisTotals(map: EnergyMap, vertical: boolean): Float32Array {
  const { energy, w, h } = map;
  const count = vertical ? h : w;
  const totals = new Float32Array(count);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const index = vertical ? y : x;
      totals[index] = (totals[index] ?? 0) + (energy[y * w + x] ?? 0);
    }
  }
  const prefix = new Float32Array(count + 1);
  for (let index = 0; index < count; index += 1) {
    prefix[index + 1] = (prefix[index] ?? 0) + (totals[index] ?? 0);
  }
  return prefix;
}

export function refit(image: HTMLImageElement, framing: Framing | null, aspect: number): Framing {
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

export function autoFrame(image: HTMLImageElement, aspect: number): Framing {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;

  let cropW = Math.min(iw, ih * aspect);
  let cropH = cropW / aspect;
  if (cropH > ih) {
    cropH = ih;
    cropW = cropH * aspect;
  }

  const centre: Framing = { cx: iw / 2, cy: ih / 2, cropW, cropH };
  const vertical = ih - cropH > iw - cropW;
  const slack = vertical ? ih - cropH : iw - cropW;
  if (slack < 1) return centre;

  const map = energyMap(image);
  if (!map) return centre;

  const prefix = axisTotals(map, vertical);
  const sampleLength = vertical ? map.h : map.w;
  const sourceLength = vertical ? ih : iw;
  const scale = sampleLength / sourceLength;
  const windowLength = Math.max(1, Math.round((vertical ? cropH : cropW) * scale));
  const span = sampleLength - windowLength;
  if (span < 1) return centre;

  const total = prefix[sampleLength] || 1;
  const baseline = windowLength / sampleLength;
  let bestStart = Math.round(span / 2);
  let bestScore = -Infinity;
  for (let start = 0; start <= span; start += 1) {
    const sum = ((prefix[start + windowLength] ?? 0) - (prefix[start] ?? 0)) / total;
    const middle = start + windowLength / 2;
    const offCentre = Math.abs(middle - sampleLength / 2) / (sampleLength / 2);
    const score = sum - CENTRE_BIAS * baseline * offCentre;
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  const cropLength = vertical ? cropH : cropW;
  const half = cropLength / 2;
  const offset = Math.min(Math.max(bestStart / scale + half, half), sourceLength - half);
  return vertical
    ? { cx: iw / 2, cy: offset, cropW, cropH }
    : { cx: offset, cy: ih / 2, cropW, cropH };
}

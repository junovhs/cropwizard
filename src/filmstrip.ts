// The queue rail: a live contact sheet of the output queue.

import { CAN_FILTER, applyAdjustment, filterFor, isNeutral } from './adjust.js';
import { canvasContext } from './infrastructure/dom.js';
import type { AppState, CropItem, OutputTarget } from './domain/types.js';

const THUMB_H = 56;

interface FilmstripCell {
  readonly el: HTMLButtonElement;
  readonly canvas: HTMLCanvasElement;
  key: string;
  index: number;
}

export interface FilmstripOptions {
  readonly root: HTMLElement;
  readonly rail: HTMLElement;
  readonly bar: HTMLElement;
  readonly text: HTMLElement;
  readonly empty: HTMLElement;
  readonly approveAll: HTMLButtonElement;
  readonly onActivate: (index: number) => void;
  readonly onApproveAll: () => void;
  readonly onAdd: () => void;
}

export interface FilmstripController {
  sync(state: AppState): void;
  scrollToActive(state: AppState): void;
  celebrate(state: AppState): void;
}

export function createFilmstrip(options: FilmstripOptions): FilmstripController {
  const {
    root, rail, bar, text, empty, approveAll,
    onActivate, onApproveAll, onAdd,
  } = options;
  const cells = new Map<string, FilmstripCell>();

  // The next slot in the queue, drawn as an outline rather than a picture: it
  // is where the images you have not dropped yet will land, and it keeps the
  // numbering going so an empty batch reads as "1 of a stack" rather than as a
  // strip that failed to load.
  const addCell = document.createElement('button');
  addCell.type = 'button';
  addCell.className = 'thumb thumb-add';
  const addNum = document.createElement('span');
  addNum.className = 'thumb-num';
  const addMark = document.createElement('span');
  addMark.className = 'thumb-add-mark';
  addMark.setAttribute('aria-hidden', 'true');
  addMark.textContent = '+';
  addCell.append(addNum, addMark);
  addCell.addEventListener('click', onAdd);

  /**
   * Shape the open slot to `target` and number it `index + 1`. The outline is
   * the shape of the thing that will fill it, so it follows the output size
   * exactly as a real thumbnail does.
   */
  function sizeAddCell(target: OutputTarget, index: number): void {
    addCell.style.height = `${THUMB_H}px`;
    addCell.style.width = `${Math.max(16, Math.round(THUMB_H * (target.w / target.h)))}px`;
    addNum.textContent = String(index + 1);
    addCell.setAttribute('aria-label', `Add more images — they join the queue at ${index + 1}`);
  }

  function drawThumb(canvas: HTMLCanvasElement, item: CropItem, target: OutputTarget): void {
    const ratio = target.w / target.h;
    const h = THUMB_H;
    const w = Math.max(16, Math.round(h * ratio));
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvasContext(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const frame = item.frame;
    if (!frame) return;
    ctx.filter = filterFor(item.adjust);
    ctx.drawImage(
      item.image,
      frame.cx - frame.cropW / 2,
      frame.cy - frame.cropH / 2,
      frame.cropW,
      frame.cropH,
      0,
      0,
      w,
      h,
    );
    ctx.filter = 'none';
    // A contact sheet has to be a preview of the file, so it carries the
    // adjustment by whichever route this browser has. A thumbnail is a few
    // thousand pixels, so the slow route costs nothing here.
    if (!CAN_FILTER && !isNeutral(item.adjust)) {
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      applyAdjustment(pixels, item.adjust);
      ctx.putImageData(pixels, 0, 0);
    }
  }

  function build(item: CropItem, index: number): FilmstripCell {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'thumb';
    const canvas = document.createElement('canvas');
    const check = document.createElement('span');
    check.className = 'thumb-check';
    check.setAttribute('aria-hidden', 'true');
    const num = document.createElement('span');
    num.className = 'thumb-num';
    num.textContent = String(index + 1);
    el.append(canvas, check, num);
    el.addEventListener('click', () => {
      const current = cells.get(item.id);
      if (current) onActivate(current.index);
    });
    return { el, canvas, key: '', index };
  }

  function sync(state: AppState): void {
    const { items, activeIndex, target, batch } = state;

    // Batch off is not a disabled queue any more, it is no queue: the switch
    // that brings it back lives in the rail (DEC-04), so an empty bar down here
    // would be furniture with nothing to say.
    if (!batch) {
      for (const cell of cells.values()) cell.el.remove();
      cells.clear();
      addCell.remove();
      bar.style.width = '0%';
      root.classList.remove('is-complete');
      root.hidden = true;
      return;
    }
    root.hidden = false;

    for (const [id, cell] of cells) {
      if (!items.some((item) => item.id === id)) {
        cell.el.remove();
        cells.delete(id);
      }
    }

    items.forEach((item, index) => {
      let cell = cells.get(item.id);
      if (!cell) {
        cell = build(item, index);
        cells.set(item.id, cell);
        rail.append(cell.el);
      }
      cell.index = index;
      const number = cell.el.querySelector<HTMLElement>('.thumb-num');
      if (number) number.textContent = String(index + 1);

      const frame = item.frame;
      const key = frame
        ? `${Math.round(frame.cx)},${Math.round(frame.cy)},${Math.round(frame.cropW)},${target.w}x${target.h},${filterFor(item.adjust)}`
        : '';
      if (key !== cell.key) {
        drawThumb(cell.canvas, item, target);
        cell.key = key;
      }

      cell.el.classList.toggle('is-active', index === activeIndex);
      cell.el.classList.toggle('is-approved', item.approved);
      cell.el.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
      cell.el.setAttribute(
        'aria-label',
        `${item.file.name}${item.approved ? ', framed' : ''} — image ${index + 1} of ${items.length}`,
      );
    });

    // The open slot always trails the queue, so the strip is never a dead end
    // and the count of what could still arrive is drawn rather than described.
    sizeAddCell(target, items.length);
    rail.append(addCell);
    empty.hidden = items.length > 0;

    const done = items.filter((item) => item.approved).length;
    bar.style.width = items.length ? `${(done / items.length) * 100}%` : '0%';
    text.textContent = `${done} / ${items.length} framed`;
    root.classList.toggle('is-empty', items.length === 0);
    root.classList.toggle('is-complete', items.length > 0 && done === items.length);
    approveAll.disabled = !items.length || done === items.length;
  }

  function activeCell(state: AppState): FilmstripCell | undefined {
    const item = state.items[state.activeIndex];
    return item ? cells.get(item.id) : undefined;
  }

  function scrollToActive(state: AppState): void {
    activeCell(state)?.el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  function celebrate(state: AppState): void {
    const cell = activeCell(state);
    if (!cell) return;
    cell.el.classList.remove('just-approved');
    void cell.el.offsetWidth;
    cell.el.classList.add('just-approved');
  }

  approveAll.addEventListener('click', onApproveAll);
  return { sync, scrollToActive, celebrate };
}

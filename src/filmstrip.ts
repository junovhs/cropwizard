// The queue rail: a live contact sheet of the output queue.

import { filterFor } from './adjust.js';
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
  readonly note: HTMLElement;
  readonly approveAll: HTMLButtonElement;
  readonly enableBatch: HTMLButtonElement;
  readonly onActivate: (index: number) => void;
  readonly onApproveAll: () => void;
  readonly onEnableBatch: () => void;
}

export interface FilmstripController {
  sync(state: AppState): void;
  scrollToActive(state: AppState): void;
  celebrate(state: AppState): void;
  flashOffer(): void;
}

export function createFilmstrip(options: FilmstripOptions): FilmstripController {
  const {
    root, rail, bar, text, note, approveAll, enableBatch,
    onActivate, onApproveAll, onEnableBatch,
  } = options;
  const cells = new Map<string, FilmstripCell>();

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
    root.classList.toggle('is-off', !batch);
    note.hidden = batch;
    enableBatch.hidden = batch;
    text.hidden = !batch;
    approveAll.hidden = !batch;

    if (!batch) {
      for (const cell of cells.values()) cell.el.remove();
      cells.clear();
      bar.style.width = '0%';
      root.classList.remove('is-complete');
      root.hidden = false;
      return;
    }

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

    const done = items.filter((item) => item.approved).length;
    bar.style.width = items.length ? `${(done / items.length) * 100}%` : '0%';
    text.textContent = `${done} / ${items.length} framed`;
    root.classList.toggle('is-complete', items.length > 0 && done === items.length);
    approveAll.disabled = !items.length || done === items.length;
    root.hidden = items.length === 0;
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

  function flashOffer(): void {
    root.classList.remove('just-offered');
    void root.offsetWidth;
    root.classList.add('just-offered');
  }

  approveAll.addEventListener('click', onApproveAll);
  enableBatch.addEventListener('click', onEnableBatch);
  return { sync, scrollToActive, celebrate, flashOffer };
}

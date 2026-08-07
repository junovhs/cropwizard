// The Convert room's panel.
//
// The question this panel answers is "what will I get, and is it worth it?".
// So it states the trade in both directions and does not flatter the result: a
// JPEG converted to PNG gets bigger, and the panel says so in the same voice it
// uses for a saving. A converter that only ever reports good news is one you
// stop believing.

import { FORMATS, DEFAULT_TEMPLATE } from '../export.js';
import { convertAndDownload, convertOne, readableBytes } from '../convert.js';
import { requiredElement, requiredElements } from '../infrastructure/dom.js';
import type { AppState, CropItem, ExportFormat } from '../domain/types.js';

// Long enough that dragging the quality slider does not queue an encode per
// frame, short enough that the estimate feels like it belongs to the control.
const ESTIMATE_DELAY = 220;

export interface ConvertPanelOptions {
  readonly root?: ParentNode;
  readonly getState: () => AppState;
  readonly announce: (message: string) => void;
}

export interface ConvertPanelController {
  sync(): void;
}

const activeOf = (state: AppState): CropItem | null => state.items[state.activeIndex] ?? null;

/** What Convert would write: the queue when there is one, else the picture. */
const convertItems = (state: AppState): readonly CropItem[] => {
  if (state.items.length > 1) return state.items;
  const active = activeOf(state);
  return active ? [active] : [];
};

export function createConvertPanel({
  root = document,
  getState,
  announce,
}: ConvertPanelOptions): ConvertPanelController {
  const $ = <T extends Element = HTMLElement>(selector: string): T => requiredElement<T>(selector, root);
  const $$ = <T extends Element = HTMLElement>(selector: string): T[] => requiredElements<T>(selector, root);

  let format: ExportFormat = 'webp';
  let quality = 0.86;
  let converting = false;
  let estimateTimer: ReturnType<typeof setTimeout> | null = null;
  // Which estimate is the current one. An encode started before the format
  // changed must not be allowed to write its answer over a newer one.
  let estimateToken = 0;

  const button = $<HTMLButtonElement>('#convertGo');
  const buttonLabel = $<HTMLElement>('#convertGoLabel');
  const fill = $<HTMLElement>('#convertFill');
  const sourceLine = $<HTMLElement>('#convertSource');
  const resultLine = $<HTMLElement>('#convertResult');
  const noteLine = $<HTMLElement>('#convertNote');
  const qualityRow = $<HTMLElement>('#convertQualityRow');
  const qualityInput = $<HTMLInputElement>('#convertQuality');
  const qualityValue = $<HTMLElement>('#convertQualityValue');

  function describeSource(): void {
    const items = convertItems(getState());
    const first = items[0];
    if (!first) {
      sourceLine.textContent = 'Nothing loaded.';
      return;
    }
    if (items.length > 1) {
      const bytes = items.reduce((sum, item) => sum + item.file.size, 0);
      sourceLine.textContent = `${items.length} images · ${readableBytes(bytes)}`;
      return;
    }
    const { naturalWidth: w, naturalHeight: h } = first.image;
    const kind = (first.file.type.split('/')[1] ?? 'image').toUpperCase();
    sourceLine.textContent = `${kind} · ${w} × ${h} · ${readableBytes(first.file.size)}`;
  }

  /**
   * Encode the active image once, off the back of a pause, to say what the
   * result will actually weigh. Only ever the first image: the estimate is a
   * sample, and encoding a whole queue to answer a question nobody asked yet is
   * how a panel becomes slower than the job it describes.
   */
  function estimate(): void {
    const token = ++estimateToken;
    const items = convertItems(getState());
    const first = items[0];
    if (!first) {
      resultLine.textContent = '';
      return;
    }

    resultLine.textContent = 'Measuring…';
    void convertOne(first, { format, quality }).then((blob) => {
      if (token !== estimateToken) return;
      const from = first.file.size;
      const to = blob.size;
      const label = FORMATS[format].label;
      const each = items.length > 1 ? ', for the first image' : '';
      if (to < from) {
        const saved = Math.round((1 - to / from) * 100);
        resultLine.textContent = `${label} · ${readableBytes(to)} — ${saved}% smaller${each}`;
        resultLine.classList.remove('is-worse');
      } else {
        const grown = Math.round((to / from - 1) * 100);
        resultLine.textContent = `${label} · ${readableBytes(to)} — ${grown}% bigger${each}`;
        resultLine.classList.add('is-worse');
      }
    }).catch((error: unknown) => {
      if (token !== estimateToken) return;
      resultLine.textContent = error instanceof Error ? error.message : 'Could not encode that format';
      resultLine.classList.add('is-worse');
    });
  }

  function scheduleEstimate(): void {
    if (estimateTimer !== null) clearTimeout(estimateTimer);
    // Retire any encode already in flight here, not when the next one starts.
    // Cancelling the timer only stops an estimate that has not begun; one that
    // is already running would otherwise land, publish an answer for the format
    // you just moved off, and be corrected a fifth of a second later. A number
    // that is briefly wrong is worse than one that is briefly absent.
    estimateToken += 1;
    resultLine.textContent = '';
    estimateTimer = setTimeout(estimate, ESTIMATE_DELAY);
  }

  /**
   * Put the panel back to describing the job. `outcome` is what just happened,
   * and it survives: the note is the only place the result of a conversion is
   * reported, so a refresh triggered by the end of that same conversion must
   * not be what erases it.
   */
  function refresh(outcome?: string): void {
    const items = convertItems(getState());
    button.disabled = !items.length || converting;
    buttonLabel.textContent = converting
      ? 'Converting…'
      : items.length > 1 ? `Convert ${items.length} images` : 'Convert';
    noteLine.textContent = outcome ?? (!items.length
      ? 'Drop an image to convert it.'
      : items.length > 1 ? 'Downloads as one ZIP. Pixels are left exactly as they are.'
      : 'Downloads as a single file. Pixels are left exactly as they are.');
    describeSource();
  }

  function setFormat(next: ExportFormat): void {
    format = next;
    for (const option of $$<HTMLButtonElement>('#convertFormatGroup button')) {
      option.setAttribute('aria-checked', String(option.dataset.format === next));
    }
    qualityRow.hidden = !FORMATS[next].lossy;
    refresh();
    scheduleEstimate();
    announce(`Convert to ${FORMATS[next].label}`);
  }

  for (const option of $$<HTMLButtonElement>('#convertFormatGroup button')) {
    option.addEventListener('click', () => {
      const next = option.dataset.format as ExportFormat | undefined;
      if (next && next in FORMATS && next !== format) setFormat(next);
    });
  }

  qualityInput.addEventListener('input', () => {
    quality = Number(qualityInput.value) / 100;
    qualityValue.textContent = qualityInput.value;
    scheduleEstimate();
  });

  button.addEventListener('click', async () => {
    const items = convertItems(getState());
    if (!items.length || converting) return;
    converting = true;
    button.classList.remove('is-done');
    fill.style.opacity = '1';
    fill.style.width = '0%';
    refresh();
    announce(`Converting ${items.length} image${items.length === 1 ? '' : 's'} to ${FORMATS[format].label}`);

    // What to leave on screen once the panel goes back to rest. Decided here
    // and applied after the reset below, so the reset cannot overwrite it.
    let outcome: string;
    let ok = false;
    try {
      const result = await convertAndDownload(
        items,
        { format, quality, template: DEFAULT_TEMPLATE },
        (progress) => { fill.style.width = `${progress * 100}%`; },
      );
      ok = true;
      const move = result.toBytes <= result.fromBytes ? 'down from' : 'up from';
      outcome = `${readableBytes(result.toBytes)}, ${move} ${readableBytes(result.fromBytes)}.`;
      announce(`${result.count} file${result.count === 1 ? '' : 's'} downloaded as ${result.filename}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      outcome = `Convert failed: ${message}`;
      announce(`Convert failed: ${message}`);
    }

    fill.style.opacity = '0';
    converting = false;
    refresh(outcome);
    if (ok) {
      button.classList.add('is-done');
      buttonLabel.textContent = 'Downloaded';
      setTimeout(() => {
        button.classList.remove('is-done');
        // The size line stays; only the button goes back to offering the job.
        refresh(outcome);
      }, 1_600);
    }
  });

  setFormat(format);

  return {
    sync(): void {
      refresh();
      scheduleEstimate();
    },
  };
}

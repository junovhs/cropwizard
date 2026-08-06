// The size palette: one text box that always lands on the right size.

import { search, ratioLabel } from './search.js';
import { loadSaved, addSaved, renameSaved, removeSaved } from './saved.js';
import { loadPinned, isPinned, togglePinned } from './pinned.js';
import { icon } from './icons.js';
import type { Dimensions, PinnedSize, SavedSize, SizeResult } from './domain/types.js';

const RECENTS_KEY = 'cropwizard.recents';
const MAX_RECENTS = 5;

interface NamingState extends Dimensions {
  /** Set when renaming a size that already has a name. */
  readonly id?: string;
  /** Set when the name is being asked for so the size can be pinned. */
  readonly pin?: boolean;
}

export interface SizePickerOptions {
  readonly root: HTMLElement;
  readonly input: HTMLInputElement;
  readonly list: HTMLElement;
  readonly trigger: HTMLButtonElement;
  readonly getTemplate?: () => Dimensions | null;
  readonly onPick: (result: SizeResult) => void;
  /**
   * Runs before the list appears, whatever opened it. Asking for a size is
   * already a statement about the mode you are in, so a caller can settle that
   * here and keep it to the one click the user actually made.
   */
  readonly onBeforeOpen?: () => void;
  /** Fires whenever a row is pinned or unpinned, so the top bar can redraw. */
  readonly onPinsChange?: (pins: readonly PinnedSize[]) => void;
}

export interface SizePickerController {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

const loadRecents = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
};

const saveRecents = (ids: readonly string[]): void => {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(ids.slice(0, MAX_RECENTS)));
  } catch {
    // Recents are optional when storage is unavailable.
  }
};

function swatch(w: number, h: number): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = 'swatch';
  const long = 22;
  const [sw, sh] = w >= h
    ? [long, Math.max(5, (long * h) / w)]
    : [Math.max(5, (long * w) / h), long];
  el.style.width = `${sw}px`;
  el.style.height = `${sh}px`;
  return el;
}

function inscribe(iw: number, ih: number, ratio: number): Dimensions {
  return iw / ih > ratio
    ? { w: Math.round(ih * ratio), h: ih }
    : { w: iw, h: Math.round(iw / ratio) };
}

// Row actions are glyphs by tradition (☆ ✎ ✕), but a pin is a real icon, so
// the mark can be either a character or a drawn one.
// `pressed` is left out by the actions that simply do a thing, and given by the
// ones that are a state you are turning on and off.
function rowAction(
  label: string,
  mark: string | Node,
  onRun: () => void,
  pressed?: boolean,
): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = pressed ? 'row-action is-on' : 'row-action';
  el.title = label;
  el.setAttribute('aria-label', label);
  if (pressed !== undefined) el.setAttribute('aria-pressed', String(pressed));
  if (typeof mark === 'string') el.textContent = mark;
  else el.append(mark);
  el.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onRun();
  });
  return el;
}

export function createSizePicker(options: SizePickerOptions): SizePickerController {
  const { root, input, list, trigger, getTemplate, onPick, onPinsChange, onBeforeOpen } = options;
  let rows: SizeResult[] = [];
  let cursor = 0;
  let recents = loadRecents();
  let saved: SavedSize[] = loadSaved();
  let pins: PinnedSize[] = loadPinned();
  let template: Dimensions | null = null;
  let naming: NamingState | null = null;

  function beginNaming(next: NamingState, suggestion: string): void {
    naming = next;
    input.value = suggestion;
    input.select();
    input.focus();
    render();
  }

  function commitNaming(): void {
    if (!naming) return;
    // Left blank, the pixels are the name. Asking again for something the row
    // already says out loud would be the app arguing with you.
    const name = input.value.trim() || `${naming.w} × ${naming.h}`;
    if (naming.id) {
      saved = renameSaved(naming.id, name);
    } else {
      // A name given for the top bar is kept as a saved size too. Pins are
      // keyed by pixels, so unpinning would otherwise throw the name away and
      // ask for it again the next time.
      saved = addSaved(name, naming.w, naming.h);
      if (naming.pin) {
        pins = togglePinned(name, naming.w, naming.h);
        onPinsChange?.(pins);
      }
    }
    naming = null;
    input.value = '';
    cursor = 0;
    render();
  }

  function cancelNaming(): void {
    naming = null;
    input.value = '';
    cursor = 0;
    render();
  }

  function renderNaming(): void {
    if (!naming) return;
    const note = document.createElement('p');
    note.className = 'picker-empty';
    note.textContent = naming.id
      ? 'Type a new name, then press Enter. Escape to leave it alone.'
      : `What should ${naming.w} × ${naming.h} be called on the top bar? Press Enter. Escape to cancel.`;
    list.append(note);
  }

  function ratioAnswer(result: SizeResult): SizeResult | null {
    if (!template) return null;
    const { w, h } = inscribe(template.w, template.h, result.w / result.h);
    return {
      kind: 'ratio',
      key: `ratio-${result.w}x${result.h}`,
      name: `${ratioLabel(result.w, result.h)} of this image`,
      detail: 'Its own pixels, cropped to shape',
      w,
      h,
    };
  }

  function appendRatioControl(container: HTMLElement, result: SizeResult): void {
    const answer = ratioAnswer(result);
    if (!answer) {
      const ratio = document.createElement('span');
      ratio.className = 'picker-ratio';
      ratio.textContent = ratioLabel(result.w, result.h);
      container.append(ratio);
      return;
    }

    const ratio = document.createElement('button');
    ratio.type = 'button';
    ratio.className = 'picker-ratio';
    ratio.textContent = ratioLabel(result.w, result.h);
    ratio.tabIndex = -1;
    const say = `Crop this image to ${ratioLabel(result.w, result.h)} — ${answer.w} × ${answer.h}, its own pixels`;
    ratio.title = say;
    ratio.setAttribute('aria-label', say);
    ratio.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      close();
      onPick(answer);
    });
    container.append(ratio);
  }

  function render(): void {
    list.textContent = '';
    if (naming) {
      renderNaming();
      return;
    }

    rows = search(input.value, recents, saved, template);
    if (template && !input.value.trim()) {
      const templateResult: SizeResult = {
        kind: 'template',
        key: 'template',
        name: 'Match this image',
        detail: 'Its own pixel size',
        w: template.w,
        h: template.h,
        section: 'From this image',
      };
      rows = [templateResult, ...rows];
    }
    cursor = Math.min(cursor, Math.max(0, rows.length - 1));

    if (!rows.length) {
      const none = document.createElement('p');
      none.className = 'picker-empty';
      none.textContent = 'No size by that name. Type exact pixels instead — like 1200 x 630.';
      list.append(none);
      return;
    }

    let section: string | null = null;
    rows.forEach((result, index) => {
      if (result.section && result.section !== section) {
        section = result.section;
        const head = document.createElement('div');
        head.className = 'picker-section';
        head.textContent = section;
        list.append(head);
      }

      const row = document.createElement('div');
      row.className = 'picker-row';
      row.id = `picker-row-${index}`;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(index === cursor));
      row.dataset.index = String(index);
      row.append(swatch(result.w, result.h));

      const text = document.createElement('span');
      text.className = 'picker-text';
      const name = document.createElement('strong');
      name.textContent = result.name;
      const detail = document.createElement('span');
      detail.textContent = result.detail;
      text.append(name, detail);

      const dims = document.createElement('span');
      dims.className = 'picker-dims';
      dims.textContent = `${result.w} × ${result.h}`;

      row.append(text);
      appendRatioControl(row, result);
      row.append(dims);

      // Any size can be pinned, because the one you reach for every day is as
      // likely to be a preset or a raw pixel pair as something you saved.
      //
      // Some rows have a name and some only have a description of themselves —
      // "300 × 400", "Match this image". A chip on the top bar has to be called
      // something, so pinning one of those asks what, and that is the only thing
      // that ever asks. There used to be a separate star for saving a size,
      // which was a second act doing most of the same job and left people
      // wondering which one kept it.
      const held = isPinned(pins, result.w, result.h);
      const unnamed = result.kind === 'custom' || result.kind === 'template' || result.kind === 'whole';
      row.append(rowAction(
        held ? 'Unpin from the top bar' : 'Pin to the top bar',
        icon('pin'),
        () => {
          if (!held && unnamed) {
            beginNaming({ w: result.w, h: result.h, pin: true }, '');
            return;
          }
          pins = togglePinned(result.name, result.w, result.h);
          onPinsChange?.(pins);
          render();
        },
        held,
      ));

      if (result.kind === 'saved' && result.savedId) {
        const savedId = result.savedId;
        row.append(
          rowAction('Rename this size', '✎', () => beginNaming({ id: savedId, w: result.w, h: result.h }, result.name)),
          rowAction('Delete this size', '✕', () => {
            saved = removeSaved(savedId);
            render();
          }),
        );
      }

      row.addEventListener('mousedown', (event) => {
        event.preventDefault();
        choose(index);
      });
      row.addEventListener('mousemove', () => setCursor(index));
      list.append(row);
    });
    scrollToCursor();
  }

  function setCursor(next: number): void {
    if (next === cursor) return;
    cursor = next;
    for (const row of list.querySelectorAll<HTMLElement>('.picker-row')) {
      row.setAttribute('aria-selected', String(Number(row.dataset.index) === cursor));
    }
    input.setAttribute('aria-activedescendant', `picker-row-${cursor}`);
  }

  function scrollToCursor(): void {
    list.querySelector<HTMLElement>(`#picker-row-${cursor}`)?.scrollIntoView({ block: 'nearest' });
  }

  function move(delta: number): void {
    if (!rows.length) return;
    setCursor((cursor + delta + rows.length) % rows.length);
    scrollToCursor();
  }

  function choose(index = cursor, shape = false): void {
    const row = rows[index];
    if (!row) return;
    const result = shape ? ratioAnswer(row) ?? row : row;
    if (result.id) {
      recents = [result.id, ...recents.filter((id) => id !== result.id)].slice(0, MAX_RECENTS);
      saveRecents(recents);
    }
    close();
    onPick(result);
  }

  function open(): void {
    onBeforeOpen?.();
    root.hidden = false;
    naming = null;
    saved = loadSaved();
    pins = loadPinned();
    template = getTemplate?.() ?? null;
    const shapeHint = root.querySelector<HTMLElement>('#shapeHint');
    if (shapeHint) shapeHint.hidden = !template;
    // On a touch screen, focusing the field throws up the keyboard and takes
    // half the list with it — before anyone has had a chance to look at what is
    // on offer. Typing is one tap away; seeing the list should not be.
    if (!matchMedia('(pointer: coarse)').matches) {
      input.select();
      input.focus();
    }
    cursor = 0;
    render();
    requestAnimationFrame(() => root.classList.add('open'));
  }

  function close(): void {
    naming = null;
    root.classList.remove('open');
    root.hidden = true;
    trigger.focus();
  }

  input.addEventListener('input', () => {
    if (!naming) {
      cursor = 0;
      render();
    }
  });

  input.addEventListener('keydown', (event) => {
    if (naming) {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitNaming();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelNaming();
      }
      return;
    }

    const keys: Readonly<Record<string, () => void>> = {
      ArrowDown: () => move(1),
      ArrowUp: () => move(-1),
      Enter: () => choose(cursor, event.shiftKey),
      Escape: close,
      Tab: close,
    };
    const action = keys[event.key];
    if (!action) return;
    if (event.key !== 'Tab') event.preventDefault();
    action();
  });

  root.addEventListener('mousedown', (event) => {
    if (event.target === root) close();
  });
  trigger.addEventListener('click', open);

  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (root.hidden) open();
      else close();
    }
  });

  return { open, close, isOpen: () => !root.hidden };
}

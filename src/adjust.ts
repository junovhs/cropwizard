// Image-adjustment domain and presentation adapter.

import type { Adjustment, AdjustmentKey } from './domain/types.js';
import { canvasContext } from './infrastructure/dom.js';
import { icon } from './icons.js';

export interface AdjustmentChannel {
  readonly key: AdjustmentKey;
  readonly label: string;
  readonly fn: 'brightness' | 'contrast' | 'saturate';
}

export const CHANNELS: readonly AdjustmentChannel[] = [
  { key: 'exposure', label: 'Exposure', fn: 'brightness' },
  { key: 'contrast', label: 'Contrast', fn: 'contrast' },
  { key: 'saturation', label: 'Saturation', fn: 'saturate' },
];

export const NEUTRAL: Readonly<Adjustment> = Object.freeze({
  exposure: 0,
  contrast: 0,
  saturation: 0,
});

export const neutral = (): Adjustment => ({ ...NEUTRAL });

export const isNeutral = (adjustment: Adjustment | null | undefined): boolean =>
  !adjustment || CHANNELS.every((channel) => !adjustment[channel.key]);

export function filterFor(adjustment: Adjustment | null | undefined): string {
  if (isNeutral(adjustment)) return 'none';
  return CHANNELS
    .map((channel) => `${channel.fn}(${(1 + (adjustment?.[channel.key] ?? 0) / 100).toFixed(3)})`)
    .join(' ');
}

/**
 * Whether this browser can actually apply a filter to a canvas.
 *
 * Asking the property was not a test. A 2D context is an ordinary object as far
 * as assignment is concerned, so on a browser with no filter support `ctx.filter
 * = 'saturate(2)'` quietly *creates* the property and reading it back returns
 * exactly what was written — the check passed everywhere, and the sliders were
 * left enabled on devices that would ignore them. Which is what shipped: three
 * controls that moved and changed nothing, with the note explaining why sitting
 * hidden behind a test that could not fail.
 *
 * So paint a pixel and look at it. Black through `invert(1)` is white, or the
 * filter did nothing and it is still black. There is no arguing with the pixel.
 */
export const CAN_FILTER = (() => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvasContext(canvas, { willReadFrequently: true });
    if (!('filter' in context)) return false;
    context.filter = 'invert(1)';
    context.fillStyle = '#000000';
    context.fillRect(0, 0, 1, 1);
    const [red] = context.getImageData(0, 0, 1, 1).data;
    return (red ?? 0) > 200;
  } catch {
    return false;
  }
})();

interface AdjustPanelOptions {
  readonly rows: HTMLElement;
  readonly reset: HTMLButtonElement;
  readonly note: HTMLElement;
  readonly onChange: (adjustment: Adjustment) => void;
  readonly onAnnounce?: (message: string) => void;
}

interface ChannelControls {
  readonly input: HTMLInputElement;
  readonly zero: HTMLButtonElement;
}

export interface AdjustPanel {
  load(adjustment: Adjustment | null | undefined): Adjustment;
  readonly enabled: boolean;
}

export function createAdjustPanel({
  rows,
  reset,
  note,
  onChange,
  onAnnounce,
}: AdjustPanelOptions): AdjustPanel {
  let value = neutral();
  const controls = new Map<AdjustmentKey, ChannelControls>();

  // Which channel the narrow layout is showing. Three sliders will not fit
  // across a phone without becoming three things you cannot aim at, so the row
  // holds either the list of what you can change or the one you are changing —
  // never both, and never a different number of rows than a moment ago.
  const picker = document.createElement('div');
  picker.className = 'adjust-picker';
  rows.before(picker);
  const pickerButton = (key: AdjustmentKey): HTMLButtonElement | null =>
    picker.querySelector<HTMLButtonElement>(`.adjust-pick[data-channel="${key}"]`);

  function show(next: AdjustmentKey | null): void {
    rows.dataset.picked = next ?? '';
    picker.dataset.picked = next ?? '';
    for (const channel of CHANNELS) {
      const row = rows.querySelector<HTMLElement>(`[data-channel="${channel.key}"]`);
      if (row) row.dataset.active = String(channel.key === next);
    }
  }

  for (const channel of CHANNELS) {
    const row = document.createElement('div');
    row.className = 'adjust-row';
    row.dataset.channel = channel.key;

    const id = `adj-${channel.key}`;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = channel.label;

    // The way back to the list. Invisible on a wide screen, where all three
    // sliders are on show and there is nothing to go back from.
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'adjust-back';
    back.title = 'Back to the list';
    back.setAttribute('aria-label', 'Back to the list');
    back.append(icon('chevron-left'));
    back.addEventListener('click', () => {
      show(null);
      pickerButton(channel.key)?.focus();
    });

    // ...and the way in. One per channel, sitting in the row above.
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'adjust-pick';
    open.dataset.channel = channel.key;
    open.textContent = channel.label;
    open.addEventListener('click', () => {
      show(channel.key);
      controls.get(channel.key)?.input.focus();
    });
    picker.append(open);

    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = '-100';
    input.max = '100';
    input.step = '1';
    input.value = '0';

    const zero = document.createElement('button');
    zero.type = 'button';
    zero.className = 'adjust-value';
    zero.textContent = '0';
    zero.title = `Reset ${channel.label.toLowerCase()}`;
    zero.setAttribute('aria-label', `Reset ${channel.label.toLowerCase()}`);
    zero.disabled = true;

    input.addEventListener('input', () => commit(channel.key, Number(input.value)));
    zero.addEventListener('click', () => {
      commit(channel.key, 0);
      onAnnounce?.(`${channel.label} reset`);
      input.focus();
    });

    row.append(back, label, input, zero);
    rows.append(row);
    controls.set(channel.key, { input, zero });
  }

  // The reset lives with the channel list rather than in a heading of its own,
  // and it is disabled rather than hidden when there is nothing to undo: a
  // control that appears the instant you touch a slider moves everything else
  // down while your finger is still on it.
  picker.append(reset);
  show(null);

  reset.addEventListener('click', () => {
    value = neutral();
    paint();
    onChange(value);
    onAnnounce?.('Adjustments reset');
  });

  function commit(key: AdjustmentKey, next: number): void {
    value = { ...value, [key]: next };
    paint();
    onChange(value);
  }

  function paint(): void {
    for (const channel of CHANNELS) {
      const control = controls.get(channel.key);
      if (!control) continue;
      const current = value[channel.key];
      if (Number(control.input.value) !== current) control.input.value = String(current);
      control.zero.textContent = current > 0 ? `+${current}` : String(current);
      control.zero.disabled = current === 0;
      const pick = pickerButton(channel.key);
      // The list says which channels have been touched, so you can see what you
      // have done without opening each one.
      if (pick) pick.dataset.touched = String(current !== 0);
    }
    // Disabled, never hidden: appearing the moment a slider moves would push
    // the panel taller with a finger still on the control.
    reset.disabled = isNeutral(value);
  }

  if (!CAN_FILTER) {
    note.hidden = false;
    for (const control of controls.values()) {
      control.input.disabled = true;
      control.zero.disabled = true;
    }
  }

  return {
    load(adjustment): Adjustment {
      value = { ...neutral(), ...(adjustment ?? {}) };
      paint();
      return value;
    },
    enabled: CAN_FILTER,
  };
}

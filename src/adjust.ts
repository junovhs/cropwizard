// Image-adjustment domain and presentation adapter.

import type { Adjustment, AdjustmentKey } from './domain/types.js';
import { canvasContext } from './infrastructure/dom.js';

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

export const CAN_FILTER = (() => {
  try {
    const canvas = document.createElement('canvas');
    const context = canvasContext(canvas);
    context.filter = 'saturate(2)';
    return context.filter !== 'none';
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

  for (const channel of CHANNELS) {
    const row = document.createElement('div');
    row.className = 'adjust-row';

    const id = `adj-${channel.key}`;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = channel.label;

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

    row.append(label, input, zero);
    rows.append(row);
    controls.set(channel.key, { input, zero });
  }

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
    }
    reset.hidden = isNeutral(value);
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

import {
  DEFAULT_TEMPLATE,
  FORMATS,
  expandName,
  exportAll,
  scaledTarget,
} from '../export.js';
import { exportItems } from '../application/freeform.js';
import { requiredElement, requiredElements } from '../infrastructure/dom.js';
import type {
  AppState,
  ExportFormat,
  ExportOptions,
  ExportScale,
  Framing,
} from '../domain/types.js';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type ExportSettings = Mutable<Omit<ExportOptions, 'label'>>;
type NamingKey = 'keep' | 'size' | 'number';

export interface ExportPanelOptions {
  readonly root?: ParentNode;
  readonly getState: () => AppState;
  readonly getFraming: () => Framing | null;
  readonly announce: (message: string) => void;
  readonly onScaleChange?: (framing: Framing | null) => void;
}

export interface ExportPanelController {
  sync(): void;
  getScale(): ExportScale;
}

export function createExportPanel({
  root = document,
  getState,
  getFraming,
  announce,
  onScaleChange,
}: ExportPanelOptions): ExportPanelController {
  const $ = <T extends Element = HTMLElement>(selector: string): T => requiredElement<T>(selector, root);
  const $$ = <T extends Element = HTMLElement>(selector: string): T[] => requiredElements<T>(selector, root);

  const options: ExportSettings = {
    format: 'png',
    quality: 0.86,
    template: DEFAULT_TEMPLATE,
    scale: 1,
  };
  const naming: Record<NamingKey, boolean> = { keep: true, size: true, number: false };
  let customTemplate: string | null = null;
  let exporting = false;

  const exportButton = $<HTMLButtonElement>('#export');
  const exportFill = $<HTMLElement>('#exportFill');
  const exportLabel = $<HTMLElement>('#exportLabel');
  const exportNote = $<HTMLElement>('#exportNote');
  const templateInput = $<HTMLInputElement>('#template');
  const qualityInput = $<HTMLInputElement>('#qualityInput');

  function composeTemplate(): string {
    const parts: string[] = [];
    if (naming.keep) parts.push('{name}');
    if (naming.size) parts.push('{w}x{h}');
    if (naming.number) parts.push('{n}');
    return parts.join('-') || '{n}';
  }

  function refreshExport(): void {
    const state = getState();
    const { target, activeIndex } = state;
    // Freeform describes one rectangle of one image, so that is what would be
    // written even when a queue is still loaded behind it.
    const items = exportItems(state);
    const count = items.length;
    exportButton.disabled = !count || exporting;
    exportLabel.textContent = exporting
      ? 'Exporting…'
      : count > 1 ? `Export ${count} images` : 'Export';

    const sample = items[Math.max(0, activeIndex)] ?? items[0];
    const out = scaledTarget(target, options.scale);
    $<HTMLElement>('#namePreview').textContent = expandName(options.template, {
      name: sample?.name ?? 'photo',
      index: 0,
      total: Math.max(count, 1),
      w: out.w,
      h: out.h,
      ext: FORMATS[options.format].ext,
      label: target.label,
    });

    const pending = items.filter((item) => !item.approved).length;
    exportNote.textContent = !count
      ? 'Nothing to export yet.'
      : count === 1 ? 'Downloads as a single image.'
      : pending ? `Downloads as one ZIP. ${pending} still using the suggested crop.`
      : 'Downloads as one ZIP.';
  }

  function syncScale(): void {
    const { target } = getState();
    const out = scaledTarget(target, options.scale);
    for (const button of $$<HTMLButtonElement>('#scaleGroup button')) {
      button.setAttribute('aria-checked', String(Number(button.dataset.scale ?? 0) === options.scale));
    }

    const framing = getFraming();
    const stretched = framing
      && (framing.cropW < out.w - 0.5 || framing.cropH < out.h - 0.5);
    const scaleNote = $<HTMLElement>('#scaleNote');
    scaleNote.classList.toggle('is-stretched', Boolean(stretched));
    scaleNote.textContent = stretched
      ? `${out.w} × ${out.h} — bigger than the crop holds, so it will soften.`
      : `Writes ${out.w} × ${out.h}.`;

    onScaleChange?.(framing);
    refreshExport();
  }

  function syncNaming(): void {
    options.template = customTemplate ?? composeTemplate();
    if (!customTemplate && document.activeElement !== templateInput) {
      templateInput.value = options.template;
    }
    $<HTMLElement>('#naming').classList.toggle('is-overridden', Boolean(customTemplate));
    $<HTMLElement>('#namingOverride').hidden = !customTemplate;
    refreshExport();
  }

  function setFormat(format: ExportFormat): void {
    options.format = format;
    for (const button of $$<HTMLButtonElement>('#formatGroup button')) {
      button.setAttribute('aria-checked', String(button.dataset.format === format));
    }
    $<HTMLElement>('#qualityRow').hidden = !FORMATS[format].lossy;
    refreshExport();
  }

  function setScale(scale: ExportScale): void {
    if (scale === options.scale) return;
    options.scale = scale;
    syncScale();
    const { w, h } = scaledTarget(getState().target, scale);
    announce(`${scale} times. Exports at ${w} by ${h} pixels`);
  }

  for (const button of $$<HTMLButtonElement>('#formatGroup button')) {
    button.addEventListener('click', () => {
      const format = button.dataset.format as ExportFormat | undefined;
      if (format && format in FORMATS) setFormat(format);
    });
  }

  for (const button of $$<HTMLButtonElement>('#scaleGroup button')) {
    button.addEventListener('click', () => {
      const scale = Number(button.dataset.scale);
      if (scale === 1 || scale === 2 || scale === 4) setScale(scale);
    });
  }

  qualityInput.addEventListener('input', () => {
    options.quality = Number(qualityInput.value) / 100;
    $<HTMLElement>('#qualityValue').textContent = qualityInput.value;
  });

  const namingControls: readonly (readonly [string, NamingKey])[] = [
    ['#nameKeep', 'keep'],
    ['#nameSize', 'size'],
    ['#nameNumber', 'number'],
  ];
  for (const [selector, key] of namingControls) {
    const input = $<HTMLInputElement>(selector);
    input.addEventListener('change', () => {
      naming[key] = input.checked;
      customTemplate = null;
      syncNaming();
    });
  }

  templateInput.addEventListener('input', () => {
    customTemplate = templateInput.value || null;
    options.template = customTemplate || DEFAULT_TEMPLATE;
    syncNaming();
  });

  exportButton.addEventListener('click', async () => {
    const state = getState();
    const { target } = state;
    const items = exportItems(state);
    if (!items.length || exporting) return;
    exporting = true;
    exportButton.classList.remove('is-done');
    exportFill.style.opacity = '1';
    exportFill.style.width = '0%';
    refreshExport();
    announce(`Exporting ${items.length} image${items.length === 1 ? '' : 's'}`);

    try {
      const result = await exportAll(
        items,
        target,
        { ...options, label: target.label },
        (progress) => { exportFill.style.width = `${progress * 100}%`; },
      );
      exportButton.classList.add('is-done');
      exportLabel.textContent = 'Downloaded';
      announce(`${result.count} image${result.count === 1 ? '' : 's'} downloaded as ${result.filename}`);
      setTimeout(() => {
        exportButton.classList.remove('is-done');
        refreshExport();
      }, 1_600);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      announce(`Export failed: ${message}`);
      exportNote.textContent = `Export failed: ${message}`;
    } finally {
      exportFill.style.opacity = '0';
      exporting = false;
      refreshExport();
    }
  });

  syncNaming();
  syncScale();

  return {
    sync(): void {
      syncScale();
    },
    getScale: () => options.scale,
  };
}

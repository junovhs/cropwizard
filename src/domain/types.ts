export interface Dimensions {
  readonly w: number;
  readonly h: number;
}

export interface OutputTarget extends Dimensions {
  readonly label: string;
}

export interface Framing {
  readonly cx: number;
  readonly cy: number;
  readonly cropW: number;
  readonly cropH: number;
}

export type AdjustmentKey = 'exposure' | 'contrast' | 'saturation';
export type Adjustment = Record<AdjustmentKey, number>;

export interface CropItem {
  readonly id: string;
  readonly file: File;
  readonly image: HTMLImageElement;
  readonly name: string;
  readonly frame: Framing | null;
  readonly adjust: Adjustment;
  readonly approved: boolean;
  readonly auto: boolean;
  readonly framedFor: string | null;
}

export interface AppState {
  readonly target: OutputTarget;
  readonly items: readonly CropItem[];
  readonly activeIndex: number;
  readonly batch: boolean;
}

export interface SavedSize extends Dimensions {
  readonly id: string;
  readonly name: string;
}

/** A size kept on the top bar. Identified by its pixels, not by its name. */
export interface PinnedSize extends Dimensions {
  readonly id: string;
  readonly name: string;
}

export interface Preset extends Dimensions {
  readonly id: string;
  readonly group: string;
  readonly name: string;
  readonly hot?: true;
  readonly keywords: readonly string[];
}

export type SizeResultKind = 'preset' | 'saved' | 'custom' | 'ratio' | 'template' | 'whole';

export interface SizeResult extends Dimensions {
  readonly kind: SizeResultKind;
  readonly key: string;
  readonly name: string;
  readonly detail: string;
  readonly section?: string;
  readonly id?: string;
  readonly savedId?: string;
}

export type ExportFormat = 'png' | 'jpeg' | 'webp';
export type ExportScale = 1 | 2 | 4;

export interface ExportOptions {
  readonly format: ExportFormat;
  readonly quality: number;
  readonly template: string;
  readonly label: string;
  readonly scale: ExportScale;
}

export interface FilenameContext extends Dimensions {
  readonly name: string;
  readonly index: number;
  readonly total: number;
  readonly ext: string;
  readonly label?: string;
}

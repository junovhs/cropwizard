// The zoom slider's scale.
//
// Zoom is stated against the scale at which the picture exactly covers the
// frame, which is also the floor: 100% is "the whole picture, nothing wasted",
// and every larger number is how far in you have gone. The control is
// logarithmic, so a step is the same proportion of wherever you already are —
// as fine at 700% as at 101% — and there are no jumps anywhere along it.

export interface ZoomRange {
  readonly min: number;
  readonly max: number;
}

export const zoomFromTick = (tick: number, ticks: number, { min, max }: ZoomRange): number =>
  min * Math.exp(Math.log(max / min) * (tick / ticks));

export const tickFromZoom = (zoom: number, ticks: number, { min, max }: ZoomRange): number =>
  Math.round((Math.log(zoom / min) / Math.log(max / min)) * ticks);

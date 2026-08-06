// The zoom slider's scale.
//
// Zoom is stated against the scale at which the picture exactly covers the
// frame: 100% is "the whole picture, nothing wasted", above it you are pushing
// in, below it the picture sits inside the frame with room around it. The
// control is logarithmic, so a step is the same proportion of wherever you
// already are — as fine at 700% as at 12% — and 100% falls at a fixed place on
// the track rather than at one end of it.

export interface ZoomRange {
  readonly min: number;
  readonly max: number;
}

export const zoomFromTick = (tick: number, ticks: number, { min, max }: ZoomRange): number =>
  min * Math.exp(Math.log(max / min) * (tick / ticks));

export const tickFromZoom = (zoom: number, ticks: number, { min, max }: ZoomRange): number =>
  Math.round((Math.log(zoom / min) / Math.log(max / min)) * ticks);

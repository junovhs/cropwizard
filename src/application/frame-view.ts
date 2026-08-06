// How large the frame is drawn — and only that.
//
// Every view here shows the same crop of the same picture at the same zoom.
// What changes is how much of the screen the output rectangle takes up while
// you decide, which is a question about looking, never about the file. Keeping
// that separate is the whole point: the moment a view could change what gets
// exported, it stops being a view.

/**
 * `true` is the output at its real pixel size (DEC-03), capped when the stage is
 * too small to honour it. `fit` fills the stage, for close work. `small` steps
 * back, for judging a composition you cannot see the shape of with your nose
 * against it.
 */
export type FrameView = 'true' | 'fit' | 'small';

/** Half of what you would otherwise be shown. */
const SMALL_VIEW = 0.5;
/**
 * ...but never below this on the long side. Half of a 1200px frame is still
 * plenty to work with; half of a 90px one is a stamp with corners you cannot
 * hit, and a control you cannot grab is not a view.
 */
const SMALL_FLOOR_PX = 140;

export interface FrameFit {
  /** How much of true size the frame is actually drawn at. */
  readonly scale: number;
  /** Whether leaning in would show anything the current view does not. */
  readonly enlargeable: boolean;
  /** Whether standing back would. */
  readonly shrinkable: boolean;
}

/**
 * @param view      which of the three the user asked for
 * @param fits      the scale at which the output rectangle fills the stage
 * @param longest   the output's long side in pixels, for the shrink floor
 */
export function frameFit(view: FrameView, fits: number, longest: number): FrameFit {
  // True size, or as close to it as the stage allows. Both departures are
  // measured from here, so the middle option is the one that is always honest.
  const real = Math.min(1, fits);
  const floor = Math.min(real, SMALL_FLOOR_PX / Math.max(1, longest));
  const small = Math.max(real * SMALL_VIEW, floor);
  return {
    scale: view === 'fit' ? fits : view === 'small' ? small : real,
    enlargeable: fits > 1.005,
    // Where even the floor is no smaller than true size there is nothing to
    // offer, and an option that shows you the same picture is not an option.
    shrinkable: small < real * 0.995,
  };
}

import { autoFrame, refit } from '../autoframe.js';
import type { CropItem, Framing, OutputTarget } from '../domain/types.js';

export const targetKey = (target: OutputTarget): string => `${target.w}x${target.h}`;

export const wholeFrame = (item: CropItem): Framing => ({
  cx: item.image.naturalWidth / 2,
  cy: item.image.naturalHeight / 2,
  cropW: item.image.naturalWidth,
  cropH: item.image.naturalHeight,
});

export function suggestFrame(item: CropItem, target: OutputTarget): CropItem {
  return {
    ...item,
    frame: autoFrame(item.image, target.w / target.h),
    framedFor: targetKey(target),
    auto: true,
  };
}

export function fitFrameToTarget(item: CropItem, target: OutputTarget): CropItem {
  if (item.framedFor === targetKey(target)) return item;
  if (item.auto) return suggestFrame(item, target);
  return {
    ...item,
    frame: refit(item.image, item.frame, target.w / target.h),
    framedFor: targetKey(target),
  };
}

export function acceptFrame(item: CropItem): CropItem {
  return item.approved && !item.auto
    ? item
    : { ...item, approved: true, auto: false };
}

export function useWholeImage(item: CropItem, target: OutputTarget): CropItem {
  return {
    ...item,
    frame: wholeFrame(item),
    auto: false,
    framedFor: targetKey(target),
  };
}

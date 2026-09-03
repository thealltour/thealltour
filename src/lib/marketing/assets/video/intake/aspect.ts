export const AI_VIDEO_TARGET_ASPECT_WIDTH = 9;
export const AI_VIDEO_TARGET_ASPECT_HEIGHT = 16;
/** Maximum relative error versus 9:16, as a percent. 1080×1920 and 720×1280 are exact. */
export const AI_VIDEO_ASPECT_RATIO_MAX_RELATIVE_ERROR_PERCENT = 3;

export function isPortraitNearNineSixteen(width: number, height: number): boolean {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return false;
  }
  if (height <= width) return false;
  const numerator = Math.abs(AI_VIDEO_TARGET_ASPECT_HEIGHT * width - AI_VIDEO_TARGET_ASPECT_WIDTH * height);
  const denominator = AI_VIDEO_TARGET_ASPECT_WIDTH * height;
  return numerator * 100 <= AI_VIDEO_ASPECT_RATIO_MAX_RELATIVE_ERROR_PERCENT * denominator;
}

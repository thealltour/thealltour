export const MONTH_SWIPE_THRESHOLD_PX = 48;
export const MONTH_SWIPE_AXIS_RATIO = 1.25;
export const MONTH_SWIPE_COOLDOWN_MS = 350;

export function addCalendarMonths(base: Date, deltaMonths: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), 1);
  d.setMonth(d.getMonth() + deltaMonths);
  return d;
}

/** dx < 0 (swipe left) → next month (+1). dx > 0 → previous month (-1). */
export function resolveMonthSwipeDelta(dx: number, dy: number): -1 | 0 | 1 {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < MONTH_SWIPE_THRESHOLD_PX) return 0;
  if (absX < absY * MONTH_SWIPE_AXIS_RATIO) return 0;
  return dx < 0 ? 1 : -1;
}

export function isMonthSwipeInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'button, a, input, select, textarea, [role="button"], [contenteditable="true"]',
    ),
  );
}

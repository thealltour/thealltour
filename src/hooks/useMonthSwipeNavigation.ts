"use client";

import { useCallback, useRef, type PointerEventHandler } from "react";
import {
  MONTH_SWIPE_COOLDOWN_MS,
  addCalendarMonths,
  isMonthSwipeInteractiveTarget,
  resolveMonthSwipeDelta,
} from "@/lib/calendar/monthSwipeGesture";

type UseMonthSwipeNavigationOptions = {
  month: Date | undefined;
  onMonthChange: ((month: Date) => void) | undefined;
  enabled?: boolean;
};

type PointerPoint = { x: number; y: number; pointerId: number };

export function useMonthSwipeNavigation({
  month,
  onMonthChange,
  enabled = true,
}: UseMonthSwipeNavigationOptions) {
  const startRef = useRef<PointerPoint | null>(null);
  const lastSwipeAtRef = useRef(0);

  const onPointerDown: PointerEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      if (!enabled || !month || !onMonthChange) return;
      if (event.button !== 0) return;
      if (isMonthSwipeInteractiveTarget(event.target)) return;

      startRef.current = {
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [enabled, month, onMonthChange],
  );

  const finishSwipe = useCallback(
    (clientX: number, clientY: number) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start || !month || !onMonthChange) return;

      const dx = clientX - start.x;
      const dy = clientY - start.y;
      const deltaMonths = resolveMonthSwipeDelta(dx, dy);
      if (deltaMonths === 0) return;

      const now = Date.now();
      if (now - lastSwipeAtRef.current < MONTH_SWIPE_COOLDOWN_MS) return;
      lastSwipeAtRef.current = now;

      onMonthChange(addCalendarMonths(month, deltaMonths));
    },
    [month, onMonthChange],
  );

  const onPointerUp: PointerEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      if (startRef.current?.pointerId !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      finishSwipe(event.clientX, event.clientY);
    },
    [finishSwipe],
  );

  const onPointerCancel: PointerEventHandler<HTMLDivElement> = useCallback((event) => {
    if (startRef.current?.pointerId !== event.pointerId) return;
    startRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const swipeActive = Boolean(enabled && month && onMonthChange);

  return {
    swipeActive,
    swipeHandlers: {
      onPointerDown,
      onPointerUp,
      onPointerCancel,
    },
  };
}

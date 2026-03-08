/**
 * PR27: 리뷰 전환 분석용 이벤트 선택자.
 */
import type { ReviewInteractionEvent } from "@/types/reviewConversionAnalytics";
import { CONVERSION_EVENT_TYPES } from "./reviewConversionConstants";

const CONVERSION_SET = new Set<string>(CONVERSION_EVENT_TYPES);

export function getReviewInteractionEvents(
  events: ReviewInteractionEvent[],
): ReviewInteractionEvent[] {
  return events.filter((e) => !CONVERSION_SET.has(e.eventType));
}

export function getConversionEvents(
  events: ReviewInteractionEvent[],
): ReviewInteractionEvent[] {
  return events.filter((e) => CONVERSION_SET.has(e.eventType));
}

export function getEventsByProduct(
  events: ReviewInteractionEvent[],
  productId: string,
): ReviewInteractionEvent[] {
  return events.filter((e) => e.productId === productId);
}

export function getEventsByVariant(
  events: ReviewInteractionEvent[],
  experimentKey: string,
  variant: string,
): ReviewInteractionEvent[] {
  return events.filter(
    (e) =>
      (e.experimentKey === experimentKey || !e.experimentKey) &&
      e.variant === variant,
  );
}

export function getEventsByReviewId(
  events: ReviewInteractionEvent[],
  reviewId: string,
): ReviewInteractionEvent[] {
  return events.filter((e) => e.reviewId === reviewId);
}

export function getEventsWithAttributionKey(
  events: ReviewInteractionEvent[],
): ReviewInteractionEvent[] {
  return events.filter(
    (e) => typeof e.sessionKey === "string" && e.sessionKey.length > 0,
  );
}

/**
 * PortOne return page presentation analytics (PR-UI-10A).
 * Payment Core / completePortOnePaymentClient 0 diff.
 */

import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

export type PaymentReturnFailReason = "missing_payment_id" | "complete_failed";

export function trackPaymentReturnView(): void {
  try {
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.payment_return_view,
        source: ANALYTICS_SOURCES.payment_return,
        pagePath:
          typeof window !== "undefined" ? window.location.pathname : "/payments/portone/return",
        section: "payment_return",
        metadata: { status: "checking" },
      }),
    );
  } catch {
    // no-op
  }
}

export function trackPaymentReturnFailed(params: {
  reason: PaymentReturnFailReason;
  hasPaymentId: boolean;
}): void {
  try {
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.payment_return_failed,
        source: ANALYTICS_SOURCES.payment_return,
        pagePath:
          typeof window !== "undefined" ? window.location.pathname : "/payments/portone/return",
        section: "payment_return",
        metadata: {
          status: "failed",
          reason: params.reason,
          has_payment_id: params.hasPaymentId,
        },
      }),
    );
  } catch {
    // no-op
  }
}

/**
 * Checkout Modal / Order Success presentation funnel (PR-UI-07).
 * Payment core에 영향 없이 fire-and-forget.
 */

import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

function getPagePath(pagePath?: string): string | null {
  if (typeof pagePath === "string" && pagePath.trim()) return pagePath.trim();
  if (typeof window !== "undefined") return window.location.pathname;
  return null;
}

export type TrackCheckoutOpenParams = {
  productId: string;
  travelerCount?: number | null;
  pagePath?: string;
};

export function trackCheckoutOpen(params: TrackCheckoutOpenParams): void {
  try {
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.checkout_open,
        source: ANALYTICS_SOURCES.consult_cta,
        pagePath: getPagePath(params.pagePath),
        productId: params.productId?.trim() || null,
        section: "checkout_modal",
        metadata: {
          traveler_count: params.travelerCount ?? null,
        },
      }),
    );
  } catch {
    // no-op
  }
}

export type TrackCheckoutSubmitParams = {
  productId: string;
  travelerCount?: number | null;
  pagePath?: string;
};

export function trackCheckoutSubmit(params: TrackCheckoutSubmitParams): void {
  try {
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.checkout_submit,
        source: ANALYTICS_SOURCES.consult_cta,
        pagePath: getPagePath(params.pagePath),
        productId: params.productId?.trim() || null,
        section: "checkout_modal",
        metadata: {
          traveler_count: params.travelerCount ?? null,
        },
      }),
    );
  } catch {
    // no-op
  }
}

export type TrackCheckoutPaymentResultParams = {
  productId: string;
  result: "success" | "fail";
  travelerCount?: number | null;
  pagePath?: string;
};

export function trackCheckoutPaymentResult(params: TrackCheckoutPaymentResultParams): void {
  try {
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.checkout_payment_result,
        source: ANALYTICS_SOURCES.consult_cta,
        pagePath: getPagePath(params.pagePath),
        productId: params.productId?.trim() || null,
        section: "checkout_modal",
        label: params.result,
        metadata: {
          result: params.result,
          traveler_count: params.travelerCount ?? null,
        },
      }),
    );
  } catch {
    // no-op
  }
}

export type TrackOrderSuccessViewParams = {
  hasBookingNumber: boolean;
  isMember: boolean;
  pagePath?: string;
};

export function trackOrderSuccessView(params: TrackOrderSuccessViewParams): void {
  try {
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.order_success_view,
        source: ANALYTICS_SOURCES.consult_cta,
        pagePath: getPagePath(params.pagePath) ?? "/order/success",
        section: "order_success",
        metadata: {
          has_booking_number: params.hasBookingNumber,
          is_member: params.isMember,
        },
      }),
    );
  } catch {
    // no-op
  }
}

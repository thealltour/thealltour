/**
 * 문의(quote) 페이지 계측: page_view, submit_click, submit_success.
 */

import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

function getPagePath(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.pathname || null;
}

export function trackQuotePageView(productId?: string | null): void {
  try {
    const pagePath = getPagePath();
    const deviceType = inferDeviceType(undefined, typeof window !== "undefined" ? window.innerWidth : undefined);
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.quote_page_view,
        source: ANALYTICS_SOURCES.quote_page,
        pagePath,
        productId: productId?.trim() || null,
        deviceType,
        metadata: productId ? { productId } : undefined,
      }),
    );
  } catch {
    // no-op
  }
}

export function trackQuoteSubmitClick(productId?: string | null): void {
  try {
    const pagePath = getPagePath();
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.quote_submit_click,
        source: ANALYTICS_SOURCES.quote_page,
        pagePath,
        productId: productId?.trim() || null,
        metadata: productId ? { productId } : undefined,
      }),
    );
  } catch {
    // no-op
  }
}

export function trackQuoteSubmitSuccess(productId?: string | null): void {
  try {
    const pagePath = getPagePath();
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.quote_submit_success,
        source: ANALYTICS_SOURCES.quote_page,
        pagePath,
        productId: productId?.trim() || null,
        metadata: productId ? { productId } : undefined,
      }),
    );
  } catch {
    // no-op
  }
}

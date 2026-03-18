/**
 * 글로벌 빠른 상담 모달 계측: consult_open, consult_submit.
 */

import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

function getPagePath(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.pathname || null;
}

export type ConsultModalTrackParams = {
  productId?: string | null;
  productTitle?: string | null;
  sourcePath?: string | null;
};

export function trackConsultOpen(params?: ConsultModalTrackParams | null): void {
  try {
    const pagePath = getPagePath();
    const productId = params?.productId?.trim() || null;
    const sourcePath = params?.sourcePath?.trim() || null;
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.consult_open,
        source: ANALYTICS_SOURCES.consult_cta,
        pagePath,
        productId,
        metadata:
          productId || sourcePath
            ? { productId: productId ?? undefined, sourcePath: sourcePath ?? undefined }
            : undefined,
      }),
    );
  } catch {
    // no-op
  }
}

export function trackConsultSubmit(params?: ConsultModalTrackParams | null): void {
  try {
    const pagePath = getPagePath();
    const productId = params?.productId?.trim() || null;
    const sourcePath = params?.sourcePath?.trim() || null;
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.consult_submit,
        source: ANALYTICS_SOURCES.consult_cta,
        pagePath,
        productId,
        metadata:
          productId || sourcePath
            ? { productId: productId ?? undefined, sourcePath: sourcePath ?? undefined }
            : undefined,
      }),
    );
  } catch {
    // no-op
  }
}

/**
 * 클라이언트 analytics 전송 공통 엔트리 (device_type / page_path 기본 채움).
 */

import type { AnalyticsPayload } from "./types";
import { createAnalyticsPayload, inferDeviceType } from "./payload";
import { trackClientEvent } from "./trackClientEvent";

function defaultPagePath(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.pathname || null;
}

function defaultDeviceType(): AnalyticsPayload["deviceType"] {
  if (typeof window === "undefined") return "unknown";
  return inferDeviceType(undefined, window.innerWidth);
}

/** fire-and-forget. 실패해도 UX에 영향 없음. */
export function trackClientAnalytics(
  partial: Partial<AnalyticsPayload> & Pick<AnalyticsPayload, "eventName" | "source">,
): void {
  try {
    trackClientEvent(
      createAnalyticsPayload({
        ...partial,
        pagePath: partial.pagePath ?? defaultPagePath(),
        deviceType: partial.deviceType ?? defaultDeviceType(),
      }),
    );
  } catch {
    /* no-op */
  }
}

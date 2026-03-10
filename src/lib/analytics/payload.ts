/**
 * Analytics payload 생성·정규화 유틸 (골격만).
 * 네트워크 호출/DB 저장은 연결하지 않는다.
 */

import type { AnalyticsPayload } from "./types";

const DEFAULT_DEVICE: AnalyticsPayload["deviceType"] = "unknown";
const MAX_HREF_LENGTH = 2048;
const MAX_LABEL_LENGTH = 512;

/**
 * 부분 payload로 공통 payload 생성. 누락 필드는 null 또는 기본값.
 */
export function createAnalyticsPayload(
  partial: Partial<AnalyticsPayload> & Pick<AnalyticsPayload, "eventName" | "source">,
): AnalyticsPayload {
  const occurredAt =
    typeof partial.occurredAt === "string" && partial.occurredAt
      ? partial.occurredAt
      : new Date().toISOString();

  return {
    eventName: partial.eventName,
    source: partial.source,
    pagePath: partial.pagePath ?? null,
    deviceType: partial.deviceType ?? DEFAULT_DEVICE,
    taxonomyType: partial.taxonomyType ?? null,
    taxonomyId: partial.taxonomyId ?? null,
    taxonomySlug: partial.taxonomySlug ?? null,
    taxonomyName: partial.taxonomyName ?? null,
    section: partial.section ?? null,
    label: partial.label ?? null,
    href: partial.href ?? null,
    position: partial.position ?? null,
    query: partial.query ?? null,
    resultCount: partial.resultCount ?? null,
    productId: partial.productId ?? null,
    occurredAt,
    metadata: partial.metadata ?? null,
  };
}

/**
 * href 정규화 — trim, 길이 제한. 계측 시 일관된 형식용.
 */
export function normalizeAnalyticsHref(href: string): string {
  if (typeof href !== "string") return "";
  const trimmed = href.trim();
  if (trimmed.length <= MAX_HREF_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_HREF_LENGTH);
}

/**
 * label 정규화 — trim, 길이 제한.
 */
export function normalizeAnalyticsLabel(label: string): string {
  if (typeof label !== "string") return "";
  const trimmed = label.trim();
  if (trimmed.length <= MAX_LABEL_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_LABEL_LENGTH);
}

/**
 * deviceType 추론. mode가 있으면 우선 사용, 없으면 windowWidth로 판단.
 * SSR 환경에서는 window 없으므로 mode만 넘기거나 'unknown' 반환.
 */
export function inferDeviceType(
  mode?: "desktop" | "mobile" | string,
  windowWidth?: number,
): AnalyticsPayload["deviceType"] {
  if (mode === "desktop") return "desktop";
  if (mode === "mobile") return "mobile";
  if (typeof windowWidth === "number") {
    return windowWidth >= 768 ? "desktop" : "mobile";
  }
  return DEFAULT_DEVICE;
}

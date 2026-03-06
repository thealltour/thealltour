/**
 * 클라이언트에서 analytics 이벤트를 fire-and-forget으로 전송하는 공통 유틸.
 * sendBeacon 우선, 실패 시 fetch(keepalive) fallback. 어떤 경우에도 throw 하지 않는다.
 */

import type { AnalyticsPayload } from "./types";

const API_PATH = "/api/analytics/events";
const isDev = process.env.NODE_ENV === "development";

function getUrl(): string {
  if (typeof window === "undefined") return API_PATH;
  const base = window.location.origin ?? "";
  return `${base}${API_PATH}`;
}

/**
 * payload를 전송. 브라우저가 아니면 no-op.
 * sendBeacon 사용 가능하면 우선 사용, 실패 시 fetch(keepalive) fallback.
 * 전송 실패가 사용자 동작을 막지 않도록 절대 throw 하지 않는다.
 */
export function trackClientEvent(payload: AnalyticsPayload): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const url = getUrl();
    const body = JSON.stringify(payload);

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      const sent = navigator.sendBeacon(url, blob);
      if (sent) {
        if (isDev) {
          console.debug("[analytics] trackClientEvent sent (beacon):", payload.eventName, payload.source);
        }
        return;
      }
    }

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      if (isDev) {
        console.debug("[analytics] trackClientEvent fetch failed (fire-and-forget):", payload.eventName);
      }
    });
  } catch {
    if (isDev) {
      console.debug("[analytics] trackClientEvent threw (swallowed):", payload.eventName);
    }
  }
}

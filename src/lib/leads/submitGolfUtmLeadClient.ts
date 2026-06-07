/**
 * 클라이언트에서 골프 UTM 리드를 fire-and-forget으로 전송.
 * 외부 랜딩·직접 연동용. 내부 문의는 /api/inquiries 서버 dual-write가 주 경로.
 */

import type { GolfUtmLeadInput } from "@/lib/leads/golfLeadPayload";

const API_PATH = "/api/leads/golf-utm";

function toApiBody(input: GolfUtmLeadInput): Record<string, unknown> {
  return {
    customerName: input.customerName,
    phoneNumber: input.phoneNumber,
    groupSize: input.groupSize ?? undefined,
    targetDestination: input.targetDestination ?? undefined,
    landingPage: input.landingPage ?? undefined,
    utmSource: input.utmSource ?? undefined,
    utmMedium: input.utmMedium ?? undefined,
    utmCampaign: input.utmCampaign ?? undefined,
    utmTerm: input.utmTerm ?? undefined,
    utmContent: input.utmContent ?? undefined,
  };
}

/** 브라우저에서 golf-utm API로 전송. 실패해도 throw 하지 않음. */
export function submitGolfUtmLeadClient(input: GolfUtmLeadInput): void {
  if (typeof window === "undefined") return;

  try {
    const url = `${window.location.origin}${API_PATH}`;
    const body = JSON.stringify(toApiBody(input));

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* fire-and-forget */
  }
}

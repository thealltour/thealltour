import type { AgendaSlateCandidate } from "@/lib/marketing/cron/daily/agendaSlate/types";

export const V1_EDITORIAL_CLASSES = [
  "DECISION_ORIENTED",
  "NEWS_HEADLINE_LIKE",
  "TREND_REPEAT",
  "GENERIC_INFORMATIONAL",
  "OPERATIONAL_TRUTH",
  "PROMOTIONAL",
  "OTHER",
] as const;
export type V1EditorialClass = (typeof V1_EDITORIAL_CLASSES)[number];

/**
 * Classify V1 agenda editorially using existing title/topics/editorial cues.
 * Does not rewrite content.
 */
export function classifyV1AgendaEditorially(c: AgendaSlateCandidate): V1EditorialClass {
  const title = (c.title ?? "").toLowerCase();
  const topics = (c.topics ?? []).map((t) => t.toLowerCase());
  const blob = `${c.title} ${c.summary ?? ""} ${(c.rationale ?? []).join(" ")}`;

  if (
    topics.includes("activity_trend") ||
    topics.includes("fare_price_signal") ||
    topics.includes("competitor_promotion_signal") ||
    /관측|콘텐츠 관측|obs_|ttl fix/i.test(c.title)
  ) {
    return "TREND_REPEAT";
  }

  if (
    topics.includes("visa") ||
    topics.includes("safety") ||
    /visa|주의|입국|안전|fcdo|advisory|수수료|취소/i.test(blob)
  ) {
    return /수수료|취소|visa|입국|안전|advisory/i.test(blob)
      ? "OPERATIONAL_TRUTH"
      : "OPERATIONAL_TRUTH";
  }

  if (
    /프로모|특가|기획전|할인|9\.9|promotion|promo/i.test(blob) ||
    topics.includes("competitor_promotion_signal")
  ) {
    return "PROMOTIONAL";
  }

  if (
    /어떻게|판단|선택|vs|대비|어디에|언제 예약|무엇을 먼저/i.test(blob) ||
    (c.editorial?.practicalTravelValue &&
      /가이드|선택|판단|기준|비교/.test(c.editorial.practicalTravelValue))
  ) {
    return "DECISION_ORIENTED";
  }

  // Country-label only or slug-like destinations as titles
  if (/^(taiwan|nepal|thailand|ireland|vietnam)$/i.test(c.title.trim()) || c.title.trim().length <= 12) {
    if (topics.includes("safety") || topics.includes("visa")) return "OPERATIONAL_TRUTH";
    return "GENERIC_INFORMATIONAL";
  }

  if (
    /opens?|개장|오픈|공급|인기|best september|escapes|paradises|breathe deep|discover/i.test(
      title,
    )
  ) {
    return "NEWS_HEADLINE_LIKE";
  }

  if (/관광청|신규 콘텐츠|마음을 흔들어|빛과 불/.test(c.title)) {
    return "GENERIC_INFORMATIONAL";
  }

  return "OTHER";
}

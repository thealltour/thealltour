/**
 * PR27: 리뷰 전환 attribution (규칙 기반).
 */
import type {
  ReviewInteractionEvent,
  ReviewConversionAttribution,
  ReviewConversionSummary,
  ReviewVariantConversionSummary,
  ConversionEventType,
  ReviewSessionJourney,
} from "@/types/reviewConversionAnalytics";
import {
  REVIEW_ATTRIBUTION_WINDOW_MINUTES,
  REVIEW_LAST_TOUCH_LOOKBACK_MINUTES,
  REVIEW_MAX_ATTRIBUTED_REVIEW_IDS,
  REVIEW_EXPAND_WEIGHT,
  REVIEW_CLICK_WEIGHT,
  REVIEW_SUMMARY_VIEW_WEIGHT,
  REVIEW_PERSONALIZED_VIEW_WEIGHT,
  REVIEW_HELPFUL_CLICK_WEIGHT,
  REVIEW_IMPRESSION_WEIGHT,
} from "./reviewConversionConstants";
import { CONVERSION_EVENT_TYPES } from "./reviewConversionConstants";
import { getConversionEvents, getReviewInteractionEvents } from "./reviewConversionSelectors";

const CONVERSION_TYPES_SET = new Set<string>(CONVERSION_EVENT_TYPES);

function toMs(minutes: number): number {
  return minutes * 60 * 1000;
}

/**
 * sessionKey 또는 userKey 기준으로 이벤트를 묶어 세션별 여정 구성.
 */
export function buildReviewSessionJourneys(
  events: ReviewInteractionEvent[],
): ReviewSessionJourney[] {
  const key = (e: ReviewInteractionEvent) =>
    e.sessionKey ?? e.userKey ?? "";
  const bySubject = new Map<string, ReviewInteractionEvent[]>();
  for (const e of events) {
    const k = key(e);
    if (!k) continue;
    let list = bySubject.get(k);
    if (!list) {
      list = [];
      bySubject.set(k, list);
    }
    list.push(e);
  }
  const journeys: ReviewSessionJourney[] = [];
  for (const [sessionKey, list] of bySubject) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const byProduct = new Map<string, ReviewInteractionEvent[]>();
    for (const e of sorted) {
      const pid = e.productId;
      let arr = byProduct.get(pid);
      if (!arr) {
        arr = [];
        byProduct.set(pid, arr);
      }
      arr.push(e);
    }
    for (const [productId, productEvents] of byProduct) {
      journeys.push({
        sessionKey,
        productId,
        events: productEvents,
        conversions: productEvents.filter((e) => CONVERSION_TYPES_SET.has(e.eventType)),
      });
    }
  }
  return journeys;
}

/**
 * 단일 여정에서 전환을 리뷰 터치포인트에 귀속.
 */
export function attributeConversionsFromJourney(
  journey: ReviewSessionJourney,
  model: "last_review_touch" | "weighted_review_touch" | "section_level_touch",
): ReviewConversionAttribution[] {
  if (journey.conversions.length === 0) return [];
  if (model === "last_review_touch") {
    return applyLastReviewTouchAttribution(journey);
  }
  if (model === "weighted_review_touch") {
    return applyWeightedReviewTouchAttribution(journey);
  }
  return applySectionLevelTouchAttribution(journey);
}

/**
 * conversion 이전 window 내 가장 최근 리뷰 터치에 귀속.
 */
export function applyLastReviewTouchAttribution(
  journey: ReviewSessionJourney,
): ReviewConversionAttribution[] {
  const windowMs = toMs(REVIEW_LAST_TOUCH_LOOKBACK_MINUTES);
  const interactions = getReviewInteractionEvents(journey.events);
  const result: ReviewConversionAttribution[] = [];

  for (const conv of journey.conversions) {
    const convAt = new Date(conv.createdAt).getTime();
    const before = interactions.filter(
      (e) => new Date(e.createdAt).getTime() <= convAt && convAt - new Date(e.createdAt).getTime() <= windowMs,
    );
    const withReview = before.filter((e) => e.reviewId);
    const preferred = withReview.filter((e) =>
      ["review_click", "review_expand", "review_helpful_click"].includes(e.eventType),
    );
    const last = (preferred.length ? preferred : withReview).slice(-1);
    const fallback = before.filter((e) => !e.reviewId).length > 0 ? [] : last;
    const attributed = last.length
      ? [...new Set(last.map((e) => e.reviewId!).filter(Boolean))]
      : [];
    const reasons: string[] = [];
    if (last.length) {
      reasons.push(`last_review_touch: ${last[0].eventType}`);
    } else if (interactions.some((e) => new Date(e.createdAt).getTime() <= convAt)) {
      reasons.push("section_level_touch: no review id in window");
    }
    result.push({
      sessionKey: journey.sessionKey,
      userKey: undefined,
      productId: journey.productId,
      conversionEventType: conv.eventType as ConversionEventType,
      conversionAt: conv.createdAt,
      attributedReviewIds: attributed,
      attributedVariant: last[0]?.variant,
      attributionModel: "last_review_touch",
      attributionScore: last.length ? 1 : 0,
      reasons,
    });
  }
  return result;
}

/**
 * conversion 이전 window 내 리뷰 이벤트에 가중치 부여 후 상위 N개 리뷰 귀속.
 */
export function applyWeightedReviewTouchAttribution(
  journey: ReviewSessionJourney,
): ReviewConversionAttribution[] {
  const windowMs = toMs(REVIEW_ATTRIBUTION_WINDOW_MINUTES);
  const interactions = getReviewInteractionEvents(journey.events);
  const result: ReviewConversionAttribution[] = [];

  for (const conv of journey.conversions) {
    const convAt = new Date(conv.createdAt).getTime();
    const before = interactions.filter(
      (e) => new Date(e.createdAt).getTime() <= convAt && convAt - new Date(e.createdAt).getTime() <= windowMs,
    );
    const scoreByReview = new Map<string, number>();
    for (const e of before) {
      const r = e.reviewId ?? "__section__";
      let w = REVIEW_IMPRESSION_WEIGHT;
      if (e.eventType === "review_click") w = REVIEW_CLICK_WEIGHT;
      else if (e.eventType === "review_expand") w = REVIEW_EXPAND_WEIGHT;
      else if (e.eventType === "review_helpful_click") w = REVIEW_HELPFUL_CLICK_WEIGHT;
      else if (e.eventType === "review_summary_view") w = REVIEW_SUMMARY_VIEW_WEIGHT;
      else if (e.eventType === "personalized_review_view") w = REVIEW_PERSONALIZED_VIEW_WEIGHT;
      scoreByReview.set(r, (scoreByReview.get(r) ?? 0) + w);
    }
    const sorted = [...scoreByReview.entries()]
      .filter(([id]) => id !== "__section__")
      .sort((a, b) => b[1] - a[1])
      .slice(0, REVIEW_MAX_ATTRIBUTED_REVIEW_IDS);
    const attributedReviewIds = sorted.map(([id]) => id);
    const topVariant = journey.events.find((e) => e.reviewId === sorted[0]?.[0])?.variant;
    const totalScore = sorted.reduce((s, [, v]) => s + v, 0);
    result.push({
      sessionKey: journey.sessionKey,
      productId: journey.productId,
      conversionEventType: conv.eventType as ConversionEventType,
      conversionAt: conv.createdAt,
      attributedReviewIds,
      attributedVariant: topVariant,
      attributionModel: "weighted_review_touch",
      attributionScore: totalScore,
      reasons: attributedReviewIds.length
        ? [`weighted_top_${REVIEW_MAX_ATTRIBUTED_REVIEW_IDS}: ${attributedReviewIds.join(",")}`]
        : [],
    });
  }
  return result;
}

/**
 * section_level_touch: 리뷰 섹션 노출만으로 귀속 (reviewId 없음).
 */
function applySectionLevelTouchAttribution(
  journey: ReviewSessionJourney,
): ReviewConversionAttribution[] {
  const windowMs = toMs(REVIEW_ATTRIBUTION_WINDOW_MINUTES);
  const interactions = getReviewInteractionEvents(journey.events);
  const result: ReviewConversionAttribution[] = [];

  for (const conv of journey.conversions) {
    const convAt = new Date(conv.createdAt).getTime();
    const before = interactions.filter(
      (e) => new Date(e.createdAt).getTime() <= convAt && convAt - new Date(e.createdAt).getTime() <= windowMs,
    );
    result.push({
      sessionKey: journey.sessionKey,
      productId: journey.productId,
      conversionEventType: conv.eventType as ConversionEventType,
      conversionAt: conv.createdAt,
      attributedReviewIds: [],
      attributionModel: "section_level_touch",
      attributionScore: before.length > 0 ? 0.5 : 0,
      reasons: before.length ? ["section_level_touch"] : [],
    });
  }
  return result;
}

/**
 * attribution 결과 + 원시 이벤트로 reviewId / variant / product 단위 summary 생성.
 */
export function aggregateReviewConversionAttributions(
  attributions: ReviewConversionAttribution[],
  events: ReviewInteractionEvent[],
): {
  reviewSummaries: ReviewConversionSummary[];
  variantSummaries: ReviewVariantConversionSummary[];
} {
  const reviewSummaries = summarizeByReview(attributions, events);
  const variantSummaries = summarizeByVariant(attributions, events);
  return { reviewSummaries, variantSummaries };
}

function summarizeByReview(
  attributions: ReviewConversionAttribution[],
  events: ReviewInteractionEvent[],
): ReviewConversionSummary[] {
  const byKey = new Map<
    string,
    {
      productId: string;
      reviewId?: string;
      experimentKey?: string;
      variant?: string;
      impressions: number;
      clicks: number;
      expands: number;
      helpfulClicks: number;
      summaryViews: number;
      personalizedViews: number;
      conversions: number;
      assistedConversions: number;
    }
  >();
  const key = (r: { productId: string; reviewId?: string; experimentKey?: string; variant?: string }) =>
    `${r.productId}|${r.reviewId ?? ""}|${r.experimentKey ?? ""}|${r.variant ?? ""}`;

  for (const e of events) {
    if (CONVERSION_TYPES_SET.has(e.eventType)) continue;
    const k = key(e);
    let s = byKey.get(k);
    if (!s) {
      s = {
        productId: e.productId,
        reviewId: e.reviewId,
        experimentKey: e.experimentKey,
        variant: e.variant,
        impressions: 0,
        clicks: 0,
        expands: 0,
        helpfulClicks: 0,
        summaryViews: 0,
        personalizedViews: 0,
        conversions: 0,
        assistedConversions: 0,
      };
      byKey.set(k, s);
    }
    if (e.eventType === "review_impression") s.impressions++;
    else if (e.eventType === "review_click") s.clicks++;
    else if (e.eventType === "review_expand") s.expands++;
    else if (e.eventType === "review_helpful_click") s.helpfulClicks++;
    else if (e.eventType === "review_summary_view") s.summaryViews++;
    else if (e.eventType === "personalized_review_view") s.personalizedViews++;
  }

  for (const a of attributions) {
    for (const rid of a.attributedReviewIds) {
      const k = `${a.productId}|${rid}|${a.attributedVariant ?? ""}|`;
      const match = [...byKey.entries()].find(([bk]) => bk.startsWith(a.productId + "|" + rid));
      if (match) {
        const [, s] = match;
        s.conversions += a.attributionScore;
        s.assistedConversions += 1;
      }
    }
  }

  const out: ReviewConversionSummary[] = [];
  for (const s of byKey.values()) {
    const imp = s.impressions || 1;
    out.push({
      ...s,
      ctr: s.impressions ? s.clicks / s.impressions : 0,
      expandRate: s.impressions ? s.expands / s.impressions : 0,
      conversionRate: imp ? s.conversions / imp : 0,
      assistedConversionRate: imp ? s.assistedConversions / imp : 0,
    });
  }
  return out;
}

function summarizeByVariant(
  attributions: ReviewConversionAttribution[],
  events: ReviewInteractionEvent[],
): ReviewVariantConversionSummary[] {
  const byKey = new Map<
    string,
    { productId: string; experimentKey?: string; variant?: string; impressions: number; conversions: number; assistedConversions: number }
  >();
  const key = (p: string, ex?: string, v?: string) => `${p}|${ex ?? ""}|${v ?? ""}`;

  for (const e of events) {
    if (CONVERSION_TYPES_SET.has(e.eventType)) continue;
    if (e.eventType !== "review_impression") continue;
    const k = key(e.productId, e.experimentKey, e.variant);
    let s = byKey.get(k);
    if (!s) {
      s = {
        productId: e.productId,
        experimentKey: e.experimentKey,
        variant: e.variant,
        impressions: 0,
        conversions: 0,
        assistedConversions: 0,
      };
      byKey.set(k, s);
    }
    s.impressions++;
  }
  for (const a of attributions) {
    const k = key(a.productId, undefined, a.attributedVariant);
    const s = byKey.get(k);
    if (s) {
      s.conversions += a.attributionScore;
      s.assistedConversions += 1;
    }
  }
  return [...byKey.values()].map((s) => ({
    ...s,
    conversionRate: s.impressions ? s.conversions / s.impressions : 0,
  }));
}

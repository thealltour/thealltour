/**
 * 상품 카드 **대표 배지** — PR3: `campaign_card_meta`(taxonomy CMS) 우선, 없으면 문자열 레거시.
 */

import type { ProductCardSource } from "@/lib/products/productListItem";
import type { ProductCardBadge } from "@/components/products/ProductCard";
import { sortVisibleCampaignCardMeta } from "@/lib/productCampaignSort";

/** 레거시: 라벨만 있을 때 우선순위 (taxonomy 없을 때) */
const PRIORITY_RECOMMEND = 1;
const PRIORITY_POPULAR = 2;
const PRIORITY_NEW = 3;
const PRIORITY_OTHER_BASE = 100;

export function normalizeCampaignLabel(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function campaignKey(label: string): string {
  return normalizeCampaignLabel(label).toLowerCase();
}

/** @deprecated PR3 이후 taxonomy badge_priority 사용. 레거시 fallback 전용 */
export function getCampaignBadgePriority(label: string): number {
  const k = campaignKey(label);
  if (k === "추천") return PRIORITY_RECOMMEND;
  if (k === "인기") return PRIORITY_POPULAR;
  if (k === "신규") return PRIORITY_NEW;
  return PRIORITY_OTHER_BASE;
}

function collectCampaignLabels(product: ProductCardSource): string[] {
  const raw = product.campaigns ?? product.campaigns_json ?? [];
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const n = normalizeCampaignLabel(item);
    if (!n) continue;
    const key = campaignKey(n);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function sortCampaignLabelsForDisplay(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const pa = getCampaignBadgePriority(a);
    const pb = getCampaignBadgePriority(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b, "ko");
  });
}

function legacyCampaignBadgeTypeForLabel(label: string): string {
  const k = campaignKey(label);
  if (k === "추천" || k === "인기" || k === "신규") return "accent";
  return "muted";
}

/** 레거시 단일 라벨 → ProductCardBadge */
export function buildCampaignBadge(label: string): ProductCardBadge {
  const normalized = normalizeCampaignLabel(label);
  const k = campaignKey(normalized);
  let campaignTone: "primary" | "highlight" | "neutral" = "neutral";
  if (k === "추천") campaignTone = "primary";
  else if (k === "인기") campaignTone = "highlight";
  else if (k === "신규") campaignTone = "neutral";
  return {
    type: legacyCampaignBadgeTypeForLabel(normalized),
    label: normalized,
    priority: 100 - getCampaignBadgePriority(normalized),
    isActive: true,
    campaignTone,
  };
}

function appendRecommendPopularFallback(product: ProductCardSource, labels: string[]): string[] {
  const next = [...labels];
  const seen = new Set(next.map((l) => campaignKey(l)));

  if (product.is_recommend === true && !seen.has("추천")) {
    next.push("추천");
    seen.add("추천");
  }
  if (product.is_popular === true && !seen.has("인기")) {
    next.push("인기");
    seen.add("인기");
  }
  return sortCampaignLabelsForDisplay(next);
}

function buildBadgesFromCampaignCardMeta(product: ProductCardSource, max: number): ProductCardBadge[] {
  const meta = product.campaign_card_meta;
  if (!meta?.length) return [];
  const visible = sortVisibleCampaignCardMeta(meta);
  return visible.slice(0, max).map((m) => ({
    type: m.badge_tone,
    label: m.displayLabel,
    priority: 1_000_000 - (m.badge_priority ?? 100),
    isActive: true,
    campaignTone: m.badge_tone,
    isPromotion: m.isPromotionCampaign === true,
  }));
}

export type BuildCampaignRepresentativeBadgesOptions = {
  /** 대표 배지 최대 개수. related/grid/home 2, list·모바일 리스트 1 권장 */
  max?: number;
};

const DEFAULT_CAMPAIGN_BADGE_MAX = 2;

/**
 * 카드 상단 대표 배지 (campaign 소스 단일 진입점).
 * - `campaign_card_meta`에 해석된 토큰이 있으면 CMS 규칙만 사용(전부 비노출이면 배지 없음).
 * - 해석된 메타가 없을 때만 campaigns 문자열 + 레거시 추천/인기/신규 + is_* fallback.
 */
export function buildCampaignRepresentativeBadges(
  product: ProductCardSource,
  options?: BuildCampaignRepresentativeBadgesOptions,
): ProductCardBadge[] {
  const max = Math.max(1, Math.min(2, options?.max ?? DEFAULT_CAMPAIGN_BADGE_MAX));
  const meta = product.campaign_card_meta;
  const hasResolvedCampaignTokens = Array.isArray(meta) && meta.length > 0;
  const fromMeta = buildBadgesFromCampaignCardMeta(product, max);
  if (fromMeta.length > 0) {
    return fromMeta;
  }
  if (hasResolvedCampaignTokens) {
    return [];
  }

  let labels = sortCampaignLabelsForDisplay(collectCampaignLabels(product));

  if (labels.length === 0) {
    labels = appendRecommendPopularFallback(product, []);
  } else {
    labels = labels.slice(0, max);
  }

  if (labels.length === 0) {
    return [];
  }

  return labels.slice(0, max).map((label) => buildCampaignBadge(label));
}

export function getPrimaryRepresentativeCampaignLabel(product: ProductCardSource): string | undefined {
  const b = buildCampaignRepresentativeBadges(product, { max: 2 })[0];
  const t = b?.label?.trim();
  return t || undefined;
}

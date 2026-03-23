/**
 * PR3: 상품의 campaigns 토큰(이름 또는 taxonomy id) → 카드 배지용 메타 해석.
 */

import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { CampaignBadgeTone, ProductCampaignCardMeta } from "@/types/productCampaignCard";

export type CampaignTaxonomyIndex = {
  byId: Map<string, ProductTaxonomy>;
  byNameKey: Map<string, ProductTaxonomy>;
};

function normKey(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCampaignTokenUuid(token: string): boolean {
  return UUID_RE.test(token.trim());
}

function parseBadgeTone(raw: unknown): CampaignBadgeTone {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "primary" || s === "highlight" || s === "neutral") return s;
  return "neutral";
}

/** campaign taxonomy 목록으로 조회 인덱스 생성 */
export function buildCampaignTaxonomyIndex(taxonomies: ProductTaxonomy[]): CampaignTaxonomyIndex {
  const byId = new Map<string, ProductTaxonomy>();
  const byNameKey = new Map<string, ProductTaxonomy>();
  for (const t of taxonomies) {
    if (t.taxonomy_type !== "campaign") continue;
    if (t.id) byId.set(t.id.trim(), t);
    const nk = normKey(t.name ?? "");
    if (nk) byNameKey.set(nk, t);
  }
  return { byId, byNameKey };
}

function taxonomyToCardMeta(t: ProductTaxonomy): ProductCampaignCardMeta {
  const name = (t.name ?? "").trim() || "—";
  const display =
    (typeof t.display_label === "string" && t.display_label.trim() !== ""
      ? t.display_label.trim()
      : name) || name;
  const priority =
    typeof t.badge_priority === "number" && Number.isFinite(t.badge_priority)
      ? t.badge_priority
      : 100;
  const visible = t.badge_visible !== false;
  const tone = parseBadgeTone(t.badge_tone);
  const desc =
    typeof t.badge_description === "string" && t.badge_description.trim() !== ""
      ? t.badge_description.trim()
      : undefined;
  return {
    taxonomyId: t.id,
    name,
    displayLabel: display,
    badge_priority: priority,
    badge_visible: visible,
    badge_tone: tone,
    description: desc,
  };
}

/** 토큰이 taxonomy에 없을 때 (레거시 문자열) */
export function legacyCampaignTokenToMeta(token: string): ProductCampaignCardMeta {
  const name = token.replace(/\s+/g, " ").trim();
  const k = normKey(name);
  let priority = 100;
  let tone: CampaignBadgeTone = "neutral";
  if (k === "추천") {
    priority = 1;
    tone = "primary";
  } else if (k === "인기") {
    priority = 2;
    tone = "highlight";
  } else if (k === "신규") {
    priority = 3;
    tone = "neutral";
  }
  return {
    name,
    displayLabel: name,
    badge_priority: priority,
    badge_visible: true,
    badge_tone: tone,
    description: undefined,
  };
}

function resolveToken(token: string, index: CampaignTaxonomyIndex): ProductCampaignCardMeta {
  const t = token.trim();
  if (!t) return legacyCampaignTokenToMeta("");
  if (isCampaignTokenUuid(t)) {
    const row = index.byId.get(t);
    if (row) return taxonomyToCardMeta(row);
  }
  const byName = index.byNameKey.get(normKey(t));
  if (byName) return taxonomyToCardMeta(byName);
  return legacyCampaignTokenToMeta(t);
}

/**
 * 상품 campaigns 배열 순서 유지, 중복 제거(같은 taxonomy id 또는 같은 표시 라벨 키).
 */
export function resolveProductCampaignCardMeta(
  product: Product,
  index: CampaignTaxonomyIndex,
): ProductCampaignCardMeta[] {
  const raw = product.campaigns ?? product.campaigns_json ?? [];
  if (!Array.isArray(raw)) return [];
  const out: ProductCampaignCardMeta[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const meta = resolveToken(item, index);
    const dedupe =
      meta.taxonomyId?.trim() ||
      `name:${normKey(meta.displayLabel)}` ||
      `raw:${normKey(item)}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(meta);
  }
  return out;
}

export function hydrateProductsWithCampaignCardMeta(
  products: Product[],
  campaignTaxonomies: ProductTaxonomy[],
): Product[] {
  const index = buildCampaignTaxonomyIndex(campaignTaxonomies);
  return products.map((p) => ({
    ...p,
    campaign_card_meta: resolveProductCampaignCardMeta(p, index),
  }));
}

export function hydrateProductWithCampaignCardMeta(
  product: Product,
  campaignTaxonomies: ProductTaxonomy[],
): Product {
  return hydrateProductsWithCampaignCardMeta([product], campaignTaxonomies)[0]!;
}

/**
 * POST-UI-01D-3B: Guide bridge score / diversity / fallback — 0-diff semantics on slim input.
 */

import { getTaxonomyById, parseThemeTokens } from "@/lib/productTaxonomies";
import { extractGuideBridgeSearchTokens } from "@/lib/guides";
import type { Guide } from "@/types/guide";

/** Stage-1 score input — GuideBridgeCandidate fields only. */
export type GuideScorableProduct = {
  id: string;
  destination_id?: string | null;
  category?: string | null;
  theme?: string | null;
  title: string;
  description?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
};

export type GuideBridgeRecContext = {
  guideDestinationId: string | null;
  guideThemeId: string | null;
  themeNameLower: string | null;
  destinationNameLower: string | null;
  searchTokens: string[];
};

export type GuideBridgeScoredProduct = {
  product: GuideScorableProduct;
  score: number;
  reasons: string[];
};

export type GuideBridgeRecommendationsOptions = {
  totalLimit?: number;
  /** 개발 점검용: 점수·사유 배열 (프로덕션 UI에 노출 금지) */
  includeDebug?: boolean;
};

export type GuideBridgeProductDebugEntry = {
  productId: string;
  title: string;
  score: number;
  reasons: string[];
};

export type GuideBridgeSelectionResult = {
  primary: GuideScorableProduct[];
  secondary: GuideScorableProduct[];
  fallback: GuideScorableProduct[];
  all: GuideScorableProduct[];
  debug?: GuideBridgeProductDebugEntry[];
};

const SCORE_DESTINATION_EXACT = 100;
const SCORE_THEME_TOKEN_EXACT = 60;
const SCORE_THEME_TOKEN_PARTIAL = 35;
const SCORE_TOKEN_TITLE = 25;
const SCORE_TOKEN_CATEGORY = 18;
const SCORE_TOKEN_THEME = 20;
const SCORE_TOKEN_DESCRIPTION = 8;
const SCORE_BONUS_TOKENS_2 = 10;
const SCORE_BONUS_TOKENS_3 = 18;
const SCORE_BONUS_TOKENS_4 = 25;

function compareGuideBridgeScored(
  a: GuideBridgeScoredProduct,
  b: GuideBridgeScoredProduct,
): number {
  if (b.score !== a.score) return b.score - a.score;
  const oa = a.product.sort_order ?? 1e9;
  const ob = b.product.sort_order ?? 1e9;
  if (oa !== ob) return oa - ob;
  return (b.product.created_at ?? "").localeCompare(a.product.created_at ?? "");
}

function compareProductsFallbackOrder(
  a: GuideScorableProduct,
  b: GuideScorableProduct,
): number {
  const oa = a.sort_order ?? 1e9;
  const ob = b.sort_order ?? 1e9;
  if (oa !== ob) return oa - ob;
  return (b.created_at ?? "").localeCompare(a.created_at ?? "");
}

/** 가이드 1건에 대한 추천용 컨텍스트 (taxonomy 이름 + 정제 토큰) */
export async function buildGuideRecommendationContext(
  guide: Guide,
): Promise<GuideBridgeRecContext> {
  const destId = guide.destination_id?.trim() || null;
  const themeId = guide.theme_id?.trim() || null;
  const [destTax, themeTax] = await Promise.all([
    destId ? getTaxonomyById(destId) : Promise.resolve(null),
    themeId ? getTaxonomyById(themeId) : Promise.resolve(null),
  ]);
  const destinationNameLower =
    (destTax?.name ?? guide.destination_name)?.trim().toLowerCase() || null;
  const themeNameLower = (themeTax?.name ?? guide.theme_name)?.trim().toLowerCase() || null;

  const searchTokens = extractGuideBridgeSearchTokens(guide, {
    destinationLower: destinationNameLower,
    themeLower: themeNameLower,
  });

  return {
    guideDestinationId: destId,
    guideThemeId: themeId,
    themeNameLower,
    destinationNameLower,
    searchTokens,
  };
}

/**
 * 단일 상품의 가이드 브리지 관련도 점수.
 * destination_id 일치 > 테마 토큰 > 제목·카테고리·테마·설명 토큰(가중치 상이) > 다중 토큰 보너스.
 */
export function scoreProductForGuideBridge(
  product: GuideScorableProduct,
  ctx: GuideBridgeRecContext,
): GuideBridgeScoredProduct {
  let score = 0;
  const reasons: string[] = [];

  const titleL = product.title?.toLowerCase() ?? "";
  const catL = product.category?.toLowerCase() ?? "";
  const themeStrL = (product.theme ?? "").toLowerCase();
  const descL = (product.description ?? "").toLowerCase();
  const themeTokens = parseThemeTokens(product.theme ?? undefined).map((t) => t.toLowerCase());

  const gDest = ctx.guideDestinationId;
  if (gDest && product.destination_id === gDest) {
    score += SCORE_DESTINATION_EXACT;
    reasons.push("destination:exact");
  }

  const tn = ctx.themeNameLower;
  if (tn) {
    const exactTok = themeTokens.some((t) => t === tn);
    const partialTok =
      !exactTok && themeTokens.some((t) => t.includes(tn) || tn.includes(t));
    const inThemeStr =
      !exactTok &&
      !partialTok &&
      (themeStrL.includes(tn) || titleL.includes(tn) || catL.includes(tn));

    if (exactTok) {
      score += SCORE_THEME_TOKEN_EXACT;
      reasons.push("theme:exact-token");
    } else if (partialTok) {
      score += SCORE_THEME_TOKEN_PARTIAL;
      reasons.push("theme:partial-token");
    } else if (inThemeStr && (themeStrL.includes(tn) || themeTokens.length === 0)) {
      score += SCORE_THEME_TOKEN_PARTIAL;
      reasons.push("theme:string-match");
    }
  }

  const uniqueTokensMatched = new Set<string>();

  for (const tok of ctx.searchTokens) {
    if (!tok || tok.length < 2) continue;
    if (titleL.includes(tok)) {
      score += SCORE_TOKEN_TITLE;
      reasons.push(`token:title=${tok}`);
      uniqueTokensMatched.add(tok);
    }
    if (catL.includes(tok)) {
      score += SCORE_TOKEN_CATEGORY;
      reasons.push(`token:category=${tok}`);
      uniqueTokensMatched.add(tok);
    }
    if (themeStrL.includes(tok)) {
      score += SCORE_TOKEN_THEME;
      reasons.push(`token:theme=${tok}`);
      uniqueTokensMatched.add(tok);
    }
    if (descL.includes(tok)) {
      score += SCORE_TOKEN_DESCRIPTION;
      reasons.push(`token:description=${tok}`);
      uniqueTokensMatched.add(tok);
    }
  }

  const n = uniqueTokensMatched.size;
  if (n >= 4) {
    score += SCORE_BONUS_TOKENS_4;
    reasons.push("bonus:unique-tokens>=4");
  } else if (n >= 3) {
    score += SCORE_BONUS_TOKENS_3;
    reasons.push("bonus:unique-tokens>=3");
  } else if (n >= 2) {
    score += SCORE_BONUS_TOKENS_2;
    reasons.push("bonus:unique-tokens>=2");
  }

  return { product, score, reasons };
}

/** score > 0 목록에서 상위 take건을 고를 때, 동일 destination/category 연속만 완화 */
function softDiversityPick(
  poolInput: GuideBridgeScoredProduct[],
  take: number,
): GuideBridgeScoredProduct[] {
  const pool = [...poolInput].sort(compareGuideBridgeScored);
  const out: GuideBridgeScoredProduct[] = [];

  while (out.length < take && pool.length > 0) {
    if (out.length < 2) {
      out.push(pool.shift()!);
      continue;
    }

    const prev2 = out[out.length - 2]!;
    const prev1 = out[out.length - 1]!;
    const top = pool[0]!;

    let pickIdx = 0;
    const dest2 = prev2.product.destination_id ?? "";
    const dest1 = prev1.product.destination_id ?? "";
    const topDest = top.product.destination_id ?? "";
    if (dest2 && dest2 === dest1 && topDest === dest2) {
      const alt = pool.findIndex(
        (c, i) =>
          i > 0 &&
          (c.product.destination_id ?? "") !== dest2 &&
          c.score >= top.score - 25,
      );
      if (alt !== -1) pickIdx = alt;
    } else {
      const cat2 = (prev2.product.category ?? "").toLowerCase();
      const cat1 = (prev1.product.category ?? "").toLowerCase();
      const topCat = (top.product.category ?? "").toLowerCase();
      if (cat1 && cat2 === cat1 && topCat === cat1) {
        const alt = pool.findIndex(
          (c, i) =>
            i > 0 &&
            (c.product.category ?? "").toLowerCase() !== cat1 &&
            c.score >= top.score - 15,
        );
        if (alt !== -1) pickIdx = alt;
      }
    }

    const [picked] = pool.splice(pickIdx, 1);
    out.push(picked);
  }

  return out;
}

/**
 * 가이드 브리지: 점수 정렬 + 폴백 분리 + primary(3) / secondary(6) / fallback.
 * Sync Stage-1 — caller performs listing fetch for card fields.
 */
export function computeGuideBridgeRecommendations(
  products: GuideScorableProduct[],
  ctx: GuideBridgeRecContext,
  options?: GuideBridgeRecommendationsOptions,
): GuideBridgeSelectionResult {
  if (products.length === 0) {
    return { primary: [], secondary: [], fallback: [], all: [] };
  }

  const totalLimit = Math.max(1, options?.totalLimit ?? 18);

  const scored = products.map((p) => scoreProductForGuideBridge(p, ctx));
  const positive = scored.filter((s) => s.score > 0).sort(compareGuideBridgeScored);
  const zeroProducts = scored
    .filter((s) => s.score === 0)
    .map((s) => s.product)
    .sort(compareProductsFallbackOrder);

  const headPick = softDiversityPick(positive, 9);
  const headIds = new Set(headPick.map((s) => s.product.id));
  const remainingPositive = positive.filter((s) => !headIds.has(s.product.id));

  const primary = headPick.slice(0, 3).map((s) => s.product);
  const secondary = headPick.slice(3, 9).map((s) => s.product);

  const all: GuideScorableProduct[] = [];
  const seen = new Set<string>();
  const pushUnique = (p: GuideScorableProduct) => {
    if (seen.has(p.id)) return;
    seen.add(p.id);
    if (all.length < totalLimit) all.push(p);
  };

  for (const p of primary) pushUnique(p);
  for (const p of secondary) pushUnique(p);
  for (const s of remainingPositive) pushUnique(s.product);
  for (const p of zeroProducts) pushUnique(p);

  const debug: GuideBridgeProductDebugEntry[] | undefined = options?.includeDebug
    ? scored
        .slice()
        .sort(compareGuideBridgeScored)
        .map((s) => ({
          productId: s.product.id,
          title: s.product.title,
          score: s.score,
          reasons: s.reasons,
        }))
    : undefined;

  return {
    primary,
    secondary,
    fallback: zeroProducts,
    all,
    ...(debug ? { debug } : {}),
  };
}

/** Test helpers — exported score constants for fixture assertions. */
export const GUIDE_BRIDGE_SCORE_WEIGHTS = {
  destinationExact: SCORE_DESTINATION_EXACT,
  themeTokenExact: SCORE_THEME_TOKEN_EXACT,
  themeTokenPartial: SCORE_THEME_TOKEN_PARTIAL,
  tokenTitle: SCORE_TOKEN_TITLE,
  tokenCategory: SCORE_TOKEN_CATEGORY,
  tokenTheme: SCORE_TOKEN_THEME,
  tokenDescription: SCORE_TOKEN_DESCRIPTION,
  bonusTokens2: SCORE_BONUS_TOKENS_2,
  bonusTokens3: SCORE_BONUS_TOKENS_3,
  bonusTokens4: SCORE_BONUS_TOKENS_4,
} as const;

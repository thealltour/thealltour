/**
 * PR14: 상품별 리뷰 요약 CRUD 및 소스 리뷰 조회.
 * - submitted만 대상, hidden 제외.
 * - PR23: summary.recommended_for는 개인화 context.preferenceTags와 비교해 보조 노출에 활용 가능.
 */
import "server-only";

import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getPublicReviews } from "@/lib/reviewStats";
import type { PublicReviewItem } from "@/types/review";

export type ProductReviewSummaryStatus = "ready" | "stale" | "failed";

export type ProductReviewSummary = {
  id: string;
  product_id: string;
  review_count: number;
  average_rating: number | null;
  summary_text: string | null;
  positive_points: string[];
  negative_points: string[];
  recommended_for: string[];
  generated_at: string;
  updated_at: string;
  source_review_ids: string[];
  status: ProductReviewSummaryStatus;
};

function toSummary(row: Record<string, unknown>): ProductReviewSummary {
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return {
    id: String(row.id ?? ""),
    product_id: String(row.product_id ?? ""),
    review_count: typeof row.review_count === "number" ? row.review_count : 0,
    average_rating:
      typeof row.average_rating === "number"
        ? row.average_rating
        : typeof row.average_rating === "string"
          ? parseFloat(row.average_rating)
          : null,
    summary_text: typeof row.summary_text === "string" ? row.summary_text : null,
    positive_points: arr(row.positive_points),
    negative_points: arr(row.negative_points),
    recommended_for: arr(row.recommended_for),
    generated_at: String(row.generated_at ?? row.updated_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    source_review_ids: arr(row.source_review_ids),
    status: (row.status as ProductReviewSummaryStatus) ?? "ready",
  };
}

/**
 * 상품별 요약 1건 조회 (공개용, anon 읽기).
 * status=ready 이고 review_count>=2, summary_text 있을 때만 카드 표시 권장.
 * PR22: summary_text는 공개 상품 상세 페이지 본문 요약(ProductReviewSeoSummary)에도 사용.
 */
export async function getProductReviewSummary(
  productId: string,
): Promise<ProductReviewSummary | null> {
  const { data, error } = await supabase
    .from("product_review_summaries")
    .select("*")
    .eq("product_id", productId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return toSummary(data as Record<string, unknown>);
}

export type UpsertProductReviewSummaryPayload = {
  review_count: number;
  average_rating: number | null;
  summary_text: string | null;
  positive_points: string[];
  negative_points: string[];
  recommended_for: string[];
  source_review_ids: string[];
  status: "ready" | "failed";
};

/**
 * 요약 upsert (관리자/재생성 API에서 사용).
 */
export async function upsertProductReviewSummary(
  productId: string,
  payload: UpsertProductReviewSummaryPayload,
): Promise<ProductReviewSummary | null> {
  const now = new Date().toISOString();
  const row = {
    product_id: productId,
    review_count: payload.review_count,
    average_rating: payload.average_rating,
    summary_text: payload.summary_text,
    positive_points: payload.positive_points,
    negative_points: payload.negative_points,
    recommended_for: payload.recommended_for,
    source_review_ids: payload.source_review_ids,
    status: payload.status,
    updated_at: now,
  };

  const { data, error } = await supabaseAdmin
    .from("product_review_summaries")
    .upsert(row, {
      onConflict: "product_id",
      ignoreDuplicates: false,
    })
    .select("*")
    .single();

  if (error) return null;
  return toSummary((data ?? row) as Record<string, unknown>);
}

/**
 * 해당 상품 요약을 stale로 표시 (리뷰 추가/수정/숨김 시 호출).
 */
export async function markProductReviewSummaryStale(
  productId: string,
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("product_review_summaries")
    .update({ status: "stale", updated_at: new Date().toISOString() })
    .eq("product_id", productId);

  return !error;
}

/**
 * 요약 생성용 소스 리뷰 목록 (submitted만, 해당 상품).
 * 최대 200건. 리뷰 2건 미만이면 생성 생략 권장.
 */
export async function getSummarySourceReviews(
  productId: string,
  options?: { limit?: number },
): Promise<PublicReviewItem[]> {
  const limit = options?.limit ?? 200;
  return getPublicReviews({
    productId,
    limit,
    sort: "latest",
  });
}

/** 관리자: 요약 목록 (전체, updated_at 내림차순). */
export async function getReviewSummariesList(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ rows: ProductReviewSummary[]; total: number }> {
  const limit = Math.min(options?.limit ?? 100, 200);
  const offset = options?.offset ?? 0;

  const { data, error, count } = await supabaseAdmin
    .from("product_review_summaries")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return { rows: [], total: 0 };
  const rows = (data ?? []).map((row) => toSummary(row as Record<string, unknown>));
  return { rows, total: count ?? 0 };
}

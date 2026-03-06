import { supabase } from "@/lib/supabase";
import type { Review, ReviewStatus } from "@/types/review";

function normalizeReview(row: Record<string, unknown>): Review {
  const imageUrls = Array.isArray(row.image_urls)
    ? row.image_urls.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  const legacyImageUrl = typeof row.image_url === "string" ? row.image_url : undefined;

  const status = typeof row.status === "string" ? row.status : undefined;
  const validStatuses = ["draft", "submitted", "hidden"];

  const parseRating = (val: unknown): number | undefined => {
    if (typeof val === "number" && Number.isFinite(val) && val >= 1 && val <= 5) {
      return Math.round(val);
    }
    return undefined;
  };

  return {
    id: String(row.id ?? ""),
    member_id: typeof row.member_id === "string" ? row.member_id : undefined,
    title: String(row.title ?? ""),
    content: String(row.content ?? ""),
    image_url: legacyImageUrl,
    image_urls: imageUrls.length > 0 ? imageUrls : legacyImageUrl ? [legacyImageUrl] : [],
    author_name: String(row.author_name ?? ""),
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
    rating: parseRating(row.rating),
    status: status && validStatuses.includes(status) ? (status as Review["status"]) : undefined,
    eligibility_id: typeof row.eligibility_id === "string" ? row.eligibility_id : undefined,
    booking_id: typeof row.booking_id === "string" ? row.booking_id : undefined,
    customer_profile_id: typeof row.customer_profile_id === "string" ? row.customer_profile_id : undefined,
    summary: typeof row.summary === "string" ? row.summary : undefined,
    content_good: typeof row.content_good === "string" ? row.content_good : undefined,
    content_bad: typeof row.content_bad === "string" ? row.content_bad : undefined,
    content_tip: typeof row.content_tip === "string" ? row.content_tip : undefined,
    rating_schedule: parseRating(row.rating_schedule),
    rating_stay: parseRating(row.rating_stay),
    rating_guide: parseRating(row.rating_guide),
    rating_food: parseRating(row.rating_food),
  };
}

export async function getReviews() {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    return [] as Review[];
  }
  return (data ?? []).map((row) => normalizeReview(row as Record<string, unknown>));
}

/** 마이페이지용: 특정 회원이 작성한 리뷰만 조회 (member_id 일치) */
export async function getReviewsByMemberId(memberId: string): Promise<Review[]> {
  if (!memberId) return [];
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) return [];
  return (data ?? []).map((row) => normalizeReview(row as Record<string, unknown>));
}

/**
 * 마이페이지용: 작성 완료(submitted) 리뷰 조회.
 * status 컬럼이 있으면 submitted만 조회, 없으면 전체 조회(하위호환).
 */
export async function getSubmittedReviewsByMemberId(memberId: string): Promise<Review[]> {
  if (!memberId) return [];

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("member_id", memberId)
    .eq("status", "submitted")
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    return getReviewsByMemberId(memberId);
  }

  return (data ?? []).map((row) => normalizeReview(row as Record<string, unknown>));
}

/**
 * 마이페이지용: 임시저장(draft) 리뷰 조회.
 * status 컬럼이 있으면 draft만 조회, 없으면 빈 배열(하위호환).
 */
export async function getDraftReviewsByMemberId(memberId: string): Promise<Review[]> {
  if (!memberId) return [];

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("member_id", memberId)
    .eq("status", "draft")
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    return [];
  }

  return (data ?? []).map((row) => normalizeReview(row as Record<string, unknown>));
}

/** 리뷰 ID로 단건 조회 */
export async function getReviewById(reviewId: string): Promise<Review | null> {
  if (!reviewId) return null;
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("id", reviewId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeReview(data as Record<string, unknown>);
}

/** 특정 eligibility_id로 제출된 리뷰가 있는지 조회 */
export async function getReviewByEligibilityId(eligibilityId: string): Promise<Review | null> {
  if (!eligibilityId) return null;
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("eligibility_id", eligibilityId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeReview(data as Record<string, unknown>);
}

/** 특정 eligibility_id로 draft 또는 submitted 상태인 리뷰 조회 */
export async function getDraftOrReviewByEligibilityId(eligibilityId: string): Promise<Review | null> {
  if (!eligibilityId) return null;
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("eligibility_id", eligibilityId)
    .in("status", ["draft", "submitted"])
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeReview(data as Record<string, unknown>);
}

/** Draft 리뷰 입력 타입 */
export type DraftReviewInput = {
  memberId: string;
  authorName: string;
  eligibilityId?: string;
  bookingId?: string;
  customerProfileId?: string;
  title?: string;
  content?: string;
  summary?: string;
  contentGood?: string;
  contentBad?: string;
  contentTip?: string;
  rating?: number;
  ratingSchedule?: number;
  ratingStay?: number;
  ratingGuide?: number;
  ratingFood?: number;
  imageUrls?: string[];
};

/**
 * Draft 리뷰 저장 (신규 생성 또는 기존 업데이트).
 * eligibility 기반일 경우 기존 draft가 있으면 업데이트, 없으면 생성.
 */
export async function saveDraftReview(
  input: DraftReviewInput,
): Promise<{ success: boolean; reviewId?: string; error?: string }> {
  const { memberId, authorName, eligibilityId } = input;

  if (!memberId || !authorName) {
    return { success: false, error: "invalid_member" };
  }

  const payload: Record<string, unknown> = {
    member_id: memberId,
    author_name: authorName,
    status: "draft" as ReviewStatus,
    title: input.title?.trim() || "",
    content: input.content?.trim() || "",
    summary: input.summary?.trim() || null,
    content_good: input.contentGood?.trim() || null,
    content_bad: input.contentBad?.trim() || null,
    content_tip: input.contentTip?.trim() || null,
    rating: input.rating ?? null,
    rating_schedule: input.ratingSchedule ?? null,
    rating_stay: input.ratingStay ?? null,
    rating_guide: input.ratingGuide ?? null,
    rating_food: input.ratingFood ?? null,
    image_urls: input.imageUrls ?? [],
    image_url: input.imageUrls?.[0] ?? null,
    updated_at: new Date().toISOString(),
  };

  if (eligibilityId) {
    payload.eligibility_id = eligibilityId;
    payload.booking_id = input.bookingId ?? null;
    payload.customer_profile_id = input.customerProfileId ?? null;

    const existing = await getReviewByEligibilityId(eligibilityId);
    if (existing) {
      if (existing.status === "submitted") {
        return { success: false, error: "already_submitted" };
      }
      const { error } = await supabase
        .from("reviews")
        .update(payload)
        .eq("id", existing.id);

      if (error) {
        return { success: false, error: "update_failed" };
      }
      return { success: true, reviewId: existing.id };
    }
  }

  const { data, error } = await supabase
    .from("reviews")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { success: false, error: "insert_failed" };
  }

  return { success: true, reviewId: String(data.id) };
}

/**
 * Draft 리뷰를 submitted로 전환하여 제출 완료 처리.
 */
export async function submitReview(
  reviewId: string,
  updateData?: Partial<DraftReviewInput>,
): Promise<{ success: boolean; error?: string }> {
  if (!reviewId) {
    return { success: false, error: "invalid_review_id" };
  }

  const existing = await getReviewById(reviewId);
  if (!existing) {
    return { success: false, error: "not_found" };
  }

  if (existing.status === "submitted") {
    return { success: false, error: "already_submitted" };
  }

  const payload: Record<string, unknown> = {
    status: "submitted" as ReviewStatus,
    updated_at: new Date().toISOString(),
  };

  if (updateData) {
    if (updateData.title !== undefined) payload.title = updateData.title.trim();
    if (updateData.content !== undefined) payload.content = updateData.content.trim();
    if (updateData.summary !== undefined) payload.summary = updateData.summary.trim() || null;
    if (updateData.contentGood !== undefined) payload.content_good = updateData.contentGood.trim() || null;
    if (updateData.contentBad !== undefined) payload.content_bad = updateData.contentBad.trim() || null;
    if (updateData.contentTip !== undefined) payload.content_tip = updateData.contentTip.trim() || null;
    if (updateData.rating !== undefined) payload.rating = updateData.rating ?? null;
    if (updateData.ratingSchedule !== undefined) payload.rating_schedule = updateData.ratingSchedule ?? null;
    if (updateData.ratingStay !== undefined) payload.rating_stay = updateData.ratingStay ?? null;
    if (updateData.ratingGuide !== undefined) payload.rating_guide = updateData.ratingGuide ?? null;
    if (updateData.ratingFood !== undefined) payload.rating_food = updateData.ratingFood ?? null;
    if (updateData.imageUrls !== undefined) {
      payload.image_urls = updateData.imageUrls;
      payload.image_url = updateData.imageUrls[0] ?? null;
    }
  }

  const { error } = await supabase
    .from("reviews")
    .update(payload)
    .eq("id", reviewId);

  if (error) {
    return { success: false, error: "update_failed" };
  }

  return { success: true };
}

/** 리뷰 업데이트 (draft 상태에서만 가능) */
export async function updateDraftReview(
  reviewId: string,
  memberId: string,
  updateData: Partial<DraftReviewInput>,
): Promise<{ success: boolean; error?: string }> {
  if (!reviewId || !memberId) {
    return { success: false, error: "invalid_params" };
  }

  const existing = await getReviewById(reviewId);
  if (!existing) {
    return { success: false, error: "not_found" };
  }

  if (existing.member_id !== memberId) {
    return { success: false, error: "unauthorized" };
  }

  if (existing.status === "submitted") {
    return { success: false, error: "already_submitted" };
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updateData.title !== undefined) payload.title = updateData.title.trim();
  if (updateData.content !== undefined) payload.content = updateData.content.trim();
  if (updateData.summary !== undefined) payload.summary = updateData.summary.trim() || null;
  if (updateData.contentGood !== undefined) payload.content_good = updateData.contentGood.trim() || null;
  if (updateData.contentBad !== undefined) payload.content_bad = updateData.contentBad.trim() || null;
  if (updateData.contentTip !== undefined) payload.content_tip = updateData.contentTip.trim() || null;
  if (updateData.rating !== undefined) payload.rating = updateData.rating ?? null;
  if (updateData.ratingSchedule !== undefined) payload.rating_schedule = updateData.ratingSchedule ?? null;
  if (updateData.ratingStay !== undefined) payload.rating_stay = updateData.ratingStay ?? null;
  if (updateData.ratingGuide !== undefined) payload.rating_guide = updateData.ratingGuide ?? null;
  if (updateData.ratingFood !== undefined) payload.rating_food = updateData.ratingFood ?? null;
  if (updateData.imageUrls !== undefined) {
    payload.image_urls = updateData.imageUrls;
    payload.image_url = updateData.imageUrls[0] ?? null;
  }

  const { error } = await supabase
    .from("reviews")
    .update(payload)
    .eq("id", reviewId);

  if (error) {
    return { success: false, error: "update_failed" };
  }

  return { success: true };
}

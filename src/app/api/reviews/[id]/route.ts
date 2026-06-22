import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { getReviewById } from "@/lib/reviews";
import { updateEligibilityStatus } from "@/lib/reviewEligibilities";
import { createNewReviewNotification } from "@/lib/adminNotifications";
import { createReviewReward } from "@/lib/reviewRewards";
import { cancelReviewReminders } from "@/lib/reviewReminders";
import { markProductReviewSummaryStale } from "@/lib/reviewSummaries";
import { getProductIdByBookingId } from "@/lib/bookings/bookingRepository";
import { MAX_REVIEW_IMAGES } from "@/lib/constants/review";

type ReviewPatchBody = {
  action?: "save_draft" | "submit";
  title?: string;
  content?: string;
  summary?: string;
  content_good?: string;
  content_bad?: string;
  content_tip?: string;
  image_urls?: string[];
  rating?: number;
  rating_schedule?: number;
  rating_stay?: number;
  rating_guide?: number;
  rating_food?: number;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);

  const review = await getReviewById(id);
  if (!review) {
    return NextResponse.json({ message: "후기를 찾을 수 없습니다." }, { status: 404 });
  }

  // 회원 후기: 본인만 조회
  if (review.member_id != null) {
    if (!session) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }
    if (review.member_id !== session.memberId) {
      return NextResponse.json({ message: "본인의 후기만 조회할 수 있습니다." }, { status: 403 });
    }
  }
  // 비회원 후기(member_id null): 세션 없이 조회 허용 (reviewId로 본인 작성 확인)

  return NextResponse.json(review);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);

  const review = await getReviewById(id);
  if (!review) {
    return NextResponse.json({ message: "후기를 찾을 수 없습니다." }, { status: 404 });
  }

  // 회원 후기: 세션 필요, 본인만 수정
  if (review.member_id != null) {
    if (!session) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }
    if (review.member_id !== session.memberId) {
      return NextResponse.json({ message: "본인의 후기만 수정할 수 있습니다." }, { status: 403 });
    }
  }
  // 비회원 후기(member_id null): 세션 없이 수정 허용

  if (review.status === "submitted") {
    return NextResponse.json({ message: "이미 제출된 후기는 수정할 수 없습니다." }, { status: 400 });
  }

  const body = (await request.json()) as ReviewPatchBody;
  const action = body.action ?? "save_draft";

  const title = body.title?.trim() ?? review.title;
  const content = body.content?.trim() ?? review.content;
  const summary = body.summary?.trim() ?? review.summary ?? "";
  const contentGood = body.content_good?.trim() ?? review.content_good ?? "";
  const contentBad = body.content_bad?.trim() ?? review.content_bad ?? "";
  const contentTip = body.content_tip?.trim() ?? review.content_tip ?? "";

  const rawImageUrls = (Array.isArray(body.image_urls) ? body.image_urls : review.image_urls ?? [])
    .map((url: unknown) => String(url).trim())
    .filter((url: string) => url.length > 0);
  const imageUrls = rawImageUrls.slice(0, MAX_REVIEW_IMAGES);
  const imageUrl = imageUrls[0] ?? null;

  const parseRating = (val: unknown, fallback?: number): number | null => {
    if (typeof val === "number" && Number.isFinite(val) && val >= 1 && val <= 5) {
      return Math.round(val);
    }
    if (typeof fallback === "number") return fallback;
    return null;
  };

  const rating = parseRating(body.rating, review.rating);
  const ratingSchedule = parseRating(body.rating_schedule, review.rating_schedule);
  const ratingStay = parseRating(body.rating_stay, review.rating_stay);
  const ratingGuide = parseRating(body.rating_guide, review.rating_guide);
  const ratingFood = parseRating(body.rating_food, review.rating_food);

  if (action === "submit") {
    const hasTitleOrSummary = title || summary;
    const hasContent = content || contentGood || contentBad || contentTip;

    if (review.eligibility_id) {
      if (!hasTitleOrSummary) {
        return NextResponse.json({ message: "제목 또는 한줄 요약을 입력해 주세요." }, { status: 400 });
      }
      if (!hasContent) {
        return NextResponse.json({ message: "후기 내용을 입력해 주세요." }, { status: 400 });
      }
      if (rating === null) {
        return NextResponse.json({ message: "전체 만족도를 선택해 주세요." }, { status: 400 });
      }
    } else {
      if (!title || !content) {
        return NextResponse.json({ message: "제목과 내용을 입력해 주세요." }, { status: 400 });
      }
    }
  }

  if (rawImageUrls.length > MAX_REVIEW_IMAGES) {
    return NextResponse.json(
      { message: `이미지는 최대 ${MAX_REVIEW_IMAGES}장까지 첨부할 수 있습니다.` },
      { status: 400 },
    );
  }

  const finalContent = content || buildFallbackContent(contentGood, contentBad, contentTip);
  const newStatus = action === "submit" ? "submitted" : "draft";

  const payload: Record<string, unknown> = {
    title,
    content: finalContent,
    summary: summary || null,
    content_good: contentGood || null,
    content_bad: contentBad || null,
    content_tip: contentTip || null,
    image_url: imageUrl,
    image_urls: imageUrls,
    rating,
    rating_schedule: ratingSchedule,
    rating_stay: ratingStay,
    rating_guide: ratingGuide,
    rating_food: ratingFood,
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from("reviews").update(payload).eq("id", id);

  if (error) {
    return NextResponse.json({ message: "후기 수정에 실패했습니다." }, { status: 500 });
  }

  if (action === "submit") {
    if (review.eligibility_id) {
      await updateEligibilityStatus(review.eligibility_id, "submitted");
      await cancelReviewReminders(review.eligibility_id);
    }
    if (review.booking_id) {
      const productIdForSummary = await getProductIdByBookingId(review.booking_id);
      if (productIdForSummary) await markProductReviewSummaryStale(productIdForSummary);
    }
    await createNewReviewNotification({
      reviewId: id,
      authorName: review.author_name,
      title: title || summary || "후기",
    });
    const reward = await createReviewReward({
      id,
      member_id: review.member_id,
      status: "submitted",
      eligibility_id: review.eligibility_id,
    });
    return NextResponse.json({
      message: "후기가 등록되었습니다.",
      review_id: id,
      rewardCreated: reward.rewardCreated,
      pointsAwarded: reward.rewardCreated ? reward.points : undefined,
    });
  }

  return NextResponse.json({
    message: "임시저장되었습니다.",
    review_id: id,
  });
}

function buildFallbackContent(good?: string, bad?: string, tip?: string): string {
  const parts: string[] = [];
  if (good) parts.push(`[좋았던 점]\n${good}`);
  if (bad) parts.push(`[아쉬웠던 점]\n${bad}`);
  if (tip) parts.push(`[여행 팁]\n${tip}`);
  return parts.join("\n\n");
}

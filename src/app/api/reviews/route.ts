import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getReviews, getReviewByEligibilityId } from "@/lib/reviews";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { createNewReviewNotification } from "@/lib/adminNotifications";
import { getEligibilityById, updateEligibilityStatus } from "@/lib/reviewEligibilities";
import { createReviewReward } from "@/lib/reviewRewards";
import { cancelReviewReminders } from "@/lib/reviewReminders";
import { markProductReviewSummaryStale } from "@/lib/reviewSummaries";
import { getProductIdByBookingId } from "@/lib/travelBookings";

type ReviewBody = {
  title?: string;
  content?: string;
  image_url?: string | null;
  image_urls?: string[];
  rating?: number;
  eligibility_id?: string;
  status?: "draft" | "submitted";
  summary?: string;
  author_name?: string;
  content_good?: string;
  content_bad?: string;
  content_tip?: string;
  rating_schedule?: number;
  rating_stay?: number;
  rating_guide?: number;
  rating_food?: number;
};

const MAX_REVIEW_IMAGES = 10;

export async function GET() {
  const reviews = await getReviews();
  return NextResponse.json(reviews);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);

  const body = (await request.json()) as ReviewBody;
  const eligibilityId = typeof body.eligibility_id === "string" ? body.eligibility_id.trim() : null;
  if (!session) {
    if (eligibilityId) {
      return NextResponse.json(
        { message: "예약 연동 후기를 작성하려면 로그인이 필요합니다." },
        { status: 403 },
      );
    }
  }

  const title = body.title?.trim() ?? "";
  const content = body.content?.trim() ?? "";
  const summary = body.summary?.trim() ?? "";
  const contentGood = body.content_good?.trim() ?? "";
  const contentBad = body.content_bad?.trim() ?? "";
  const contentTip = body.content_tip?.trim() ?? "";
  const rawImageUrls = (Array.isArray(body.image_urls) ? body.image_urls : [])
    .map((url) => String(url).trim())
    .filter((url) => url.length > 0);
  const imageUrls = rawImageUrls.slice(0, MAX_REVIEW_IMAGES);
  const imageUrl = imageUrls[0] ?? body.image_url?.trim() ?? null;
  const rating =
    typeof body.rating === "number" && Number.isFinite(body.rating)
      ? Math.round(body.rating)
      : undefined;
  const isDraft = body.status === "draft";

  const parseDetailRating = (val: unknown): number | null => {
    if (typeof val === "number" && Number.isFinite(val) && val >= 1 && val <= 5) {
      return Math.round(val);
    }
    return null;
  };

  const ratingSchedule = parseDetailRating(body.rating_schedule);
  const ratingStay = parseDetailRating(body.rating_stay);
  const ratingGuide = parseDetailRating(body.rating_guide);
  const ratingFood = parseDetailRating(body.rating_food);

  if (!isDraft) {
    if (eligibilityId) {
      const hasTitleOrSummary = title || summary;
      const hasContent = content || contentGood || contentBad || contentTip;
      if (!hasTitleOrSummary) {
        return NextResponse.json({ message: "제목 또는 한줄 요약을 입력해 주세요." }, { status: 400 });
      }
      if (!hasContent) {
        return NextResponse.json({ message: "후기 내용을 입력해 주세요." }, { status: 400 });
      }
      if (rating === undefined) {
        return NextResponse.json({ message: "전체 만족도를 선택해 주세요." }, { status: 400 });
      }
    } else {
      if (!title || !content) {
        return NextResponse.json({ message: "제목과 내용을 입력해 주세요." }, { status: 400 });
      }
    }
  }

  if (rating !== undefined && (rating < 1 || rating > 5)) {
    return NextResponse.json({ message: "별점은 1점에서 5점 사이로 선택해 주세요." }, { status: 400 });
  }
  if (rawImageUrls.length > MAX_REVIEW_IMAGES) {
    return NextResponse.json(
      { message: `이미지는 최대 ${MAX_REVIEW_IMAGES}장까지 첨부할 수 있습니다.` },
      { status: 400 },
    );
  }
  if (imageUrls.some((url) => url.length > 2000) || (imageUrl && imageUrl.length > 2000)) {
    return NextResponse.json({ message: "이미지 URL이 너무 깁니다." }, { status: 400 });
  }

  let bookingId: string | null = null;
  let customerProfileId: string | null = null;

  if (eligibilityId) {
    const eligibility = await getEligibilityById(eligibilityId);

    if (!eligibility) {
      return NextResponse.json({ message: "유효하지 않은 후기 작성 권한입니다." }, { status: 404 });
    }

    if (!session) {
      return NextResponse.json(
        { message: "예약 연동 후기를 작성하려면 로그인이 필요합니다." },
        { status: 403 },
      );
    }
    if (eligibility.claimed_by_member_id !== session.memberId) {
      return NextResponse.json({ message: "본인에게 부여된 후기 작성 권한이 아닙니다." }, { status: 403 });
    }

    if (!["eligible", "claimed"].includes(eligibility.status)) {
      if (eligibility.status === "submitted") {
        return NextResponse.json({ message: "이미 후기를 작성한 여행건입니다." }, { status: 409 });
      }
      if (eligibility.status === "expired") {
        return NextResponse.json({ message: "후기 작성 기한이 만료되었습니다." }, { status: 400 });
      }
      if (eligibility.status === "blocked") {
        return NextResponse.json({ message: "후기 작성이 차단된 상태입니다." }, { status: 400 });
      }
      return NextResponse.json({ message: "후기를 작성할 수 없는 상태입니다." }, { status: 400 });
    }

    const existingReview = await getReviewByEligibilityId(eligibilityId);
    if (existingReview) {
      if (existingReview.status === "submitted" && !isDraft) {
        return NextResponse.json({ message: "이미 후기를 작성한 여행건입니다." }, { status: 409 });
      }

      if (existingReview.status === "draft") {
        const updatePayload: Record<string, unknown> = {
          title,
          content: content || buildFallbackContent(contentGood, contentBad, contentTip),
          summary: summary || null,
          content_good: contentGood || null,
          content_bad: contentBad || null,
          content_tip: contentTip || null,
          image_url: imageUrl,
          image_urls: imageUrls,
          rating: rating ?? null,
          rating_schedule: ratingSchedule,
          rating_stay: ratingStay,
          rating_guide: ratingGuide,
          rating_food: ratingFood,
          status: isDraft ? "draft" : "submitted",
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from("reviews")
          .update(updatePayload)
          .eq("id", existingReview.id);

        if (updateError) {
          return NextResponse.json({ message: "후기 수정에 실패했습니다." }, { status: 500 });
        }

        if (!isDraft) {
          await updateEligibilityStatus(eligibilityId, "submitted");
          await cancelReviewReminders(eligibilityId);
          const productIdForSummary = await getProductIdByBookingId(eligibility.booking_id);
          if (productIdForSummary) await markProductReviewSummaryStale(productIdForSummary);
          await createNewReviewNotification({
            reviewId: existingReview.id,
            authorName: session.name,
            title: title || summary || "후기",
          });
          let rewardCreated = false;
          let pointsAwarded: number | undefined;
          if (session) {
            const reward = await createReviewReward({
              id: existingReview.id,
              member_id: session.memberId,
              status: "submitted",
              eligibility_id: eligibilityId,
            });
            rewardCreated = reward.rewardCreated;
            pointsAwarded = reward.rewardCreated ? reward.points : undefined;
          }
          return NextResponse.json({
            message: isDraft ? "임시저장되었습니다." : "후기가 등록되었습니다.",
            review_id: existingReview.id,
            eligibility_based: true,
            rewardCreated,
            pointsAwarded,
          }, { status: isDraft ? 200 : 201 });
        }
      }
    }

    bookingId = eligibility.booking_id;
    customerProfileId = eligibility.customer_profile_id;
  }

  const finalContent = content || buildFallbackContent(contentGood, contentBad, contentTip);

  const guestAuthorName = (body.author_name?.trim() || "비회원").slice(0, 100);
  const payload: Record<string, unknown> = {
    member_id: session?.memberId ?? null,
    author_name: session?.name ?? guestAuthorName,
    title,
    content: finalContent,
    summary: summary || null,
    content_good: contentGood || null,
    content_bad: contentBad || null,
    content_tip: contentTip || null,
    image_url: imageUrl,
    image_urls: imageUrls,
    rating: rating ?? null,
    rating_schedule: ratingSchedule,
    rating_stay: ratingStay,
    rating_guide: ratingGuide,
    rating_food: ratingFood,
    status: isDraft ? "draft" : "submitted",
    updated_at: new Date().toISOString(),
  };

  if (eligibilityId) {
    payload.eligibility_id = eligibilityId;
    payload.booking_id = bookingId;
    payload.customer_profile_id = customerProfileId;
  }

  const insertResult = await supabase
    .from("reviews")
    .insert(payload)
    .select("id,title,author_name")
    .maybeSingle();

  if (insertResult.error) {
    if (insertResult.error.code === "23505" && insertResult.error.message?.includes("eligibility")) {
      return NextResponse.json({ message: "이미 후기를 작성한 여행건입니다." }, { status: 409 });
    }

    const insertLegacy = await supabase
      .from("reviews")
      .insert({
        member_id: session?.memberId ?? null,
        author_name: session?.name ?? guestAuthorName,
        title,
        content: finalContent,
        image_url: imageUrl,
      })
      .select("id,title,author_name")
      .maybeSingle();

    if (insertLegacy.error || !insertLegacy.data) {
      return NextResponse.json({ message: "후기 등록에 실패했습니다." }, { status: 500 });
    }

    if (!isDraft) {
      await createNewReviewNotification({
        reviewId: String(insertLegacy.data.id),
        authorName: String(insertLegacy.data.author_name),
        title: String(insertLegacy.data.title),
      });
    }

    return NextResponse.json({
      message: isDraft ? "임시저장되었습니다." : "후기가 등록되었습니다.",
      review_id: String(insertLegacy.data.id),
    }, { status: isDraft ? 200 : 201 });
  }

  if (!isDraft && eligibilityId) {
    await updateEligibilityStatus(eligibilityId, "submitted");
  }

  if (!isDraft && insertResult.data) {
    await createNewReviewNotification({
      reviewId: String(insertResult.data.id),
      authorName: String(insertResult.data.author_name),
      title: String(insertResult.data.title),
    });
    if (eligibilityId && bookingId) {
      const productIdForSummary = await getProductIdByBookingId(bookingId);
      if (productIdForSummary) await markProductReviewSummaryStale(productIdForSummary);
    }
    if (eligibilityId) {
      await cancelReviewReminders(eligibilityId);
    }
    let rewardCreated = false;
    let pointsAwarded: number | undefined;
    if (session) {
      const reward = await createReviewReward({
        id: String(insertResult.data.id),
        member_id: session.memberId,
        status: "submitted",
        eligibility_id: eligibilityId,
      });
      rewardCreated = reward.rewardCreated;
      pointsAwarded = reward.rewardCreated ? reward.points : undefined;
    }
    return NextResponse.json({
      message: "후기가 등록되었습니다.",
      review_id: String(insertResult.data.id),
      eligibility_based: true,
      rewardCreated,
      pointsAwarded,
    }, { status: 201 });
  }

  return NextResponse.json({
    message: isDraft ? "임시저장되었습니다." : "후기가 등록되었습니다.",
    review_id: insertResult.data ? String(insertResult.data.id) : undefined,
    eligibility_based: !!eligibilityId,
  }, { status: isDraft ? 200 : 201 });
}

function buildFallbackContent(good?: string, bad?: string, tip?: string): string {
  const parts: string[] = [];
  if (good) parts.push(`[좋았던 점]\n${good}`);
  if (bad) parts.push(`[아쉬웠던 점]\n${bad}`);
  if (tip) parts.push(`[여행 팁]\n${tip}`);
  return parts.join("\n\n");
}

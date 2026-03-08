/**
 * PR20: 관리자 리뷰 Moderation 액션 API.
 */
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { hideReview, restoreReview, markReviewUnderReview, resolveReviewReport } from "@/lib/reviewModerationActions";
import { getProductIdByBookingId } from "@/lib/travelBookings";
import { getReviewById } from "@/lib/reviews";
import { markProductReviewSummaryStale } from "@/lib/reviewSummaries";

type RouteContext = { params: Promise<{ id: string }> };

type Body = { action?: string; reason?: string };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: reviewId } = await context.params;
  if (!reviewId) {
    return NextResponse.json({ message: "리뷰 ID가 필요합니다." }, { status: 400 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    // no body
  }
  const action = body.action ?? "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : undefined;

  const review = await getReviewById(reviewId);
  if (!review) {
    return NextResponse.json({ message: "후기를 찾을 수 없습니다." }, { status: 404 });
  }

  let ok = false;
  switch (action) {
    case "hide":
      ok = await hideReview(reviewId, reason);
      break;
    case "restore":
      ok = await restoreReview(reviewId);
      break;
    case "under_review":
      ok = await markReviewUnderReview(reviewId, reason);
      break;
    case "resolve":
      ok = await resolveReviewReport(reviewId);
      break;
    default:
      return NextResponse.json({ message: "지원하지 않는 액션입니다." }, { status: 400 });
  }

  if (!ok) {
    return NextResponse.json({ message: "상태 변경에 실패했습니다." }, { status: 500 });
  }

  if (review.booking_id) {
    const productId = await getProductIdByBookingId(review.booking_id);
    if (productId) await markProductReviewSummaryStale(productId);
  }

  return NextResponse.json({ success: true, action });
}

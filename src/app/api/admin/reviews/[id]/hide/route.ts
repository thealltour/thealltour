import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getReviewById } from "@/lib/reviews";
import { markProductReviewSummaryStale } from "@/lib/reviewSummaries";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getProductIdByBookingId } from "@/lib/bookings/bookingRepository";

type RouteContext = { params: Promise<{ id: string }> };

type PostBody = { action?: "hide" | "restore" };

/** POST: 관리자 전용. 리뷰 숨김(hidden) 또는 복구(submitted). */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: reviewId } = await context.params;
  if (!reviewId) {
    return NextResponse.json({ message: "리뷰 ID가 필요합니다." }, { status: 400 });
  }

  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    // no body
  }
  const action = body.action === "restore" ? "restore" : "hide";

  const review = await getReviewById(reviewId);
  if (!review) {
    return NextResponse.json({ message: "후기를 찾을 수 없습니다." }, { status: 404 });
  }

  const newStatus = action === "hide" ? "hidden" : "submitted";
  const { error } = await supabaseAdmin
    .from("reviews")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", reviewId);

  if (error) {
    return NextResponse.json({ message: "상태 변경에 실패했습니다." }, { status: 500 });
  }

  if (review.booking_id) {
    const productIdForSummary = await getProductIdByBookingId(review.booking_id);
    if (productIdForSummary) await markProductReviewSummaryStale(productIdForSummary);
  }

  return NextResponse.json({
    message: action === "hide" ? "후기가 숨김 처리되었습니다." : "후기가 복구되었습니다.",
    status: newStatus,
  });
}

import { NextResponse } from "next/server";
import { requireMemberSession } from "@/lib/apiAuth";
import { getReviewById } from "@/lib/reviews";
import { reportReview } from "@/lib/reviewReports";

type RouteContext = { params: Promise<{ id: string }> };

type PostBody = { reason?: string };

/** POST: 리뷰 신고. 로그인 필수, 리뷰당 1회. PR24: 자동 moderation 연동. */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;
  const memberId = auth.session.memberId;

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
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ message: "신고 사유를 입력해 주세요." }, { status: 400 });
  }

  const review = await getReviewById(reviewId);
  if (!review) {
    return NextResponse.json({ message: "후기를 찾을 수 없습니다." }, { status: 404 });
  }
  if (review.status !== "submitted") {
    return NextResponse.json({ message: "공개된 후기에만 신고할 수 있습니다." }, { status: 400 });
  }

  const result = await reportReview(reviewId, reason, memberId);

  if (!result.success) {
    const status = result.message?.includes("이미") ? 409 : 500;
    return NextResponse.json(
      { message: result.message ?? "신고 접수에 실패했습니다.", success: false },
      { status },
    );
  }

  return NextResponse.json({
    success: true,
    autoModerationApplied: result.autoModerationApplied,
    nextStatus: result.nextStatus,
  });
}

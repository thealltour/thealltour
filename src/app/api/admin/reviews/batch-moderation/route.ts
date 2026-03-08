/**
 * PR24: 관리자 리뷰 일괄 Moderation API.
 */
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  batchHideReviews,
  batchRestoreReviews,
  batchMarkReviewsUnderReview,
  batchResolveReviewReports,
} from "@/lib/reviewModerationActions";

type Body = { action: string; reviewIds: string[] };

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 본문이 필요합니다." }, { status: 400 });
  }

  const { action, reviewIds } = body;
  if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
    return NextResponse.json({ message: "reviewIds 배열이 필요합니다." }, { status: 400 });
  }

  const ids = reviewIds.filter((id) => typeof id === "string");
  let result: { successIds: string[]; failedIds: string[]; totalProcessed: number };

  switch (action) {
    case "hide":
      result = await batchHideReviews(ids);
      break;
    case "restore":
      result = await batchRestoreReviews(ids);
      break;
    case "under_review":
      result = await batchMarkReviewsUnderReview(ids);
      break;
    case "resolve":
      result = await batchResolveReviewReports(ids);
      break;
    default:
      return NextResponse.json({ message: "지원하지 않는 액션입니다." }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    ...result,
  });
}

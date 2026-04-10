import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getAdminReviewModerationSummary } from "@/lib/adminReviewModerationSummary";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  try {
    const summary = await getAdminReviewModerationSummary();
    return NextResponse.json(summary);
  } catch (e) {
    console.error("[admin/reviews/summary]", e);
    return NextResponse.json({ message: "리뷰 요약을 불러오지 못했습니다." }, { status: 500 });
  }
}

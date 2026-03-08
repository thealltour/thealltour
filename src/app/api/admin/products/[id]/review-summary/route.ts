/**
 * PR14: 상품별 리뷰 요약 재생성 API.
 */
import { NextResponse } from "next/server";
import { getProductByIdFresh } from "@/lib/products";
import { generateAndBuildPayload } from "@/lib/ai/reviewSummary";
import { upsertProductReviewSummary } from "@/lib/reviewSummaries";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id: productId } = await context.params;
  if (!productId) {
    return NextResponse.json({ message: "상품 ID가 필요합니다." }, { status: 400 });
  }

  let body: { action?: string } = {};
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    // no body
  }
  if (body.action !== "regenerate") {
    return NextResponse.json({ message: "action은 regenerate 여야 합니다." }, { status: 400 });
  }

  const product = await getProductByIdFresh(productId);
  if (!product) {
    return NextResponse.json({ message: "상품을 찾을 수 없습니다." }, { status: 404 });
  }

  const result = await generateAndBuildPayload(productId);
  if (!result.success) {
    // 생성 실패 시 status='failed'로 저장해 관리자에서 재시도 가능하게 함
    await upsertProductReviewSummary(productId, {
      review_count: 0,
      average_rating: null,
      summary_text: null,
      positive_points: [],
      negative_points: [],
      recommended_for: [],
      source_review_ids: [],
      status: "failed",
    });
    return NextResponse.json(
      { message: result.reason ?? "요약 생성에 실패했습니다." },
      { status: 400 },
    );
  }

  const summary = await upsertProductReviewSummary(productId, result.payload);
  if (!summary) {
    return NextResponse.json(
      { message: "요약 저장에 실패했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    reviewCount: summary.review_count,
    averageRating: summary.average_rating,
    status: summary.status,
  });
}

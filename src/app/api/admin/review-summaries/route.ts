/**
 * PR14: 관리자 리뷰 요약 목록 API.
 */
import { NextResponse } from "next/server";
import { getReviewSummariesList } from "@/lib/reviewSummaries";
import { getProductByIdFresh } from "@/lib/products";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  const { rows, total } = await getReviewSummariesList({ limit, offset });

  const withTitles = await Promise.all(
    rows.map(async (row) => {
      const product = await getProductByIdFresh(row.product_id);
      return {
        ...row,
        product_title: product?.title ?? null,
      };
    }),
  );

  return NextResponse.json({ rows: withTitles, total });
}

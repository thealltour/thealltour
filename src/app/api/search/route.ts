import { NextRequest, NextResponse } from "next/server";
import { searchProductsByParams } from "@/lib/search/searchProducts";
import { parseSearchParams } from "@/lib/search/searchQueryParams";
import type { SearchApiResponse } from "@/types/search";

/**
 * GET /api/search
 * Load More용. q, destination, theme, product_line, sort, page 쿼리 파싱 후
 * searchProductsByParams 호출하여 { items, page, totalPages } 반환.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const params: Record<string, string | string[] | undefined> = {};
  searchParams.forEach((value, key) => {
    const existing = params[key];
    if (existing === undefined) params[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else params[key] = [existing, value];
  });
  const state = parseSearchParams(params);
  const hasCondition = state.q || state.destination || state.theme || state.product_line;
  if (!hasCondition) {
    return NextResponse.json<SearchApiResponse>(
      { items: [], page: 1, totalPages: 0 },
      { status: 200 },
    );
  }
  const result = await searchProductsByParams({
    q: state.q,
    destination: state.destination ?? null,
    theme: state.theme ?? null,
    product_line: state.product_line ?? null,
    sort: state.sort,
    page: state.page ?? 1,
  });
  const body: SearchApiResponse = {
    items: result.items,
    page: result.page,
    totalPages: result.totalPages,
  };
  return NextResponse.json(body);
}

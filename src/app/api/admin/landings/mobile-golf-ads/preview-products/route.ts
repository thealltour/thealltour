import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { resolveProductsForGolfProductRail } from "@/lib/adminMobileGolfAds/resolveMobileGolfAdProducts";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const idsParam = request.nextUrl.searchParams.get("ids")?.trim() ?? "";
  const source = request.nextUrl.searchParams.get("source") === "home_default"
    ? "home_default"
    : "custom";
  const productIds = idsParam
    ? idsParam.split(",").map((id) => id.trim()).filter(Boolean)
    : [];

  try {
    const products = await resolveProductsForGolfProductRail(source, productIds);
    return NextResponse.json({ products });
  } catch (error) {
    const message = error instanceof Error ? error.message : "상품 조회에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

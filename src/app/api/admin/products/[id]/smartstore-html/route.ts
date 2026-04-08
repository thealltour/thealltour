import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getProductByIdFresh } from "@/lib/products";
import { resolveProductNoticesForDetailPage } from "@/lib/noticeTemplates";
import { buildSmartstoreDetailHtmlFromProduct } from "@/lib/smartstore/buildSmartstoreDetailHtml";
import type { SmartstoreHtmlApiResponse } from "@/lib/smartstore/smartstoreHtml.types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<SmartstoreHtmlApiResponse>> {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return auth.res as NextResponse<SmartstoreHtmlApiResponse>;
  }

  const { id } = await context.params;
  const rawId = id?.trim();
  if (!rawId) {
    return NextResponse.json(
      { ok: false, message: "상품 ID가 필요합니다." },
      { status: 400 },
    );
  }

  try {
    const product = await getProductByIdFresh(rawId);
    if (!product) {
      return NextResponse.json({ ok: false, message: "상품을 찾을 수 없습니다." }, { status: 404 });
    }

    const notices = await resolveProductNoticesForDetailPage(product);
    const { html, meta } = buildSmartstoreDetailHtmlFromProduct(product, notices);

    return NextResponse.json({ ok: true, html, meta });
  } catch (e) {
    console.error("[api/admin/products/[id]/smartstore-html]", e);
    return NextResponse.json(
      { ok: false, message: "HTML 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

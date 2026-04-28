import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getProductByIdFresh } from "@/lib/products";
import { resolveProductNoticesForDetailPage } from "@/lib/noticeTemplates";
import { mapProductToBlogPostViewModel } from "@/lib/blog/mapProductToBlogPostViewModel";
import { buildBandHookText } from "@/lib/blog/buildBandHookText";
import type { BandHookApiResponse } from "@/lib/blog/blogPost.types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<BandHookApiResponse>> {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return auth.res as NextResponse<BandHookApiResponse>;
  }

  const { id } = await context.params;
  const rawId = id?.trim();

  if (!rawId) {
    return NextResponse.json({ ok: false, message: "상품 ID가 필요합니다." }, { status: 400 });
  }

  try {
    const product = await getProductByIdFresh(rawId);
    if (!product) {
      return NextResponse.json({ ok: false, message: "상품을 찾을 수 없습니다." }, { status: 404 });
    }

    const notices = await resolveProductNoticesForDetailPage(product);
    const vm = mapProductToBlogPostViewModel(product, notices);
    const result = buildBandHookText(vm);

    return NextResponse.json({
      ok: true,
      text: result.text,
      meta: result.meta,
      hookCandidates: result.hookCandidates,
    });
  } catch (e) {
    console.error("[api/admin/products/[id]/band-hook]", e);
    return NextResponse.json(
      { ok: false, message: "밴드 훅 문구 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

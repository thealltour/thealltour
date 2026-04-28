import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getProductByIdFresh } from "@/lib/products";
import { resolveProductNoticesForDetailPage } from "@/lib/noticeTemplates";
import { mapProductToBlogPostViewModel } from "@/lib/blog/mapProductToBlogPostViewModel";
import { buildKakaoChannelPostText } from "@/lib/blog/buildKakaoChannelPostText";
import type { KakaoPostApiResponse } from "@/lib/blog/blogPost.types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<KakaoPostApiResponse>> {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return auth.res as NextResponse<KakaoPostApiResponse>;
  }

  const { id } = await context.params;
  const rawId = id?.trim();

  if (!rawId) {
    return NextResponse.json({ ok: false, message: "상품 ID가 필요합니다." }, { status: 400 });
  }

  try {
    const product = await getProductByIdFresh(rawId);

    if (!product) {
      return NextResponse.json({ ok: false, message: "상품 없음" }, { status: 404 });
    }

    const notices = await resolveProductNoticesForDetailPage(product);
    const vm = mapProductToBlogPostViewModel(product, notices);
    const result = buildKakaoChannelPostText(vm);

    return NextResponse.json({
      ok: true,
      text: result.text,
      hookCandidates: result.hookCandidates,
      meta: result.meta,
    });
  } catch (e) {
    console.error("[api/admin/products/[id]/kakao-post]", e);
    return NextResponse.json(
      { ok: false, message: "카카오채널 게시글 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

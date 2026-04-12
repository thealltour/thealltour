import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getProductByIdFresh } from "@/lib/products";
import { resolveProductNoticesForDetailPage } from "@/lib/noticeTemplates";
import { mapProductToBlogPostViewModel } from "@/lib/blog/mapProductToBlogPostViewModel";
import { buildBlogPostBundle } from "@/lib/blog/buildBlogPostText";
import type { BlogPostApiResponse } from "@/lib/blog/blogPost.types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<BlogPostApiResponse>> {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return auth.res as NextResponse<BlogPostApiResponse>;
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
    const bundle = buildBlogPostBundle(vm);

    return NextResponse.json({ ok: true, ...bundle });
  } catch (e) {
    console.error("[api/admin/products/[id]/blog-post]", e);
    return NextResponse.json(
      { ok: false, message: "블로그 텍스트 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

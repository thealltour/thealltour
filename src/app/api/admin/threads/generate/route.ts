import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getProductByIdFresh } from "@/lib/products";
import { resolveProductNoticesForDetailPage } from "@/lib/noticeTemplates";
import { mapProductToBlogPostViewModel } from "@/lib/blog/mapProductToBlogPostViewModel";
import { generateThreadCopy } from "@/lib/threads/generateThreadCopy";
import {
  composeThreadDraft,
  isThreadsMarketingMode,
  type ThreadsMarketingMode,
} from "@/lib/threads/threadCopy.types";

type GenerateBody = {
  productId?: string;
  marketingMode?: string;
};

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ ok: false, message: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const productId = body.productId?.trim() ?? "";
  if (!productId) {
    return NextResponse.json({ ok: false, message: "상품 ID가 필요합니다." }, { status: 400 });
  }
  if (!isThreadsMarketingMode(body.marketingMode)) {
    return NextResponse.json(
      { ok: false, message: "marketingMode는 TIMEDEAL, CURATION, SEASONAL_EXPERIENCE 중 하나여야 합니다." },
      { status: 400 },
    );
  }
  const marketingMode: ThreadsMarketingMode = body.marketingMode;

  try {
    const product = await getProductByIdFresh(productId);
    if (!product) {
      return NextResponse.json({ ok: false, message: "상품을 찾을 수 없습니다." }, { status: 404 });
    }

    const notices = await resolveProductNoticesForDetailPage(product);
    const vm = mapProductToBlogPostViewModel(product, notices);
    const copy = await generateThreadCopy(vm, marketingMode);

    return NextResponse.json({
      ok: true,
      productId,
      marketingMode,
      copy,
      draftContent: composeThreadDraft(copy),
      heroImageUrl: vm.heroImageUrl ?? null,
    });
  } catch (error) {
    console.error("[api/admin/threads/generate]", error);
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "스레드 카피 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

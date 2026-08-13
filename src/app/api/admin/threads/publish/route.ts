import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { publishToThreads, ThreadsClientError } from "@/lib/threads/threadsClient";

type PublishBody = {
  draftContent?: string;
  imageUrl?: string;
  targetKeyword?: string;
  productId?: string;
};

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: PublishBody;
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    return NextResponse.json({ ok: false, message: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const draftContent = body.draftContent?.trim() ?? "";
  const productId = body.productId?.trim() ?? "";
  const targetKeyword = body.targetKeyword?.trim() ?? "";
  const imageUrl = body.imageUrl?.trim() || undefined;

  if (!draftContent) {
    return NextResponse.json({ ok: false, message: "게시할 원고가 비어 있습니다." }, { status: 400 });
  }
  if (!productId) {
    return NextResponse.json({ ok: false, message: "상품 ID가 필요합니다." }, { status: 400 });
  }
  if (!targetKeyword) {
    return NextResponse.json({ ok: false, message: "targetKeyword가 필요합니다." }, { status: 400 });
  }

  try {
    const threads = await publishToThreads({ text: draftContent, imageUrl });
    return NextResponse.json({
      ok: true,
      productId,
      targetKeyword,
      publishedAt: new Date().toISOString(),
      threads,
      logId: null,
    });
  } catch (error) {
    console.error("[api/admin/threads/publish]", error);
    if (error instanceof ThreadsClientError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.httpStatus });
    }
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "스레드 게시에 실패했습니다.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

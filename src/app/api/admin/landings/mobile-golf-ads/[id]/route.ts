import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  deleteAdminMobileGolfAd,
  getAdminMobileGolfAd,
  MobileGolfAdServiceError,
  updateAdminMobileGolfAd,
} from "@/lib/adminMobileGolfAds/service";
import type { MobileGolfAdLandingInput } from "@/lib/adminMobileGolfAds/types";

type PatchBody = Partial<MobileGolfAdLandingInput>;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  try {
    const item = await getAdminMobileGolfAd(id);
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof MobileGolfAdServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "조회에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON 본문이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const existing = await getAdminMobileGolfAd(id);
    const item = await updateAdminMobileGolfAd(id, {
      title: body.title ?? existing.title,
      slug: body.slug ?? existing.slug,
      heroImageUrl: body.heroImageUrl ?? existing.heroImageUrl,
      bodyDoc: body.bodyDoc ?? existing.bodyDoc,
      seoTitle: body.seoTitle !== undefined ? body.seoTitle : existing.seoTitle,
      seoDescription:
        body.seoDescription !== undefined ? body.seoDescription : existing.seoDescription,
    });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof MobileGolfAdServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "수정 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  try {
    await deleteAdminMobileGolfAd(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof MobileGolfAdServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "삭제 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

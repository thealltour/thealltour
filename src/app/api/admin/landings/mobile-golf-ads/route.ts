import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  createAdminMobileGolfAd,
  listAdminMobileGolfAds,
  MobileGolfAdServiceError,
} from "@/lib/adminMobileGolfAds/service";
import { createEmptyTipTapBodyDoc } from "@/lib/adminMobileGolfAds/bodyDoc";
import type { MobileGolfAdLandingInput } from "@/lib/adminMobileGolfAds/types";

type PostBody = Partial<MobileGolfAdLandingInput>;

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  try {
    const result = await listAdminMobileGolfAds();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "목록을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "JSON 본문이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const item = await createAdminMobileGolfAd({
      title: body.title ?? "",
      slug: body.slug ?? "",
      heroImageUrl: body.heroImageUrl ?? "",
      bodyDoc: body.bodyDoc ?? createEmptyTipTapBodyDoc(),
      seoTitle: body.seoTitle,
      seoDescription: body.seoDescription,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof MobileGolfAdServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

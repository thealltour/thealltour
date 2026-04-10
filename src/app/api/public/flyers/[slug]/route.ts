import { NextResponse } from "next/server";
import { fetchPublicFlyerBySlug } from "@/lib/flyers/fetchPublicFlyerBySlug";
import { isValidPublicFlyerSlug, type PublicFlyerApiError, type PublicFlyerApiSuccess } from "@/lib/flyers/publicFlyer";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse<PublicFlyerApiSuccess | PublicFlyerApiError>> {
  const { slug: rawSlug } = await context.params;
  const slug = rawSlug?.trim() ?? "";
  if (!isValidPublicFlyerSlug(slug)) {
    return NextResponse.json({ ok: false, message: "유효하지 않은 링크입니다." }, { status: 400 });
  }

  let loaded;
  try {
    loaded = await fetchPublicFlyerBySlug(slug);
  } catch {
    return NextResponse.json({ ok: false, message: "유인물을 불러오지 못했습니다." }, { status: 500 });
  }
  if (!loaded) {
    return NextResponse.json({ ok: false, message: "유인물을 찾을 수 없습니다." }, { status: 404 });
  }

  const payload: PublicFlyerApiSuccess = {
    ok: true,
    draft: loaded.draft,
    displayTitle: loaded.displayTitle,
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}

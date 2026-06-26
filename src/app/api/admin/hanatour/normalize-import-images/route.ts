/**
 * POST /api/admin/hanatour/normalize-import-images
 *
 * HanatourImportV1 JSON의 외부 이미지 URL을 Supabase product-images로 재업로드(JPG) 후
 * 공개 URL로 치환한다. 실패한 URL은 원본을 유지한다.
 *
 * Body: { payload: HanatourImportV1 }
 * Response: { payload: HanatourImportV1, stats: NormalizeImportImageStats }
 */
import { NextRequest, NextResponse } from "next/server";
import { isHanatourImportV1 } from "@/lib/admin/hanatourImport/validate";
import { normalizeHanatourImportImages } from "@/lib/admin/hanatourImport/normalizeHanatourImportImages";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { payload?: unknown };
    const payload = body?.payload;
    if (!payload || !isHanatourImportV1(payload)) {
      return NextResponse.json({ error: "유효한 HanatourImportV1 payload가 필요합니다." }, { status: 400 });
    }

    const { payload: normalized, stats } = await normalizeHanatourImportImages(payload);

    return NextResponse.json({ payload: normalized, stats });
  } catch (e) {
    const message = e instanceof Error ? e.message : "normalize-import-images 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/modetour/normalize-import-images
 *
 * ModetourImportV1 JSON의 외부 이미지 URL을 Supabase product-images로 재업로드(JPG) 후
 * 공개 URL로 치환한다. 실패한 URL은 원본을 유지한다.
 *
 * Body: { payload: ModetourImportV1 }
 * Response: { payload: ModetourImportV1, stats: NormalizeImportImageStats }
 *
 * admin 인증: middleware (theall_admin_auth)
 */
import { NextRequest, NextResponse } from "next/server";
import { isModetourImportV1 } from "@/lib/admin/modetourImport/validate";
import { normalizeModetourImportImages } from "@/lib/admin/modetourImport/normalizeModetourImportImages";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { payload?: unknown };
    const payload = body?.payload;
    if (!payload || !isModetourImportV1(payload)) {
      return NextResponse.json({ error: "유효한 ModetourImportV1 payload가 필요합니다." }, { status: 400 });
    }

    const { payload: normalized, stats } = await normalizeModetourImportImages(payload);

    return NextResponse.json({ payload: normalized, stats });
  } catch (e) {
    const message = e instanceof Error ? e.message : "normalize-import-images 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

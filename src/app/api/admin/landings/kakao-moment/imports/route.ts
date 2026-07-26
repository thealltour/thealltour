import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { listKakaoMomentImports } from "@/lib/adminLandings/kakaoMomentImportService";

export const runtime = "nodejs";

/** GET /api/admin/landings/kakao-moment/imports */
export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  try {
    const imports = await listKakaoMomentImports();
    return NextResponse.json({ imports });
  } catch (err) {
    console.error("[api/admin/landings/kakao-moment/imports]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "임포트 목록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

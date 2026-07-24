import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { fetchKakaoSyncAnalytics } from "@/lib/adminLandings/kakaoSyncAnalyticsService";
import { parseKakaoSyncAnalyticsRangeParam } from "@/lib/adminLandings/kakaoSyncAnalyticsModels";

export const runtime = "nodejs";

/** GET /api/admin/landings/kakao-sync/analytics */
export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  try {
    const range = parseKakaoSyncAnalyticsRangeParam(request.nextUrl.searchParams.get("range"));
    const data = await fetchKakaoSyncAnalytics({ range });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/admin/landings/kakao-sync/analytics]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "카카오싱크 성과를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

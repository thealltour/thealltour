import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { fetchLandingAnalytics } from "@/lib/adminLandings/analyticsService";
import {
  parseLandingAnalyticsRangeParam,
  parseLandingAnalyticsSortParam,
} from "@/lib/adminLandings/landingAnalyticsModels";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const range = parseLandingAnalyticsRangeParam(searchParams.get("range"));
  const sort = parseLandingAnalyticsSortParam(searchParams.get("sort"));

  try {
    const result = await fetchLandingAnalytics({ range, sort });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "랜딩 성과를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

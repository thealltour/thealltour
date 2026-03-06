import { NextRequest, NextResponse } from "next/server";
import { getAdminCounts } from "@/lib/adminCounts";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminAnalyticsOverview, type AdminAnalyticsOverview } from "@/lib/adminAnalytics";

/** analytics 조회 실패 시 반환할 빈 overview. 후속 PR에서 AdminDashboardKpiSection KPI/Top list 렌더에 사용. */
function emptyAnalyticsOverview(): AdminAnalyticsOverview {
  return {
    summary: {
      headerNavClicks: 0,
      megaMenuClicks: 0,
      searchSubmits: 0,
      searchResultClicks: 0,
      searchNoResultCount: 0,
      ctaClicks: 0,
      landingViews: 0,
      landingProductClicks: 0,
      productCardClicks: 0,
    },
    topHeaderItems: [],
    topMegaMenuItems: [],
    topCtas: [],
    topSearchKeywords: [],
    topNoResultKeywords: [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const range = searchParams.get("range") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;

    const [counts, unreadNotificationCount] = await Promise.all([
      getAdminCounts(),
      prepareAdminNotificationsAndGetUnreadCount(),
    ]);

    let analytics: AdminAnalyticsOverview;
    try {
      analytics = await getAdminAnalyticsOverview({ range, from, to });
    } catch (err) {
      console.error("[admin/dashboard] analytics overview failed", err);
      analytics = emptyAnalyticsOverview();
    }

    return NextResponse.json({ counts, unreadNotificationCount, analytics });
  } catch (error) {
    console.error("Failed to load admin dashboard data", error);
    return NextResponse.json({ message: "Failed to load admin dashboard data" }, { status: 500 });
  }
}


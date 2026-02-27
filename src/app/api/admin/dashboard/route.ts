import { NextRequest, NextResponse } from "next/server";
import { getAdminCounts } from "@/lib/adminCounts";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const range = searchParams.get("range") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;

    // 현재는 getAdminCounts가 전역 통계를 반환하지만
    // 향후 range / from / to 값에 따라 필터링 가능하도록 확장 여지를 남긴다.

    const [counts, unreadNotificationCount] = await Promise.all([
      getAdminCounts(),
      prepareAdminNotificationsAndGetUnreadCount(),
    ]);

    return NextResponse.json({ counts, unreadNotificationCount });
  } catch (error) {
    console.error("Failed to load admin dashboard data", error);
    return NextResponse.json({ message: "Failed to load admin dashboard data" }, { status: 500 });
  }
}


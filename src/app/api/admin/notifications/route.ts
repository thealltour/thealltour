import { NextResponse } from "next/server";
import { getAdminNotifications, getUnreadNotificationCount } from "@/lib/adminNotifications";

export async function GET() {
  const [notifications, unreadCount] = await Promise.all([
    getAdminNotifications(),
    getUnreadNotificationCount(),
  ]);

  return NextResponse.json({
    unreadCount,
    notifications,
  });
}

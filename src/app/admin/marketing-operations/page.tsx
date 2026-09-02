import { MarketingOperationsPageBody } from "@/components/admin/marketing-operations/MarketingOperationsPageBody";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import {
  getDailyMarketingOperationsStatus,
  getRecentDailyMarketingOperationsSummaries,
} from "@/lib/marketing/operations";
import { formatKstBusinessDate } from "@/lib/marketing/cron/daily/kstBusinessDate";

export const dynamic = "force-dynamic";

export default async function AdminMarketingOperationsPage() {
  const businessDateKst = formatKstBusinessDate();
  const [unreadNotificationCount, status, recent] = await Promise.all([
    prepareAdminNotificationsAndGetUnreadCount(),
    getDailyMarketingOperationsStatus({ businessDateKst }),
    getRecentDailyMarketingOperationsSummaries(7),
  ]);

  void unreadNotificationCount;

  return (
    <MarketingOperationsPageBody
      initialStatus={status}
      initialRecent={recent}
      businessDateKst={businessDateKst}
    />
  );
}

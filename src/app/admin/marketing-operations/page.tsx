import { MarketingOperationsPageBody } from "@/components/admin/marketing-operations/MarketingOperationsPageBody";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import {
  getDailyMarketingOperationsStatus,
  getRecentDailyMarketingOperationsSummaries,
} from "@/lib/marketing/operations";
import { formatKstBusinessDate } from "@/lib/marketing/cron/daily/kstBusinessDate";
import type {
  DailyMarketingOperatingCycle,
  MarketingOperationsSummary,
} from "@/lib/marketing/operations/types";

export const dynamic = "force-dynamic";

export default async function AdminMarketingOperationsPage() {
  const businessDateKst = formatKstBusinessDate();
  await prepareAdminNotificationsAndGetUnreadCount().catch(() => undefined);

  let initialStatus: DailyMarketingOperatingCycle | null = null;
  let initialRecent: MarketingOperationsSummary[] = [];
  let loadError: string | null = null;

  try {
    const [status, recent] = await Promise.all([
      getDailyMarketingOperationsStatus({ businessDateKst }),
      getRecentDailyMarketingOperationsSummaries(7),
    ]);
    initialStatus = status;
    initialRecent = recent;
  } catch (err) {
    loadError = err instanceof Error ? err.message : "운영 상태를 불러오지 못했습니다.";
  }

  return (
    <MarketingOperationsPageBody
      initialStatus={initialStatus}
      initialRecent={initialRecent}
      businessDateKst={businessDateKst}
      initialLoadError={loadError}
    />
  );
}

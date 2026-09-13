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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}_timeout_${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export default async function AdminMarketingOperationsPage() {
  const businessDateKst = formatKstBusinessDate();
  await prepareAdminNotificationsAndGetUnreadCount().catch(() => undefined);

  let initialStatus: DailyMarketingOperatingCycle | null = null;
  let initialRecent: MarketingOperationsSummary[] = [];
  let loadError: string | null = null;

  try {
    initialStatus = await withTimeout(
      getDailyMarketingOperationsStatus({ businessDateKst }),
      20_000,
      "ops_status",
    );
  } catch (err) {
    loadError = err instanceof Error ? err.message : "운영 상태를 불러오지 못했습니다.";
  }

  try {
    initialRecent = await withTimeout(getRecentDailyMarketingOperationsSummaries(7), 15_000, "ops_recent");
  } catch {
    // Keep page usable even if multi-day summary is slow/unavailable.
    initialRecent = [];
    if (!loadError) {
      loadError = "최근 7일 요약 로드가 지연되어 생략했습니다. 새로고침으로 다시 시도하세요.";
    }
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

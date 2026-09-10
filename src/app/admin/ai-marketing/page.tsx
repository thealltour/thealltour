import { AiMarketingHubPageBody, hubFieldsFromReviewQueue } from "@/components/admin/ai-marketing/AiMarketingHubPageBody";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { formatKstBusinessDate } from "@/lib/marketing/cron/daily/kstBusinessDate";
import { getDailyMarketingOperationsStatus } from "@/lib/marketing/operations";
import { createServerMarketingTraceReadRepository } from "@/lib/marketing/observability/viewer/serverReadRepository";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { createTravelTrendsStagingRepository } from "@/lib/marketing/trends/staging/createTravelTrendsStagingRepository";

export const dynamic = "force-dynamic";

export default async function AdminAiMarketingHubPage() {
  const businessDateKst = formatKstBusinessDate();
  const loadErrors: string[] = [];

  await prepareAdminNotificationsAndGetUnreadCount().catch(() => undefined);

  let trendNewCount: number | null = null;
  try {
    const staging = await createTravelTrendsStagingRepository();
    trendNewCount = await staging.countNewTrendObservations();
  } catch {
    loadErrors.push("트렌드");
  }

  let reviewQueue = null;
  try {
    const service = await createHumanMarketingReviewService();
    reviewQueue = await service.listMorningReviewQueue("all");
  } catch {
    loadErrors.push("제작·검토");
  }

  let operationsOverall = null;
  let operationsAction: string | null = null;
  try {
    const status = await getDailyMarketingOperationsStatus({ businessDateKst });
    operationsOverall = status.overallStatus;
    operationsAction = status.actionRequiredReasons[0] ?? null;
  } catch {
    loadErrors.push("오늘 운영");
  }

  let runningTraceCount = 0;
  let recentFailedTraceCount = 0;
  try {
    const repo = await createServerMarketingTraceReadRepository();
    if (repo) {
      const traces = await repo.listRecentTraces({ limit: 30 });
      runningTraceCount = traces.filter((t) => t.status === "running").length;
      recentFailedTraceCount = traces.filter((t) => t.status === "failed").length;
    }
  } catch {
    loadErrors.push("조직 관제");
  }

  const reviewFields = hubFieldsFromReviewQueue(reviewQueue);

  return (
    <AiMarketingHubPageBody
      snapshot={{
        businessDateKst,
        trendNewCount,
        ...reviewFields,
        operationsOverall,
        operationsAction,
        runningTraceCount,
        recentFailedTraceCount,
        loadErrors,
      }}
    />
  );
}

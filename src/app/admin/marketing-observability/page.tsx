import { MarketingObservabilityPageBody } from "@/components/admin/marketing-observability/MarketingObservabilityPageBody";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { createServerMarketingTraceReadRepository } from "@/lib/marketing/observability/viewer/serverReadRepository";
import { toTraceListItemDto } from "@/lib/marketing/observability/viewer/dto";

export const dynamic = "force-dynamic";

export default async function AdminMarketingObservabilityPage() {
  const [, repo] = await Promise.all([
    prepareAdminNotificationsAndGetUnreadCount(),
    createServerMarketingTraceReadRepository(),
  ]);

  const traces = repo ? await repo.listRecentTraces({ limit: 30 }) : [];

  return (
    <MarketingObservabilityPageBody initialTraces={traces.map(toTraceListItemDto)} />
  );
}

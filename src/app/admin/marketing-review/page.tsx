import { MarketingReviewPageBody } from "@/components/admin/marketing-review/MarketingReviewPageBody";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";

export const dynamic = "force-dynamic";

function parseBusinessDateKst(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  return raw;
}

export default async function AdminMarketingReviewPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const slateBusinessDateKst = parseBusinessDateKst(params.businessDateKst);

  const [unreadNotificationCount, queue] = await Promise.all([
    prepareAdminNotificationsAndGetUnreadCount(),
    createHumanMarketingReviewService().then((service) => service.listMorningReviewQueue("all")),
  ]);

  return (
    <MarketingReviewPageBody
      initialSummary={queue}
      unreadNotificationCount={unreadNotificationCount}
      slateBusinessDateKst={slateBusinessDateKst}
    />
  );
}

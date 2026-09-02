import { MarketingReviewPageBody } from "@/components/admin/marketing-review/MarketingReviewPageBody";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";

export const dynamic = "force-dynamic";

export default async function AdminMarketingReviewPage() {
  const [unreadNotificationCount, queue] = await Promise.all([
    prepareAdminNotificationsAndGetUnreadCount(),
    createHumanMarketingReviewService().then((service) => service.listMorningReviewQueue("all")),
  ]);

  return (
    <MarketingReviewPageBody
      initialSummary={queue}
      unreadNotificationCount={unreadNotificationCount}
    />
  );
}

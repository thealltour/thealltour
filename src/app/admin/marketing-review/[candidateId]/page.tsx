import { notFound } from "next/navigation";
import { MarketingReviewDetailBody } from "@/components/admin/marketing-review/MarketingReviewDetailBody";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ candidateId: string }> };

export default async function AdminMarketingReviewDetailPage({ params }: PageProps) {
  const { candidateId } = await params;
  const service = await createHumanMarketingReviewService();
  const [unreadNotificationCount, context] = await Promise.all([
    prepareAdminNotificationsAndGetUnreadCount(),
    service.getMorningMarketingReviewContext(candidateId),
  ]);

  if (!context) notFound();

  return (
    <MarketingReviewDetailBody
      initialContext={context}
      unreadNotificationCount={unreadNotificationCount}
    />
  );
}

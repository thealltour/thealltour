import AdminHeader from "@/components/admin/AdminHeader";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";
import { listReviewNotifications, getReviewNotificationSummary } from "@/lib/reviewNotifications";
import type { ReviewNotificationItem, ReviewNotificationSummary } from "@/types/reviewNotifications";
import { ReviewNotificationsDashboard } from "@/components/admin/reviews/ReviewNotificationsDashboard";

export const dynamic = "force-dynamic";

export default async function AdminReviewNotificationsPage() {
  let counts = { inquiryCount: 0, productCount: 0, memberCount: 0, reviewCount: 0 };
  let unreadNotificationCount = 0;
  let notifications: ReviewNotificationItem[] = [];
  let summary: ReviewNotificationSummary = { total: 0, unread: 0, critical: 0, warning: 0, info: 0 };

  try {
    [counts, unreadNotificationCount, notifications, summary] = await Promise.all([
      getAdminCounts(),
      prepareAdminNotificationsAndGetUnreadCount(),
      listReviewNotifications({ limit: 100 }),
      getReviewNotificationSummary(),
    ]);
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[AdminReviewNotificationsPage]", e);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="reviews"
          title="리뷰 운영 알림"
          description="이상 감지·검토·신고·전환·인사이트 등 리뷰 시스템 이벤트를 한곳에서 확인하고 읽음/보관 처리할 수 있습니다."
          inquiryCount={counts.inquiryCount}
          productCount={counts.productCount}
          memberCount={counts.memberCount}
          reviewCount={counts.reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
          <ReviewNotificationsDashboard notifications={notifications} summary={summary} />
        </section>
      </main>
    </div>
  );
}

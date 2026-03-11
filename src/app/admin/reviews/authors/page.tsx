import AdminHeader from "@/components/admin/AdminHeader";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";
import { getAllReviewsForAdminList } from "@/lib/reviewAdminList";
import { buildReviewAuthorProfiles } from "@/lib/reviewAuthorProfiles";
import { ReviewAuthorProfilesDashboard } from "@/components/admin/reviews/ReviewAuthorProfilesDashboard";

export const dynamic = "force-dynamic";

export default async function AdminReviewAuthorsPage() {
  const [counts, unreadNotificationCount, reviews] = await Promise.all([
    getAdminCounts(),
    prepareAdminNotificationsAndGetUnreadCount(),
    getAllReviewsForAdminList(),
  ]);

  const profiles = buildReviewAuthorProfiles(reviews);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="reviews"
          title="리뷰 작성자 분석"
          description="작성자 단위 신뢰 프로필·작성 패턴·위험도를 확인하고, 고위험 작성자를 빠르게 식별할 수 있습니다."
          inquiryCount={counts.inquiryCount}
          productCount={counts.productCount}
          memberCount={counts.memberCount}
          reviewCount={counts.reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
          <ReviewAuthorProfilesDashboard profiles={profiles} />
        </section>
      </main>
    </div>
  );
}

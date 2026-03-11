import { Suspense } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminRewardsManager from "@/components/admin/AdminRewardsManager";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminRewardsPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="w-full space-y-6">
        <AdminHeader
          activeTab="rewards"
          title="리워드 교환 관리"
          description="교환 신청을 상태별로 보고 승인/반려/발송/완료 처리할 수 있습니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <Suspense fallback={<div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">불러오는 중…</div>}>
          <AdminRewardsManager />
        </Suspense>
      </main>
    </div>
  );
}

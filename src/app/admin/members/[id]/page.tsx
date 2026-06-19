import AdminHeader from "@/components/admin/AdminHeader";
import AdminMemberDetailPage from "@/components/admin/members/AdminMemberDetailPage";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminMemberDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="w-full space-y-6">
        <AdminHeader
          title="회원 상세"
          description="회원 기본 정보와 포인트 현황을 확인합니다."
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
          <AdminMemberDetailPage memberId={id} />
        </section>
      </main>
    </div>
  );
}

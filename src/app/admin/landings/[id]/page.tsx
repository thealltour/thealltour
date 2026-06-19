import AdminHeader from "@/components/admin/AdminHeader";
import AdminLandingFormPage from "@/components/admin/landings/AdminLandingFormPage";
import { ADMIN_LANDINGS_TITLE } from "@/components/admin/landings/adminLandings.constants";
import { getAdminCounts } from "@/lib/adminCounts";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";

type AdminLandingEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminLandingsEditPage({ params }: AdminLandingEditPageProps) {
  const { id } = await params;
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          title={`${ADMIN_LANDINGS_TITLE} · 수정`}
          description="랜딩 기본 메타 정보를 수정합니다."
          unreadNotificationCount={unreadNotificationCount}
        />
        <AdminLandingFormPage mode="edit" landingId={id} />
      </main>
    </div>
  );
}

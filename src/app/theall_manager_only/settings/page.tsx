import AdminHeader from "@/components/AdminHeader";
import AdminSiteSettingsManager from "@/components/AdminSiteSettingsManager";

export const dynamic = "force-dynamic";

export default function AdminSiteSettingsPage() {
  return (
    <div className="min-h-screen bg-[#f8fbff] px-6 py-10 text-[#0f172a] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="settings"
          title="환경설정"
          description="사이트 연락처, 회사 정보, 히어로·About·추천 검색어를 관리합니다."
          inquiryCount={0}
          productCount={0}
          memberCount={0}
          reviewCount={0}
          unreadNotificationCount={0}
        />
        <div className="space-y-6">
          <AdminSiteSettingsManager />
        </div>
      </main>
    </div>
  );
}


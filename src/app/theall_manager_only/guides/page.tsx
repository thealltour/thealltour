import AdminHeader from "@/components/AdminHeader";
import AdminGuideManager from "@/components/AdminGuideManager";

export const dynamic = "force-dynamic";

export default function AdminGuidesPage() {
  return (
    <div className="min-h-screen bg-[#f8fbff] px-6 py-10 text-[#0f172a] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="guides"
          title="여행가이드 관리"
          description="랜딩 페이지/블로그용 여행가이드 카드를 등록하고 노출 상태를 관리하세요."
          inquiryCount={0}
          productCount={0}
          memberCount={0}
          reviewCount={0}
          unreadNotificationCount={0}
        />
        <AdminGuideManager />
      </main>
    </div>
  );
}


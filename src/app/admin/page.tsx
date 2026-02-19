import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import { getAdminCounts } from "@/lib/adminCounts";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";

export default async function AdminPage() {
  const [counts, unreadNotificationCount] = await Promise.all([
    getAdminCounts(),
    prepareAdminNotificationsAndGetUnreadCount(),
  ]);

  const {
    inquiryCount,
    productCount,
    memberCount,
    reviewCount,
    totalInquiries,
    pendingInquiries,
    completedInquiries,
    delayedInquiries,
    completionRate,
  } = counts;

  return (
    <div className="min-h-screen bg-[#f8fbff] px-6 py-10 text-[#0f172a] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="dashboard"
          title="관리자 대시보드"
          description="오늘 운영 상태와 상담 처리 지표를 한 화면에서 확인하세요."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#dbeafe]">
            <p className="text-xs font-semibold text-slate-500">전체 문의</p>
            <p className="mt-2 text-3xl font-bold text-[#0f172a]">{totalInquiries}</p>
            <p className="mt-2 text-xs text-slate-500">누적 접수 기준</p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-amber-200">
            <p className="text-xs font-semibold text-amber-700">미완료 문의</p>
            <p className="mt-2 text-3xl font-bold text-amber-700">{pendingInquiries}</p>
            <p className="mt-2 text-xs text-amber-700">우선 처리 대상</p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-emerald-200">
            <p className="text-xs font-semibold text-emerald-700">완료 문의</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">{completedInquiries}</p>
            <p className="mt-2 text-xs text-emerald-700">완료율 {completionRate}%</p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-rose-200">
            <p className="text-xs font-semibold text-rose-700">24시간 이상 지연</p>
            <p className="mt-2 text-3xl font-bold text-rose-700">{delayedInquiries}</p>
            <p className="mt-2 text-xs text-rose-700">즉시 확인 권장</p>
          </article>
        </section>

        <section className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#dbeafe] md:grid-cols-2">
          <article className="space-y-2 rounded-xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
            <h2 className="text-lg font-bold text-[#1e3a8a]">빠른 작업</h2>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/theall_manager_only/inquiries"
                className="rounded-lg bg-[#1d4ed8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1e40af]"
              >
                문의 관리로 이동
              </Link>
              <Link
                href="/theall_manager_only/notifications"
                className="rounded-lg border border-[#bfdbfe] bg-white px-3 py-2 text-sm font-semibold text-[#1e3a8a] hover:bg-[#eff6ff]"
              >
                알림 확인
              </Link>
            </div>
          </article>
          <article className="space-y-2 rounded-xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
            <h2 className="text-lg font-bold text-[#1e3a8a]">운영 리소스 현황</h2>
            <p className="text-sm text-slate-600">
              상품 {productCount}건 · 회원 {memberCount}명 · 후기 {reviewCount}건
            </p>
            <p className="text-sm text-slate-600">문의 처리 우선순위를 유지하면 응답 속도가 안정화됩니다.</p>
          </article>
        </section>
      </main>
    </div>
  );
}

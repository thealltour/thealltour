import Image from "next/image";
import Link from "next/link";
import AdminLogoutButton from "@/components/AdminLogoutButton";
import AdminNotificationBell from "@/components/AdminNotificationBell";

type AdminHeaderProps = {
  title: string;
  description: string;
  activeTab:
    | "dashboard"
    | "products"
    | "inquiries"
    | "members"
    | "reviews"
    | "notifications"
    | "banners"
    | "notices";
  productCount: number;
  inquiryCount: number;
  memberCount: number;
  reviewCount: number;
  unreadNotificationCount: number;
};

export default function AdminHeader({
  title,
  description,
  activeTab,
  productCount,
  inquiryCount,
  memberCount,
  reviewCount,
  unreadNotificationCount,
}: AdminHeaderProps) {
  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/thealltour-logo.png"
              alt="더올투어 로고"
              width={140}
              height={90}
              className="h-auto w-[120px]"
              priority
            />
          </Link>
          <p className="text-sm font-semibold tracking-wide text-[#2563eb]">THEALL TOUR ADMIN</p>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <AdminNotificationBell initialUnreadCount={unreadNotificationCount} />
          <AdminLogoutButton />
        </div>
      </div>
      <nav className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 shadow-sm ring-1 ring-[#dbeafe]">
        <Link
          href="/theall_manager_only"
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "dashboard"
              ? "bg-[#1d4ed8] text-white"
              : "text-[#1e3a8a] hover:bg-[#eff6ff]"
          }`}
        >
          대시보드
        </Link>
        <Link
          href="/theall_manager_only/products"
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "products"
              ? "bg-[#1d4ed8] text-white"
              : "text-[#1e3a8a] hover:bg-[#eff6ff]"
          }`}
        >
          상품 관리
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              activeTab === "products" ? "bg-white/20 text-white" : "bg-[#dbeafe] text-[#1d4ed8]"
            }`}
          >
            {productCount}
          </span>
        </Link>
        <Link
          href="/theall_manager_only/inquiries"
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "inquiries"
              ? "bg-[#1d4ed8] text-white"
              : "text-[#1e3a8a] hover:bg-[#eff6ff]"
          }`}
        >
          문의 관리
          <span
            title="미처리 문의 건수"
            className={`rounded-full px-2 py-0.5 text-xs ${
              activeTab === "inquiries" ? "bg-white/20 text-white" : "bg-[#fee2e2] text-[#b91c1c]"
            }`}
          >
            {inquiryCount}
          </span>
        </Link>
        <Link
          href="/theall_manager_only/members"
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "members"
              ? "bg-[#1d4ed8] text-white"
              : "text-[#1e3a8a] hover:bg-[#eff6ff]"
          }`}
        >
          회원 관리
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              activeTab === "members" ? "bg-white/20 text-white" : "bg-[#dbeafe] text-[#1d4ed8]"
            }`}
          >
            {memberCount}
          </span>
        </Link>
        <Link
          href="/theall_manager_only/reviews"
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "reviews"
              ? "bg-[#1d4ed8] text-white"
              : "text-[#1e3a8a] hover:bg-[#eff6ff]"
          }`}
        >
          후기 관리
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              activeTab === "reviews" ? "bg-white/20 text-white" : "bg-[#dbeafe] text-[#1d4ed8]"
            }`}
          >
            {reviewCount}
          </span>
        </Link>
        <Link
          href="/theall_manager_only/banners"
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "banners"
              ? "bg-[#1d4ed8] text-white"
              : "text-[#1e3a8a] hover:bg-[#eff6ff]"
          }`}
        >
          메인배너
        </Link>
        <Link
          href="/theall_manager_only/notices"
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "notices"
              ? "bg-[#1d4ed8] text-white"
              : "text-[#1e3a8a] hover:bg-[#eff6ff]"
          }`}
        >
          공지사항
        </Link>
        <Link
          href="/theall_manager_only/notifications"
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "notifications"
              ? "bg-[#1d4ed8] text-white"
              : "text-[#1e3a8a] hover:bg-[#eff6ff]"
          }`}
        >
          알림
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              activeTab === "notifications" ? "bg-white/20 text-white" : "bg-[#fee2e2] text-[#b91c1c]"
            }`}
          >
            {unreadNotificationCount}
          </span>
        </Link>
      </nav>
    </header>
  );
}

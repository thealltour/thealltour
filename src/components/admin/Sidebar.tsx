"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MainMenuKey } from "@/components/admin/SubHeader";
import {
  LayoutDashboard,
  Package,
  MessageSquare,
  Users,
  Settings,
  Star,
  BookOpen,
  Image as ImageIcon,
  Megaphone,
  Bell,
} from "lucide-react";

type SidebarProps = {
  activeMenu: MainMenuKey | null;
  setActiveMenu: (key: MainMenuKey) => void;
};

const MAIN_MENU_ITEMS: { href: string; label: string; key: MainMenuKey }[] = [
  { href: "/theall_manager_only", label: "대시보드", key: "dashboard" },
  { href: "/theall_manager_only/products", label: "상품 관리", key: "product" },
  { href: "/theall_manager_only/inquiries", label: "문의 관리", key: "inquiry" },
  { href: "/theall_manager_only/members", label: "회원 관리", key: "member" },
];

const EXTRA_MENU_ITEMS: { href: string; label: string }[] = [
  { href: "/theall_manager_only/settings", label: "환경설정" },
  { href: "/theall_manager_only/reviews", label: "후기 관리" },
  { href: "/theall_manager_only/guides", label: "여행가이드" },
  { href: "/theall_manager_only/banners", label: "메인배너" },
  { href: "/theall_manager_only/notices", label: "공지사항" },
  { href: "/theall_manager_only/notifications", label: "알림" },
];

export default function Sidebar({ activeMenu, setActiveMenu }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-[#f1f5f9]">
      <div className="flex h-full flex-col">
        <div className="px-4 pt-6 pb-4">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/thealltour-logo.png"
              alt="더올투어 로고"
              width={140}
              height={90}
              className="h-auto w-[120px]"
              sizes="120px"
            />
          </Link>
          <p className="mt-2 text-xs font-semibold tracking-[0.18em] text-[#2563eb]">
            THEALL TOUR ADMIN
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {MAIN_MENU_ITEMS.map((item) => {
            const isActive = activeMenu === item.key;
            const Icon =
              item.key === "dashboard"
                ? LayoutDashboard
                : item.key === "product"
                  ? Package
                  : item.key === "inquiry"
                    ? MessageSquare
                    : Users;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActiveMenu(item.key);
                  router.push(item.href);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border-l-4 border-l-[#1d4ed8] bg-blue-50 text-[#1d4ed8]"
                    : "border-l-4 border-l-transparent text-[#1e293b] hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    size={18}
                    className={isActive ? "text-[#1d4ed8]" : "text-slate-500"}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </span>
              </button>
            );
          })}

          <div className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-xs text-slate-400">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em]">기타</p>
            {EXTRA_MENU_ITEMS.map((item) => {
              const Icon =
                item.href === "/theall_manager_only/settings"
                  ? Settings
                  : item.href === "/theall_manager_only/reviews"
                    ? Star
                    : item.href === "/theall_manager_only/guides"
                      ? BookOpen
                      : item.href === "/theall_manager_only/banners"
                        ? ImageIcon
                        : item.href === "/theall_manager_only/notices"
                          ? Megaphone
                          : Bell;
              const isActive =
                item.href === "/theall_manager_only"
                  ? pathname === "/theall_manager_only"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition ${
                    isActive
                      ? "border-l-4 border-l-[#1d4ed8] bg-blue-50 text-[#1d4ed8]"
                      : "border-l-4 border-l-transparent text-[#475569] hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      size={18}
                      className={isActive ? "text-[#1d4ed8]" : "text-slate-500"}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </aside>
  );
}


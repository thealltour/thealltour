"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU_ITEMS = [
  { href: "/mypage/dashboard", label: "대시보드" },
  { href: "/mypage/points", label: "포인트" },
  { href: "/mypage/points/request", label: "포인트 적립 요청" },
  { href: "/mypage/rewards", label: "리워드 교환소" },
  { href: "/mypage/reviews", label: "리뷰 관리" },
  { href: "/mypage/notifications", label: "알림" },
  { href: "/mypage/profile", label: "회원정보" },
] as const;

export default function MyPageSidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="마이페이지 메뉴" className="flex gap-2 overflow-x-auto lg:flex-col">
      {MENU_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border-[var(--border)] bg-[var(--primary-soft)] text-[var(--primary)]"
                : "border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/mypage", label: "대시보드" },
  { href: "/mypage/points", label: "포인트" },
  { href: "/mypage/rewards", label: "리워드 교환소" },
  { href: "/mypage/redemptions", label: "교환 신청 내역" },
  { href: "/reviews", label: "내 리뷰" },
  { href: "/mypage/profile", label: "개인정보/배송지" },
] as const;

export default function MypageNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="마이페이지 메뉴">
      {NAV_ITEMS.map(({ href, label }) => {
        const isActive = href === "/mypage" ? pathname === "/mypage" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

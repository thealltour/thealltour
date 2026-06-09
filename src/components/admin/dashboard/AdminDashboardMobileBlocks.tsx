"use client";

import Link from "next/link";
import { Bell, MessageSquare, PackageSearch, Star, Users } from "lucide-react";
import { useIsMobileAdmin } from "@/components/admin/mobile/useIsMobileAdmin";

const QUICK_ACTIONS = [
  {
    key: "inquiries",
    icon: MessageSquare,
    href: "/theall_manager_only/inquiries",
    label: "Inquiries",
    description: "View and update inquiry status.",
    mobile: true,
    desktop: true,
  },
  {
    key: "notifications",
    icon: Bell,
    href: "/theall_manager_only/notifications",
    label: "Notifications",
    description: "Check admin notifications.",
    mobile: true,
    desktop: true,
  },
  {
    key: "reviews",
    icon: Star,
    href: "/theall_manager_only/reviews",
    label: "Reviews",
    description: "Search and moderate reviews.",
    mobile: true,
    desktop: false,
  },
  {
    key: "products",
    icon: PackageSearch,
    href: "/theall_manager_only/products",
    label: "Products",
    description: "Browse and edit products.",
    mobile: false,
    desktop: true,
  },
  {
    key: "members",
    icon: Users,
    href: "/theall_manager_only/members",
    label: "Members",
    description: "Review registered members.",
    mobile: false,
    desktop: true,
  },
] as const;

export function AdminDashboardQuickActionsList() {
  const { isMobileAdmin, isReady } = useIsMobileAdmin();
  const useMobile = isReady && isMobileAdmin;
  const visible = QUICK_ACTIONS.filter((a) => (useMobile ? a.mobile : a.desktop));

  return (
    <ul className="divide-y divide-[var(--divider)] overflow-hidden rounded-lg bg-[var(--surface)] ring-1 ring-[var(--border)]">
      {visible.map((action) => {
        const Icon = action.icon;
        return (
          <li key={action.key}>
            <Link
              href={action.href}
              className="flex min-h-11 items-center gap-3 px-3 py-2.5 text-sm text-[var(--text-primary)] transition-[background-color,transform] hover:bg-[var(--surface-muted)] active:scale-[0.99] md:min-h-12 md:active:scale-100"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)] md:h-8 md:w-8">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-semibold leading-tight">{action.label}</span>
                <span className="text-[11px] leading-snug text-[var(--text-muted)] md:text-xs">{action.description}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

type ResourceOverviewProps = {
  productCount: number;
  memberCount: number;
  reviewCount: number;
};

export function AdminDashboardResourceOverview({ productCount, memberCount, reviewCount }: ResourceOverviewProps) {
  const { isMobileAdmin, isReady } = useIsMobileAdmin();
  const compact = isReady && isMobileAdmin;

  if (compact) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs leading-snug text-[var(--text-muted)]">
          상세 재고·회원 편집은 PC 관리자를 이용해 주세요.
        </p>
        <p className="text-sm font-medium tabular-nums text-[var(--text-secondary)]">
          상품 {productCount} · 회원 {memberCount} · 리뷰 {reviewCount}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm tabular-nums text-[var(--text-secondary)]">
        Products {productCount} · Members {memberCount} · Reviews {reviewCount}
      </p>
      <p className="text-sm leading-relaxed text-[var(--text-muted)]">
        Keeping a clear priority on inquiries helps maintain stable response times.
      </p>
    </div>
  );
}

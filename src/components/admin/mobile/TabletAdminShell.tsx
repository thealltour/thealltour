"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { LayoutGrid, MessageCircle } from "lucide-react";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import { AdminPwaInstallBanner } from "@/components/admin/pwa/AdminPwaProvider";
import { MobileAdminBottomNav } from "@/components/admin/mobile/MobileAdminBottomNav";
import { TabletAdminSideRail } from "@/components/admin/mobile/TabletAdminSideRail";
import { ADMIN_PWA_HUB_HREF } from "@/components/admin/mobile/mobileAdmin.constants";
import { useAdminChat } from "@/components/admin/chat/AdminChatProvider";

type TabletAdminShellProps = {
  title: string;
  children: ReactNode;
  /** 가로 모드면 좌측 레일 */
  isLandscape?: boolean;
};

const MAIN_BOTTOM_PAD = "calc(5.5rem + env(safe-area-inset-bottom, 0px))";

function CompactHeaderActions() {
  const { setOpen, totalUnread, refreshRooms } = useAdminChat();

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => {
          void refreshRooms();
          setOpen(true);
        }}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
        aria-label={totalUnread > 0 ? `팀 채팅, 미읽음 ${totalUnread}건` : "팀 채팅"}
        title="팀 채팅"
      >
        <MessageCircle className="h-4 w-4" aria-hidden />
        {totalUnread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[9px] font-bold leading-none text-white">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        ) : null}
      </button>
      <Link
        href={ADMIN_PWA_HUB_HREF}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
        aria-label="앱 · 메뉴"
        title="앱 · 메뉴"
      >
        <LayoutGrid className="h-4 w-4" aria-hidden />
      </Link>
      <AdminLogoutButton />
    </div>
  );
}

/**
 * 태블릿·모바일 컴팩트 셸.
 * 세로: 하단 탭 / 가로: 좌측 레일.
 */
export function TabletAdminShell({ title, children, isLandscape = false }: TabletAdminShellProps) {
  if (isLandscape) {
    return (
      <div className="flex min-h-dvh bg-[var(--bg)] text-[var(--text-primary)]">
        <TabletAdminSideRail />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-sm">
            <h1 className="truncate text-base font-semibold text-[var(--text-primary)]">{title}</h1>
            <CompactHeaderActions />
          </header>
          <main className="flex-1 overflow-y-auto px-5 py-4">
            <AdminPwaInstallBanner />
            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] shadow-sm">
        <h1 className="truncate text-base font-semibold text-[var(--text-primary)]">{title}</h1>
        <CompactHeaderActions />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-3" style={{ paddingBottom: MAIN_BOTTOM_PAD }}>
        <AdminPwaInstallBanner />
        {children}
      </main>

      <MobileAdminBottomNav />
    </div>
  );
}

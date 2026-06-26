"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { AdminResponsiveFrame } from "@/components/admin/AdminResponsiveFrame";
import AdminQueryProvider from "@/components/admin/AdminQueryProvider";
import { AdminRoleProvider } from "@/components/admin/AdminRoleContext";
import AdminToastProvider from "@/components/admin/AdminToastProvider";
import AdminConfirmProvider from "@/components/admin/AdminConfirmProvider";
import { AdminPwaProvider } from "@/components/admin/pwa/AdminPwaProvider";
import { AdminChatProvider } from "@/components/admin/chat/AdminChatProvider";
import AdminChatInboxSync from "@/components/admin/chat/AdminChatInboxSync";
import AdminChatWidget from "@/components/admin/chat/AdminChatWidget";
import type { AdminSessionPermissions } from "@/lib/adminPermissions";

export type AdminRouteProvidersProps = {
  children: ReactNode;
  session: AdminSessionPermissions;
};

/**
 * /admin·/theall_manager_only 공통: Query/Role/Toast/Confirm + AdminResponsiveFrame.
 */
export function AdminRouteProviders({ children, session }: AdminRouteProvidersProps) {
  return (
    <div className="site-admin min-h-screen">
      <AdminQueryProvider>
      <AdminRoleProvider session={session}>
        <AdminToastProvider>
          <AdminConfirmProvider>
            <AdminPwaProvider>
              <AdminChatProvider>
              <AdminChatInboxSync />
              <Suspense
              fallback={
                <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
                  <div className="mx-auto flex min-h-screen max-w-[1280px] flex-col gap-4 px-6 py-10 md:px-10">
                    <div className="h-10 w-48 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
                    <div className="h-24 w-full max-w-2xl animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]" />
                    <div className="grid flex-1 gap-4 md:grid-cols-[240px_1fr]">
                      <div className="hidden h-full min-h-[320px] animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] md:block" />
                      <div className="min-h-[320px] flex-1 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]" />
                    </div>
                    <p className="text-center text-xs text-[var(--text-muted)]">관리자 콘솔을 불러오는 중입니다…</p>
                  </div>
                </div>
              }
            >
              <AdminResponsiveFrame>{children}</AdminResponsiveFrame>
            </Suspense>
              <Suspense fallback={null}>
                <AdminChatWidget />
              </Suspense>
              </AdminChatProvider>
            </AdminPwaProvider>
          </AdminConfirmProvider>
        </AdminToastProvider>
      </AdminRoleProvider>
    </AdminQueryProvider>
    </div>
  );
}

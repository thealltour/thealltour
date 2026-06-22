import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { ADMIN_PWA_METADATA, ADMIN_PWA_VIEWPORT } from "@/lib/adminPwaMetadata";
import { getAdminSession } from "@/lib/adminServerSession";

const AdminRouteProviders = dynamic(() => import("@/components/admin/AdminRouteProvidersClient"), {
  loading: () => (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      <div className="mx-auto flex min-h-screen max-w-[1280px] items-center justify-center px-6 py-10">
        <p className="text-center text-xs text-[var(--text-muted)]">관리자 콘솔을 불러오는 중입니다…</p>
      </div>
    </div>
  ),
});

export const metadata = ADMIN_PWA_METADATA;
export const viewport = ADMIN_PWA_VIEWPORT;

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();
  return (
    <AdminRouteProviders
      session={
        session ?? {
          role: "admin",
          permissions: [],
          isBootstrapAdmin: false,
        }
      }
    >
      {children}
    </AdminRouteProviders>
  );
}

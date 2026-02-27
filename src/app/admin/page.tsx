import AdminDashboardKpiSection from "@/components/admin/AdminDashboardKpiSection";
import AdminHeader from "@/components/AdminHeader";
import { getAdminCounts } from "@/lib/adminCounts";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import Link from "next/link";
import { Bell, MessageSquare, PackageSearch, Users } from "lucide-react";

export default async function AdminPage() {
  const [counts, unreadNotificationCount] = await Promise.all([
    getAdminCounts(),
    prepareAdminNotificationsAndGetUnreadCount(),
  ]);

  const { inquiryCount, productCount, memberCount, reviewCount } = counts;

  const quickActions = [
    {
      key: "inquiries",
      icon: MessageSquare,
      href: "/theall_manager_only/inquiries",
      label: "Inquiries",
      description: "View and update inquiry status.",
    },
    {
      key: "notifications",
      icon: Bell,
      href: "/theall_manager_only/notifications",
      label: "Notifications",
      description: "Check admin notifications.",
    },
    {
      key: "products",
      icon: PackageSearch,
      href: "/theall_manager_only/products",
      label: "Products",
      description: "Browse and edit products.",
    },
    {
      key: "members",
      icon: Users,
      href: "/theall_manager_only/members",
      label: "Members",
      description: "Review registered members.",
    },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10 transition-colors">
      <main className="w-full space-y-6">
        <AdminHeader
          activeTab="dashboard"
          title="Admin dashboard"
          description="Check today&apos;s operations and inquiry metrics in one place."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <AdminDashboardKpiSection />

        <section className="grid gap-4 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-5 backdrop-blur-md md:grid-cols-2 transition-colors">
          <article className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 transition-colors">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Quick actions</h2>
            <ul className="divide-y divide-[var(--border)] rounded-lg bg-[var(--surface)] ring-1 ring-[var(--border)]">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <li key={action.key}>
                    <Link
                      href={action.href}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)]"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="flex flex-col">
                        <span className="font-semibold">{action.label}</span>
                        <span className="text-xs text-[var(--text-muted)]">{action.description}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </article>

          <article className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 transition-colors">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Resource overview</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Products {productCount} / Members {memberCount} / Reviews {reviewCount}
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              Keeping a clear priority on inquiries helps maintain stable response times.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}


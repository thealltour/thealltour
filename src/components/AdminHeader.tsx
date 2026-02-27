import AdminLogoutButton from "@/components/AdminLogoutButton";
import AdminNotificationBell from "@/components/AdminNotificationBell";

type AdminHeaderProps = {
  title: string;
  description: string;
  activeTab:
    | "dashboard"
    | "settings"
    | "products"
    | "inquiries"
    | "members"
    | "reviews"
    | "guides"
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
        <div className="space-y-1">
          <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <AdminNotificationBell initialUnreadCount={unreadNotificationCount} />
          <AdminLogoutButton />
        </div>
      </div>
    </header>
  );
}

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
}: AdminHeaderProps) {
  return (
    <header className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
    </header>
  );
}

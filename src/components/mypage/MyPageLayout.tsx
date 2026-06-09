import SiteHeader from "@/components/site-chrome/SiteHeader";
import MyPageContent from "@/components/mypage/MyPageContent";

type MyPageLayoutProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
};

export default function MyPageLayout({ children, title, description }: MyPageLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--bg)] text-[var(--text-primary)]">
      <SiteHeader />
      <MyPageContent title={title} description={description}>
        {children}
      </MyPageContent>
    </div>
  );
}

import MyPageContent from "@/components/mypage/MyPageContent";
import type { MyPageMemberSummary } from "@/lib/mypage/memberSummary";

type MyPageLayoutProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
  memberSummary?: MyPageMemberSummary | null;
};

export default function MyPageLayout({
  children,
  title,
  description,
  memberSummary,
}: MyPageLayoutProps) {
  return (
    <MyPageContent title={title} description={description} memberSummary={memberSummary}>
      {children}
    </MyPageContent>
  );
}

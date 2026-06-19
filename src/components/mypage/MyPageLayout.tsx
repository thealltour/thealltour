import MyPageContent from "@/components/mypage/MyPageContent";

type MyPageLayoutProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
};

export default function MyPageLayout({ children, title, description }: MyPageLayoutProps) {
  return (
    <MyPageContent title={title} description={description}>
      {children}
    </MyPageContent>
  );
}

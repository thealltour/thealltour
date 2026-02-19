import type { Metadata } from "next";
import "./globals.css";
import GlobalSiteFooter from "@/components/GlobalSiteFooter";

export const metadata: Metadata = {
  title: "더올투어 | 맞춤형 해외/국내 여행 전문",
  description:
    "더올투어는 해외여행과 국내여행을 고객 맞춤형으로 설계하는 전문 여행사입니다. 상담부터 일정 운영까지 신뢰 있게 안내합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="flex min-h-screen flex-col antialiased selection:bg-[#bfdbfe] selection:text-[#0f172a]">
        <div className="flex-1">{children}</div>
        <GlobalSiteFooter />
      </body>
    </html>
  );
}

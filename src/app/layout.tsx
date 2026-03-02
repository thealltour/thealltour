import type { Metadata } from "next";
import "./globals.css";
import GlobalSiteFooter from "@/components/GlobalSiteFooter";
import KakaoFloatingButton from "@/components/KakaoFloatingButton";

export const metadata: Metadata = {
  title: "더올투어 | 맞춤형 해외/국내 골프투어/파크골프투어 전문",
  description:
    "더올투어는 해외/국내 골프투어와 파크골프투어를 고객 맞춤형으로 설계하는 전문 여행사입니다. 상담부터 일정 운영, 현지 케어까지 신뢰 있게 안내합니다.",
  icons: {
    icon: "/thealltour-logo.png",
    shortcut: "/thealltour-logo.png",
    apple: "/thealltour-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="preconnect"
          href="https://qmswixmwquuazrhfyils.supabase.co"
          crossOrigin=""
        />
        <link
          rel="preconnect"
          href="https://img.modetour.com"
          crossOrigin=""
        />
      </head>
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-blue-100 selection:text-foreground">
        <div className="flex-1">{children}</div>
        <KakaoFloatingButton />
        <GlobalSiteFooter />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import GlobalSiteFooter from "@/components/GlobalSiteFooter";
import KakaoFloatingButton from "@/components/KakaoFloatingButton";
import { ConsultModalProvider } from "@/components/ConsultModal";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";

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

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* LCP 히어로 이미지(Supabase Storage)용 - 초기 연결 선점 */}
        <link
          rel="preconnect"
          href="https://qmswixmwquuazrhfyils.supabase.co"
          crossOrigin=""
        />
        {/* 상품 이미지 도메인 - dns-prefetch로 가볍게 (폴드 아래) */}
        <link rel="dns-prefetch" href="https://img.modetour.com" />
      </head>
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-[color:color-mix(in_oklab,var(--primary)_18%,white)] selection:text-foreground">
        <WebVitalsReporter />
        <ConsultModalProvider>
          <div className="flex-1">{children}</div>
          <KakaoFloatingButton />
          <GlobalSiteFooter />
        </ConsultModalProvider>
      </body>
    </html>
  );
}

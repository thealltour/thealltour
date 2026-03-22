import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import {
  THEALL_APPLE_TOUCH_ICON_SRC,
  THEALL_FAVICON_16_SRC,
  THEALL_FAVICON_32_SRC,
} from "@/lib/brandAssets";
import GlobalSiteFooter from "@/components/GlobalSiteFooter";
import KakaoFloatingButton from "@/components/KakaoFloatingButton";
import { ConsultModalProvider } from "@/components/ConsultModal";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import { FirstTouchInit } from "@/components/FirstTouchInit";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://thealltour.com").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "더올투어 | 맞춤형 해외·국내 골프투어",
    template: "%s | 더올투어",
  },
  description:
    "가족여행, 효도여행, 골프투어, 테마여행까지. 상담부터 일정 제안까지 맞춤형으로 도와드립니다.",
  icons: {
    icon: [
      { url: THEALL_FAVICON_16_SRC, sizes: "16x16", type: "image/png" },
      { url: THEALL_FAVICON_32_SRC, sizes: "32x32", type: "image/png" },
    ],
    shortcut: THEALL_FAVICON_32_SRC,
    apple: THEALL_APPLE_TOUCH_ICON_SRC,
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "더올투어",
    locale: "ko_KR",
    title: "더올투어 | 맞춤형 해외·국내 골프투어",
    description:
      "가족여행, 효도여행, 골프투어, 테마여행까지. 상담부터 일정 제안까지 맞춤형으로 도와드립니다.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "더올투어 - 맞춤형 골프 및 테마 여행",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "더올투어 | 맞춤형 해외·국내 골프투어",
    description:
      "가족여행, 효도여행, 골프투어, 테마여행까지. 상담부터 일정 제안까지 맞춤형으로 도와드립니다.",
    images: ["/twitter-image"],
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
        {/* GA4 */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID ?? ""}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GA_ID ?? ""}');
          `}
        </Script>
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
        <FirstTouchInit />
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

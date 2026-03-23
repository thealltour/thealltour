import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import {
  THEALL_APPLE_TOUCH_ICON_SRC,
  THEALL_FAVICON_16_SRC,
  THEALL_FAVICON_32_SRC,
} from "@/lib/brandAssets";
import GlobalSiteFooter from "@/components/site-chrome/GlobalSiteFooter";
import KakaoFloatingButton from "@/components/site-chrome/KakaoFloatingButton";
import { ConsultModalProvider } from "@/components/inquiry/ConsultModal";
import { WebVitalsReporter } from "@/components/site-chrome/WebVitalsReporter";
import { FirstTouchInit } from "@/components/site-chrome/FirstTouchInit";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://thealltour.com").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "\ub354\uc62c\ud22c\uc5b4 | \ub9de\ucda4\ud615 \ud574\uc678\u00b7\uad6d\ub0b4 \uace8\ud504\ud22c\uc5b4",
    template: "%s | \ub354\uc62c\ud22c\uc5b4",
  },
  description:
    "\uac00\uc871\uc5ec\ud589, \ud6a8\ub3c4\uc5ec\ud589, \uace8\ud504\ud22c\uc5b4, \ud14c\ub9c8\uc5ec\ud589\uae4c\uc9c0. \uc0c1\ub2f4\ubd80\ud130 \uc77c\uc815 \uc81c\uc548\uae4c\uc9c0 \ub9de\ucda4\ud615\uc73c\ub85c \ub3c4\uc640\ub4dc\ub9bd\ub2c8\ub2e4.",
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
    siteName: "\ub354\uc62c\ud22c\uc5b4",
    locale: "ko_KR",
    title: "\ub354\uc62c\ud22c\uc5b4 | \ub9de\ucda4\ud615 \ud574\uc678\u00b7\uad6d\ub0b4 \uace8\ud504\ud22c\uc5b4",
    description:
      "\uac00\uc871\uc5ec\ud589, \ud6a8\ub3c4\uc5ec\ud589, \uace8\ud504\ud22c\uc5b4, \ud14c\ub9c8\uc5ec\ud589\uae4c\uc9c0. \uc0c1\ub2f4\ubd80\ud130 \uc77c\uc815 \uc81c\uc548\uae4c\uc9c0 \ub9de\ucda4\ud615\uc73c\ub85c \ub3c4\uc640\ub4dc\ub9bd\ub2c8\ub2e4.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "\ub354\uc62c\ud22c\uc5b4 - \ub9de\ucda4\ud615 \uace8\ud504 \ubc0f \ud14c\ub9c8 \uc5ec\ud589",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "\ub354\uc62c\ud22c\uc5b4 | \ub9de\ucda4\ud615 \ud574\uc678\u00b7\uad6d\ub0b4 \uace8\ud504\ud22c\uc5b4",
    description:
      "\uac00\uc871\uc5ec\ud589, \ud6a8\ub3c4\uc5ec\ud589, \uace8\ud504\ud22c\uc5b4, \ud14c\ub9c8\uc5ec\ud589\uae4c\uc9c0. \uc0c1\ub2f4\ubd80\ud130 \uc77c\uc815 \uc81c\uc548\uae4c\uc9c0 \ub9de\ucda4\ud615\uc73c\ub85c \ub3c4\uc640\ub4dc\ub9bd\ub2c8\ub2e4.",
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
        {/* LCP: Supabase Storage preconnect */}
        <link
          rel="preconnect"
          href="https://qmswixmwquuazrhfyils.supabase.co"
          crossOrigin=""
        />
        {/* Product images: dns-prefetch */}
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

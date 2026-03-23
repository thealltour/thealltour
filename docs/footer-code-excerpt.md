# Footer 관련 코드 발췌본 (PR 전 정리)

> **참고**: 이 저장소에는 `Footer.tsx`라는 이름의 파일이 없습니다. 공개 사이트 전역 푸터는 **`GlobalSiteFooter.tsx`** 단일 컴포넌트이며, `src/app/layout.tsx`에서 `<ConsultModalProvider>` 내부·`<KakaoFloatingButton>` 아래에 렌더됩니다.

---

## 개선 시 주의(절대/가급적 건드리지 말 것)

1. **저작권 줄 뒤 숨은 관리자 링크**  
   `GlobalSiteFooter.tsx` 하단 `© … 더올투어` 문구 뒤의 **`.`(점)만 감싼** `<Link href="/theall_manager_only">` — 스타일로 거의 안 보이게 한 **관리자 진입용** 링크입니다. 실수로 제거·노출 방식 변경 시 운영 동선에 영향이 있습니다.

2. **관리자 경로에서 푸터 비표시**  
   `pathname.startsWith("/admin") || pathname.startsWith("/theall_manager_only")` 일 때 `return null` — 관리 화면에 공개 푸터가 겹치지 않도록 하는 분기입니다.

3. **`/api/site-settings` 계약**  
   푸터는 클라이언트에서 `GET /api/site-settings`로 회사정보·SNS URL을 가져옵니다. 응답 형식·필드명을 바꿀 경우 **`GlobalSiteFooter`와 `HeaderQuickConsultCtas`(동일 API 사용)** 등을 함께 수정해야 합니다.

4. **서버 측 기본값·캐시**  
   `src/lib/siteSettings.ts`의 `DEFAULT_SITE_SETTINGS` 및 `unstable_cache` + `revalidateTag("site-settings")` — 푸터 표시 문구와 DB/캐시 불일치를 일으키지 않도록 주의하세요.

5. **루트 레이아웃 구조**  
   `<body>` 안 `flex min-h-screen flex-col` + `<div className="flex-1">{children}</div>` 다음에 플로팅·푸터가 옵니다. 푸터를 `flex-1` 안으로 넣으면 sticky/하단 고정 UX가 바뀔 수 있습니다.

6. **별도 tailwind.config 없음**  
   Tailwind v4 + `@import "tailwindcss"` + `globals.css`의 `@theme inline` — 토큰은 주로 CSS 변수로 정의되어 있습니다.

---

## 헤더 CTA/Button 재사용 참고 파일

- 데스크톱 헤더 우측: `HeaderQuickConsultCtas` — `Button` + `buttonVariants` (`accent`, `kakao`)
- 공통 버튼 유틸: `src/components/ui/Button.tsx` (`buttonVariants`, `type-btn` 포함)

---

## 로고 렌더링 (푸터에는 미사용, 동일 브랜드 자산 참고)

- `src/lib/brandAssets.ts` — 워드마크 PNG 경로
- `src/components/header/ThemedWordmarkImage.tsx` — 라이트/다크 `next/image`
- `src/components/header/HeaderBrandLogo.tsx` — 헤더용 래퍼
- `globals.css` — `.header-brand-logo-img`, `--header-logo-*` 토큰

푸터 개선 시 로고를 넣을 경우 위 자산·패턴을 재사용하는 것이 일관됩니다.

---

## 모바일/데스크톱 분기

- 푸터 전용 훅/유틸 파일은 **없습니다**.
- `GlobalSiteFooter`는 Tailwind 반응형만 사용: 예) `md:grid-cols-[1fr_auto]`, `md:items-end`.

---

아래부터 요청하신 형식으로 **파일 전체**를 붙였습니다.

---

=== FILE: src/components/GlobalSiteFooter.tsx ===

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";

type SiteSettingsClient = {
  kakao_channel_url?: string;
  instagram_url?: string;
  company_name?: string;
  ceo_name?: string;
  address?: string;
  business_reg_no?: string;
  tourism_reg_no?: string;
  mail_order_reg_no?: string;
  main_phone?: string;
  main_email?: string;
};

const footerPillClass =
  "footer-pill focus-visible:outline-none";
const footerPillCtaClass = "footer-pill footer-pill-cta focus-visible:outline-none";

export default function GlobalSiteFooter() {
  const pathname = usePathname();
  const [settings, setSettings] = useState<SiteSettingsClient | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const response = await fetch("/api/site-settings", { cache: "no-store" });
        const result = (await response.json()) as SiteSettingsClient | { message?: string };
        if (!response.ok || !result || typeof result !== "object" || "message" in result) {
          return;
        }
        if (isMounted) {
          setSettings(result as SiteSettingsClient);
        }
      } catch {
        // 실패 시에는 기본 URL 사용
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  if (pathname.startsWith("/admin") || pathname.startsWith("/theall_manager_only")) {
    return null;
  }

  const companyName = settings?.company_name ?? "(주)더올투어";
  const ceoName = settings?.ceo_name ?? "김지호";
  const address = settings?.address ?? "경기도 고양시 덕양구 용현로 27, 407호(행신동, 행신프라자)";
  const businessRegNo = settings?.business_reg_no ?? "645-88-03583";
  const tourismRegNo = settings?.tourism_reg_no ?? "미정";
  const mailOrderRegNo = settings?.mail_order_reg_no ?? "미정";
  const mainPhone = settings?.main_phone ?? "02-0000-0000";
  const mainEmail = settings?.main_email ?? "thealltour@gmail.com";
  const kakaoChannelUrl = settings?.kakao_channel_url ?? "https://pf.kakao.com";
  const instagramUrl = settings?.instagram_url ?? "https://www.instagram.com/thealltour";

  return (
    <footer className="border-t border-[var(--divider)] bg-[var(--surface-muted)]">
      <PageContainer size="wide" className="grid gap-6 py-7 type-small leading-7 text-[var(--text-muted)] md:grid-cols-[1fr_auto]">
        <div>
          <p className="type-body font-bold text-[var(--foreground)]">{companyName}</p>
          <p className="text-[var(--text-subtle)]">대표: {ceoName}</p>
          <p className="text-[var(--text-subtle)]">주소: {address}</p>
          <p className="text-[var(--text-subtle)]">사업자등록번호: {businessRegNo}</p>
          <p className="text-[var(--text-subtle)]">관광사업등록번호: {tourismRegNo}</p>
          <p className="text-[var(--text-subtle)]">통신판매업신고번호: {mailOrderRegNo}</p>
        </div>

        <div className="flex flex-col items-start gap-2 type-caption md:items-end">
          <a href={`tel:${mainPhone}`} className={footerPillClass}>
            대표번호 {mainPhone}
          </a>
          <a href={`mailto:${mainEmail}`} className={footerPillClass}>
            {mainEmail}
          </a>
          <div className="mt-1 flex items-center gap-2">
            <a
              href={kakaoChannelUrl ?? "https://pf.kakao.com"}
              target="_blank"
              rel="noreferrer"
              className={footerPillCtaClass}
            >
              카카오채널
            </a>
            <a
              href={instagramUrl ?? "https://www.instagram.com/thealltour"}
              target="_blank"
              rel="noreferrer"
              className={footerPillClass}
            >
              인스타그램
            </a>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Link href="/terms" className={footerPillClass}>
              이용약관
            </Link>
            <Link href="/privacy" className={footerPillClass}>
              개인정보처리방침
            </Link>
          </div>
        </div>
      </PageContainer>
      <PageContainer size="wide" className="border-t border-[var(--divider)] py-3 text-center type-caption text-[var(--text-subtle)]">
        © {new Date().getFullYear()} 더올투어. All rights reserved
        <Link
          href="/theall_manager_only"
          aria-label="관리자 전용 페이지"
          className="cursor-default no-underline hover:no-underline focus:no-underline"
        >
          .
        </Link>
      </PageContainer>
    </footer>
  );
}
```

---

=== FILE: src/app/layout.tsx ===

```tsx
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

export const metadata: Metadata = {
  title: "더올투어 | 맞춤형 해외/국내 골프투어/파크골프투어 전문",
  description:
    "더올투어는 해외/국내 골프투어와 파크골프투어를 고객 맞춤형으로 설계하는 전문 여행사입니다. 상담부터 일정 운영, 현지 케어까지 신뢰 있게 안내합니다.",
  icons: {
    icon: [
      { url: THEALL_FAVICON_16_SRC, sizes: "16x16", type: "image/png" },
      { url: THEALL_FAVICON_32_SRC, sizes: "32x32", type: "image/png" },
    ],
    shortcut: THEALL_FAVICON_32_SRC,
    apple: THEALL_APPLE_TOUCH_ICON_SRC,
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
```

---

=== FILE: src/components/layout/PageContainer.tsx ===

```tsx
"use client";

import { cn } from "@/lib/cn";

export type PageContainerSize = "reading" | "default" | "wide" | "full";

export type PageContainerProps = {
  children: React.ReactNode;
  /** reading: 1040px, default: 1280px, wide: 1600px, full: 제한 없음 */
  size?: PageContainerSize;
  className?: string;
};

const SIZE_CLASS: Record<PageContainerSize, string> = {
  reading: "max-w-[1040px]",
  default: "max-w-[1280px]",
  wide: "max-w-[1600px]",
  full: "max-w-none",
};

/**
 * 유저 페이지 공통 폭·패딩 컨테이너.
 * 홈/상품목록/상품상세/문서형 페이지에 공통 적용 가능.
 */
export function PageContainer({
  children,
  size = "default",
  className,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        "px-4 sm:px-6 lg:px-8 xl:px-10",
        SIZE_CLASS[size],
        className
      )}
    >
      {children}
    </div>
  );
}
```

---

=== FILE: src/lib/cn.ts ===

```ts
export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
```

---

=== FILE: src/app/api/site-settings/route.ts ===

```ts
import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/siteSettings";

export async function GET() {
  const settings = await getSiteSettings();
  return NextResponse.json(settings);
}
```

---

=== FILE: src/lib/siteSettings.ts ===

```ts
import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";

export type SiteSettings = {
  kakao_channel_url: string;
  instagram_url: string;
  kakao_chat_url: string;
  company_name: string;
  ceo_name: string;
  address: string;
  business_reg_no: string;
  tourism_reg_no: string;
  mail_order_reg_no: string;
  main_phone: string;
  main_email: string;
  products_hero_headline: string;
  products_hero_subcopy: string;
  products_hero_regions: string;
  golf_hero_headline: string;
  golf_hero_subcopy: string;
  golf_hero_regions: string;
  /** 메인 홈 DESTINATIONS 섹션에 노출할 지역(taxonomy) id 목록. JSON 배열 문자열. 비어 있으면 허브 노출 지역 전체를 기본 순서로 사용. */
  home_region_card_ids: string;
  /** 메인 홈 지역 섹션 상단 문구: eyebrow(작은 라벨). 비어 있으면 "DESTINATIONS" 사용 */
  home_region_section_eyebrow: string;
  /** 메인 홈 지역 섹션 제목. 비어 있으면 "어디로 떠나고 싶으신가요?" 사용 */
  home_region_section_title: string;
  /** 메인 홈 지역 섹션 부제목. 비어 있으면 "지역별 여행 상품을 만나보세요." 사용 */
  home_region_section_description: string;
  /** 메인 홈 THEME 섹션에 노출할 테마(taxonomy) id 목록. JSON 배열 문자열. 비어 있으면 허브 노출 테마 전체를 기본 순서로 사용. 최대 8개. */
  home_theme_card_ids: string;
  /** 메인 홈 테마 섹션 상단 문구: eyebrow(작은 라벨). 비어 있으면 "TRAVEL THEMES" 사용 */
  home_theme_section_eyebrow: string;
  /** 메인 홈 테마 섹션 제목. 비어 있으면 "이런 여행은 어떠세요?" 사용 */
  home_theme_section_title: string;
  /** 메인 홈 테마 섹션 부제목. 비어 있으면 "테마별로 여행 상품을 둘러보세요." 사용 */
  home_theme_section_description: string;
  about_kicker: string;
  about_title: string;
  about_paragraph1: string;
  about_paragraph2: string;
  about_cta_label: string;
  about_cta_href: string;
};

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  kakao_channel_url: process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL ?? "https://pf.kakao.com",
  instagram_url: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "https://www.instagram.com/thealltour",
  kakao_chat_url: process.env.NEXT_PUBLIC_KAKAO_CHAT_URL ?? "https://pf.kakao.com",
  company_name: "(주)더올투어",
  ceo_name: "김지호",
  address: "경기도 고양시 덕양구 용현로 27, 407호(행신동, 행신프라자)",
  business_reg_no: "645-88-03583",
  tourism_reg_no: "미정",
  mail_order_reg_no: "미정",
  main_phone: "02-0000-0000",
  main_email: "thealltour@gmail.com",
  products_hero_headline:
    "패키지상품으로 원하시는 지역·예산에 맞춰 바로 상담까지 연결해 드려요.",
  products_hero_subcopy:
    "골프/패키지, 가족·지인·단체 여행까지. 관심 있는 지역과 대략적인 일정만 알려주시면, 담당자가 상품을 추려 1:1로 안내해 드립니다.",
  products_hero_regions: JSON.stringify([
    { id: "japan", label: "일본 골프·패키지", searchKeyword: "일본" },
    { id: "se-asia", label: "동남아 골프·휴양", searchKeyword: "동남아" },
    { id: "europe", label: "유럽 여행", searchKeyword: "유럽" },
    { id: "domestic", label: "국내·제주", searchKeyword: "국내" },
  ]),
  golf_hero_headline: "골프/파크골프 전문 맞춤 설계로 라운딩 동선을 깔끔하게 잡아드립니다.",
  golf_hero_subcopy:
    "선호하는 골프장, 라운딩 횟수, 동행 인원과 예산을 알려주시면, 시즌에 맞는 최적의 골프투어 코스를 추천해 드립니다.",
  golf_hero_regions: JSON.stringify([
    { id: "golf-japan", label: "일본 골프투어", searchKeyword: "일본 골프" },
    { id: "golf-se-asia", label: "동남아 골프투어", searchKeyword: "동남아 골프" },
    { id: "golf-domestic", label: "국내 골프/파크골프", searchKeyword: "국내 골프" },
  ]),
  home_region_card_ids: "[]",
  home_region_section_eyebrow: "DESTINATIONS",
  home_region_section_title: "어디로 떠나고 싶으신가요?",
  home_region_section_description: "지역별 여행 상품을 만나보세요.",
  home_theme_card_ids: "[]",
  home_theme_section_eyebrow: "TRAVEL THEMES",
  home_theme_section_title: "이런 여행은 어떠세요?",
  home_theme_section_description: "테마별로 여행 상품을 둘러보세요.",
  about_kicker: "ABOUT THEALL TOUR",
  about_title: "여행을 디자인해 드립니다",
  about_paragraph1:
    "당신 만의 특별한 여정이 되어야 할 여행, 똑같은 패키지 여행에 지치셨나요? 더올투어는 정형화된 일정이 아닌, 고객 한 분 한 분의 취향과 목적에 맞춘 '큐레이팅 여행'을 지향합니다.",
  about_paragraph2:
    "수년간 쌓아온 노하우와 탄탄한 현지 네트워크를 바탕으로, 남들은 모르는 숨은 명소부터 프라이빗한 숙소까지 세밀하게 설계해 드립니다. 전문가의 시선으로 고른 고품격 여행, 이제 더올투어와 함께 시작하세요.",
  about_cta_label: "맞춤 여행 상담 받기",
  about_cta_href: "/#contact",
};

async function fetchSiteSettingsRaw(): Promise<SiteSettings> {
  const { data, error } = await supabase.from("site_settings").select("key, value");

  if (error || !data) {
    return DEFAULT_SITE_SETTINGS;
  }

  const map = new Map<string, string>();
  for (const row of data as { key: string; value: string }[]) {
    if (!row || !row.key) continue;
    map.set(row.key, row.value ?? "");
  }

  return {
    kakao_channel_url: map.get("kakao_channel_url") || DEFAULT_SITE_SETTINGS.kakao_channel_url,
    instagram_url: map.get("instagram_url") || DEFAULT_SITE_SETTINGS.instagram_url,
    kakao_chat_url: map.get("kakao_chat_url") || DEFAULT_SITE_SETTINGS.kakao_chat_url,
    company_name: map.get("company_name") || DEFAULT_SITE_SETTINGS.company_name,
    ceo_name: map.get("ceo_name") || DEFAULT_SITE_SETTINGS.ceo_name,
    address: map.get("address") || DEFAULT_SITE_SETTINGS.address,
    business_reg_no: map.get("business_reg_no") || DEFAULT_SITE_SETTINGS.business_reg_no,
    tourism_reg_no: map.get("tourism_reg_no") || DEFAULT_SITE_SETTINGS.tourism_reg_no,
    mail_order_reg_no: map.get("mail_order_reg_no") || DEFAULT_SITE_SETTINGS.mail_order_reg_no,
    main_phone: map.get("main_phone") || DEFAULT_SITE_SETTINGS.main_phone,
    main_email: map.get("main_email") || DEFAULT_SITE_SETTINGS.main_email,
    products_hero_headline:
      map.get("products_hero_headline") || DEFAULT_SITE_SETTINGS.products_hero_headline,
    products_hero_subcopy:
      map.get("products_hero_subcopy") || DEFAULT_SITE_SETTINGS.products_hero_subcopy,
    products_hero_regions:
      map.get("products_hero_regions") || DEFAULT_SITE_SETTINGS.products_hero_regions,
    golf_hero_headline:
      map.get("golf_hero_headline") || DEFAULT_SITE_SETTINGS.golf_hero_headline,
    golf_hero_subcopy:
      map.get("golf_hero_subcopy") || DEFAULT_SITE_SETTINGS.golf_hero_subcopy,
    golf_hero_regions:
      map.get("golf_hero_regions") || DEFAULT_SITE_SETTINGS.golf_hero_regions,
    home_region_card_ids:
      map.get("home_region_card_ids") ?? DEFAULT_SITE_SETTINGS.home_region_card_ids,
    home_region_section_eyebrow:
      map.get("home_region_section_eyebrow") ?? DEFAULT_SITE_SETTINGS.home_region_section_eyebrow,
    home_region_section_title:
      map.get("home_region_section_title") ?? DEFAULT_SITE_SETTINGS.home_region_section_title,
    home_region_section_description:
      map.get("home_region_section_description") ?? DEFAULT_SITE_SETTINGS.home_region_section_description,
    home_theme_card_ids:
      map.get("home_theme_card_ids") ?? DEFAULT_SITE_SETTINGS.home_theme_card_ids,
    home_theme_section_eyebrow:
      map.get("home_theme_section_eyebrow") ?? DEFAULT_SITE_SETTINGS.home_theme_section_eyebrow,
    home_theme_section_title:
      map.get("home_theme_section_title") ?? DEFAULT_SITE_SETTINGS.home_theme_section_title,
    home_theme_section_description:
      map.get("home_theme_section_description") ?? DEFAULT_SITE_SETTINGS.home_theme_section_description,
    about_kicker: map.get("about_kicker") || DEFAULT_SITE_SETTINGS.about_kicker,
    about_title: map.get("about_title") || DEFAULT_SITE_SETTINGS.about_title,
    about_paragraph1:
      map.get("about_paragraph1") || DEFAULT_SITE_SETTINGS.about_paragraph1,
    about_paragraph2:
      map.get("about_paragraph2") || DEFAULT_SITE_SETTINGS.about_paragraph2,
    about_cta_label:
      map.get("about_cta_label") || DEFAULT_SITE_SETTINGS.about_cta_label,
    about_cta_href: map.get("about_cta_href") || DEFAULT_SITE_SETTINGS.about_cta_href,
  };
}

/** 5분 캐시 — 관리자에서 site_settings 수정 시 revalidateTag("site-settings") 호출 필요 */
export async function getSiteSettings(): Promise<SiteSettings> {
  return unstable_cache(
    fetchSiteSettingsRaw,
    ["site-settings"],
    { revalidate: 300, tags: ["site-settings"] },
  )();
}

/** 메인 홈 지역카드에 노출할 destination taxonomy id 목록 (순서 유지). 비어 있으면 설정 미사용. */
export function parseHomeRegionCardIds(settings: Pick<SiteSettings, "home_region_card_ids">): string[] {
  const raw = settings.home_region_card_ids?.trim() ?? "";
  if (!raw || raw === "[]") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());
  } catch {
    return [];
  }
}

/** 메인 홈 테마카드에 노출할 theme taxonomy id 목록 (순서 유지). 비어 있으면 설정 미사용. 최대 8개 사용 권장. */
export function parseHomeThemeCardIds(settings: Pick<SiteSettings, "home_theme_card_ids">): string[] {
  const raw = settings.home_theme_card_ids?.trim() ?? "";
  if (!raw || raw === "[]") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim())
      .slice(0, 8);
  } catch {
    return [];
  }
}
```

---

=== FILE: src/components/ui/Button.tsx ===

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "accent" | "secondary" | "kakao" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

/** 높이: sm 36px, md 44px, lg 52px. radius 12px. focus-visible ring 3px --focus-ring. */
export function buttonVariants(options?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { variant = "primary", size = "md", className } = options ?? {};

  const base =
    "inline-flex items-center justify-center rounded-xl type-btn transition-all duration-150 " +
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] " +
    "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed " +
    "active:translate-y-px";

  const sizeClass =
    size === "sm"
      ? "h-9 min-h-9 px-3"
      : size === "lg"
        ? "min-h-[52px] px-6 py-3"
        : "min-h-[44px] px-4 py-2.5";

  let variantClass: string;
  switch (variant) {
    case "accent":
      variantClass =
        "bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)]";
      break;
    case "secondary":
      variantClass =
        "bg-[var(--secondary)] text-white hover:bg-[var(--secondary-hover)] active:opacity-90";
      break;
    case "kakao":
      variantClass =
        "bg-[var(--theall-kakao-bg)] text-[var(--theall-kakao-text)] " +
        "border border-[var(--theall-kakao-border)] " +
        "hover:border-[color:color-mix(in_oklab,var(--theall-premium-gold)_78%,black)]";
      break;
    case "ghost":
      variantClass =
        "bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-muted)]";
      break;
    case "outline":
      variantClass =
        "bg-transparent border border-[var(--border-strong)] text-[var(--foreground)] " +
        "hover:bg-[var(--surface-muted)]";
      break;
    case "primary":
    default:
      variantClass =
        "bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)]";
      break;
  }

  return cn(base, sizeClass, variantClass, className);
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={buttonVariants({ variant, size, className })}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading ? (
          <span className="mr-1.5 inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-50" />
        ) : null}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
```

---

=== FILE: src/components/HeaderQuickConsultCtas.tsx ===

```tsx
"use client";

import { FormEvent, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, Send, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";

type HeaderQuickConsultCtasProps = {
  quickConsultHref?: string;
  kakaoConsultHref?: string;
};

type QuickFormState = {
  name: string;
  phone: string;
  content: string;
};

const initialFormState: QuickFormState = {
  name: "",
  phone: "",
  content: "",
};

type SiteSettingsClientForKakao = {
  kakao_channel_url?: string;
};

export default function HeaderQuickConsultCtas({
  quickConsultHref,
  kakaoConsultHref,
}: HeaderQuickConsultCtasProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<QuickFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [kakaoFromSettings, setKakaoFromSettings] = useState<string | null>(null);

  const quickHrefFallback = quickConsultHref ?? "tel:02-0000-0000";
  const kakaoHrefFallback =
    kakaoConsultHref ?? kakaoFromSettings ?? "https://pf.kakao.com";

  useEffect(() => {
    let isMounted = true;
    async function loadKakao() {
      try {
        const response = await fetch("/api/site-settings", { cache: "no-store" });
        const result = (await response.json()) as SiteSettingsClientForKakao | { message?: string };
        if (!response.ok || !result || typeof result !== "object" || "message" in result) {
          return;
        }
        const data = result as SiteSettingsClientForKakao;
        if (isMounted && data.kakao_channel_url) {
          setKakaoFromSettings(data.kakao_channel_url);
        }
      } catch {
        // 실패 시 기본값 사용
      }
    }
    loadKakao();
    return () => {
      isMounted = false;
    };
  }, []);

  function formatPhoneInput(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    setTimeout(() => {
      setToast(null);
    }, 2600);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.content.trim()) {
      showToast("error", "이름, 연락처, 문의 내용을 모두 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          source_path: `${pathname || "/"}#header-quick-consult`,
        }),
      });

      if (!response.ok) {
        showToast("error", "문의 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      setForm(initialFormState);
      setIsOpen(false);
      showToast("success", "빠른 상담 요청이 접수되었습니다. 확인 후 순차적으로 연락드리겠습니다.");
    } catch {
      showToast("error", "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-2.5">
        <Button
          type="button"
          variant="accent"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="h-11 px-4 text-[14px] md:px-5 md:text-[15px]"
        >
          <Send
            className="mr-1.5 h-4 w-4 opacity-90"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          상담 문의
        </Button>
        <a
          href={kakaoHrefFallback}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({
            variant: "kakao",
            size: "sm",
            className: "h-11 px-4 text-[14px] md:px-5 md:text-[15px]",
          })}
        >
          <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
          카톡 상담
        </a>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-[2px]">
          <div className="flex min-h-full items-center justify-center px-4 py-6">
            <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 text-[var(--text-primary)] shadow-[var(--shadow-modal)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-[var(--text-muted)]">
                  THEALL QUICK CONSULT
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)] md:text-2xl">
                  빠른 상담 요청 남기기
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)] md:text-sm">
                  간단한 정보만 남겨주시면, 전담 상담사가 순차적으로 연락드립니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                aria-label="빠른 상담 모달 닫기"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="flex flex-col gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                <label className="space-y-1.5">
                  <span>이름 *</span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="성함을 입력해 주세요"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                    required
                  />
                </label>
              </div>

              <div className="flex flex-col gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                <label className="space-y-1.5">
                  <span>연락처 *</span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        phone: formatPhoneInput(event.target.value),
                      }))
                    }
                    placeholder="010-0000-0000"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                    required
                  />
                </label>
              </div>

              <div className="flex flex-col gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                <label className="space-y-1.5">
                  <span>문의 내용 *</span>
                  <textarea
                    rows={4}
                    value={form.content}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, content: event.target.value }))
                    }
                    placeholder="예: 5월 중 일본 골프 3박 4일, 4인 강습 포함 일정 희망"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                    required
                  />
                </label>
              </div>

              <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-[10px] text-[var(--text-muted)] md:text-xs">
                  남겨주신 연락처로만 상담 연락을 드리며, 다른 용도로는 사용하지 않습니다.
                </p>
                <div className="flex items-center justify-end">
                  <Button
                    type="submit"
                    variant="accent"
                    size="sm"
                    disabled={isSubmitting}
                    className="min-w-[180px] px-5 py-2.5"
                  >
                    {isSubmitting ? "전송 중..." : "상담 신청"}
                  </Button>
                </div>
              </div>
            </form>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed top-4 right-4 z-50">
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
              toast.kind === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </>
  );
}
```

---

=== FILE: src/lib/brandAssets.ts ===

```ts
/**
 * 승인 워드마크 — 라이트(흰 배경) / 다크(납품 다크 배경)
 *
 * `next/image` 캐시 회피: 자산 교체 시 파일명 버전(v5/v6…) 올리기.
 */
/** 치수 변경 시 `ThemedWordmarkImage.tsx` 내 `WORDMARK_INTRINSIC_*` 도 맞출 것 */
export const THEALL_WORDMARK_INTRINSIC_LIGHT = { width: 1024, height: 184 } as const;
export const THEALL_WORDMARK_INTRINSIC_DARK = { width: 1024, height: 189 } as const;

/** @deprecated 라이트와 동일 — 하위 호환 */
export const THEALL_WORDMARK_INTRINSIC = THEALL_WORDMARK_INTRINSIC_LIGHT;

export const THEALL_WORDMARK_LIGHT_SRC = "/thealltour-wordmark-light-v5.png" as const;
export const THEALL_WORDMARK_DARK_SRC = "/thealltour-wordmark-dark-v6.png" as const;

/** OG·JSON-LD·폴백 등 단일 URL이 필요할 때 — 라이트 자산 */
export const THEALL_WORDMARK_IMAGE_SRC = THEALL_WORDMARK_LIGHT_SRC;

/** 파비콘·앱 아이콘 (`public/favicon-*.png`, `apple-touch-icon.png`) */
export const THEALL_FAVICON_16_SRC = "/favicon-16.png" as const;
export const THEALL_FAVICON_32_SRC = "/favicon-32.png" as const;
export const THEALL_APPLE_TOUCH_ICON_SRC = "/apple-touch-icon.png" as const;
```

---

=== FILE: src/components/header/HeaderBrandLogo.tsx ===

```tsx
import { cn } from "@/lib/cn";
import { THEALL_WORDMARK_LIGHT_SRC } from "@/lib/brandAssets";
import { ThemedWordmarkImage } from "@/components/header/ThemedWordmarkImage";

/** 헤더 워드마크 라이트 경로 (레거시·외부 참조) */
export const HEADER_LOGO_SRC = THEALL_WORDMARK_LIGHT_SRC;

export type HeaderBrandLogoVariant = "touch" | "desktop";

export type HeaderBrandLogoProps = {
  /** touch: 모바일·태블릿 바(56→60px), desktop: lg+ 메인 바(64px) — 높이는 globals.css 토큰 */
  variant: HeaderBrandLogoVariant;
  priority?: boolean;
  className?: string;
};

/**
 * 헤더 워드마크. 크기는 `:root`의 `--header-logo-*` + `.header-brand-logo-img*` 로 제어.
 * 라이트/다크는 `ThemedWordmarkImage` 로 분기.
 */
export function HeaderBrandLogo({ variant, priority, className }: HeaderBrandLogoProps) {
  return (
    <ThemedWordmarkImage
      priority={priority}
      sizes={
        variant === "desktop"
          ? "(max-width: 1279px) min(340px, 36vw), min(360px, 30vw)"
          : "(max-width: 768px) min(180px, 52vw), 260px"
      }
      imgClassName={cn(
        "header-brand-logo-img",
        variant === "touch" ? "header-brand-logo-img--touch" : "header-brand-logo-img--desktop",
        className,
      )}
    />
  );
}
```

---

=== FILE: src/components/header/ThemedWordmarkImage.tsx ===

```tsx
import Image from "next/image";
import {
  THEALL_WORDMARK_DARK_SRC,
  THEALL_WORDMARK_LIGHT_SRC,
} from "@/lib/brandAssets";

/** `brandAssets` 워드마크 PNG와 동기화 (import 바인딩 이슈·캐시 꼬임 시 런타임 ReferenceError 방지) */
const WORDMARK_INTRINSIC_LIGHT = { width: 1024, height: 184 } as const;
const WORDMARK_INTRINSIC_DARK = { width: 1024, height: 189 } as const;

export type ThemedWordmarkImageProps = {
  /** `next/image` sizes (헤더 variant·사이드바 폭에 맞게) */
  sizes: string;
  /** 로고에만 붙는 클래스 (높이·max-width 등) */
  imgClassName: string;
  priority?: boolean;
  alt?: string;
};

/**
 * 라이트: 흰 배경 워드마크 / 다크: 납품 다크 워드마크 (`dark:hidden` · `hidden dark:inline-flex` 래퍼).
 */
export function ThemedWordmarkImage({
  sizes,
  imgClassName,
  priority,
  alt = "thealltour",
}: ThemedWordmarkImageProps) {
  const L = WORDMARK_INTRINSIC_LIGHT;
  const D = WORDMARK_INTRINSIC_DARK;
  return (
    <>
      {/* 래퍼에만 표시/숨김: img의 .header-brand-logo-img { display:block } 이 Tailwind hidden 을 덮어쓸 수 있음 */}
      <span className="inline-flex shrink-0 items-center dark:hidden">
        <Image
          alt={alt}
          width={L.width}
          height={L.height}
          sizes={sizes}
          priority={priority}
          src={THEALL_WORDMARK_LIGHT_SRC}
          className={imgClassName}
        />
      </span>
      <span className="hidden shrink-0 items-center dark:inline-flex">
        <Image
          alt={alt}
          width={D.width}
          height={D.height}
          sizes={sizes}
          priority={priority}
          src={THEALL_WORDMARK_DARK_SRC}
          className={imgClassName}
        />
      </span>
    </>
  );
}
```

---

=== FILE: src/components/SiteHeaderUI.tsx ===

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import HeaderQuickConsultCtas from "@/components/HeaderQuickConsultCtas";
import UserMenuDropdown from "@/components/header/UserMenuDropdown";
import { HeaderExpandSearch } from "@/components/HeaderExpandSearch";
import { DesktopMegaMenu } from "@/components/header/DesktopMegaMenu";
import { MobileHeaderMenu } from "@/components/header/MobileHeaderMenu";
import { HeaderBrandLogo } from "@/components/header/HeaderBrandLogo";
import { PageContainer } from "@/components/layout/PageContainer";
import { HEADER_DESKTOP_PRIMARY_NAV_KEYS, HEADER_PRIMARY_NAV_ITEMS, HEADER_PRIMARY_NAV_DEFAULT_HREF } from "@/components/header/headerNav.constants";
import type { HeaderPrimaryNavKey } from "@/components/header/headerNav.constants";
import type { HeaderNavigationData, HeaderPrimaryNavItem } from "@/components/header/headerNav.types";
import { cn } from "@/lib/cn";

export type SiteHeaderUIProps = {
  /** 서버에서 조회한 헤더 네비 데이터. null이면 직접 링크 fallback */
  headerNavigationData?: HeaderNavigationData | null;
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
  searchQuery?: string;
  golfPresetActive?: boolean;
  quickConsultHref?: string;
  kakaoConsultHref?: string;
  session: { name: string } | null;
  memberPoints: number | null;
};

/** 데이터 없을 때 사용할 최소 1차 메뉴 (직접 링크) */
function getFallbackPrimaryNav(): HeaderPrimaryNavItem[] {
  return HEADER_PRIMARY_NAV_ITEMS.map(({ key, label }) => ({
    key,
    label,
    href: HEADER_PRIMARY_NAV_DEFAULT_HREF[key as HeaderPrimaryNavKey],
  }));
}

function getNavLinkClass(isActive: boolean) {
  const base =
    "relative shrink-0 whitespace-nowrap text-sm tracking-tight transition-colors duration-150 py-1 px-0.5 rounded";
  if (isActive) {
    return cn(
      base,
      "font-medium text-[var(--foreground)]",
      "after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[var(--primary)]",
    );
  }
  return cn(
    base,
    "font-normal text-[var(--text-muted)]",
    "hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
  );
}

export default function SiteHeaderUI({
  headerNavigationData,
  activeTab,
  searchQuery,
  golfPresetActive = false,
  quickConsultHref,
  kakaoConsultHref,
  session,
  memberPoints,
}: SiteHeaderUIProps) {
  const pathname = usePathname();
  /** 모바일/태블릿 헤더 검색행: 홈에서만 숨겨 히어로 검색과 중복 제거 */
  const isHomePath = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const primaryNav = headerNavigationData?.primaryNav?.length
    ? headerNavigationData.primaryNav
    : getFallbackPrimaryNav();

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky z-50 transition-all duration-200 safe-top top-[env(safe-area-inset-top)] lg:z-40",
        scrolled
          ? "border-b border-[var(--divider)] bg-[var(--surface)] shadow-[var(--shadow-soft)] backdrop-blur-sm"
          : "border-b border-[var(--divider)] bg-[var(--surface)]",
      )}
    >
      {/* 데스크톱: 상단 유틸바 + 메인 헤더바 */}
      <PageContainer size="wide" className="hidden flex-col py-0 lg:flex">
        {/* 상단 유틸바: 회사소개 ~ 고객센터 */}
        <div className="flex h-10 items-center justify-center gap-x-8 border-b border-[var(--divider)]">
          <nav className="flex items-center gap-x-8 tracking-tight" aria-label="유틸리티 메뉴">
            <Link className={getNavLinkClass(activeTab === "about")} href="/about">
              회사소개
            </Link>
            <Link className={getNavLinkClass(activeTab === "quote")} href="/quote">
              견적문의
            </Link>
            <Link className={getNavLinkClass(activeTab === "reviews")} href="/reviews">
              여행후기
            </Link>
            <Link className={getNavLinkClass(activeTab === "blog")} href="/blog">
              여행가이드
            </Link>
            <Link className={getNavLinkClass(activeTab === "support")} href="/support">
              고객센터
            </Link>
          </nav>
        </div>

        {/* 메인 헤더바: 높이·로고 비율은 globals --header-* 토큰 (데스크톱 64px / 로고 높이·max는 토큰 참고) */}
        <div className="header-main-bar--desktop flex items-center gap-x-5 lg:gap-x-6 xl:gap-x-7">
          <Link
            href="/"
            className="header-logo-link shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-label="더올투어 홈"
          >
            <HeaderBrandLogo variant="desktop" priority />
          </Link>

          <DesktopMegaMenu primaryNav={primaryNav} />

          <div className="flex flex-1 justify-end items-center gap-x-4">
            <HeaderExpandSearch searchQuery={searchQuery} />

            <div className="flex shrink-0 items-center gap-3">
              {session ? (
                <UserMenuDropdown
                  userName={session.name}
                  points={memberPoints}
                />
              ) : (
                <>
                  <Link
                    className="type-small text-[var(--text-muted)] transition hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:rounded"
                    href="/login"
                  >
                    로그인
                  </Link>
                  <span className="text-[var(--divider)]" aria-hidden>|</span>
                  <Link
                    className={cn(
                      "type-small transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:rounded",
                      activeTab === "signup"
                        ? "font-semibold text-[var(--primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--foreground)]",
                    )}
                    href="/signup"
                  >
                    회원가입
                  </Link>
                </>
              )}
            </div>

            <HeaderQuickConsultCtas
              quickConsultHref={quickConsultHref}
              kakaoConsultHref={kakaoConsultHref}
            />
          </div>
        </div>
      </PageContainer>

      <MobileHeaderMenu
        primaryNav={primaryNav}
        activeTab={activeTab}
        searchQuery={searchQuery}
        session={session}
        showHeaderSearchRow={!isHomePath}
      />
    </header>
  );
}
```

---

=== FILE: postcss.config.mjs ===

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

---

=== FILE: src/app/globals.css ===

**전체 원문(생략 없음)**은 동일 내용을 `docs/footer-reference-globals.css`에 복사해 두었습니다. (`src/app/globals.css`와 바이트 동일 — PR 시점에 `fc`/`diff`로 검증 가능)

푸터 직접 관련 구간: 파일 하단 주석 `/* Footer pill links: token-only, reusable */` 직후 **`.footer-pill`**, **`.footer-pill-cta`** (약 930~965행).

**경로**: `docs/footer-reference-globals.css` ← **전체 스타일·토큰·@theme inline·타이포 유틸 포함**

---

## 요약 체크리스트

| 항목 | 상태 |
|------|------|
| Footer 컴포넌트 | `GlobalSiteFooter.tsx` (단일 파일, 서브컴포넌트 분리 없음) |
| 렌더 위치 | `app/layout.tsx` → `ConsultModalProvider` 하단 |
| Container | `PageContainer.tsx` |
| Link | Next.js `Link` / `<a>` 직접 사용 |
| 회사 데이터 | 컴포넌트 내 fallback + `GET /api/site-settings` + `lib/siteSettings.ts`(서버/DB) |
| 푸터 전용 CSS | `globals.css` `.footer-pill*` |
| tailwind.config | 없음 (Tailwind 4 + globals) |
| 반응형 훅 | 없음 (`md:` 유틸리티만) |

---

*문서 생성일: 저장소 기준 스냅샷. `globals.css` 전문은 `docs/footer-reference-globals.css` 참고.*

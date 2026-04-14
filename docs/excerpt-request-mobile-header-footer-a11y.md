# 발췌 요청 묶음 — 모바일 헤더 문의 CTA · 푸터 · 전역 스타일 · 접근성 참고

생성일: 2026-04-14  
원본 저장소 경로 기준: `thealltour-1`

---

## 번들 디렉터리

동일 내용의 **전체 `globals.css` 사본**은 아래 파일에 있습니다(원본과 바이트 동일 복사).

- `docs/excerpt-request-bundle/globals.css.full-copy.css` ← **`src/app/globals.css` 전문**

이 문서에는 길이상 `globals.css` 본문을 중복하지 않고, 아래 섹션에서 **요청 변수·클래스 구간의 줄 번호(원본 `src/app/globals.css` 기준)**만 안내합니다.

---

## 1. 모바일 상단 문의 버튼 관련

### 1-1. 모바일 헤더 상단바가 들어 있는 컴포넌트 (전체)

**실제 문의 CTA(`문의하기`)가 있는 상단바:** `src/components/header/MobileHeaderMenu.tsx`  
**레거시/보조 셸(우측 CTA 없음, 빈 spacer):** `src/components/header/HeaderMobileShell.tsx`

#### `MobileHeaderMenu.tsx` 전문

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useConsultModal } from "@/components/inquiry/ConsultModal";
import { MobileHeaderDrawer } from "./MobileHeaderDrawer";
import type { HeaderPrimaryNavItem } from "./headerNav.types";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import { HeaderBrandLogo } from "@/components/header/HeaderBrandLogo";
import HeaderProductSearch from "@/components/header/HeaderProductSearch";

export type MobileHeaderMenuProps = {
  primaryNav: HeaderPrimaryNavItem[];
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
  searchQuery?: string;
  session: { name: string } | null;
  /**
   * false면 헤더 직하단 검색행 미렌더 (홈 모바일/태블릿: 히어로 검색만 사용).
   * @default true
   */
  showHeaderSearchRow?: boolean;
};

/**
 * 모바일 2단 헤더: [☰ | 로고 | 문의하기] + (옵션) 고정 검색바
 * 검색 → 탐색(드로어) → 상담(CTA) 동선. CTA는 1개만(오렌지 캡슐).
 */
export function MobileHeaderMenu({
  primaryNav,
  activeTab: _activeTab,
  searchQuery,
  session,
  showHeaderSearchRow = true,
}: MobileHeaderMenuProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { openModal } = useConsultModal();

  useEffect(() => {
    function handleToggle() {
      setIsDrawerOpen((prev) => !prev);
    }
    window.addEventListener("thealltour-mobile-menu-toggle", handleToggle as EventListener);
    return () => {
      window.removeEventListener("thealltour-mobile-menu-toggle", handleToggle as EventListener);
    };
  }, []);

  function openDrawerWithTrack() {
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.mobile_menu_open,
        source: ANALYTICS_SOURCES.header_mobile_drawer,
        label: "hamburger",
        section: "mobile_header",
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType("mobile"),
      }),
    );
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
  }

  function handleConsultClick() {
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.cta_click,
        source: ANALYTICS_SOURCES.consult_cta,
        section: "mobile_header",
        label: "문의하기",
        href: "/quote",
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType("mobile"),
      }),
    );
    openModal({
      productTitle: "패키지/골프 맞춤 상담",
      sourcePath: typeof window !== "undefined" ? `${window.location.pathname}#mobile-header-consult` : "",
    });
  }

  return (
    <>
      <div className="mobile-header-stack lg:hidden">
        <div className="mobile-header-top-bar mx-auto max-w-6xl">
          <button
            type="button"
            aria-label="메뉴 열기"
            onClick={openDrawerWithTrack}
            className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--foreground)] transition-colors active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
          >
            <span className="flex flex-col gap-[3px]" aria-hidden>
              <span className="h-[2px] w-4 rounded-full bg-current" />
              <span className="h-[2px] w-4 rounded-full bg-current" />
              <span className="h-[2px] w-4 rounded-full bg-current" />
            </span>
          </button>

          <Link
            href="/"
            className="absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-label="더올투어 홈"
          >
            <HeaderBrandLogo variant="touch" className="mobile-header-top-logo" />
          </Link>

          <button
            type="button"
            onClick={handleConsultClick}
            className="mobile-header-top-bar__cta relative z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
          >
            문의하기
          </button>
        </div>

        {showHeaderSearchRow ? (
          <div className="mobile-header-search-row mx-auto w-full max-w-6xl border-t border-[var(--divider)]/80">
            <HeaderProductSearch mode="mobile" headerBar searchQuery={searchQuery} />
          </div>
        ) : null}
      </div>

      <MobileHeaderDrawer
        primaryNav={primaryNav}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        session={session}
        searchQuery={searchQuery}
      />
    </>
  );
}
```

#### `HeaderMobileShell.tsx` 전문

```tsx
"use client";

import Link from "next/link";
import { HeaderBrandLogo } from "@/components/header/HeaderBrandLogo";
import HeaderProductSearch from "@/components/header/HeaderProductSearch";

type HeaderMobileShellProps = {
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
  searchQuery?: string;
};

/**
 * 레거시/보조용 모바일 헤더 셸 — SiteHeaderUI와 동일한 2단 구조 유지
 */
export default function HeaderMobileShell({
  activeTab: _activeTab,
  searchQuery,
}: HeaderMobileShellProps) {
  return (
    <div className="mobile-header-stack lg:hidden">
      <div className="mobile-header-top-bar mx-auto max-w-6xl">
        <button
          type="button"
          aria-label="메뉴 열기"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("thealltour-mobile-menu-toggle"));
            }
          }}
          className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--foreground)] transition-colors active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
        >
          <span className="flex flex-col gap-[3px]" aria-hidden>
            <span className="h-[2px] w-4 rounded-full bg-current" />
            <span className="h-[2px] w-4 rounded-full bg-current" />
            <span className="h-[2px] w-4 rounded-full bg-current" />
          </span>
        </button>

        <Link
          href="/"
          className="absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          aria-label="더올투어 홈"
        >
          <HeaderBrandLogo variant="touch" className="mobile-header-top-logo" />
        </Link>

        {/* 우측은 메인 헤더 CTA 폭과 유사하게 비워 두어 로고 시각 중심 유지 */}
        <div className="relative z-10 h-10 min-w-[4.5rem] shrink-0" aria-hidden />
      </div>

      <div className="mobile-header-search-row mx-auto w-full max-w-6xl border-t border-[var(--divider)]/80">
        <HeaderProductSearch mode="mobile" headerBar searchQuery={searchQuery} />
      </div>
    </div>
  );
}
```

### 1-2. `mobile-header-top-bar__cta` 클래스 정의 위치

**파일:** `src/app/globals.css`  
**구간(원본 줄 번호):** `.mobile-header-stack` ~ `.mobile-header-top-bar__cta:active` 약 **295–334행**.  
전문은 `docs/excerpt-request-bundle/globals.css.full-copy.css` 와 동일합니다.

### 1-3. `문의하기` 버튼 JSX (모바일 상단, 전체)

`MobileHeaderMenu.tsx` 내 해당 버튼은 아래 한 블록이 전부입니다.

```tsx
          <button
            type="button"
            onClick={handleConsultClick}
            className="mobile-header-top-bar__cta relative z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
          >
            문의하기
          </button>
```

---

## 2. 푸터 관련

### 2-1. 사이트 푸터 컴포넌트 (전체)

**파일:** `src/components/site-chrome/GlobalSiteFooter.tsx`

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Instagram, Mail, MessageCircle, Phone } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

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

const focusRing = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]";

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
    <footer className="border-t border-[var(--divider)] bg-[var(--surface-muted)] text-[var(--foreground)]">
      <PageContainer size="wide">
        {/* 본문: 브랜드·회사정보 | 연락·액션 */}
        <div className="border-b border-[var(--divider)] py-5 sm:py-7 md:py-8">
          <div className="grid gap-4 sm:gap-9 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start md:gap-10 lg:gap-14">
            <div className="min-w-0">
              <p className="type-caption font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">
                THE ALL TOUR
              </p>
              <p className="font-card-title mt-1 text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
                {companyName}
              </p>
              <p className="mt-1.5 max-w-md text-sm leading-snug text-[var(--text-subtle)] sm:mt-2">
                맞춤형 해외·국내 골프·패키지 여행을 전문 상담으로 설계합니다.
              </p>
              <ul className="mt-3 space-y-0.5 text-[13px] leading-snug text-[var(--text-subtle)] sm:mt-4 sm:space-y-1 sm:text-sm sm:leading-snug">
                <li>
                  <span className="font-semibold text-[var(--foreground)]">대표</span>{" "}
                  <span>{ceoName}</span>
                </li>
                <li>
                  <span className="font-semibold text-[var(--foreground)]">주소</span>{" "}
                  <span className="break-words">{address}</span>
                </li>
                <li>
                  <span className="font-semibold text-[var(--foreground)]">사업자등록번호</span>{" "}
                  <span>{businessRegNo}</span>
                </li>
                <li>
                  <span className="font-semibold text-[var(--foreground)]">관광사업등록번호</span>{" "}
                  <span>{tourismRegNo}</span>
                </li>
                <li>
                  <span className="font-semibold text-[var(--foreground)]">통신판매업신고번호</span>{" "}
                  <span>{mailOrderRegNo}</span>
                </li>
              </ul>
            </div>

            <div className="flex min-w-0 flex-col gap-3 sm:gap-3.5">
              {/* 1순위: 카카오 */}
              <div>
                <p className="mb-1.5 type-caption font-medium text-[var(--text-subtle)]">
                  상담 · 채널
                </p>
                <a
                  href={kakaoChannelUrl ?? "https://pf.kakao.com"}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({
                      variant: "kakao",
                      size: "md",
                      className: "h-11 w-full justify-center gap-2 px-4 sm:w-auto sm:min-w-[220px]",
                    }),
                    focusRing,
                  )}
                >
                  <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                  카카오 채널
                </a>
              </div>

              {/* 2순위: 전화 · 이메일 */}
              <div>
                <p className="mb-1 type-caption font-medium text-[var(--text-subtle)] sm:mb-1.5">
                  연락처
                </p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <a
                    href={`tel:${mainPhone}`}
                    className={cn("footer-pill-secondary", focusRing)}
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    <span className="tabular-nums">대표 {mainPhone}</span>
                  </a>
                  <a
                    href={`mailto:${mainEmail}`}
                    className={cn("footer-pill-secondary", focusRing)}
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    <span className="max-w-[200px] truncate sm:max-w-none">{mainEmail}</span>
                  </a>
                </div>
              </div>

              {/* 3순위: 인스타 */}
              <div>
                <p className="mb-1 type-caption font-medium text-[var(--text-subtle)] sm:mb-1.5">
                  SNS
                </p>
                <a
                  href={instagramUrl ?? "https://www.instagram.com/thealltour"}
                  target="_blank"
                  rel="noreferrer"
                  className={cn("footer-pill-tertiary inline-flex items-center gap-1.5", focusRing)}
                >
                  <Instagram className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  인스타그램
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 하단: 정책 + 저작권 */}
        <div className="flex flex-col gap-2 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6 sm:gap-y-2 sm:gap-3 sm:py-4 md:py-5">
          <nav
            className="flex flex-wrap gap-x-0.5 gap-y-1 sm:gap-x-2 sm:gap-y-2"
            aria-label="약관 및 정책"
          >
            <Link
              href="/terms"
              className={cn("footer-pill-tertiary", focusRing)}
            >
              이용약관
            </Link>
            <Link
              href="/privacy"
              className={cn("footer-pill-tertiary", focusRing)}
            >
              개인정보처리방침
            </Link>
          </nav>
          <p className="text-center type-caption leading-snug text-[var(--text-subtle)] sm:text-right">
            © {new Date().getFullYear()} 더올투어. All rights reserved
            <Link
              href="/theall_manager_only"
              aria-label="관리자 전용 페이지"
              className="cursor-default no-underline hover:no-underline focus:no-underline"
            >
              .
            </Link>
          </p>
        </div>
      </PageContainer>
    </footer>
  );
}
```

### 2-2. `footer-pill-tertiary` 및 푸터 pill 계열 CSS

**파일:** `src/app/globals.css`  
**구간:** 주석 `/* Footer: 라이트 기준 토큰만` 부근 **약 1033–1137행** (`.footer-pill` ~ 모바일 미디어쿼리 내 `.footer-pill-tertiary`).  
전문은 번들의 `globals.css.full-copy.css`와 동일합니다.

### 2-3. 푸터에서 쓰는 토큰·유틸이 보이는 연관 파일 (전체)

푸터 TSX가 직접 참조하는 컴포넌트·토큰 매핑:

| 파일 | 비고 |
|------|------|
| `src/components/site-chrome/GlobalSiteFooter.tsx` | 위 2-1 전문 |
| `src/app/globals.css` | `--divider`, `--surface-muted`, `--foreground`, `--text-subtle`, `.footer-pill-*`, `@theme inline` |
| `src/components/layout/PageContainer.tsx` | `size="wide"` 레이아웃 |
| `src/components/ui/Button.tsx` | `buttonVariants({ variant: "kakao" })` — 카카오 CTA |

**`PageContainer.tsx` 전체**

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

**`Button.tsx` 전체** (`buttonVariants` · 카카오 variant 토큰)

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

/**
 * 솔리드 CTA 공통 그림자 — primary/accent/secondary/kakao `Button`과 동일.
 * 커스텀 `<button>`/`<a>`에도 붙여 시각적 통일을 유지합니다.
 */
export const solidButtonShadowClasses =
  "shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-soft-strong)]";

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
    "active:translate-y-px [&_svg]:shrink-0";

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
        `bg-[var(--accent)] text-[var(--on-accent)] ${solidButtonShadowClasses} hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)]`;
      break;
    case "secondary":
      variantClass =
        `bg-[var(--secondary)] text-white ${solidButtonShadowClasses} hover:bg-[var(--secondary-hover)] active:opacity-90`;
      break;
    case "kakao":
      /* 카카오 브랜드 옐로우 기반 솔리드 CTA (primary 오렌지로 대체 금지) */
      variantClass =
        `rounded-lg border border-[var(--theall-kakao-border)] bg-[var(--theall-kakao-bg)] text-[var(--theall-kakao-text)] ${solidButtonShadowClasses} ` +
        "hover:bg-[var(--theall-kakao-hover-bg)] active:bg-[var(--theall-kakao-active-bg)] " +
        "[&_svg]:text-[var(--theall-kakao-text)]";
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
        `bg-[var(--primary)] text-[var(--on-primary)] ${solidButtonShadowClasses} hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)]`;
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

## 3. 전역 스타일 / 디자인 토큰

### 3-1. `globals.css`

- **원본:** `src/app/globals.css`
- **docs 전문 사본:** `docs/excerpt-request-bundle/globals.css.full-copy.css`

### 3-2. CSS 변수 `--surface-muted`, `--foreground`, `--text-subtle`, `--divider` 정의 위치

모두 **`src/app/globals.css`** 의 `:root { ... }` (라이트, 대략 **6–230행**) 및 `.dark { ... }` (다크, 대략 **508–618행**)에 정의됩니다. 사본 파일에서 검색하면 동일합니다.

요약 매핑(라이트):

- `--surface-muted` → `var(--theall-card-muted-bg)` (#f6f7f9)
- `--foreground` → `var(--text-primary)` → `--theall-text-primary`
- `--text-subtle` → `#9aa3b2`
- `--divider` → `#eceef3`

### 3-3. Tailwind theme 확장 / 색상 토큰 매핑

별도 `tailwind.config.js`는 없습니다. **Tailwind v4** + **`@tailwindcss/postcss`** 이며, 테마 확장은 **`src/app/globals.css` 의 `@theme inline { ... }` 블록(대략 627–664행)** 에서 CSS 변수를 Tailwind 색상 토큰으로 노출합니다.

**`postcss.config.mjs` 전체**

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

---

## 4. 접근성·스타일 확인용 발췌

### 4-1. 푸터 JSX에서 요청 문구가 렌더되는 블록 (전체 맥락은 2-1과 동일)

- **THE ALL TOUR** — `<p className="type-caption ...">THE ALL TOUR</p>`
- **맞춤형 해외·국내 골프·패키지 여행을 전문 상담으로 설계합니다.** — 인접 `<p>`
- **대표 / 주소 / 사업자번호 / 관광사업등록번호** — `<ul>` 내 각 `<li>` (라벨: `대표`, `주소`, `사업자등록번호`, `관광사업등록번호`)
- **통신판매업번호** — 코드상 라벨은 **`통신판매업신고번호`** 입니다.
- **이용약관 / 개인정보처리방침** — 하단 `<nav>` 내 `Link` 두 개 (`footer-pill-tertiary`)

위 전체는 섹션 **2-1** 의 `GlobalSiteFooter.tsx` 코드 블록과 동일합니다.

### 4-2. 모바일 상단 `문의하기` 버튼 JSX

섹션 **1-3** 참고.

---

## 5. 추가 질문에 대한 저장소 기준 답변

### 5-1. Lighthouse contrast 지적이 발생한 “페이지 경로”

저장소에 **특정 URL의 대비 실패 로그나 리포트가 커밋되어 있지 않습니다.**  
`package.json` 스크립트는 로컬에서 **`http://localhost:3000`** (루트, 홈)을 대상으로 Lighthouse를 실행하도록 되어 있습니다. 실제 contrast 항목은 실행 시점의 빌드·콘텐츠에 따라 달라집니다.

### 5-2. 다크모드 / 라이트모드 둘 다 쓰는지

- **예.** `globals.css` 상단 `@custom-variant dark (&:where(.dark, .dark *));` 및 **`.dark { ... }`** 블록으로 다크 토큰을 정의합니다.
- 공개 루트 레이아웃(`src/app/layout.tsx`)의 `<html>` 에는 기본으로 `dark` 클래스가 붙어 있지 않습니다. 관리자 등에서 `html` 또는 상위에 `.dark` 를 쓰는 패턴과 주석이 맞물립니다.
- 일부 컴포넌트는 Tailwind `dark:` 변형을 직접 사용합니다(예: 워드마크 이미지 `ThemedWordmarkImage.tsx`).

### 5-3. 현재 브랜드 메인 컬러 토큰 정의부

**파일:** `src/app/globals.css` 의 `:root`

- **브랜드 블루(로고/아이콘 기준):** `--theall-brand-blue: #1e5b8f`
- **UI Primary(네비·기본 버튼·링크):** `--primary: var(--theall-brand-blue);`
- **주요 CTA·강조(오렌지, 남용 금지 주석):** `--accent: var(--theall-brand-orange);` 및 `--theall-brand-orange: #ff7a2f`

모바일 상단 **문의하기** 버튼은 `.mobile-header-top-bar__cta` 에서 **`background: var(--accent)`**, **`color: var(--on-accent)`** 를 사용합니다.

---

## 파일 경로 빠른 목록

| 설명 | 경로 |
|------|------|
| globals 전문 사본 | `docs/excerpt-request-bundle/globals.css.full-copy.css` |
| 모바일 문의 CTA 포함 헤더 | `src/components/header/MobileHeaderMenu.tsx` |
| 모바일 헤더 셸(CTA 없음) | `src/components/header/HeaderMobileShell.tsx` |
| 사이트 푸터 | `src/components/site-chrome/GlobalSiteFooter.tsx` |
| 전역 CSS 원본 | `src/app/globals.css` |
| PostCSS / Tailwind 엔트리 | `postcss.config.mjs` |
| 푸터 폭 래퍼 | `src/components/layout/PageContainer.tsx` |
| 카카오 버튼 variant | `src/components/ui/Button.tsx` |

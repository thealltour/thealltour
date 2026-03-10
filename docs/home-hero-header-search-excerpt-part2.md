# 모바일 홈 최상단 개편 — 추가 발췌 (2차)

이 문서는 1차 발췌에 이어 **SiteHeaderUI, SearchSuggestionsDropdown, 레이아웃 래퍼, API, 스타일, 모바일 헤더/드로어** 관련 코드를 발췌한 것입니다. 수정 없이 분석용으로만 사용하세요.

---

## 1. SiteHeaderUI (데스크탑/모바일 헤더 조합)

**파일:** `src/components/SiteHeaderUI.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import MemberLogoutButton from "@/components/MemberLogoutButton";
import HeaderQuickConsultCtas from "@/components/HeaderQuickConsultCtas";
import { HeaderExpandSearch } from "@/components/HeaderExpandSearch";
import { DesktopMegaMenu } from "@/components/header/DesktopMegaMenu";
import { MobileHeaderMenu } from "@/components/header/MobileHeaderMenu";
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
    "relative shrink-0 whitespace-nowrap type-nav font-medium transition-colors duration-150 py-1 px-0.5 rounded";
  if (isActive) {
    return cn(
      base,
      "text-[var(--foreground)] font-semibold",
      "after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[var(--primary)]",
    );
  }
  return cn(
    base,
    "text-[var(--text-muted)]",
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
        "sticky z-40 transition-all duration-200 safe-top top-[env(safe-area-inset-top)]",
        scrolled
          ? "border-b border-[var(--divider)] bg-[var(--surface)] shadow-[var(--shadow-soft)] backdrop-blur-sm"
          : "border-b border-[var(--divider)] bg-[var(--surface)]",
      )}
    >
      {/* 데스크톱: 상단 유틸바 + 메인 헤더바 */}
      <PageContainer size="wide" className="hidden flex-col py-0 lg:flex">
        {/* ... 데스크탑 유틸바, 로고, DesktopMegaMenu, HeaderExpandSearch, 마이페이지/로그인, HeaderQuickConsultCtas ... */}
        <div className="flex h-[72px] min-h-[72px] items-center gap-x-10 md:h-[76px] md:min-h-[76px]">
          <Link href="/" ...>
            <Image src="/thealltour-logo.png" ... />
            <span>더올투어</span>
            <span>Golf & Premium Travel</span>
          </Link>
          <DesktopMegaMenu primaryNav={primaryNav} />
          <div className="flex flex-1 justify-end items-center gap-x-4">
            <HeaderExpandSearch searchQuery={searchQuery} />
            {/* 마이페이지/로그인/회원가입 */}
            <HeaderQuickConsultCtas quickConsultHref={...} kakaoConsultHref={...} />
          </div>
        </div>
      </PageContainer>

      <MobileHeaderMenu
        primaryNav={primaryNav}
        activeTab={activeTab}
        searchQuery={searchQuery}
        session={session}
      />
    </header>
  );
}
```

---

## 2. 모바일 헤더 메뉴 (햄버거 / 로고 / 검색 / 채팅 아이콘)

**파일:** `src/components/header/MobileHeaderMenu.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, MessageCircle } from "lucide-react";
import { useConsultModal } from "@/components/ConsultModal";
import { MobileHeaderDrawer } from "./MobileHeaderDrawer";
import type { HeaderPrimaryNavItem } from "./headerNav.types";
// ... analytics imports

export function MobileHeaderMenu({
  primaryNav,
  activeTab: _activeTab,
  searchQuery,
  session,
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

  function openDrawerWithTrack(label: "hamburger" | "search_icon") {
    trackClientEvent(...);
    openDrawer();
  }

  return (
    <>
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4 lg:hidden md:px-6">
        <button type="button" aria-label="메뉴 열기" onClick={() => openDrawerWithTrack("hamburger")} ...>
          <span className="flex flex-col gap-[3px]" aria-hidden>
            <span className="h-[2px] w-4 rounded-full bg-current" />
            <span className="h-[2px] w-4 rounded-full bg-current" />
            <span className="h-[2px] w-4 rounded-full bg-current" />
          </span>
        </button>

        <Link href="/" className="flex min-w-0 flex-1 items-center justify-center gap-2 leading-tight" aria-label="더올투어 홈">
          <Image src="/thealltour-logo.png" alt="" width={40} height={40} sizes="40px" className="h-8 w-8 shrink-0 object-contain" />
          <div className="flex min-w-0 flex-col">
            <span className="heading-display-hero type-small font-bold tracking-tight text-[var(--secondary)]">더올투어</span>
            <span className="mt-0.5 type-caption font-medium tracking-wide text-[var(--text-muted)]">Golf & Premium Travel</span>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          <button type="button" aria-label="검색" onClick={() => openDrawerWithTrack("search_icon")} ...>
            <Search className="h-5 w-5" aria-hidden />
          </button>
          <a href="/quote" onClick={(e) => { e.preventDefault(); handleConsultClick(); }} aria-label="상담 문의" ...>
            <MessageCircle className="h-5 w-5" aria-hidden />
          </a>
        </div>
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

---

## 3. 모바일 헤더 드로어 (검색 + 아코디언 메뉴)

**파일:** `src/components/header/MobileHeaderDrawer.tsx`

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { X, LogIn, LogOut } from "lucide-react";
import HeaderProductSearch from "@/components/HeaderProductSearch";
import { MobileHeaderAccordion } from "./MobileHeaderAccordion";
// ...

export function MobileHeaderDrawer({
  primaryNav,
  isOpen,
  onClose,
  session,
  searchQuery,
}: MobileHeaderDrawerProps) {
  const pathname = usePathname();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // pathname 변경 시 드로어 자동 닫기
  useEffect(() => {
    if (!isOpen) return;
    onClose();
  }, [pathname]);

  if (!isOpen) return null;

  const content = (
    <div ref={overlayRef} role="dialog" aria-modal="true" aria-label="메뉴"
      className="fixed inset-0 z-50 flex flex-col bg-[var(--overlay)] safe-top safe-bottom"
      onClick={handleOverlayClick}>
      <div className="flex w-full max-w-sm flex-1 flex-col bg-[var(--surface-elevated)] shadow-[var(--shadow-modal)] ...">
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--divider)] px-4">
          <span className="type-small font-semibold text-[var(--foreground)]">메뉴</span>
          <button type="button" onClick={onClose} aria-label="메뉴 닫기" ...>
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="shrink-0 border-b border-[var(--divider)] p-4">
            <HeaderProductSearch mode="mobile" searchQuery={searchQuery} />
          </div>

          <div className="flex-1 px-0">
            <MobileHeaderAccordion items={items} expandedKey={expandedKey} onToggle={handleToggle} onNavigate={onClose} />
          </div>

          <div className="shrink-0 border-t border-[var(--divider)] p-4">
            {session ? (/* 마이페이지 / 포인트 / 로그아웃 */) : (
              <Link href="/login" ...> <LogIn ... /> 로그인 </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
```

---

## 4. SearchSuggestionsDropdown (히어로 검색 자동완성)

**파일:** `src/components/search/SearchSuggestionsDropdown.tsx`

```tsx
"use client";

import type { SearchSuggestion } from "@/types/search";
import { cn } from "@/lib/cn";

const TYPE_LABELS: Record<SearchSuggestion["type"], string> = {
  destination: "지역",
  theme: "테마",
  product: "상품",
};

export type SearchSuggestionsDropdownProps = {
  open: boolean;
  suggestions: SearchSuggestion[];
  highlightedIndex: number;
  isLoading: boolean;
  query: string;
  onSelect: (suggestion: SearchSuggestion, index: number) => void;
  onMouseEnterItem: (index: number) => void;
};

export default function SearchSuggestionsDropdown({
  open,
  suggestions,
  highlightedIndex,
  isLoading,
  query,
  onSelect,
  onMouseEnterItem,
}: SearchSuggestionsDropdownProps) {
  if (!open) return null;

  if (isLoading) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 shadow-[var(--shadow-modal)]">
          <p className="text-xs text-[var(--text-muted)]">추천어를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0 && query.trim().length >= 2) {
    return (
      <div className="absolute ...">
        <div className="..."><p>일치하는 추천어가 없습니다.</p>...</div>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50">
      <ul id="hero-autosuggest-list" className="max-h-[min(70vh,320px)] overflow-y-auto ... rounded-2xl border ... py-1" role="listbox" aria-label="검색 추천 목록">
        {suggestions.map((item, index) => (
          <li
            key={item.id}
            id={`hero-suggestion-${index}`}
            role="option"
            aria-selected={index === highlightedIndex}
            onMouseDown={(e) => { e.preventDefault(); onSelect(item, index); }}
            onMouseEnter={() => onMouseEnterItem(index)}
            className={cn(
              "flex cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition",
              index === highlightedIndex ? "bg-[var(--primary-soft)] text-[var(--foreground)]" : "text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
            )}
          >
            <span className={cn("shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold", item.type === "destination" && "bg-blue-100 ...", ...)}>
              {TYPE_LABELS[item.type]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.label}</p>
              {item.sublabel ? <p className="truncate text-[11px] text-[var(--text-muted)]">{item.sublabel}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 5. 레이아웃 래퍼: PageContainer, SectionBlock

**파일:** `src/components/layout/PageContainer.tsx`

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

**파일:** `src/components/layout/SectionBlock.tsx`

```tsx
"use client";

import { cn } from "@/lib/cn";

export type SectionBlockSurface = "none" | "muted" | "card";
export type SectionBlockPadding = "none" | "sm" | "md" | "lg";

export type SectionBlockProps = {
  children: React.ReactNode;
  id?: string;
  className?: string;
  headerClassName?: string;
  surface?: SectionBlockSurface;
  padding?: SectionBlockPadding;
  header?: React.ReactNode;
};

const SURFACE_CLASS: Record<SectionBlockSurface, string> = {
  none: "bg-transparent",
  muted: "bg-[var(--surface-muted)] ring-1 ring-[var(--border)]",
  card: "bg-[var(--surface)] ring-1 ring-[var(--border)] shadow-[var(--shadow-soft)]",
};

const PADDING_CLASS: Record<SectionBlockPadding, string> = {
  none: "p-0",
  sm: "p-4 sm:p-5",
  md: "p-5 sm:p-6 md:p-8",
  lg: "p-6 sm:p-8 md:p-10",
};

export function SectionBlock({ children, id, className, headerClassName, surface = "none", padding = "md", header }: SectionBlockProps) {
  return (
    <section id={id} className={cn("space-y-6", SURFACE_CLASS[surface], padding === "none" ? "" : "rounded-2xl sm:rounded-3xl", PADDING_CLASS[padding], className)}>
      {header ? <div className={cn(headerClassName)}>{header}</div> : null}
      {children}
    </section>
  );
}
```

---

## 6. 검색 API 및 데이터 출처

**파일:** `src/app/api/search/suggestions/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSearchSuggestions } from "@/lib/search/getSearchSuggestions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const keyword = q.trim();
  if (!keyword) {
    return NextResponse.json({ suggestions: [] });
  }
  try {
    const suggestions = await getSearchSuggestions(keyword);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
```

**파일:** `src/app/api/search/recommended/route.ts`

```ts
// GET: Supabase recommended_search_keywords 테이블, is_active=true, sort_order·created_at 순, 최대 10개
// POST: 추천 검색어 생성 (keyword, sortOrder, isActive)
let query = supabase
  .from("recommended_search_keywords")
  .select("id, keyword, sort_order, is_active");
// ... .eq("is_active", true).order("sort_order", { ascending: true }).order("created_at", ...)
// 응답: items: [{ id, keyword }]
```

**파일:** `src/lib/search/getSearchSuggestions.ts` (요약)

- **입력:** `keyword` (2자 이상).
- **출력:** `SearchSuggestion[]` (destination 최대 3, theme 최대 3, product 최대 4).
- **데이터:**
  - `product_taxonomies` (destination/theme) — `ilike("name", pattern)`.
  - `products` — `ilike("title", pattern)`.
- **href:** `getDestinationLandingHref`, `getThemeLandingHref`, `/products/${id}`.

---

## 7. 스타일 영향 범위 (Hero/이미지 오버레이)

**파일:** `src/app/globals.css` (Hero·이미지 오버레이 관련 발췌)

**CSS 변수 (:root):**

```css
--hero-bg: var(--theall-page-bg);
--hero-scrim-from: rgba(255, 255, 255, 0.88);
--hero-scrim-to: transparent;
--hero-text-primary: var(--foreground);
--hero-text-secondary: var(--text-muted);
--hero-accent: var(--primary);
--hero-badge-bg: rgba(0, 0, 0, 0.06);
--hero-badge-border: rgba(0, 0, 0, 0.12);
--hero-vignette-edge: rgba(255, 255, 255, 0.35);
--hero-vignette-soft: transparent;
--hero-overlay-warm-start: rgba(255, 248, 240, 0.2);
--hero-overlay-warm-end: transparent;
--overlay-image-from: rgba(0, 0, 0, 0.28);
--overlay-image-via: rgba(0, 0, 0, 0.04);
```

**클래스 정의:**

```css
.hero-scrim {
  background-image: linear-gradient(to right, var(--hero-scrim-from) 0%, var(--hero-scrim-from) 45%, var(--hero-scrim-to) 100%);
}
.hero-overlay-warm {
  background-image: linear-gradient(to left, var(--hero-overlay-warm-start) 0%, var(--hero-overlay-warm-end) 50%, transparent 100%);
}
.hero-vignette {
  background-image: radial-gradient(circle at center, transparent 62%, var(--hero-vignette-edge) 100%);
}
.hero-vignette-soft {
  background-image: radial-gradient(circle at top left, var(--hero-vignette-soft) 0%, transparent 60%);
}
.hero-text-shadow-title { text-shadow: 0 2px 12px rgba(0, 0, 0, 0.28); }
.hero-text-shadow-body { text-shadow: 0 1px 8px rgba(0, 0, 0, 0.22); }
.image-overlay-bottom {
  background-image: linear-gradient(to top, var(--overlay-image-from) 0%, var(--overlay-image-via) 50%, transparent 100%);
}
```

**.dark 테마에서 Hero 변수:**

```css
.dark {
  --hero-bg: var(--site-bg);
  --hero-scrim-from: var(--site-bg);
  --hero-scrim-to: transparent;
  --hero-vignette-edge: rgba(2, 6, 23, 0.85);
  --hero-vignette-soft: rgba(148, 163, 184, 0.26);
  --hero-overlay-warm-start: rgba(248, 196, 113, 0.26);
  --hero-overlay-warm-end: rgba(248, 196, 113, 0.08);
  --overlay-image-from: rgba(0, 0, 0, 0.5);
  --overlay-image-via: rgba(0, 0, 0, 0.08);
}
```

- **사용처:** `HeroSection.tsx`에서 `hero-scrim`, `hero-overlay-warm`, `hero-vignette`, `hero-vignette-soft`, `image-overlay-bottom` 클래스 사용.
- **스타일 방식:** Tailwind + `globals.css` 전역 클래스. 별도 `.module.css` / SCSS는 사용하지 않음.

---

## 요약

| 구분 | 내용 |
|------|------|
| **모바일 헤더** | `SiteHeaderUI` → `MobileHeaderMenu`: 햄버거(메뉴 토글) · 로고(홈) · 검색 아이콘 · 채팅(상담) 아이콘. 모두 `lg:hidden`으로 모바일만 노출. |
| **모바일 드로어** | `MobileHeaderDrawer`: 열리면 상단에 `HeaderProductSearch mode="mobile"`, 그 아래 `MobileHeaderAccordion`, 하단 로그인/마이페이지. |
| **검색 데이터** | 히어로 검색: 최근검색어 `hero_recent_searches`(localStorage, 5개), 추천검색어 `/api/search/recommended`, 자동완성 `/api/search/suggestions` → `getSearchSuggestions`(taxonomies + products). |
| **레이아웃** | `PageContainer`(size: reading/default/wide/full, px 반응형), `SectionBlock`(surface, padding, header). |
| **스타일** | Hero/이미지 오버레이는 `globals.css`의 `.hero-scrim`, `.hero-overlay-warm`, `.hero-vignette`, `.image-overlay-bottom` 및 동일 이름 CSS 변수. Tailwind와 함께 사용. |

이 문서와 1차 발췌(`page.tsx`, `HeroSection`, `HomeHeroSearch`, `HeaderSearchDropdown`, `HeaderProductSearch`, `HeroRecommendedLinks`, `heroContent.ts`, `homeHeroContent` 타입, `SiteHeader`, `HeaderMobileShell` 등)를 합치면 모바일 홈 최상단 개편 분석에 필요한 코드가 모두 포함됩니다.

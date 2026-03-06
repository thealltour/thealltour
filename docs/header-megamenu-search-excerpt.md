# 헤더 / 메가메뉴 / 검색 — 발췌 (전체 복사용)

아래는 `src/components/header/*`, `src/components/SiteHeaderUI.tsx`, 검색 컴포넌트, `src/app/products/page.tsx` 및 taxonomy 타입/상수를 발췌한 텍스트입니다.  
**특히**: Header, DesktopMegaMenu, MobileMenu, SearchBox, 클릭 핸들러 위치, taxonomy item shape.

---

## 1. Taxonomy item shape (헤더 네비 데이터 구조)

**파일: src/components/header/headerNav.types.ts**

```ts
/**
 * 헤더 네비게이션 IA 타입
 * 데이터 소스: getHeaderNavigationData() (taxonomy + home-curated)
 */

/** 단일 링크(리프) 항목 */
export type HeaderNavLeafItem = {
  key: string;
  label: string;
  href: string;
};

/** 그룹(드롭다운/메가메뉴용): 라벨 + 하위 링크 목록 */
export type HeaderNavGroup = {
  key: string;
  label: string;
  items: HeaderNavLeafItem[];
};

/** 1차 메뉴 항목: 직접 링크(href) 또는 그룹(groups) 소유 */
export type HeaderPrimaryNavItem = {
  key: string;
  label: string;
  /** 직접 이동 링크(맞춤/단체문의 등) */
  href?: string;
  /** 하위 그룹(추천/지역/테마 등) */
  groups?: HeaderNavGroup[];
};

/** 전체 헤더 네비게이션 데이터 */
export type HeaderNavigationData = {
  primaryNav: HeaderPrimaryNavItem[];
};
```

---

## 2. 헤더 네비 상수 (1차 메뉴 key/label)

**파일: src/components/header/headerNav.constants.ts**

```ts
export const HEADER_PRIMARY_NAV_KEYS = [
  "recommended", "region", "theme", "inquiry", "guides", "support",
] as const;

export type HeaderPrimaryNavKey = (typeof HEADER_PRIMARY_NAV_KEYS)[number];

export const HEADER_PRIMARY_NAV_ITEMS: ReadonlyArray<{ key: HeaderPrimaryNavKey; label: string }> = [
  { key: "recommended", label: "추천여행" },
  { key: "region", label: "지역별 여행" },
  { key: "theme", label: "테마별 여행" },
  { key: "inquiry", label: "맞춤/단체문의" },
  { key: "guides", label: "여행가이드" },
  { key: "support", label: "고객센터" },
];

export const HEADER_NAV_GROUP_KEYS = {
  RECOMMENDED: "recommended",
  REGION: "region",
  THEME: "theme",
} as const;

export const HEADER_PRIMARY_NAV_DEFAULT_HREF: Record<HeaderPrimaryNavKey, string> = {
  recommended: "/",
  region: "/products",
  theme: "/products",
  inquiry: "/quote",
  guides: "/guides",
  support: "/support",
};

/** 데스크톱 2행에 노출할 1차 탐색축 메뉴 key */
export const HEADER_DESKTOP_PRIMARY_NAV_KEYS: readonly HeaderPrimaryNavKey[] = [
  "recommended", "region", "theme", "inquiry",
];
```

---

## 3. Header (사이트 헤더 루트)

**파일: src/components/SiteHeaderUI.tsx**

- **역할**: `headerNavigationData`로 1차 메뉴 구성, 데스크톱에는 `DesktopMegaMenu` + `HeaderProductSearch`, 모바일에는 `MobileHeaderMenu` 렌더.
- **클릭 핸들러**: 상단 정적 링크(회사소개/견적문의/여행후기 등)는 `Link`만 사용. 메가메뉴·검색·모바일 메뉴는 각 하위 컴포넌트에 위임.

```tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import HeaderProductSearch from "@/components/HeaderProductSearch";
import MemberLogoutButton from "@/components/MemberLogoutButton";
import HeaderQuickConsultCtas from "@/components/HeaderQuickConsultCtas";
import { DesktopMegaMenu } from "@/components/header/DesktopMegaMenu";
import { MobileHeaderMenu } from "@/components/header/MobileHeaderMenu";
import { HEADER_PRIMARY_NAV_ITEMS, HEADER_PRIMARY_NAV_DEFAULT_HREF } from "@/components/header/headerNav.constants";
import type { HeaderPrimaryNavKey } from "@/components/header/headerNav.constants";
import type { HeaderNavigationData, HeaderPrimaryNavItem } from "@/components/header/headerNav.types";
import { cn } from "@/lib/cn";

export type SiteHeaderUIProps = {
  headerNavigationData?: HeaderNavigationData | null;
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
  searchQuery?: string;
  golfPresetActive?: boolean;
  quickConsultHref?: string;
  kakaoConsultHref?: string;
  session: { name: string } | null;
  memberPoints: number | null;
};

function getFallbackPrimaryNav(): HeaderPrimaryNavItem[] {
  return HEADER_PRIMARY_NAV_ITEMS.map(({ key, label }) => ({
    key,
    label,
    href: HEADER_PRIMARY_NAV_DEFAULT_HREF[key as HeaderPrimaryNavKey],
  }));
}

function getNavLinkClass(isActive: boolean) {
  const base = "relative shrink-0 whitespace-nowrap type-nav transition-colors duration-150 py-1 px-0.5 rounded";
  if (isActive) {
    return cn(base, "text-[var(--foreground)] font-semibold",
      "after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[var(--primary)]");
  }
  return cn(base, "text-[var(--text-muted)]", "hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)]");
}

export default function SiteHeaderUI({ headerNavigationData, activeTab, searchQuery, golfPresetActive = false, quickConsultHref, kakaoConsultHref, session, memberPoints }: SiteHeaderUIProps) {
  const [scrolled, setScrolled] = useState(false);
  const primaryNav = headerNavigationData?.primaryNav?.length ? headerNavigationData.primaryNav : getFallbackPrimaryNav();

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 8); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("sticky z-40 transition-all duration-200 safe-top top-[env(safe-area-inset-top)]",
      scrolled ? "border-b border-[var(--divider)] bg-[var(--surface)] shadow-[var(--shadow-soft)] backdrop-blur-sm" : "bg-[var(--theall-page-bg)]")}>
      {/* 데스크톱 */}
      <div className="mx-auto hidden w-full max-w-6xl flex-col px-6 py-0 lg:flex md:px-10">
        <div className="flex h-16 items-center gap-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-xl px-2 py-2 ..." aria-label="더올투어 홈">
            <Image src="/thealltour-logo.png" alt="" width={64} height={64} sizes="64px" className="h-10 w-10 object-contain md:h-11 md:w-11" />
            <div className="flex flex-col justify-center leading-tight">
              <span className="heading-display-hero text-[15px] font-bold ...">더올투어</span>
              <span className="mt-0.5 type-caption ...">Golf & Premium Travel</span>
            </div>
          </Link>
          <nav className="flex min-w-0 flex-1 items-center justify-center gap-1 tracking-tight">
            <Link className={getNavLinkClass(activeTab === "about")} href="/about">회사소개</Link>
            <Link className={getNavLinkClass(activeTab === "quote")} href="/quote">견적문의</Link>
            <Link className={getNavLinkClass(activeTab === "reviews")} href="/reviews">여행후기</Link>
            <Link className={getNavLinkClass(activeTab === "blog")} href="/blog">여행가이드</Link>
            <Link className={getNavLinkClass(activeTab === "support")} href="/support">고객센터</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            {session ? (<> 마이페이지/포인트/로그아웃 등 </>) : (<> 로그인 | 회원가입 </>)}
          </div>
        </div>
        <div className="flex h-14 items-center gap-3 border-t border-[var(--divider)]">
          <DesktopMegaMenu primaryNav={primaryNav} />
          <div className="flex flex-1 justify-center px-2">
            <HeaderProductSearch mode="desktop" searchQuery={searchQuery} />
          </div>
          <HeaderQuickConsultCtas quickConsultHref={quickConsultHref} kakaoConsultHref={kakaoConsultHref} />
        </div>
      </div>
      <MobileHeaderMenu primaryNav={primaryNav} activeTab={activeTab} searchQuery={searchQuery} session={session} />
    </header>
  );
}
```

---

## 4. DesktopMegaMenu (데스크톱 메가메뉴)

**파일: src/components/header/DesktopMegaMenu.tsx**

- **클릭 핸들러**: `setOpenKey`로 열림/닫힘. `DesktopNavItem`에 `onOpen`/`onClose` 전달. Escape·외부 클릭으로 `onClose`.
- **taxonomy 렌더**: `primaryNav`를 `HEADER_DESKTOP_PRIMARY_NAV_KEYS`로 필터한 뒤 `DesktopNavItem`으로 각 1차 항목 렌더.

```tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { HEADER_DESKTOP_PRIMARY_NAV_KEYS } from "./headerNav.constants";
import type { HeaderPrimaryNavKey } from "./headerNav.constants";
import type { HeaderPrimaryNavItem } from "./headerNav.types";
import { DesktopNavItem } from "./DesktopNavItem";
import { cn } from "@/lib/cn";

function getNavLinkClass(isActive: boolean) { /* ... */ }
function getIsActive(item: HeaderPrimaryNavItem, pathname: string): boolean {
  const key = item.key as HeaderPrimaryNavKey;
  if (key === "recommended") return pathname === "/";
  if (key === "inquiry") return pathname === "/quote";
  if (key === "region" || key === "theme") return pathname.startsWith("/products");
  return false;
}

export function DesktopMegaMenu({ primaryNav }: { primaryNav: HeaderPrimaryNavItem[] }) {
  const pathname = usePathname();
  const [openKey, setOpenKey] = useState<HeaderPrimaryNavKey | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const items = primaryNav.filter((p) => HEADER_DESKTOP_PRIMARY_NAV_KEYS.includes(p.key as HeaderPrimaryNavKey));
  const onClose = useCallback(() => setOpenKey(null), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) { if (e.key === "Escape") setOpenKey(null); }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpenKey(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav ref={containerRef} className="flex shrink-0 items-center gap-4" aria-label="탐색 메뉴">
      {items.map((item) => (
        <DesktopNavItem
          key={item.key}
          item={item}
          isOpen={openKey === (item.key as HeaderPrimaryNavKey)}
          onOpen={() => setOpenKey(item.key as HeaderPrimaryNavKey)}
          onClose={onClose}
          isActive={getIsActive(item, pathname)}
          getNavLinkClass={getNavLinkClass}
        />
      ))}
    </nav>
  );
}
```

---

## 5. DesktopNavItem + DesktopMegaMenuPanel (1차 항목 + taxonomy 패널)

**파일: src/components/header/DesktopNavItem.tsx**

- **클릭 핸들러**: `onClick`에서 `isOpen`이면 `onClose()`, 아니면 `onOpen()`. `onMouseEnter` → `onOpen`, `onMouseLeave` → `onClose`. `handleKeyDown`(Escape) → `onClose`, `handleBlur` → 포커스 밖이면 `onClose`.
- **taxonomy 렌더**: `item.groups`가 있으면 `DesktopMegaMenuPanel`에 넘겨서 `group.items`(leaf)를 `Link`로 렌더. 없고 `item.href` 있으면 단일 `Link`.

```tsx
"use client";

import Link from "next/link";
import { useRef, useCallback } from "react";
import type { HeaderPrimaryNavItem } from "./headerNav.types";
import { DesktopMegaMenuPanel } from "./DesktopMegaMenuPanel";
import { cn } from "@/lib/cn";

type DesktopNavItemProps = {
  item: HeaderPrimaryNavItem;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  isActive: boolean;
  getNavLinkClass: (isActive: boolean) => string;
};

export function DesktopNavItem({ item, isOpen, onOpen, onClose, isActive, getNavLinkClass }: DesktopNavItemProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const hasPanel = Boolean(item.groups && item.groups.length > 0);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => { if (e.key === "Escape") onClose(); }, [onClose]);
  const handleBlur = useCallback(() => {
    requestAnimationFrame(() => {
      if (wrapperRef.current && !wrapperRef.current.contains(document.activeElement)) onClose();
    });
  }, [onClose]);

  if (!hasPanel && item.href) {
    return <Link href={item.href} className={getNavLinkClass(isActive)}>{item.label}</Link>;
  }

  return (
    <div ref={wrapperRef} className="relative" onMouseEnter={onOpen} onMouseLeave={onClose} onKeyDown={handleKeyDown} onBlur={handleBlur}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls={isOpen ? `mega-menu-panel-${item.key}` : undefined}
        id={`mega-menu-trigger-${item.key}`}
        className={cn("...", isActive || isOpen ? "..." : "...")}
        onClick={(e) => { e.preventDefault(); if (isOpen) onClose(); else onOpen(); }}
        onFocus={onOpen}
      >
        {item.label}
      </button>
      {hasPanel && isOpen && <DesktopMegaMenuPanel item={item} onClose={onClose} />}
    </div>
  );
}
```

**파일: src/components/header/DesktopMegaMenuPanel.tsx**

- **클릭 핸들러**: 각 `leaf`는 `Link` + `onClick={onClose}` (패널 닫기). 패널 전체 `onMouseLeave={onClose}`.

```tsx
"use client";

import Link from "next/link";
import type { HeaderPrimaryNavItem } from "./headerNav.types";
import { cn } from "@/lib/cn";

type DesktopMegaMenuPanelProps = { item: HeaderPrimaryNavItem; onClose: () => void; };

export function DesktopMegaMenuPanel({ item, onClose }: DesktopMegaMenuPanelProps) {
  const groups = item.groups ?? [];
  return (
    <div id={`mega-menu-panel-${item.key}`} className={cn("absolute left-0 top-full z-50 ...")} role="menu" aria-label={item.label} onMouseLeave={onClose}>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.key} className="space-y-2">
            <p className="type-small font-semibold text-[var(--text-muted)]">{group.label}</p>
            <ul className="space-y-1" role="none">
              {group.items.map((leaf) => (
                <li key={leaf.key} role="none">
                  <Link href={leaf.href} role="menuitem" className={cn("block rounded-md py-1.5 px-2 ...")} onClick={onClose}>
                    {leaf.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 6. MobileHeaderMenu (모바일 상단 바 + 햄버거)

**파일: src/components/header/MobileHeaderMenu.tsx**

- **클릭 핸들러**: `openDrawer` / `closeDrawer` → `setIsDrawerOpen`. 햄버거 버튼 `onClick={openDrawer}`, 검색 아이콘도 `onClick={openDrawer}`. 상담 아이콘 `onClick`에서 `handleConsultClick`(모달 오픈).
- **taxonomy 렌더**: `primaryNav`를 `MobileHeaderDrawer`에 넘기고, 드로어 안에서 `MobileHeaderAccordion`이 렌더.

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, MessageCircle } from "lucide-react";
import { useConsultModal } from "@/components/ConsultModal";
import { MobileHeaderDrawer } from "./MobileHeaderDrawer";
import type { HeaderPrimaryNavItem } from "./headerNav.types";

export type MobileHeaderMenuProps = {
  primaryNav: HeaderPrimaryNavItem[];
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
  searchQuery?: string;
  session: { name: string } | null;
};

export function MobileHeaderMenu({ primaryNav, activeTab: _activeTab, searchQuery, session }: MobileHeaderMenuProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { openModal } = useConsultModal();

  useEffect(() => {
    function handleToggle() { setIsDrawerOpen((prev) => !prev); }
    window.addEventListener("thealltour-mobile-menu-toggle", handleToggle as EventListener);
    return () => window.removeEventListener("thealltour-mobile-menu-toggle", handleToggle as EventListener);
  }, []);

  function openDrawer() { setIsDrawerOpen(true); }
  function closeDrawer() { setIsDrawerOpen(false); }
  function handleConsultClick() {
    openModal({ productTitle: "패키지/골프 맞춤 상담", sourcePath: typeof window !== "undefined" ? `${window.location.pathname}#mobile-header-consult` : "" });
  }

  return (
    <>
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4 lg:hidden md:px-6">
        <button type="button" aria-label="메뉴 열기" onClick={openDrawer} className="...">
          <span className="flex flex-col gap-[3px]" aria-hidden>
            <span className="h-[2px] w-4 rounded-full bg-current" />
            <span className="h-[2px] w-4 rounded-full bg-current" />
            <span className="h-[2px] w-4 rounded-full bg-current" />
          </span>
        </button>
        <Link href="/" className="..." aria-label="더올투어 홈">
          <Image src="/thealltour-logo.png" alt="" width={40} height={40} sizes="40px" className="h-8 w-8 shrink-0 object-contain" />
          <div className="flex min-w-0 flex-col">...</div>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" aria-label="검색" onClick={openDrawer} className="..."><Search className="h-5 w-5" /></button>
          <a href="/quote" onClick={(e) => { e.preventDefault(); handleConsultClick(); }} aria-label="상담 문의" className="..."><MessageCircle className="h-5 w-5" /></a>
        </div>
      </div>
      <MobileHeaderDrawer primaryNav={primaryNav} isOpen={isDrawerOpen} onClose={closeDrawer} session={session} searchQuery={searchQuery} />
    </>
  );
}
```

---

## 7. MobileHeaderDrawer (슬라이드 메뉴 + 검색 + 아코디언)

**파일: src/components/header/MobileHeaderDrawer.tsx**

- **클릭 핸들러**: `handleOverlayClick` → `e.target === overlayRef.current`이면 `onClose`. 닫기 버튼 `onClick={onClose}`. 내부 컨텐츠 `onClick={(e) => e.stopPropagation()}`. 링크/로그아웃 등 `onClick={onClose}`로 드로어 닫기.
- **taxonomy 렌더**: `items={primaryNav}`를 `MobileHeaderAccordion`에 전달. 검색은 `HeaderProductSearch mode="mobile"`.

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { X, LogIn, LogOut } from "lucide-react";
import HeaderProductSearch from "@/components/HeaderProductSearch";
import { MobileHeaderAccordion } from "./MobileHeaderAccordion";
import type { HeaderPrimaryNavItem } from "./headerNav.types";
import { cn } from "@/lib/cn";

export type MobileHeaderDrawerProps = {
  primaryNav: HeaderPrimaryNavItem[];
  isOpen: boolean;
  onClose: () => void;
  session: { name: string } | null;
  searchQuery?: string;
};

export function MobileHeaderDrawer({ primaryNav, isOpen, onClose, session, searchQuery }: MobileHeaderDrawerProps) {
  const pathname = usePathname();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const items = primaryNav;

  useEffect(() => { if (!isOpen) return; function handleKeyDown(e: KeyboardEvent) { if (e.key === "Escape") onClose(); } window.addEventListener("keydown", handleKeyDown); return () => window.removeEventListener("keydown", handleKeyDown); }, [isOpen, onClose]);
  useEffect(() => { if (!isOpen) setExpandedKey(null); }, [isOpen]);
  useEffect(() => { if (!isOpen) return; onClose(); }, [pathname]);

  function handleToggle(key: string) { setExpandedKey((prev) => (prev === key ? null : key)); }
  function handleOverlayClick(e: React.MouseEvent) { if (e.target === overlayRef.current) onClose(); }

  if (!isOpen) return null;

  const content = (
    <div ref={overlayRef} role="dialog" aria-modal="true" aria-label="메뉴" className="fixed inset-0 z-50 flex flex-col bg-[var(--overlay)] ..." onClick={handleOverlayClick}>
      <div className={cn("flex w-full max-w-sm flex-1 flex-col ...")} onClick={(e) => e.stopPropagation()}>
        <div className="flex h-14 shrink-0 items-center justify-between ...">
          <span className="type-small font-semibold ...">메뉴</span>
          <button type="button" onClick={onClose} aria-label="메뉴 닫기" className="..."><X className="h-5 w-5" /></button>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="shrink-0 border-b ... p-4">
            <HeaderProductSearch mode="mobile" searchQuery={searchQuery} />
          </div>
          <div className="flex-1 px-0">
            <MobileHeaderAccordion items={items} expandedKey={expandedKey} onToggle={handleToggle} onNavigate={onClose} />
          </div>
          <div className="shrink-0 border-t ... p-4">{/* 로그인/마이페이지/로그아웃 */}</div>
        </div>
      </div>
    </div>
  );
  return createPortal(content, document.body);
}
```

---

## 8. MobileHeaderAccordion (모바일 taxonomy 아코디언)

**파일: src/components/header/MobileHeaderAccordion.tsx**

- **클릭 핸들러**: `onToggle(item.key)` → 1차 항목 버튼 클릭 시 열기/닫기. `Link` 클릭 시 `onClick={onNavigate}` (드로어 닫기).
- **taxonomy 렌더**: `items`(HeaderPrimaryNavItem[])를 순회. `item.groups`가 있으면 버튼 + `group.items`를 `Link(leaf.href, leaf.label)`로 렌더. `item.href`만 있으면 단일 `Link`. 회사소개는 하드코딩 `Link href="/about"`.

```tsx
"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { HeaderPrimaryNavItem } from "./headerNav.types";
import { cn } from "@/lib/cn";

export type MobileHeaderAccordionProps = {
  items: HeaderPrimaryNavItem[];
  expandedKey: string | null;
  onToggle: (key: string) => void;
  onNavigate?: () => void;
};

export function MobileHeaderAccordion({ items, expandedKey, onToggle, onNavigate }: MobileHeaderAccordionProps) {
  return (
    <nav className="flex flex-col" aria-label="모바일 메뉴">
      <ul className="flex flex-col">
        {items.map((item) => {
          const hasGroups = item.groups && item.groups.length > 0;
          const isExpanded = expandedKey === item.key;

          if (hasGroups) {
            return (
              <li key={item.key} className="border-b border-[var(--divider)]">
                <button type="button" aria-expanded={isExpanded} aria-controls={`mobile-nav-panel-${item.key}`} id={`mobile-nav-trigger-${item.key}`}
                  onClick={() => onToggle(item.key)} className={cn("flex w-full items-center justify-between ...")}>
                  <span>{item.label}</span>
                  <ChevronDown className={cn("h-5 w-5 shrink-0 ...", isExpanded && "rotate-180")} />
                </button>
                <div id={`mobile-nav-panel-${item.key}`} role="region" aria-labelledby={`mobile-nav-trigger-${item.key}`} className={cn("overflow-hidden ...", isExpanded ? "visible" : "hidden")}>
                  <ul className="flex flex-col ...">
                    {item.groups!.map((group) => (
                      <li key={group.key}>
                        <span className="block px-4 pt-3 pb-1.5 type-caption font-semibold ...">{group.label}</span>
                        <ul className="flex flex-col">
                          {group.items.map((leaf) => (
                            <li key={leaf.key}>
                              <Link href={leaf.href} onClick={onNavigate} className="block py-2 pl-6 pr-4 ...">{leaf.label}</Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          }
          if (item.href) {
            return (
              <li key={item.key} className="border-b ...">
                <Link href={item.href} onClick={onNavigate} className="...">{item.label}</Link>
              </li>
            );
          }
          return null;
        })}
        <li className="border-b ...">
          <Link href="/about" onClick={onNavigate} className="...">회사소개</Link>
        </li>
      </ul>
    </nav>
  );
}
```

---

## 9. SearchBox — HeaderProductSearch

**파일: src/components/HeaderProductSearch.tsx**

- **클릭 핸들러**: `handleSubmit` → `performSearch(query)`. `handleSelectSuggestion` → `performSearch(value)`. 검색어 지우기 버튼 `onClick` → `setQuery("")` + focus. 포커스/블러로 `setIsFocused`.
- **동작**: `performSearch`에서 `pushRecentSearch(trimmed)`, `setIsFocused(false)`, `router.push(\`/products?q=...\`)`.

```tsx
"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import HeaderSearchDropdown from "@/components/HeaderSearchDropdown";
// ...

export default function HeaderProductSearch({ searchQuery, mode }: HeaderProductSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(searchQuery ?? "");
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recommended, setRecommended] = useState<RecommendedKeyword[]>([]);
  // ...

  function performSearch(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    pushRecentSearch(trimmed);
    setIsFocused(false);
    router.push(`/products?q=${encodeURIComponent(trimmed)}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); performSearch(query); }
  function handleSelectSuggestion(value: string) { performSearch(value); }

  const showDropdown = isFocused;
  // desktop: form with input + HeaderSearchDropdown(open=showDropdown, onSelectKeyword=handleSelectSuggestion)
  // mobile: 동일 구조, lg:hidden
  return mode === "desktop" ? ( <form onSubmit={handleSubmit} ...><input ... onFocus={() => setIsFocused(true)} onBlur={() => setTimeout(() => setIsFocused(false), 120)} ... /><HeaderSearchDropdown open={showDropdown} query={query} recentSearches={recentSearches} recommended={recommended} ... onSelectKeyword={handleSelectSuggestion} /></form> ) : ( <form ...>...</form> );
}
```

---

## 10. HeaderSearchDropdown (검색 제안/최근/추천)

**파일: src/components/HeaderSearchDropdown.tsx**

- **클릭 핸들러**: `handleClickKeyword(event, value)` → `event.preventDefault()` + `onSelectKeyword(value)` (검색 실행 후 드롭다운 닫히도록 상위에서 처리). 최근 검색어/추천 검색어/상품 제안 버튼은 `onMouseDown={(e) => handleClickKeyword(e, keyword)}` 사용(blur 전에 실행).

```tsx
// 타입
type RecommendedKeyword = { id: string; keyword: string; };
type ProductSuggestionItem = { id: string; title: string; category?: string; theme?: string; };
type HeaderSearchDropdownProps = {
  open: boolean;
  query: string;
  recentSearches: string[];
  recommended: RecommendedKeyword[];
  isLoadingRecommended: boolean;
  productSuggestions: ProductSuggestionItem[];
  onSelectKeyword: (value: string) => void;
};

function handleClickKeyword(event: MouseEvent<HTMLButtonElement>, value: string) {
  event.preventDefault();
  onSelectKeyword(value);
}
// 렌더: 최근 검색어 / 추천 검색어 / 검색 제안(상품) 버튼에 onMouseDown={(event) => handleClickKeyword(event, keyword)} 또는 (event, item.title)
```

---

## 11. Products 페이지 (헤더 + taxonomy 사용처)

**파일: src/app/products/page.tsx**

- **역할**: `getProducts()`, `getProductTaxonomyOptions(products)`로 목록·지역/테마 옵션 조회. `SiteHeader`에 `activeTab="products"`, `searchQuery={searchKeyword}` 전달. taxonomy는 헤더 데이터가 아닌 필터용 `categories`/`themes`로 `ProductsPageContent`에 전달.

```tsx
import SiteHeader from "@/components/SiteHeader";
import ProductsHero from "@/components/ProductsHero";
import { ProductsPageContent } from "@/components/products/ProductsPageContent";
import { getProducts } from "@/lib/products";
import { getProductTaxonomyOptions } from "@/lib/productTaxonomies";

type ProductsPageProps = {
  searchParams?: Promise<{ q?: string; tourType?: string; region?: string; theme?: string; sort?: string }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const query = (await searchParams) ?? {};
  const searchKeyword = query.q?.trim() ?? "";
  const tourType = query.tourType?.trim() ?? "";
  const golfPresetActive = tourType === "golf-park";
  const presetCategories = golfPresetActive ? ["골프투어", "파크골프투어"] : undefined;
  const products = await getProducts();
  const { categories, themes } = await getProductTaxonomyOptions(products);

  return (
    <div className="min-h-screen ...">
      <SiteHeader activeTab="products" searchQuery={searchKeyword} golfPresetActive={golfPresetActive} />
      <main className="mx-auto w-full max-w-6xl px-3 py-6 ...">
        <ProductsHero variant={golfPresetActive ? "golf" : "package"} />
        {products.length === 0 ? (
          <section ...>현재 등록된 상품이 없습니다.</section>
        ) : (
          <ProductsPageContent
            products={products}
            regionOptions={categories}
            themeOptions={themes}
            initialKeyword={searchKeyword}
            presetCategories={presetCategories}
            presetLabel={golfPresetActive ? "골프/파크골프" : undefined}
          />
        )}
      </main>
    </div>
  );
}
```

---

## 요약: 클릭 핸들러 위치

| 위치 | 역할 |
|------|------|
| **DesktopMegaMenu** | `setOpenKey`; Escape/외부클릭 → `onClose` |
| **DesktopNavItem** | `onClick`: 토글 open/close; `onMouseEnter`/`onMouseLeave`; `handleKeyDown`(Escape), `handleBlur` |
| **DesktopMegaMenuPanel** | `Link`에 `onClick={onClose}`; 패널 `onMouseLeave={onClose}` |
| **MobileHeaderMenu** | 햄버거/검색 아이콘 `onClick={openDrawer}`; 상담 `onClick` → `handleConsultClick` |
| **MobileHeaderDrawer** | 오버레이 클릭 → `onClose`; 닫기 버튼/링크/로그아웃 시 `onClose` |
| **MobileHeaderAccordion** | 1차 메뉴 버튼 `onClick={() => onToggle(item.key)}`; 링크 `onClick={onNavigate}` |
| **HeaderProductSearch** | `handleSubmit` → `performSearch(query)`; `handleSelectSuggestion` → `performSearch(value)` |
| **HeaderSearchDropdown** | 키워드/제안 버튼 `onMouseDown` → `handleClickKeyword` → `onSelectKeyword(value)` |

---

## 요약: taxonomy item shape

- **HeaderNavLeafItem**: `{ key, label, href }`
- **HeaderNavGroup**: `{ key, label, items: HeaderNavLeafItem[] }`
- **HeaderPrimaryNavItem**: `{ key, label, href?, groups?: HeaderNavGroup[] }`
- **HeaderNavigationData**: `{ primaryNav: HeaderPrimaryNavItem[] }`  
데이터 소스: `getHeaderNavigationData()` (taxonomy + home-curated).

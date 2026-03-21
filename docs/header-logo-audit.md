# 헤더 로고 크기·여백 — 코드 발췌 및 원인 분석 참고

프로젝트 기준 정리. (`Header.tsx` / `Navbar.tsx` 는 없음 → **`SiteHeader.tsx` → `SiteHeaderUI.tsx`** 체인)

**현재:** 헤더·관리자 로고는 **`ThemedWordmarkImage`** — 라이트 `THEALL_WORDMARK_LIGHT_SRC` / 다크 `THEALL_WORDMARK_DARK_SRC` (`html.dark` 시 전환). `globals.css`에 `@custom-variant dark (&:where(.dark, .dark *))` 로 관리자 `SubHeader` 토글과 맞춤. OG·폴백은 `THEALL_WORDMARK_IMAGE_SRC`(라이트). 자산 교체 시 파일명 버전(v5→v6) 권장.

**정식 벡터:** 디자인 납품 SVG(Figma/Illustrator export, 타이트 viewBox)가 확보될 때까지 **PNG 유지**가 원칙. 자동 트레이싱·재해석 금지.

---

## 1. 헤더 컴포넌트 전체 흐름

### 1.1 엔트리: `SiteHeader.tsx` → `SiteHeaderUI`

`src/components/SiteHeader.tsx`:

```tsx
  return (
    <SiteHeaderUI
      headerNavigationData={headerNavigationData}
      activeTab={activeTab}
      searchQuery={searchQuery}
      golfPresetActive={golfPresetActive}
      quickConsultHref={quickConsultHref}
      kakaoConsultHref={kakaoConsultHref}
      session={session ? { name: session.name } : null}
      memberPoints={memberPoints}
    />
  );
```

### 1.2 `<header>` + 데스크톱 로고 래퍼

`src/components/SiteHeaderUI.tsx` (발췌):

```tsx
    <header
      className={cn(
        "sticky z-50 transition-all duration-200 safe-top top-[env(safe-area-inset-top)] lg:z-40",
        scrolled
          ? "border-b border-[var(--divider)] bg-[var(--surface)] shadow-[var(--shadow-soft)] backdrop-blur-sm"
          : "border-b border-[var(--divider)] bg-[var(--surface)]",
      )}
    >
      <PageContainer size="wide" className="hidden flex-col py-0 lg:flex">
        {/* 유틸바 생략 */}

        <div className="header-main-bar--desktop flex items-center gap-x-6 lg:gap-x-7 xl:gap-x-8">
          <Link
            href="/"
            className="header-logo-link shrink-0 rounded-xl transition-colors duration-150 hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-label="더올투어 홈"
          >
            <HeaderBrandLogo variant="desktop" priority />
          </Link>
```

### 1.3 모바일 탑바: 햄버거 / 가운데 로고 / CTA

`src/components/header/MobileHeaderMenu.tsx` (발췌):

```tsx
      <div className="mobile-header-stack lg:hidden">
        <div className="mobile-header-top-bar mx-auto max-w-6xl">
          <button
            type="button"
            aria-label="메뉴 열기"
            onClick={openDrawerWithTrack}
            className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--foreground)] transition-colors active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
          >
            {/* 햄버거 아이콘 */}
          </button>

          <Link
            href="/"
            className="absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-label="더올투어 홈"
          >
            <HeaderBrandLogo variant="touch" className="mobile-header-top-logo" />
          </Link>
```

### 1.4 바깥 패딩: `PageContainer`

`src/components/layout/PageContainer.tsx`:

```tsx
    <div
      className={cn(
        "mx-auto w-full",
        "px-4 sm:px-6 lg:px-8 xl:px-10",
        SIZE_CLASS[size],
        className
      )}
    >
```

---

## 2. 로고 컴포넌트 / import

별도 `Logo.tsx` 없음. **`HeaderBrandLogo`** → **`ThemedWordmarkImage`** (라이트/다크 `next/image` 2장, `dark:hidden` / `hidden dark:block`).

- **상수:** `THEALL_WORDMARK_INTRINSIC_LIGHT` (1024×184), `THEALL_WORDMARK_INTRINSIC_DARK` (1024×189), `HEADER_LOGO_SRC` = 라이트 경로(레거시).
- **관리자:** `Sidebar`, `admin/login` 도 동일 `ThemedWordmarkImage`.

```tsx
// ThemedWordmarkImage: LIGHT + DARK 두 Image
```

---

## 3. 로고 원본 파일

| 항목 | 내용 |
|------|------|
| 헤더 | **`thealltour-wordmark-light-v5.png`** (흰 배경, 1024×184), **`thealltour-wordmark-dark-v6.png`** (납품 다크, 1024×189). `thealltour-logo.png` 는 라이트 동기화 복사본 |
| 임의 SVG | **`public/thealltour-logo.svg`** — 과거 적용분 삭제됨. 재도입 시 **납품 벡터만** 사용 |
| 정식 path SVG | **미수령 시 PNG 유지** — 전환 조건: Figma/AI export, 타이트 viewBox, 트레이싱 금지 |
| PNG 내부 여백 | CSS 토큰·`max-width`로 표시 크기만 조정; **픽셀 그래픽은 교체하지 않음** |

---

## 4. 로고 관련 스타일 (`globals.css` 발췌)

### 4.1 `:root` 토큰

```css
  --header-main-height-desktop: 64px;
  --header-logo-height-mobile: 28px;
  --header-logo-height-tablet: 32px;
  --header-logo-height-desktop: 40px;
  --header-logo-max-height: 44px;
  --header-logo-wrapper-padding-left: 0px;

  --mobile-header-top-height: 56px;
  --mobile-header-search-row-height: 56px;
  --mobile-header-search-bg: #f7f9fb;
  --mobile-header-text-strong: #1a1a1a;
```

### 4.2 클래스 (width/height/max/object/padding)

```css
.header-main-bar--desktop {
  height: var(--header-main-height-desktop);
  min-height: var(--header-main-height-desktop);
}

.header-logo-link {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0;
  padding-left: var(--header-logo-wrapper-padding-left);
  max-width: 100%;
}

.header-logo-link--touch-center {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-width: 0;
  flex: 1 1 0%;
  padding-left: 0;
  padding-right: 0;
}

.header-brand-logo-img {
  display: block;
  width: auto !important;
  max-height: var(--header-logo-max-height) !important;
  flex-shrink: 0;
  object-fit: contain;
  object-position: center;
  overflow: visible;
}
.header-brand-logo-img--touch {
  height: var(--header-logo-height-mobile) !important;
  max-width: min(260px, 72vw);
}
@media (min-width: 768px) {
  .header-brand-logo-img--touch {
    height: var(--header-logo-height-tablet) !important;
  }
}
.header-brand-logo-img--desktop {
  height: var(--header-logo-height-desktop) !important;
  max-width: min(340px, 36vw);
}
@media (min-width: 1280px) {
  .header-brand-logo-img--desktop {
    max-width: min(360px, 30vw);
  }
}

.mobile-header-top-bar {
  position: relative;
  display: flex;
  height: var(--mobile-header-top-height);
  min-height: var(--mobile-header-top-height);
  align-items: center;
  justify-content: space-between;
  padding-left: 12px;
  padding-right: 12px;
}
@media (min-width: 768px) {
  .mobile-header-top-bar {
    padding-left: 16px;
    padding-right: 16px;
  }
}

/* 모바일 탑바 중앙 로고: 축소 완화 */
.header-brand-logo-img--touch.mobile-header-top-logo {
  height: 28px !important;
  max-height: 28px !important;
  max-width: min(180px, 52vw);
}
```

**다크 모드:** `.dark` 에서 `--mobile-header-search-bg: #111827` 등 (동일 파일 내 `.dark` 블록 참고)

---

## 5. 크기·여백·품질 체크리스트 (PNG + CSS 1차 개선 유지)

1. **승인 자산 일치**  
   헤더에 보이는 그래픽은 **PNG 파일 그대로**여야 함 — 임의 폰트·벡터 재구성 없음.

2. **모바일 탑바 예외**  
   `.mobile-header-top-logo` → **28px / max-width min(180px, 52vw)** (햄버거·CTA 간섭 방지).

3. **데스크톱 바깥 여백**  
   `PageContainer` 가로 패딩 + 로고 링크 패딩 **0**.

4. **데스크톱 max-width**  
   `min(340px, 36vw)` / xl `min(360px, 30vw)` — 네비와 충돌 시만 소폭 조정.

5. **토큰**  
   `--header-logo-height-*`, `--header-logo-max-height`, 좌패딩 0 등 **fix(header) 개선분 유지**.

6. **접근성**  
   `Image`의 `alt` + 부모 `Link` `aria-label` 병행.

---

## 6. 기타 참조 경로

| 용도 | 경로 |
|------|------|
| 파비콘·앱 아이콘 | `src/app/layout.tsx` → `THEALL_FAVICON_*` / `THEALL_APPLE_TOUCH_ICON_SRC` (`public/favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`) |
| 관리자 사이드바 | `src/components/admin/Sidebar.tsx` |
| 코드 내 브랜드 마크 (비헤더) | `src/brand/logo/LogoFull.tsx` |

---

*문서 생성: 헤더 로고 구조·스타일 감사용. 코드 변경 시 이 문서도 함께 갱신 권장.*

---

## 변경 이력

| 날짜 | 요약 |
|------|------|
| fix(header) | `globals.css` 로고 토큰 상향, 데스크톱 좌패딩 0, `max-width`/모바일 탑바 로고 완화, `object-position: center` |
| refactor(header) | 헤더 워드마크 PNG→인라인 SVG + `thealltour-logo.svg` 시도 → **폐기** |
| fix(header) | 임의 SVG·타이포 롤백, **`thealltour-logo.png` + next/image 복구**, `thealltour-logo.svg` 삭제. CSS 1차 개선은 유지 |
| brand | 승인 워드마크 PNG 교체(1024×176), 헤더·관리자 `Image` 비율 정합 |
| fix | `brandAssets` + 버전 파일명으로 `next/image` 캐시 회피 |
| brand | 라이트/다크 워드마크 v5(1024×184), `ThemedWordmarkImage`, `html.dark`용 `@custom-variant dark` |

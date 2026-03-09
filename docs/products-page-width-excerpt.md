# /products 페이지 width 관련 코드 발췌

## 1. 페이지 루트 (`src/app/products/page.tsx`)

```tsx
return (
  <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] text-[var(--text-primary)]">
    <SiteHeader ... />

    <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
      <PageContainer size="wide" className="flex flex-col gap-8">
        <ProductsHero ... />
        ...
        <ProductsPageContent ... />
      </PageContainer>
    </main>
  </div>
);
```

- **main**: `flex w-full flex-col` — 세로 플렉스, 가로 100%.
- **PageContainer**: `size="wide"` — 최대 가로 폭 1600px + 좌우 패딩(아래 참고).

---

## 2. PageContainer (`src/components/layout/PageContainer.tsx`)

```tsx
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

- **가로 폭**: `size="wide"` → `max-w-[1600px]`.
- **정렬**: `mx-auto w-full` → 중앙 정렬, 컨테이너 안에서 100%.
- **좌우 패딩**: `px-4 sm:px-6 lg:px-8 xl:px-10` (16px → 24px → 32px → 40px).

---

## 3. 메인 영역 레이아웃 (`src/components/products/ProductsPageContent.tsx`)

```tsx
return (
  <div className="flex gap-8 items-start">
    <ProductFilterSidebar ... />
    <div className="min-w-0 flex-1 space-y-4">
      {/* 필터 칩, 상품 목록 등 */}
    </div>
    ...
  </div>
);
```

- **전체**: `flex gap-8` — 좌측 사이드바(288px) + 간격 32px + 우측 콘텐츠.
- **우측 콘텐츠**: `min-w-0 flex-1` — 남은 가로 공간 전부 사용, 플렉스 줄바꿈 방지.

---

## 4. 필터 사이드바 폭 (`src/components/products/ProductFilterSidebar.tsx`)

```tsx
<aside
  className={cn("hidden w-72 shrink-0 lg:block", className)}
  aria-label="상품 필터"
>
```

- **폭**: `w-72` = 288px (18rem).
- **고정**: `shrink-0` — 플렉스에서 줄어들지 않음.
- **표시**: `hidden lg:block` — lg 미만에서는 숨김.

---

## 요약

| 구분 | 값 |
|------|-----|
| 페이지 컨테이너 최대 폭 | `max-w-[1600px]` (PageContainer `size="wide"`) |
| 좌우 패딩 | `px-4 sm:px-6 lg:px-8 xl:px-10` |
| 좌측 필터 폭 | `w-72` (288px), `shrink-0` |
| 메인 영역 간격 | `gap-8` (32px) |
| 메인 콘텐츠 | `min-w-0 flex-1` (남은 폭 전부) |

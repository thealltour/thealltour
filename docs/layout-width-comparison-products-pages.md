# 상품 등록(모두) vs 상품 등록 페이지 레이아웃 폭 비교 발췌

## 1) 상품 등록(모두) 페이지 컴포넌트 파일 전체 경로

- **페이지(route):** `src/app/theall_manager_only/products/new-modetour/page.tsx`
- **실제 컴포넌트:** `src/components/admin/modetour/ModetourNewProductPage.tsx`

---

## 2) 상품 등록 페이지 컴포넌트 파일 전체 경로

- **페이지(route):** `src/app/theall_manager_only/products/page.tsx` (→ `src/app/admin/products/page.tsx` re-export)
- **실제 페이지 컴포넌트:** `src/app/admin/products/page.tsx` (AdminProductsPage)
- **폼/에디터 컴포넌트:** `src/components/AdminProductManager.tsx` (view=create 시 상품 등록 UI)

---

## 3) 각 파일 return JSX — 최상위 wrapper ~ 첫 번째 주요 섹션 (120줄 내외)

### 3-1) 상품 등록(모두) — ModetourNewProductPage.tsx

```tsx
// src/components/admin/modetour/ModetourNewProductPage.tsx
// return 시작: 753행 근처

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <h1 className="text-xl font-semibold text-slate-100">상품 등록(모두)</h1>
      <p className="mt-2 text-sm text-slate-300">
        모두투어 상품 페이지에서 추출한 JSON을 붙여넣어 등록합니다.
      </p>
      <p className="mt-1 text-xs text-slate-400">
        일정·이미지·기본 정보만 자동 반영됩니다. 설명/포함·불포함/예약·환불 규정은 편집에서 직접 입력해 주세요.
      </p>

      <div className="mt-6">
        <textarea
          className="h-48 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 placeholder:text-slate-500"
          ...
        />
        ...
      </div>
      ...
      {previewProduct && (
        <div className="mt-8 rounded-lg border border-slate-700 bg-slate-900/50 p-5">
          ...
          <div className="relative aspect-[21/9] w-full max-w-2xl overflow-hidden rounded-lg bg-slate-800">
```

**포함된 width 관련 class**
- 최상위: `mx-auto` `w-full` `max-w-6xl` `px-6` `py-8`
- textarea: `w-full`
- 미리보기 이미지 래퍼: `w-full` `max-w-2xl`

---

### 3-2) 상품 등록 — admin/products/page.tsx (AdminProductsPage)

```tsx
// src/app/admin/products/page.tsx

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="w-full space-y-6">
        <section className="rounded-2xl bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] md:p-5 overflow-visible">
          <Suspense ...>
            <AdminToastProvider>
              <AdminConfirmProvider>
                <AdminProductManager />
              </AdminConfirmProvider>
            </AdminToastProvider>
          </Suspense>
        </section>
      </main>
    </div>
  );
```

**포함된 width 관련 class**
- 최상위: `min-h-screen` `px-6` `py-10` `md:px-10` (max-w 없음)
- main: `w-full` `space-y-6`
- section: 폭 제한 없음 (max-w/container 없음)

---

### 3-3) 상품 등록 — AdminProductManager.tsx (return ~ 첫 섹션 120줄)

```tsx
// src/components/AdminProductManager.tsx
// return 시작: 1135행 근처 (view=create 또는 editingId 있을 때)

  return (
    <div className="space-y-6">
      ...
      {(isCreateView || editingId) && !isFeaturedView ? (
        <AdminProductEditorView>
        <>
        <div className="flex items-start gap-4 lg:gap-6">
        {/* 좌측: 섹션 네비 + 액션 바 */}
        <aside
          className="sticky top-24 z-10 flex max-h-[calc(100vh-6rem)] w-[260px] shrink-0 flex-col gap-4 self-start overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm max-md:hidden"
          ...
        >
          ...
        </aside>
        {/* 오른쪽: 입력 아코디언 + 미리보기 */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-6">
          <main className="min-w-0">
        <form
          className="space-y-4 rounded-xl bg-[var(--surface-muted)] p-4 ring-1 ring-[var(--border)]"
          ...
        >
        ...
        <div className="space-y-2">
          {SECTIONS.map((section) => {
            ...
            return (
            <div
              key={id}
              id={`form-section-${id}`}
              className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] ring-1 ring-[var(--border)]"
            >
```

**포함된 width 관련 class**
- 최상위: `space-y-6` (width 제한 없음)
- flex 컨테이너: `flex` `items-start` `gap-4` `lg:gap-6`
- aside: `w-[260px]` `shrink-0`
- 오른쪽 영역: `flex` `min-w-0` `flex-1` `flex-col` `gap-4` `lg:gap-6`
- main: `min-w-0`
- form: `space-y-4` `rounded-xl` `p-4` `ring-1` (max-w 없음)
- 섹션 카드: `overflow-hidden` `rounded-lg` `border` … (grid-cols/col-span 없음, 상단 기준)

---

## 4) 공통 상위 layout — wrapper class

두 페이지 모두 **같은 layout** 사용:

- **파일:** `src/app/theall_manager_only/layout.tsx`  
  → `AdminLayout`만 사용 (admin/products 전용 layout은 없음).

**AdminLayout** (`src/components/admin/AdminLayout.tsx`) wrapper 부분:

```tsx
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] transition-colors">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
      <main className="ml-64 transition-colors">
        ...
        <div className="w-full px-6 pt-4 md:px-10">
          <div className="mx-auto max-w-[1280px]">
            <Breadcrumb />
          </div>
        </div>
        <SubHeader activeMenu={activeMenu} onTabChange={setActiveSubTab} />

        <div className="w-full px-6 py-10 md:px-10">
          <div className="max-w-full">
            <AnimatedSection ...>
              {children}
            </AnimatedSection>
          </div>
        </div>
      </main>
    </div>
  );
```

**포함된 width 관련 class**
- 최상위: `min-h-screen` (폭 제한 없음)
- main: `ml-64` (사이드바 폭)
- Breadcrumb 영역: `w-full` `px-6` `md:px-10` / 내부 `mx-auto` **max-w-[1280px]**
- **본문(children) 래퍼:** `w-full` `px-6` `py-10` `md:px-10` / 내부 **max-w-full** → 실제 컨텐츠 폭 제한은 각 페이지에서만 발생.

---

## 5) 관련 공통 컴포넌트 — className 정의

### AdminProductEditorView

- **파일:** `src/components/admin/products/AdminProductEditorView.tsx`
- **역할:** 상품 등록/편집 뷰 컨테이너. 현재는 wrapper 없이 `<>...</>`만 사용.

```tsx
export default function AdminProductEditorView({ children }: AdminProductEditorViewProps) {
  return <>{children}</>;
}
```

- **className:** 없음 (Fragment만 사용).

### AdminProductsPage의 section

- **파일:** `src/app/admin/products/page.tsx`
- **역할:** 상품 목록/등록/카테고리/메인추천 공통 wrapper.
- **className:**  
  `rounded-2xl bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] md:p-5 overflow-visible`  
  → **max-w, container, grid-cols, col-span, col-start, w-full, min-w-0 없음.**

---

## 요약 비교

| 구분 | 상품 등록(모두) | 상품 등록 |
|------|------------------|-----------|
| **페이지 최상위** | `mx-auto w-full max-w-6xl px-6 py-8` | `min-h-screen ... px-6 py-10 md:px-10` + `main.w-full` + `section`(폭 제한 없음) |
| **폭 제한** | **max-w-6xl** (72rem ≈ 1152px) | 없음 (layout의 **max-w-full** 안에서 전폭 사용) |
| **공통 layout** | AdminLayout → `div.max-w-full` | 동일 |
| **Card/Section** | 페이지 내부에서 직접 `div`로 섹션 구성 | AdminProductsPage의 `section` + AdminProductManager 내부 `div`/form |

**차이:**  
상품 등록(모두)만 **max-w-6xl**로 폭이 제한되어 있고, 상품 등록(목록/등록/카테고리/메인추천)은 layout의 **max-w-full**만 적용되어 더 넓게 쓴다.

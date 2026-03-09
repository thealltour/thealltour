# 유저 페이지 좌우 폭 통일 작업 요약

기준: `/products` — `main` spacing, `PageContainer size="wide"`, 2열 시 `flex gap-8 lg:flex-row lg:items-start`, 좌측 `w-72 shrink-0`, 우측 `min-w-0 flex-1`.  
제거 대상: `-mx-*`, `w-[calc(100%+...)]`, 좌/우 보정용 `pl-*`/`pr-*`.

---

## 1. 수정된 파일 목록

| 파일 | 비고 |
|------|------|
| `src/app/destinations/page.tsx` | 1차 대상 |
| `src/app/themes/page.tsx` | 동일 패턴 |
| `src/app/recommended/page.tsx` | 동일 패턴 |
| `src/app/destinations/[slug]/page.tsx` | 랜딩 2열 |
| `src/app/themes/[slug]/page.tsx` | 랜딩 2열 |
| `src/app/page.tsx` | main spacing만 통일 |

---

## 2. 파일별 수정 이유

- **destinations/page.tsx**  
  PageContainer 패딩을 상쇄하는 `-mx-*`·`w-[calc(100%+*)]`와 좌측 `pl-*`·우측 `pr-*`로 폭을 다시 잡고 있어 `/products`와 체감 폭이 달랐음. 이를 제거하고 `/products`와 동일한 2열 기준 구조로 통일.

- **themes/page.tsx**  
  destinations와 동일한 콘텐츠 래퍼 패턴 사용 → 동일하게 제거 후 기준 레이아웃 적용.

- **recommended/page.tsx**  
  동일한 `-mx-*`·`calc`·`pl-*`/`pr-*` 패턴 사용 → 제거 후 2열 기준 적용(좌측은 `HubFilterSidebar`만, `w-72 shrink-0`).

- **destinations/[slug]/page.tsx**, **themes/[slug]/page.tsx**  
  같은 패턴 + `main`이 `py-0`으로만 되어 있음 → 패딩 상쇄 제거하고 `main`을 `/products`와 동일한 `py-6 sm:py-10 md:py-14`로 통일.

- **page.tsx (홈)**  
  `main`이 `py-8 md:py-10`으로만 되어 있어 `/products`의 `py-6 sm:py-10 md:py-14`와 불일치 → main spacing만 통일.

---

## 3. 레이아웃 변경 전 / 후

### 3.1 콘텐츠 래퍼 (2열 영역)

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 래퍼 div | `-mx-4 ... xl:w-[calc(100%+5rem)]` + `flex-col gap-8 lg:flex-row lg:items-start` | `flex flex-col gap-8 lg:flex-row lg:items-start` |
| 좌측 영역 | `flex shrink-0 flex-col gap-6 pl-4 sm:pl-6 lg:pl-8 xl:pl-10` | `hidden w-72 shrink-0 lg:flex lg:flex-col lg:gap-6` (destinations/themes) 또는 `hidden w-72 shrink-0 lg:block` (recommended, [slug]) |
| 우측 영역 | `min-w-0 flex-1 pr-4 sm:pr-6 lg:pr-8 xl:pr-10` | `min-w-0 flex-1` |

### 3.2 main / PageContainer

| 페이지 | 변경 전 main | 변경 후 main | 변경 전 PageContainer | 변경 후 PageContainer |
|--------|----------------|--------------|------------------------|------------------------|
| destinations | `page-content flex w-full flex-col py-8 md:py-12` | `flex w-full flex-col py-6 sm:py-10 md:py-14` | `gap-16 md:gap-20` | `gap-8` |
| themes | 동일 | 동일 | 동일 | `gap-8` |
| recommended | 동일 | 동일 | 동일 | `gap-8` |
| destinations/[slug] | `page-content ... py-0 md:py-0` | `flex w-full flex-col py-6 sm:py-10 md:py-14` | `gap-12 md:gap-16` | `gap-8` |
| themes/[slug] | 동일 | 동일 | 동일 | `gap-8` |
| home | `page-content ... py-8 md:py-10` | `flex w-full flex-col py-6 sm:py-10 md:py-14` | (유지) | (유지) |

---

## 4. `/products`와 동일 폭 기준 적용 여부

- **적용됨.**  
  - 모든 수정 페이지가 `PageContainer size="wide"`(max-width 1600px + 동일 px 패딩) 안에서만 레이아웃을 구성.  
  - 2열 구간은 `flex flex-col gap-8 lg:flex-row lg:items-start` + 좌측 `w-72 shrink-0` + 우측 `min-w-0 flex-1`로 `/products`와 동일.  
  - `-mx-*`, `w-[calc(100%+*)]`, `pl-*`/`pr-*` 보정 제거로 콘텐츠 시작선과 최대 폭이 `/products`와 같아짐.

---

## 5. 변경 코드 요약 (diff 형태)

### destinations/page.tsx

```diff
-      <main className="page-content flex w-full flex-col py-8 md:py-12">
-        <PageContainer size="wide" className="flex flex-col gap-16 md:gap-20">
+      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
+        <PageContainer size="wide" className="flex flex-col gap-8">
           <LandingHero {...getHubHeroConfig("destinations")} className="mb-12" />

           {hasDestinations ? (
-            <div className="-mx-4 flex w-[calc(100%+2rem)] flex-col gap-8 sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-8 lg:w-[calc(100%+4rem)] lg:flex-row lg:items-start xl:-mx-10 xl:w-[calc(100%+5rem)]">
-              <div className="flex shrink-0 flex-col gap-6 pl-4 sm:pl-6 lg:pl-8 xl:pl-10">
+            <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
+              <div className="hidden w-72 shrink-0 lg:flex lg:flex-col lg:gap-6">
                 <HubFilterSidebar ... />
                 <StickySectionNav variant="desktop" ... />
               </div>
-              <div className="min-w-0 flex-1 pr-4 sm:pr-6 lg:pr-8 xl:pr-10">
+              <div className="min-w-0 flex-1">
```

### themes/page.tsx

동일한 패턴으로 래퍼·좌측·우측·main·PageContainer 수정.

### recommended/page.tsx

동일하게 래퍼/좌/우 보정 제거. 좌측은 StickySectionNav 없이 `hidden w-72 shrink-0 lg:block` + HubFilterSidebar만.

### destinations/[slug]/page.tsx, themes/[slug]/page.tsx

- main: `py-0` → `py-6 sm:py-10 md:py-14`  
- 래퍼: `-mx-*`·`calc` 제거 → `flex flex-col gap-8 lg:flex-row lg:items-start`  
- 좌: `pl-*` 제거 → `hidden w-72 shrink-0 lg:block`  
- 우: `pr-*` 제거 → `min-w-0 flex-1`  
- PageContainer: `gap-12 md:gap-16` → `gap-8`

### page.tsx (홈)

```diff
-      <main className="page-content flex w-full flex-col py-8 md:py-10">
+      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
```

---

## 6. 미수정 유저 페이지 (참고)

- **blog, guides, support, about, quote, reviews 등**  
  `SectionBody` + `max-w-6xl` / `max-w-4xl` 사용. 문서형·폼형 페이지라 별도로 “reading” 폭을 유지할지, 전부 `PageContainer size="wide"`로 넓힐지는 요구에 따라 추가 통일 가능.
- **admin, theall_manager_only, dev**  
  관리자/개발용으로 제외.

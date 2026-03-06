# 관리자 대시보드 — 발췌 (전체 복사용)

목표: 운영 현황 대시보드에 헤더/메가메뉴/검색/CTA 클릭 데이터를 설계·연결하기, KPI/기간 필터 구조를 기준으로 PR을 잘게 쪼개기, 상품관리 > 카테고리/테마 관리 탭과의 데이터 흐름 파악.

---

## 1. 관리자 대시보드 페이지 진입점

### 1.1 대시보드 페이지 (실제 경로: src/app/admin/page.tsx)

- **탭 구조**: 별도 “운영 현황 / 통계” 탭 없음. 단일 대시보드 뷰 하나만 존재. SubHeader의 menuMap에는 dashboard: ["운영 현황", "통계"]가 정의되어 있으나, 대시보드 페이지는 탭 전환 없이 KPI 섹션 + Quick actions + Resource overview를 한 화면에 렌더.
- **데이터 로드**: 서버에서 `getAdminCounts()`, `prepareAdminNotificationsAndGetUnreadCount()` 병렬 호출 → counts(inquiryCount, productCount, memberCount, reviewCount)와 unreadNotificationCount를 AdminHeader에 전달. KPI 상세(문의 집계·증감률)는 **클라이언트**에서 `AdminDashboardKpiSection`이 `/api/admin/dashboard`를 호출해 가져옴.
- **기간 선택**: `AdminDashboardKpiSection` 내부에서 URL searchParams(`range`, `from`, `to`)로 관리. `range`: "today" | "7d" | "30d" | "custom". custom일 때 `from`/`to`(date input). **현재 API는 range/from/to를 받지만 getAdminCounts()에는 아직 전달하지 않음** — 확장 여지만 있음.
- **Suspense**: page에서 `<Suspense fallback={...}><AdminDashboardKpiSection /></Suspense>`. fallback은 4개 플레이스홀더 카드 그리드.
- **구성**: AdminHeader(제목/설명) → AdminQueryProvider → Suspense → AdminDashboardKpiSection(기간 필터 + KPI 카드 + 문의 상태 분포 차트) → Quick actions(Link 목록) + Resource overview(문구만).

```tsx
// src/app/admin/page.tsx
import { Suspense } from "react";
import AdminDashboardKpiSection from "@/components/admin/AdminDashboardKpiSection";
import AdminHeader from "@/components/AdminHeader";
import { getAdminCounts } from "@/lib/adminCounts";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import Link from "next/link";
import { Bell, MessageSquare, PackageSearch, Users } from "lucide-react";
import AdminQueryProvider from "@/components/admin/AdminQueryProvider";

export default async function AdminPage() {
  const [counts, unreadNotificationCount] = await Promise.all([
    getAdminCounts(),
    prepareAdminNotificationsAndGetUnreadCount(),
  ]);
  const { inquiryCount, productCount, memberCount, reviewCount } = counts;

  const quickActions = [
    { key: "inquiries", icon: MessageSquare, href: "/theall_manager_only/inquiries", label: "Inquiries", description: "View and update inquiry status." },
    { key: "notifications", icon: Bell, href: "/theall_manager_only/notifications", label: "Notifications", description: "Check admin notifications." },
    { key: "products", icon: PackageSearch, href: "/theall_manager_only/products", label: "Products", description: "Browse and edit products." },
    { key: "members", icon: Users, href: "/theall_manager_only/members", label: "Members", description: "Review registered members." },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 ...">
      <main className="w-full space-y-6">
        <AdminHeader activeTab="dashboard" title="Admin dashboard" description="..." inquiryCount={...} ... />
        <AdminQueryProvider>
          <Suspense fallback={<section className="...">{/* 4 placeholder cards */}</section>}>
            <AdminDashboardKpiSection />
          </Suspense>
        </AdminQueryProvider>
        <section className="...">
          <article><h2>Quick actions</h2><ul>{quickActions.map(...)}</ul></article>
          <article><h2>Resource overview</h2><p>Products {productCount} / Members {memberCount} / Reviews {reviewCount}</p>...</article>
        </section>
      </main>
    </div>
  );
}
```

---

## 2. KPI 카드 컴포넌트

### 2.1 KpiCard (재export: AdminStatCard)

**파일: src/components/admin/KpiCard.tsx** → `export { default } from "@/components/admin/ui/AdminStatCard";`

### 2.2 AdminStatCard (실제 구현)

**파일: src/components/admin/ui/AdminStatCard.tsx**

- **Props**: title, value(number | string), changePercent?, changeDirection? ("up" | "down"), href?(있으면 카드 전체가 Link).
- **제목/값/증감률**: 제목은 text-secondary, 값은 text-2xl bold. changePercent 있으면 "▲/▼ +n%" 형태, down이면 danger, up이면 success.
- **재사용**: AdminCard(variant="glass")를 감싼 공용 스탯 카드. 대시보드 전용이지만 다른 KPI에도 그대로 사용 가능.
- **포맷**: `formatChange(changePercent)` → "+n.n%" / "-n.n%". value는 그대로 표시(호출 측에서 포맷).
- **skeleton**: AdminStatCard 자체에는 없음. AdminDashboardKpiSection에서 loading 시 4개 플레이스홀더 div로 대체.

```tsx
// AdminStatCard props
type AdminStatCardProps = {
  title: string;
  value: number | string;
  changePercent?: number | null;
  changeDirection?: "up" | "down";
  href?: string;
};

function formatChange(changePercent?: number | null) {
  if (typeof changePercent !== "number") return null;
  const sign = changePercent > 0 ? "+" : "";
  return `${sign}${changePercent.toFixed(1)}%`;
}
// body: AdminCard variant="glass" > title, value, (changePercent + changeDirection 시 ▲/▼ + formatChange)
// href 있으면 Link로 감싸서 반환
```

### 2.3 카드 배열을 만드는 부분 (AdminDashboardKpiSection)

- 4장: 전체 문의 수, 미처리 문의 수, 완료된 문의 수, 24시간 이상 지연. 각각 `counts.totalInquiries`, `pendingInquiries`, `completedInquiries`, `delayedInquiries`와 대응 delta 퍼센트. `toDirection(percent)`로 "up"|"down" 전달. href는 `/theall_manager_only/inquiries` 또는 `?status=pending|completed|delayed`.

---

## 3. 차트 / 분포 위젯 / 패널

### 3.1 문의 상태 분포 차트

- **위치**: AdminDashboardKpiSection 내부, 우측 컬럼 한 개. Recharts 미사용. **순수 SVG** (viewBox="0 0 100 40").
- **데이터**: counts.completedInquiries, pendingInquiries, delayedInquiries 3점. max 기준으로 y 스케일(0~25), x는 인덱스 비례. area path + line path + circle 포인트. 색상: chart-3(완료), chart-1(미처리), chart-5(지연).
- **빈 데이터**: points가 있으면 그대로 그림. 하단 레전드 "완료 n / 미처리 n / 지연 n".
- **차트 카드 wrapper**: `<section className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-4 ...">` + 제목 "문의 상태 분포" + "오늘 기준" 문구.

### 3.2 Resource overview

- **위치**: admin page 본문 하단, Quick actions와 같은 row. `<article><h2>Resource overview</h2><p>Products {productCount} / Members {memberCount} / Reviews {reviewCount}</p><p>Keeping a clear priority...</p></article>`. 별도 컴포넌트 없음, 인라인 마크업.

### 3.3 Quick actions

- **위치**: 동일 section. quickActions 배열을 map해서 Link 리스트. 아이콘 + label + description. 별도 “Quick actions” 컴포넌트 없음.

### 3.4 공통 wrapper

- **AdminCard**: variant default | muted | glass. KPI는 glass.
- **AdminPanel**: AdminCard variant=muted|default 래퍼.
- **AdminSection**: title, description, headerRight, children. 섹션 제목/설명용.

---

## 4. 기간 필터 / 검색 / 상단 컨트롤

### 4.1 기간 필터 (AdminDashboardKpiSection)

- **상태**: URL searchParams. `range`(today|7d|30d), `from`, `to`. `updateRange(range, from?, to?)`에서 router.replace로 쿼리 갱신. custom일 때만 from/to 설정.
- **UI**: "기간 선택:" + 버튼 3개(오늘, 최근 7일, 최근 30일) + date input 2개(from ~ to). date input 변경 시 `updateRange("custom", from, to)` 호출.
- **연결**: useQuery의 queryKey에 `{ range, from, to }` 포함. queryFn에서 `/api/admin/dashboard?range=...&from=...&to=...` 호출. **현재 API는 이 파라미터를 받지만 getAdminCounts()에는 넘기지 않음** — 집계는 전역·오늘/어제 기준만 사용. 따라서 **analytics 집계에 기간 필터를 재사용하려면 API와 getAdminCounts(또는 별도 getInquiryMetrics)에서 range/from/to를 사용하도록 수정 필요**.

### 4.2 날짜 파싱/정규화 유틸

- **adminCounts.ts**: `startOfToday`, `startOfYesterday`, `startOfTomorrow`, `delayedThresholdIso` 등 Date 객체로 직접 계산. 별도 date range 유틸 파일 없음. **재사용 가능한 parseDateRange(range, from, to) 같은 함수는 없음**.

### 4.3 Admin 상단 검색 (SubHeader)

- **파일**: src/components/admin/SubHeader.tsx. 오른쪽에 `globalSearch` state + input. placeholder "Admin search...". `onChange`에서 setGlobalSearch만 하고 **TODO: wire up admin global search API** 주석 있음. 즉 **현재는 UI만 있고 실제 검색/필터 동작 없음**.

---

## 5. 대시보드 데이터 로더 / 집계 함수

### 5.1 getAdminCounts (lib)

**파일: src/lib/adminCounts.ts**

- **역할**: products/inquiries/members/reviews 전역 count + 문의 집계(전체/미처리/완료/24h 지연) + 오늘/어제 대비 증감률.
- **집계 위치**: lib에서 Supabase 직접 호출. page나 API에서 호출 가능(현재는 page에서 서버로 한 번, API에서 클라이언트 요청 시 한 번).
- **Supabase 쿼리**: select id, count exact, head: true. inquiries는 is_completed, created_at, lt(created_at, delayedThresholdIso) 등으로 필터. **날짜 범위**: 오늘/어제만 고정 구간 사용. range/from/to 미사용.
- **리턴 타입**: productCount, inquiryCount(pending 수), memberCount, reviewCount, totalInquiries, pendingInquiries, completedInquiries, delayedInquiries, completionRate, totalInquiriesDeltaPercent, pendingInquiriesDeltaPercent, completedInquiriesDeltaPercent, delayedInquiriesDeltaPercent.
- **캐시**: unstable_cache 60초, tags: ["admin-counts"].

```ts
// 반환 shape (사실상 AdminCounts 타입)
{
  productCount, inquiryCount, memberCount, reviewCount,
  totalInquiries, pendingInquiries, completedInquiries, delayedInquiries,
  completionRate,
  totalInquiriesDeltaPercent, pendingInquiriesDeltaPercent,
  completedInquiriesDeltaPercent, delayedInquiriesDeltaPercent,
}
```

### 5.2 API GET /api/admin/dashboard

**파일: src/app/api/admin/dashboard/route.ts**

- **동작**: searchParams에서 range, from, to 읽지만 **getAdminCounts()에는 넘기지 않음**. getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount() 호출 후 `{ counts, unreadNotificationCount }` JSON 반환.
- **향후**: range/from/to를 getAdminCounts 또는 getInquiryMetrics에 전달해 기간 필터 집계 가능.

### 5.3 타입 (AdminDashboardKpiSection 내부)

```ts
type AdminCounts = {
  inquiryCount: number;
  productCount: number;
  memberCount: number;
  reviewCount: number;
  totalInquiries: number;
  pendingInquiries: number;
  completedInquiries: number;
  delayedInquiries: number;
  completionRate: number;
  totalInquiriesDeltaPercent?: number | null;
  pendingInquiriesDeltaPercent?: number | null;
  completedInquiriesDeltaPercent?: number | null;
  delayedInquiriesDeltaPercent?: number | null;
};

type DashboardResponse = {
  counts: AdminCounts;
  unreadNotificationCount: number;
};
```

- **위치**: AdminDashboardKpiSection.tsx 상단. 별도 types 파일 없음. **확장 시**: 새 KPI 필드를 AdminCounts에 추가하고 API/lib에서 반환하면 됨. 문의 전용이 아닌 “운영 KPI”를 같은 카드 시스템으로 표현 가능(AdminStatCard가 title/value/change/href만 받으므로).

---

## 6. 관리자 대시보드 타입 정리

- **dashboard stats**: AdminCounts(위). chart item은 별도 타입 없이 counts 필드 그대로 사용.
- **quick action**: page.tsx에서 `{ key, icon, href, label, description }` 인라인 배열. 타입 없음.
- **resource overview**: 문자열만. 타입 없음.
- **차트**: completedInquiries, pendingInquiries, delayedInquiries 숫자 3개만 사용.
- **정리**: 타입이 파일로 분리되어 있지 않고, 문의 KPI에 맞춰져 있으나 value가 number|string, href/changePercent가 선택이므로 **새 analytics KPI를 끼우기 쉬운 shape**임. AdminCounts를 확장하거나 별도 AdminAnalyticsCounts를 두고 카드 배열만 추가하면 됨.

---

## 7. 상품관리 > 카테고리/테마 관리 탭

### 7.1 상품관리 페이지 진입점

**파일: src/app/admin/products/page.tsx**

- getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount() 호출 후 AdminProductManager에 넘기지 않고, 레이아웃/헤더용으로만 사용 가능. 실제 상품·taxonomy 데이터는 AdminProductManager 내부에서 클라이언트/API로 로드.
- AdminProductManager를 AdminToastProvider, AdminConfirmProvider로 감싼 뒤 Suspense fallback만 제공.

### 7.2 탭 구조 (SubHeader + AdminProductManager)

- **SubHeader menuMap.product**: ["상품 목록", "상품 등록", "상품 등록(모두)", "카테고리/테마 관리", "메인 추천상품 관리"].
- **view param**: searchParams.get("view"). taxonomy 탭 = view === "taxonomy". 상수: ADMIN_PRODUCTS_VIEW.TAXONOMY, PRODUCT_VIEW_TO_LABEL["taxonomy"] = "카테고리/테마 관리".

### 7.3 AdminProductTaxonomyView (카테고리/테마 탭 컨텐츠)

**파일: src/components/admin/products/AdminProductTaxonomyView.tsx**

- **탭**: 내부에 "지역 관리" / "테마 관리" 버튼으로 activeTab("region"|"theme") 전환. region = categoryTaxonomies, theme = themeTaxonomies.
- **테이블 컬럼**: 이름, slug, 정렬(sort_order), 활성(is_active), 사용(usageCount), 동작(수정/삭제 또는 저장/취소). **정렬/필터/검색**: 테이블 자체에는 정렬·필터·검색 UI 없음. 목록은 API에서 받은 순서 그대로.
- **row action**: 수정(인라인 편집: slug, sort_order, is_active) → 저장/취소. 삭제 → 확인 후 delete API. fallback 항목(id.startsWith("fallback-"))이면 수정/삭제 비활성화.
- **category/theme**: 하나의 공용 컴포넌트로 같은 테이블 구조를 region/theme 두 탭에 반복. 데이터만 categoryTaxonomies / themeTaxonomies로 구분.

### 7.4 Taxonomy 테이블 / 폼

- **테이블**: 위 컴포넌트 내부 `<table>` 두 개(지역·테마 각각). thead: 이름, slug, 정렬, 활성, 사용, 동작. tbody: map으로 row 렌더, 편집 중이면 input/checkbox.
- **폼(추가)**: 테이블 아래. 지역: 이름(name), slug, 정렬 입력 + "지역 추가" 버튼. 테마: 동일 + "테마 추가". 별도 drawer/modal 없음. 인라인 폼만.

### 7.5 컬럼 정의 요약

| 컬럼 | 필드 | 비고 |
|------|------|------|
| 이름 | item.name | 읽기 전용 |
| slug | item.slug | 편집 시 input |
| 정렬 | item.sort_order | 편집 시 number input |
| 활성 | item.is_active | 편집 시 checkbox |
| 사용 | item.usageCount | 읽기 전용 (상품에서 사용 중인 수) |
| 동작 | — | 수정/삭제 또는 저장/취소 |

- **“최근 7일 클릭수 / 검색유입 / 랜딩 클릭률”** 컬럼을 넣으려면: 1) API가 taxonomy별 집계를 반환하도록 확장, 2) ProductTaxonomyWithUsage를 확장하거나 별도 DTO에 해당 필드 추가, 3) 테이블 th/td 한 줄씩 추가하면 됨. 현재 테이블이 컴포넌트 내부에 있어서 **컬럼 추가는 해당 파일 수정으로 가능**.
- **row action 확장**: "랜딩 보기 / 헤더 노출 / 필터 노출" 같은 버튼을 "동작" 셀에 추가하기만 하면 됨. slug 있으면 랜딩 URL `/products/region/{slug}` 또는 `/products/theme/{slug}` 링크 가능.

---

## 8. Taxonomy CRUD / 조회 로직

### 8.1 헤더용 (공용 소스)

- **getActiveTaxonomiesForHeader()**: src/lib/productTaxonomies.ts. getActiveTaxonomiesCached() 호출 → is_active=true, type/sort_order/name 정렬. **관리자 목록과 다른 소스**: 관리자는 GET /api/admin/product-taxonomies(usageCount 포함), 헤더는 getActiveTaxonomiesCached(usage 없음). **같은 product_taxonomies 테이블**을 보지만 API가 products와 조인해 usageCount를 계산해 반환.

### 8.2 관리자용 목록 조회

- **API**: GET /api/admin/product-taxonomies. product_taxonomies 전체 + products에서 category/theme 사용 수 계산해 usageCount 붙여 반환. (route.ts 참조. GET에서 items 배열 반환.)
- **클라이언트**: fetchAdminProductTaxonomy() → adminProductTaxonomy.client.ts. GET /api/admin/product-taxonomies, 배열 파싱. ProductTaxonomyWithUsage[].

### 8.3 생성/수정/삭제

- **create**: POST /api/admin/product-taxonomies. body: type, name, slug?, sort_order?, is_active?. revalidateTag(TAXONOMY), revalidateTag(HEADER_NAV).
- **update**: PATCH /api/admin/product-taxonomies/[id]. body: slug?, sort_order?, is_active?. revalidate 동일.
- **delete**: DELETE /api/admin/product-taxonomies/[id]. 사용 중이면 400. revalidate 동일.
- **normalize**: API 내부에서 mapTaxonomy 같은 별도 함수명은 없고, GET에서 row를 { id, type, name, slug, is_active, sort_order, created_at, usageCount } 형태로 매핑.

### 8.4 정리

- **관리자 목록 vs 헤더**: 관리자 = API(usageCount 포함). 헤더 = getActiveTaxonomiesCached (usage 없음). 동일 테이블, **캐시 무효화**는 taxonomy API에서 revalidateTag(TAXONOMY, HEADER_NAV)로 처리.
- **usageCount**: getProductTaxonomiesWithUsage(products)는 관리자 API가 아닌 서버용. API는 자체적으로 products를 조회해 count 계산.

---

## 9. 대시보드/관리자 공용 UI 쉘

### 9.1 관리자 레이아웃

**파일: src/components/admin/AdminLayout.tsx**

- Sidebar(왼쪽) + 본문. pathname으로 mainMenu 추론(inferMainMenuKey). SubHeader, Breadcrumb. AnimatedSection으로 전환. 권한은 SIDEBAR_ITEMS와 role로 canAccessCurrentPath 계산 후 없으면 권한 안내 문구.

### 9.2 AdminCard / AdminPanel / AdminSection

- **AdminCard**: variant default | muted | glass. KPI는 glass.
- **AdminPanel**: AdminCard wrapper, muted 옵션.
- **AdminSection**: title, description, headerRight, children. 섹션 제목용.

### 9.3 AdminHeader (대시보드 상단)

- **파일**: src/components/AdminHeader.tsx. props: title, description, activeTab, productCount, inquiryCount, memberCount, reviewCount, unreadNotificationCount. **실제 렌더는 title과 description만**. 나머지 숫자는 선언만 되어 있고 하단 탭/링크는 없음.

### 9.4 AdminBadge / StatusBadge

- **AdminBadge**: variant success | warning | danger. 작은 뱃지+점.
- **StatusBadge**: variant pending | completed | delayed. 문의 상태용 라벨.

### 9.5 Empty / Loading / Error

- **AdminDashboardKpiSection**: isLoading → 4개 플레이스홀더. isError → 메시지 + "다시 시도" 버튼. isEmptyState(counts 없음) → "아직 집계된 지표가 없습니다" 문구. 별도 AdminEmptyState 컴포넌트는 없음.

---

## 10. 중점 확인 포인트 (확장 시 참고)

1) **대시보드 KPI 추가 시 가장 안전한 확장 위치**  
   - **서버**: getAdminCounts() 반환 객체에 필드 추가하거나, 별도 getInquiryMetrics(range?, from?, to?) 등을 만들어 API에서 호출.  
   - **클라이언트**: AdminDashboardKpiSection에서 useQuery로 같은 API를 쓰고, 응답에 새 필드를 넣어 KpiCard 한 장 더 추가. AdminCounts 타입만 확장하면 됨.

2) **문의 KPI와 운영 KPI를 같은 카드 시스템으로 표현 가능한지**  
   - 가능. AdminStatCard는 title, value, changePercent, changeDirection, href만 받음. 문의가 아닌 “상품 노출 수”, “헤더 클릭 수” 등도 동일 카드로 추가 가능.

3) **기간 필터를 analytics 집계에도 재사용 가능한지**  
   - UI와 queryKey는 이미 range/from/to 사용. API와 getAdminCounts(또는 새 집계 함수)에서 이 파라미터를 받아 날짜 범위 필터만 적용하면 재사용 가능. 현재는 API가 파라미터를 읽지만 집계에는 미반영.

4) **taxonomy 관리 탭에 “최근 7일 클릭수 / 검색유입 / 랜딩 클릭률” 컬럼을 넣기 쉬운지**  
   - 테이블이 AdminProductTaxonomyView 한 파일에 있어서, 1) 백엔드에서 taxonomy별 집계 API 또는 기존 API에 필드 추가, 2) ProductTaxonomyWithUsage 확장 또는 별도 타입, 3) thead/th 한 줄 + tbody/td 한 줄 추가하면 됨. 구조상 쉬움.

5) **taxonomy row action에서 “랜딩 보기 / 헤더 노출 / 필터 노출” 확장**  
   - “동작” 셀에 버튼/링크 추가만 하면 됨. 랜딩 보기는 slug 있으면 `/products/region/{slug}` 또는 `/products/theme/{slug}`. 헤더/필터 노출은 is_active와 동일 소스이므로 설명 툴팁이나 뱃지로 표시 가능.

6) **현재 쿼리/타입 구조가 analytics 집계 추가에 열려 있는지**  
   - 열려 있음. AdminCounts 확장, API에 range/from/to 전달, 새 집계 필드 추가, 카드/차트 한 개씩 추가하는 방식으로 확장 가능. mock이 아닌 **실제 Supabase 집계**이며, 차트 데이터는 **서버 집계 결과를 그대로** 클라이언트에서 SVG로 시각화.

---

## 11. 추가: 실제 집계 쿼리 / taxonomy 테이블 컬럼

### 11.1 adminCounts 쿼리 요약

- products: count(id).  
- inquiries: count(id); is_completed=false; created_at 오늘/어제 구간; delayed(created_at < 24h ago, is_completed=false).  
- members, reviews: count(id).  
- 증감률: percentChange(오늘 값, 어제 값).

### 11.2 Taxonomy 테이블 컬럼 정의 (AdminProductTaxonomyView)

- **thead**: 이름, slug, 정렬, 활성, 사용, 동작.  
- **tbody**: name(텍스트), slug(편집 시 input), sort_order(편집 시 number), is_active(편집 시 checkbox), usageCount(텍스트), 동작(수정/삭제 또는 저장/취소).

---

## 12. 기타

- **관리자 대시보드에 보이는 컴포넌트 매핑**:  
  - 페이지: src/app/admin/page.tsx  
  - 상단: AdminHeader  
  - KPI+기간+차트: AdminDashboardKpiSection  
  - KPI 카드 1장: KpiCard → AdminStatCard  
  - Quick actions / Resource overview: page.tsx 인라인 article  
  - 레이아웃: AdminLayout (Sidebar, SubHeader, Breadcrumb)

- **운영 현황 vs 통계**: 메뉴 맵에는 "운영 현황", "통계"가 있으나 **단일 페이지에서 탭 전환이 없음**. 실제 화면은 하나. 탭을 나누려면 SubHeader의 handleTabClick에서 dashboard일 때 view 또는 path를 바꾸고, 페이지에서 탭별 컨텐츠 분기하면 됨.

- **Mock 데이터 여부**: 아님. getAdminCounts()가 Supabase에서 직접 집계.

- **차트 데이터**: 서버 집계(counts)를 API로 받아서 클라이언트에서 SVG로 그리므로 **서버 집계 + 클라이언트 시각화**.

- **Taxonomy 관리 탭 검색/정렬**: 현재 **없음**. 목록은 API 순서 그대로. 검색/정렬을 넣으려면 클라이언트에서 filter/sort하거나, API에 q/sort 파라미터를 추가하면 됨.

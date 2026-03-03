# 토큰 기반 리팩토링 산출물

## 1. 변경 파일 목록

### UI 프리미티브
- `src/components/ui/Input.tsx` — bg, border, focus ring, placeholder/텍스트 토큰
- `src/components/ui/Textarea.tsx` — 동일
- `src/components/ui/Select.tsx` — 동일
- `src/components/ui/Card.tsx` — shadow, elevated 배경/그림자 토큰
- `src/components/ui/Badge.tsx` — success/warning/danger variant 추가, 기존 variant 토큰화
- `src/components/ui/Button.tsx` — primary variant `--primary` / `--primary-hover`
- `src/components/ui/AlertCard.tsx` — warning/info/neutral 배경·링·텍스트 토큰
- `src/components/ui/Tag.tsx` — accent/muted/gold 토큰화

### 모달 / 드롭다운
- `src/components/admin/AdminConfirmProvider.tsx` — backdrop `--overlay`, 모달 `--surface-elevated`, `--shadow-modal`
- `src/components/admin/SubHeader.tsx` — 검색 input focus `--primary` ring
- `src/components/AdminNotificationBell.tsx` — 드롭다운 배경·테두리·텍스트·링크 토큰

### 공개 페이지 / 카드
- `src/components/ProductDetailSticky.tsx` — 데스크톱/모바일 카드·버튼·테두리·텍스트
- `src/components/ProductCard.tsx` — 카드 배경·그림자·링·텍스트·CTA
- `src/components/ProductDetailContentLegacy.tsx` — 페이지 배경·섹션·버튼·플라이트 카드·구분선
- `src/components/products/TravelOverviewV2.tsx` — 섹션·SummaryCard
- `src/components/products/ThemeChartCard.tsx` — 컨테이너·범례·텍스트
- `src/app/login/page.tsx` — 페이지/섹션 배경·링·텍스트
- `src/app/admin/notices/page.tsx` — 페이지/섹션/폴백 토큰

### 어드민 폼·테이블·알림
- `src/components/AdminSiteSettingsManager.tsx` — 입력·라벨·섹션·버튼·테두리 일괄 토큰화
- `src/components/AdminMemberTable.tsx` — 테이블 헤더·행·입력·버튼·정렬 버튼·페이지네이션
- `src/components/AdminNotificationList.tsx` — 필터 탭·알림 카드·버튼·상태 뱃지
- `src/components/admin/ui/AdminStatCard.tsx` — focus ring `--primary`

### 레이아웃·전역
- `src/app/layout.tsx` — selection 배경 `color-mix(primary)`
- `src/app/globals.css` — (이전 작업에서 이미 토큰 정리됨)

---

## 2. 대표 컴포넌트 Before/After

### (1) 모달 — AdminConfirmProvider

**Before**
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
  <div className="w-full max-w-sm rounded-2xl bg-[var(--card)] p-5 shadow-[0_18px_55px_rgba(15,23,42,0.45)] ring-1 ring-[var(--border)]">
```

**After**
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 backdrop-blur-[2px]">
  <div className="w-full max-w-sm rounded-2xl bg-[var(--surface-elevated)] p-5 shadow-[var(--shadow-modal)] ring-1 ring-[var(--border)]">
```

- 백드롭: `bg-black/30` → `bg-[var(--overlay)]` (+ backdrop-blur)
- 모달: `bg-[var(--card)]` → `bg-[var(--surface-elevated)]`, `shadow-[...]` → `shadow-[var(--shadow-modal)]`

---

### (2) 인풋 — Input.tsx

**Before**
```tsx
"w-full rounded-xl border border-[color:var(--border)] bg-white px-4 py-3.5 type-body outline-none",
"transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
```

**After**
```tsx
"w-full rounded-xl border border-[color:var(--border)] bg-[var(--surface)] px-4 py-3.5 type-body outline-none",
"transition focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]",
"text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
```

- 배경: `bg-white` → `bg-[var(--surface)]` (다크 대비)
- 포커스: Tailwind primary → 명시적 `var(--primary)` + color-mix 링
- 텍스트/플레이스홀더: 토큰 연결

---

### (3) 카드 — Card.tsx (default / elevated)

**Before**
```tsx
variantClass = "rounded-2xl bg-card shadow-sm ring-1 ring-[color:var(--border)]";
// elevated
variantClass = "rounded-3xl bg-card shadow-md ring-1 ring-[color:var(--border)]";
```

**After**
```tsx
variantClass = "rounded-2xl bg-card shadow-[0_1px_3px_var(--shadow-soft),0_4px_12px_var(--shadow-soft-strong)] ring-1 ring-[color:var(--border)]";
// elevated
variantClass = "rounded-3xl bg-[var(--surface-elevated)] shadow-[0_4px_12px_var(--shadow-soft-strong)] ring-1 ring-[color:var(--border)]";
```

- default: shadow를 `--shadow-soft` / `--shadow-soft-strong` 사용
- elevated: `bg-[var(--surface-elevated)]` + 동일 shadow 토큰

---

### (4) 드롭다운 — AdminNotificationBell

**Before**
```tsx
<div className="absolute right-0 z-50 mt-2 w-[340px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
```
```tsx
? "border-slate-200 bg-white hover:bg-slate-50"
: "border-blue-200 bg-blue-50 hover:bg-blue-100/60"
```

**After**
```tsx
<div className="absolute right-0 z-50 mt-2 w-[340px] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 shadow-[var(--shadow-modal)]">
```
```tsx
? "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--surface-muted)]"
: "border-[color:color-mix(in_oklab,var(--primary)_35%,transparent)] bg-[var(--success-bg)] hover:bg-[color:color-mix(in_oklab,var(--primary)_12%,transparent)]"
```

- 컨테이너: elevated + `--shadow-modal`
- 읽음/안읽음: border·bg·hover를 전부 토큰/color-mix로 통일

---

### (5) 버튼 — Button.tsx (primary)

**Before**
```tsx
"bg-[#1E3A8A] text-white hover:bg-[#1d4ed8]";
```

**After**
```tsx
"bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]";
```

- primary 컬러 전부 시맨틱 토큰으로 교체

---

## 3. 토큰 미적용 잔여 하드코딩 리스트

아래 파일들은 이번 리팩토링에서 **일부만 수정했거나 아직 미수정**입니다. 동일 규칙으로 추가 교체 시 다크 모드·라이트 일관성이 유지됩니다.

| 파일 | 패턴 예시 |
|------|------------|
| `AdminLoginForm.tsx` | border-slate-300, focus:border-[#2563eb], bg-[#1d4ed8] |
| `MemberLoginForm.tsx` | 동일 |
| `ProductDetailStickyV2.tsx` | border-[#dbeafe], bg-white, ring-[#dbeafe] |
| `privacy/page.tsx`, `terms/page.tsx`, `signup/page.tsx` | from-[#f3f8ff], to-white, bg-[#1d4ed8], ring-[#dbeafe] |
| `support/page.tsx` | bg-white, ring-[#dbeafe] |
| `admin/login/page.tsx`, `admin/banners/page.tsx`, `admin/members/page.tsx` | bg-[#f8fbff], bg-white, ring-[#dbeafe] |
| `theall_manager_only/guides/page.tsx` | bg-[#f8fbff] |
| `MultiImageUploadField.tsx`, `GuidePdfUploadField.tsx` | border-slate-300, focus:border-[#2563eb], bg-blue-50 |
| `ProductDetailTabsLegacy.tsx`, `ProductDetailTabs.tsx` | bg-[#f8fbff], ring-[#dbeafe], text-[#1e3a8a], bg-[#1d4ed8] |
| `ProductDetailV2.tsx` | border-[#dbeafe], bg-[#f8fbff], text-[#0f172a], bullet bg-[#2563eb] |
| `products/[id]/page.tsx` | bg-white, ring-[#dbeafe] |
| `ProductDetailHero.tsx` | text-[#0f172a], border-[#dbeafe], bg-[#1E3A8A] |
| `ProductCatalogSection.tsx` | bg-white/95, ring-[#dbeafe], bg-[#eff6ff], text-[#1E3A8A] |
| `ProductsHero.tsx` | bg-white/95, ring-[#dbeafe] |
| `HomeProductSlider.tsx` | bg-white/80, ring-[#dbeafe], bg-white |
| `OptionGroup.tsx` | text-[#0f172a], bg-white, has-[:checked]:border-[#1E3A8A] |
| `FlightSummarySection.tsx` | text-[#1e3a8a], bg-[#eff6ff] |
| `ProductCardV2.tsx` | text-[#0f172a] |
| `QuoteSummary.tsx` | border-[#dbeafe], bg-[#f8fbff], text-slate-600 |
| `AdminReviewTable.tsx` | border-slate-300, focus:border-[#2563eb], bg-[#eff6ff], text-[#1e3a8a] |
| `AdminProductManager.tsx` | 다수 bg-[#f8fbff], ring-[#dbeafe], border-slate-300, focus:blue |
| `ReviewItemActions.tsx` | border-slate-300, focus:blue, bg-[#1d4ed8] |
| `ConsultModal.tsx` | border-[#60a5fa], gradient from-[#1d4ed8] to-[#2563eb] |
| `GuideDetailBody.tsx` | border-[#1E3A8A], bg-[#1E3A8A] |
| `SiteHeader.tsx` | bg-[#eff6ff], text-[#1E3A8A] |
| `dev/product-detail/[id]/page.tsx` | bg-white, ring-[#dbeafe] |
| `AdminSiteSettingsManager.tsx` | 제목 등 text-[#1e3a8a] 2곳 |
| `AdminNotificationBell.tsx` | 제목 text-[#0f172a] 1곳 |

**교체 규칙 요약**
- `bg-white` → `bg-[var(--surface)]` 또는 `bg-[var(--card)]`
- `#f8fbff` / `#eff6ff` / `#dbeafe` → `var(--card-muted)`, `var(--border)`, 또는 primary color-mix
- `#1e3a8a` / `#1d4ed8` / `#2563eb` → `var(--primary)`, `var(--primary-hover)`
- `#0f172a` → `var(--text-primary)`
- `border-slate-*`, `text-slate-*` → `var(--border)`, `var(--divider)`, `var(--text-primary)` 등
- `focus:border-[#2563eb] focus:ring-[#bfdbfe]` → `focus:border-[var(--primary)] focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]`

---

## 4. 다크 모드 대비

- **배경 계층**: `--bg` → `--surface` → `--surface-muted` → `--surface-elevated` 순으로 다크에서도 정의되어 있어 동일 클래스로 동작합니다.
- **테두리**: `--border`, `--divider`가 다크에서 더 밝은 값으로 오버라이드됩니다.
- **포커스 링**: `var(--primary)` + color-mix를 사용해 두 테마에서 모두 대비 확보됩니다.
- **상태 뱃지**: Badge/AlertCard의 success-bg, warning-bg, danger-bg는 `.dark`에서 연한 배경으로 정의되어 가독성이 유지됩니다.

이미 수정한 컴포넌트는 `html.dark` 또는 부모에 `.dark`가 적용되면 자동으로 다크 팔레트를 사용합니다.

# 구분선(divider) 토큰 교체 — 산출물

## 적용 규칙

- **구분선 역할** (섹션·리스트·테이블 행·사이드바 메뉴 구분): `border-[var(--divider)]` 또는 `divide-[var(--divider)]` 사용.
- **카드/입력 필드 외곽선**: `--border` 또는 `--border-strong` 유지 (divider 아님).
- **라이트 UI**: `--divider`는 `#e2e8f0`로 얇고 은은하게 정의됨.

---

## 1. 교체된 위치 목록

### 1.1 섹션 헤더 아래 / 섹션 구분선

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| **SubHeader.tsx** | 스티키 헤더 하단 | `border-b border-[var(--border)]` → `border-b border-[var(--divider)]` |
| **GuidePdfModal.tsx** | 모달 헤더 아래 | `border-b border-[var(--border)]` → `border-b border-[var(--divider)]` |
| **ThumbnailCropSelector.tsx** | 툴바 아래 | `border-b border-[var(--border)]` → `border-b border-[var(--divider)]` |
| **SignupForm.tsx** | 약관 모달 헤더 아래 | `border-b border-[var(--border)]` → `border-b border-[var(--divider)]` |
| **ProductImageGalleryModal.tsx** | 갤러리 헤더 아래 | `border-b border-[var(--border)]` → `border-b border-[var(--divider)]` |
| **ProductDetailTabs.tsx** | 탭 패널 내 일정·포함사항 위 | `border-t border-[#dbeafe]` → `border-t border-[var(--divider)]` |
| **ProductDetailV2.tsx** | 동일 | `border-t border-[#dbeafe]` → `border-t border-[var(--divider)]` |
| **QuoteSummary.tsx** | 요약 리스트 위 | `border-t border-[#dbeafe]` → `border-t border-[var(--divider)]` |
| **InteractiveTimelineV2.tsx** | 섹션 구분 | `border-t border-slate-200` → `border-t border-[var(--divider)]` |
| **GuideDetailBody.tsx** | 가이드 본문 상단 구분 | `border-t border-slate-200` → `border-t border-[var(--divider)]` |
| **FlightSummarySection.tsx** | 출발/도착 블록 사이 | `border-t border-slate-200` → `border-t border-[var(--divider)]` |
| **AdminProductManager.tsx** | 카테고리 패널 내부 구분, 섹션 하단 | `border-t border-[#dbeafe]` / `border-b border-slate-200` → `border-[var(--divider)]` |
| **AdminInquiryTable.tsx** | 필터 영역 아래 | `border-t border-slate-200` → `border-t border-[var(--divider)]` |
| **ProductImageGalleryModal.tsx** | 하단 패널 상단(기본/콜라주 영역 위) | `border-t border-slate-200` → `border-t border-[var(--divider)]` |
| **GlobalSiteFooter.tsx** | 푸터 내부 상단 구분 | `border-t border-site-border` → `border-t border-[var(--divider)]` |
| **AdminNotificationBell.tsx** | 드롭다운 하단 “전체보기” 위 | (이미 `border-[var(--divider)]` 적용됨) |

### 1.2 리스트 아이템 사이 구분선

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| **admin/page.tsx** | 대시보드 리스트 | `divide-y divide-[var(--border)]` → `divide-y divide-[var(--divider)]` |
| **AdminRecommendedSearchManager.tsx** | 테이블·tbody | `divide-y divide-[var(--border)]` → `divide-y divide-[var(--divider)]` |
| **AdminGuideManager.tsx** | 테이블·tbody | `divide-y divide-slate-200` / `divide-slate-100` → `divide-y divide-[var(--divider)]` |

### 1.3 테이블 row 구분선

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| **AdminMemberTable.tsx** | thead 아래·행 사이 | (이미 `border-t border-[var(--divider)]` 적용됨) |
| **AdminProductManager.tsx** | 상품 테이블 tr | `border-t border-slate-200` → `border-t border-[var(--divider)]` |
| **AdminInquiryTable.tsx** | 문의 테이블 tr | `border-t border-slate-200` → `border-t border-[var(--divider)]` |
| **AdminReviewTable.tsx** | 리뷰 테이블 tr | `border-t border-slate-200` → `border-t border-[var(--divider)]` |

### 1.4 사이드바·드롭다운·플로팅 바 구분선

| 파일 | 위치 | 변경 내용 |
|------|------|-----------|
| **Sidebar.tsx** | 메뉴 그룹 사이 | `border-t border-[var(--border)]` → `border-t border-[var(--divider)]` |
| **HeaderSearchDropdown.tsx** | 최근 검색 / 인기 / 제안 섹션 사이 | `border-t border-[var(--border)]` → `border-t border-[var(--divider)]` (3곳) |
| **ProductDetailSticky.tsx** | 모바일 CTA 바 상단 | `border-t border-[var(--border)]` → `border-t border-[var(--divider)]` |
| **ProductDetailStickyV2.tsx** | 동일 | `border-t border-slate-200` → `border-t border-[var(--divider)]` |

---

## 2. 유지한 border (divider 아님)

- **카드/패널 외곽**: `ring-1 ring-[var(--border)]`, `border border-[var(--border)]` — 유지.
- **입력 필드·버튼 외곽**: `border-[var(--border)]` — 유지.
- **다크/브랜드 전용 구분선**: `SiteHeader.tsx`(border-t border-white/10), `MobileFloatingMenu.tsx`(border-t border-white/10), `GlobalSiteFooter.tsx`(푸터 상단 border-t rgba 골드) — 컨텍스트상 기존 값 유지.

---

## 3. 대표 코드 스니펫

### 3.1 섹션 헤더 아래 (스티키 헤더)

```tsx
// SubHeader.tsx — Before
className="... border-b border-[var(--border)] bg-[var(--card)] ..."

// After
className="... border-b border-[var(--divider)] bg-[var(--card)] ..."
```

### 3.2 리스트 아이템 사이 (divide)

```tsx
// admin/page.tsx — Before
<ul className="divide-y divide-[var(--border)] rounded-lg bg-[var(--surface)] ring-1 ring-[var(--border)]">

// After
<ul className="divide-y divide-[var(--divider)] rounded-lg bg-[var(--surface)] ring-1 ring-[var(--border)]">
```

(카드 외곽은 `ring-[var(--border)]` 유지.)

### 3.3 테이블 row 구분선

```tsx
// AdminReviewTable.tsx — Before
<tr className="border-t border-slate-200">
<tr key={item.id} className="border-t border-slate-200 align-top">

// After
<tr className="border-t border-[var(--divider)]">
<tr key={item.id} className="border-t border-[var(--divider)] align-top">
```

### 3.4 사이드바 메뉴 구분선

```tsx
// Sidebar.tsx — Before
<div className="mt-4 space-y-1 border-t border-[var(--border)] pt-3 text-xs ...">

// After
<div className="mt-4 space-y-1 border-t border-[var(--divider)] pt-3 text-xs ...">
```

### 3.5 드롭다운 섹션 구분선

```tsx
// HeaderSearchDropdown.tsx — Before
<section className="border-t border-[var(--border)] px-3 py-2.5">

// After
<section className="border-t border-[var(--divider)] px-3 py-2.5">
```

### 3.6 모달 헤더 아래

```tsx
// GuidePdfModal.tsx — Before
<div className="... border-b border-[var(--border)] bg-[var(--surface-elevated)] ...">

// After
<div className="... border-b border-[var(--divider)] bg-[var(--surface-elevated)] ...">
```

---

## 4. 요약

- **교체**: 구분선 역할의 `border-t`/`border-b` 및 `divide-y`를 `--divider`로 통일.
- **유지**: 카드·입력 필드 외곽선은 `--border`/`--border-strong` 유지.
- **라이트**: `--divider`(#e2e8f0)로 구분선이 얇고 은은하게 보이도록 적용 완료.

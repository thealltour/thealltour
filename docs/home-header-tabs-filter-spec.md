# 홈/헤더/탭/필터/검색 UI — 토큰 기반 스펙 적용

## 1. 변경 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/SiteHeader.tsx` | 서버 컴포넌트로 축소, session/memberPoints 조회 후 SiteHeaderUI에 전달 |
| `src/components/SiteHeaderUI.tsx` | **신규** 클라이언트 헤더: 스크롤 시 surface+shadow+divider, 64/56px, 네비·서브칩·CTA 토큰 |
| `src/components/HeaderProductSearch.tsx` | 카드형 검색바: surface, border, shadow-soft, focus 시 primary+ring, placeholder text-subtle |
| `src/components/HeaderSearchDropdown.tsx` | surface-elevated, shadow-modal, row hover surface-muted |
| `src/components/HeaderMobileShell.tsx` | 라이트 테마: secondary/muted 텍스트, surface-muted hover, focus-ring |
| `src/components/MemberLogoutButton.tsx` | text-muted / hover foreground, focus-ring |
| `src/components/ui/Tabs.tsx` | Pill 탭: surface-muted 컨테이너, active surface+shadow-soft, focus-ring |
| `src/components/ui/FilterChip.tsx` | **신규** default/selected/premium, 36~40px pill, 토큰만 사용 |
| `src/components/ui/SortDropdown.tsx` | **신규** outline 트리거, surface-elevated 드롭다운, selected primary-soft |
| `src/app/globals.css` | section-heading, section-description, section-grid, page-content 유틸 추가 |
| `src/app/page.tsx` | 페이지 루트 bg theall-page-bg, main page-content, 빈 상태·링크 토큰 |

---

## 2. 공통 컴포넌트 요약

### SiteHeader (SiteHeaderUI)

- **배경**: 기본 `--theall-page-bg`, 스크롤 시 `--surface` + `--shadow-soft` + `border-b` `--divider`, `backdrop-blur-sm`
- **높이**: 데스크톱 64px(`h-16`), 모바일 56px(`h-14`)
- **로고/브랜드**: `--secondary`, 서브텍스트 `--text-muted`
- **네비 링크**: 기본 `--text-muted`, hover `--foreground` + `--surface-muted`, active `--foreground` + 2px 하단 `--primary`
- **서브칩(패키지/골프)**: 선택 시 `--primary-soft` 또는 success-bg, 비선택 surface/border/hover surface-muted
- **CTA**: Button primary, HeaderQuickConsultCtas 유지
- **검색**: HeaderProductSearch 카드형(아래 SearchBar 스펙)

### 검색바 (HeaderProductSearch)

- **컨테이너**: `bg-[var(--surface)]`, `border-[var(--border)]`, `shadow-[var(--shadow-soft)]`, `rounded-2xl`, padding
- **input**: bg transparent, `text-[var(--foreground)]`, `placeholder:text-[var(--text-subtle)]`
- **focus**: 컨테이너 `border-[var(--primary)]`, `ring-[3px]` `ring-[var(--focus-ring)]`
- **드롭다운**: `bg-[var(--surface-elevated)]`, `shadow-[var(--shadow-modal)]`, 구분선 `--divider`, row hover `--surface-muted`

### Tabs (Pill)

- **컨테이너**: `bg-[var(--surface-muted)]`, `rounded-full`, `p-1`
- **트리거**: 기본 `text-[var(--text-muted)]`, hover `bg-[var(--surface)]` `text-[var(--foreground)]`, active `bg-[var(--surface)]` + `shadow-[var(--shadow-soft)]`
- **높이**: min-h 40px

### FilterChip

- **default**: `bg-[var(--surface)]`, `border-[var(--border)]`, `text-[var(--text-muted)]`, hover surface-muted/border-strong/foreground
- **selected**: `bg-[var(--primary-soft)]`, `border-[var(--primary)]`, `text-[var(--primary)]`
- **premium**: `bg-[var(--secondary-soft)]`, `text-[var(--secondary)]`
- **크기**: min-h 9 (36px), pill, focus-ring

### SortDropdown

- **트리거**: Button outline
- **드롭다운**: `bg-[var(--surface-elevated)]`, `shadow-[var(--shadow-modal)]`, `border-[var(--border)]`, 구분선 `--divider`
- **option**: hover `--surface-muted`, selected `--primary-soft` + `text-[var(--primary)]`

---

## 3. 홈/리스트/모달 Before·After 요약

### 홈

- **Before**: 전체 배경 네이비, 헤더 네이비+골드, 검색창 white/10
- **After**: 페이지 배경 `--theall-page-bg`, 헤더 라이트+스크롤 시 surface, 검색 카드형 토큰, 메인 `page-content`, 빈 상태·전체 상품 링크 토큰. 히어로/신뢰/컨택트 등 네이비 블록은 유지(프리미엄 앵커).

### 리스트(상품 목록)

- ProductCatalogSection 카테고리/테마 칩은 이미 `--primary-soft` 적용. FilterChip/SortDropdown 컴포넌트 사용 시 동일 스펙으로 통일 가능.

### 모달

- 기존 ConsultModal·Modal·HeaderQuickConsultCtas 모달: `--overlay`, `--surface-elevated`, `--shadow-modal` 유지. 닫기 버튼 border/ hover 토큰 적용됨.

---

## 4. 하드코딩 잔여 목록

- **홈 페이지**: 히어로/신뢰/컨택트/CuratedBlock 내부 `#0F172A`, `#162133`, `#111C2D`, `site-primary`, `#1E3A8A`, `#B8962E` 등은 의도적 네이비·골드 앵커로 유지.
- **HeaderQuickConsultCtas**: 모달 내 input/textarea는 이미 토큰 또는 Input 컴포넌트 사용 권장.
- **MobileFloatingMenu**: 메뉴 패널 배경/텍스트가 아직 white/navy 계열일 수 있음 → 필요 시 `--surface-elevated`, `--foreground` 등으로 교체.
- **기타**: Admin·기타 페이지의 `bg-white`, `text-slate-*`, `border-slate-*` 는 점진적으로 토큰으로 교체 가능.

---

## 5. 점검 체크리스트

- [x] 홈 상단: 헤더 + 검색바 라이트·카드형, 탭(서브칩) 토큰
- [x] 카드 리스트: hover shadow-soft-strong 등 기존 토큰 유지
- [x] 필터/정렬: FilterChip·SortDropdown selected/hover/focus 정의
- [x] 모달/드롭다운: overlay + surface-elevated + shadow-modal 통일
- [x] 다크 모드: 동일 토큰 구조(.dark)로 대비/레이어 유지

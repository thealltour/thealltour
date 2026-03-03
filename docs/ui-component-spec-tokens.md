# UI 컴포넌트 스펙 — 토큰 기반 (아고다 친숙함 + 프리미엄 네이비)

## 1. 변경 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/app/globals.css` | `--primary-bg` 추가(라이트/다크), `.link-primary` 유틸 추가 |
| `src/components/ui/Button.tsx` | 4종 변형(primary/secondary/outline/ghost), 높이 44/36/52px, radius 12px, focus ring 3px, active:translate-y-px |
| `src/components/ui/Input.tsx` | h-11, rounded-xl, hover border-strong, focus primary+ring 3px, error/disabled 토큰 |
| `src/components/ui/Textarea.tsx` | 동일 포커스/에러/disabled, min-height |
| `src/components/ui/Select.tsx` | h-11, 동일 스펙 |
| `src/components/ui/Label.tsx` | text-[var(--foreground)], LabelSub export (--text-muted) |
| `src/components/ui/FormField.tsx` | 신규: FormField, InputField, TextareaField, SelectField (라벨/헬퍼/에러) |
| `src/components/ui/Card.tsx` | border 기반, rounded-2xl(16px), interactive variant(hover shadow-strong+border-strong) |
| `src/components/ui/Badge.tsx` | neutral/primary/premium/outline/success/warning/danger, default/blue/gold 별칭 유지 |
| `src/components/ui/AlertCard.tsx` | success/danger variant 추가, title --foreground, 본문 --text-muted, border --divider |
| `src/components/products/OptionPanel.tsx` | Card 하드코딩 제거 → border/surface 토큰 |
| `src/components/products/ProductDetailV2.tsx` | 일정 카드 border/bg 하드코딩 제거 |
| `src/components/guides/GuideDetailBody.tsx` | 섹션/목차/링크/버튼 전부 토큰, link-primary 적용 |
| `src/app/support/notices/[id]/page.tsx` | hr/버튼 토큰 |
| `src/components/HomeTopBanner.tsx` | ring/indicator bg 토큰 |

---

## 1-1. Soft 토큰 (primary-soft / secondary-soft)

### 토큰 추가 코드

**`:root` (라이트)**  
- `--primary-soft: rgba(47, 107, 255, 0.08);` — primary 아주 연한 배경  
- `--secondary-soft: rgba(11, 27, 58, 0.06);` — secondary(네이비) 아주 연한 배경  

**`.dark`**  
- `--primary-soft: rgba(121, 167, 255, 0.14);`  
- `--secondary-soft: rgba(248, 250, 252, 0.1);`  

### 적용 위치 목록

| 위치 | 용도 | 토큰 |
|------|------|------|
| `src/components/ui/Badge.tsx` | primary / blue 배지 배경 | `bg-[var(--primary-soft)]` |
| `src/app/globals.css` (`.link-primary:hover`) | 링크 hover 배경 | `background-color: var(--primary-soft)` |
| `src/components/ProductCatalogSection.tsx` | 카테고리 탭 선택 시 chip 배경 | `bg-[var(--primary-soft)]` + `text-[var(--primary)]` |
| `src/components/ProductCatalogSection.tsx` | 테마 탭 선택 시 chip 배경 | `bg-[var(--primary-soft)]` + `text-[var(--primary)]` |

- **secondary-soft**: 네이비 계열 연한 강조가 필요한 영역(예: 선택된 보조 chip, 호버 영역)에서 `bg-[var(--secondary-soft)]` 로 사용 가능.

---

## 2. 공통 컴포넌트(variants) 요약

### Button (`buttonVariants`)

- **primary**: `bg-[var(--primary)]` / `hover:bg-[var(--primary-hover)]` / text white  
- **secondary**: `bg-[var(--secondary)]` / `hover:bg-[var(--secondary-hover)]` / text white  
- **outline**: `border-[var(--border-strong)]` / `text-[var(--foreground)]` / `hover:bg-[var(--surface-muted)]`  
- **ghost**: `text-[var(--foreground)]` / `hover:bg-[var(--surface-muted)]`  
- **kakao**: 기존 카카오 토큰 유지  
- 높이: sm 36px, md 44px, lg 52px  
- radius: 12px (`rounded-xl`)  
- focus-visible: `ring-[3px]` `ring-[var(--focus-ring)]`  
- disabled: opacity-50, pointer-events-none  
- active: `translate-y-px`

### Input / Textarea / Select

- bg: `--surface`, border: `--border`, hover: `--border-strong`  
- focus-visible: border `--primary`, ring 3px `--focus-ring`  
- placeholder: `--text-subtle`  
- error: border/ring `--danger`  
- disabled: bg `--surface-muted`, text `--text-subtle`  
- Input/Select 기본 높이: 44px (`h-11`)

### Card

- **default**: `border-[var(--border)]` / `bg-[var(--surface)]` / `shadow-[var(--shadow-soft)]` / rounded-2xl  
- **elevated**: `bg-[var(--surface-elevated)]` / shadow-soft-strong  
- **interactive**: default + hover 시 `border-[var(--border-strong)]` / shadow-soft-strong  
- **hero**: 네이비/사이트 토큰 유지

### Badge

- **neutral/default**: `bg-[var(--surface-muted)]` / `text-[var(--text-muted)]` / `border-[var(--divider)]`  
- **primary/blue**: `bg-[var(--primary-bg)]` / `text-[var(--primary)]`  
- **premium/gold**: `bg-[var(--secondary)]` / text white  
- **success/warning/danger**: 각 `*-bg` / 해당 상태 컬러

### 링크

- `.link-primary`: color `--primary`, hover `--primary-hover` + underline, visited 동일 유지

### 모달/팝오버

- container: `bg-[var(--surface-elevated)]`, `shadow-[var(--shadow-modal)]`, `border-[var(--border)]`, rounded-2xl  
- backdrop: `bg-[var(--overlay)]`  
- header/footer 구분: `border-[var(--divider)]` 사용 권장

---

## 3. 하드코딩 제거·잔여 목록

### 이번에 제거한 항목

- `GuideDetailBody`: bg-white, ring-slate-200, border-slate-200, bg-slate-50, text-slate-*, #1E3A8A  
- `OptionPanel`: border-[#dbeafe], bg-white, ring-[#dbeafe]  
- `ProductDetailV2`: border-[#dbeafe], bg-[#f8fbff], ring-[#dbeafe]  
- `support/notices/[id]`: border-slate-200, border-slate-300, bg-white, text-content-secondary, hover:bg-slate-50  
- `HomeTopBanner`: ring-[#dbeafe], bg-white / bg-white/50  

### 잔여(추가 교체 권장)

- **AdminProductManager.tsx**:  
  - `bg-[#f8fbff]`, `ring-[#dbeafe]` → `bg-[var(--surface-muted)]`, `ring-[var(--border)]`  
  - `border-slate-*`, `bg-white`, `text-slate-*` → `border-[var(--border)]`, `bg-[var(--surface)]`, `text-[var(--foreground)]` / `--text-muted`  
  - `focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]` → `focus:border-[var(--primary)] focus:ring-[3px] focus:ring-[var(--focus-ring)]`  
- **GuideNotionModal.tsx**: iframe 등 `bg-white` → `bg-[var(--surface)]` (필요 시)  
- **HomeProductSlider.tsx**: Badge variant blue/gold 이미 토큰 Badge 사용 중  
- 기타 admin/폼 컴포넌트: 동일 패턴으로 `Input`/`Select`/`Button` + 토큰 클래스로 점진 교체

---

## 4. 대표 화면 3곳 Before/After 요약

### (1) 홈 — 밝기·CTA·프리미엄

- **Before**: 히어로/카드 등 부분적으로 하드코딩 색상 혼재.  
- **After**: 전역 `:root` 토큰(오프화이트 배경, primary 블루, secondary 네이비) 적용. 버튼은 `Button` primary/secondary 사용 시 통일. TopBanner 인디케이터·링은 `--surface`/`--border` 사용.

### (2) 가이드 카드/상세(GuideDetailBody)

- **Before**: `bg-white`, `ring-slate-200`, 목차 `border-slate-200 bg-slate-50`, 링크 `text-slate-600 hover:text-[#1E3A8A]`, 버튼 `#1E3A8A` 등.  
- **After**: 섹션 `border-[var(--border)]` / `bg-[var(--surface)]` / `shadow-[var(--shadow-soft)]`, 목차 `--border` / `--surface-muted`, 링크 `.link-primary`, 원문 버튼 `--primary` / `--primary-hover`. 가독성·프리미엄 톤 유지.

### (3) 모달(ConsultModal / Modal / GuideNotionModal)

- **Before**: 이미 `--overlay`, `--surface-elevated`, `--shadow-modal` 사용.  
- **After**: 동일 토큰 유지. Alert/인라인 안내는 AlertCard success/danger 포함, title `--foreground`, 본문 `--text-muted`.  
- 노션 모달 내부 iframe 등은 필요 시 `--surface` 적용 가능(잔여 목록 참고).

---

## 5. 체크리스트(품질 검증)

- [x] **전체 밝기**: 오프화이트(`--theall-page-bg` #fafafa) 기반, 눈부심 완화  
- [x] **CTA 대비**: primary 버튼 `--primary`(선명 블루), secondary 네이비로 즉시 구분  
- [x] **프리미엄 톤**: secondary `--secondary`(네이비) 보조 액션, 카드/보더 뉴트럴 톤  
- [x] **입력폼 포커스**: Input/Textarea/Select 공통 focus-visible ring 3px + `--focus-ring`  
- [x] **다크 모드**: `.dark` 토큰 동일 구조, 대비·레이어 정상 동작(SubHeader 토글 유지)

---

*문서 기준: UI 컴포넌트 스펙 토큰 적용 작업*

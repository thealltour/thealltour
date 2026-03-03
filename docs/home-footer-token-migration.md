# 홈·푸터 토큰 마이그레이션 산출물

## 1. 변경 파일 목록 (홈 섹션 / 푸터 관련)

| 파일 | 변경 요약 |
|------|------------|
| `src/app/page.tsx` | 히어로 오버레이·그림자·링 토큰화, Trust/Golf/Curated/Contact 전부 라이트 토큰(--surface, --foreground, --text-muted, --border, --divider) 적용, CuratedBlock 라이트 토큰·오버레이 클래스 적용 |
| `src/components/GlobalSiteFooter.tsx` | 배경/테두리/텍스트 전부 토큰 적용, pill 링크를 `.footer-pill` / `.footer-pill-cta` 재사용 클래스로 통일 |
| `src/app/globals.css` | 히어로·이미지 오버레이 토큰 추가(--hero-*, --overlay-*), 오버레이 그라데이션 유틸 클래스(hero-vignette, image-overlay-bottom, overlay-radial-*), 푸터 pill(.footer-pill, .footer-pill-cta), --on-primary 및 .page-hero/.btn-admin-* 색상 토큰화 |

---

## 2. 토큰 미적용 잔여 하드코딩 리스트 (홈/푸터 범위)

- **없음.**  
  홈 페이지와 푸터에서 hex / rgb(a) / tailwind 색상(slate, white, black, indigo 등) 하드코딩은 제거되었고, 모두 `var(--...)` 또는 globals.css에 정의된 유틸 클래스로 연결되어 있습니다.

- **의도적 예외**  
  - **히어로 섹션(유일한 다크 앵커)**  
    - `--site-bg`, `--site-text-primary`, `--site-accent`, `--site-border` 등 “네이비 섹션용” 토큰만 사용.  
    - 그라데이션/비네트/웜 오버레이는 `--hero-*`, `--overlay-*` 및 `.hero-vignette`, `.hero-overlay-warm`, `.image-overlay-bottom` 등 토큰 기반 클래스로 처리.  
  - **globals.css 내부**  
    - `:root` / `.dark` 안의 토큰 **정의**는 디자인 시스템 소스이므로 hex/rgba 유지.

---

## 3. 홈/푸터 주요 영역 Before → After 요약

### 3-1. 히어로 섹션

| 항목 | Before | After |
|------|--------|--------|
| 섹션 그림자 | `shadow-xl` | `shadow-[var(--shadow-soft-strong)]` |
| 웜 오버레이 | `from-[rgba(248,196,113,0.26)]` 등 | `.hero-overlay-warm` (토큰 `--hero-overlay-warm-*`) |
| 비네트 | `rgba(2,6,23,0.85)`, `rgba(148,163,184,0.26)` | `.hero-vignette`, `.hero-vignette-soft` (토큰 `--hero-vignette-*`) |
| 모바일 이미지 오버레이 | `from-black/45`, `text-white` | `.image-overlay-bottom` (토큰 `--overlay-image-*`), `text-[var(--site-text-primary)]` |
| 뱃지 pill | `bg-white/10`, `ring-white/10`, `ring-white/20` | `bg-[var(--hero-badge-bg)]`, `ring-[var(--hero-badge-border)]` |

### 3-2. 신뢰 섹션 (THEALL TOUR TRUST)

| 항목 | Before | After |
|------|--------|--------|
| 섹션 배경/링 | `--site-bg-section`, `--site-border` | `bg-[var(--surface-muted)]`, `ring-[var(--border)]` |
| 카드 | `--site-bg-elevated`, `text-site-*`, `--site-accent` 아이콘 | `bg-[var(--surface)]`, `text-[var(--foreground)]` / `text-[var(--text-muted)]`, 아이콘 `text-[var(--primary)]`, `shadow-[var(--shadow-soft)]`, `ring-[var(--border)]` |
| 뱃지 | 골드 테두리/배경 | `border-[var(--border-strong)]`, `bg-[var(--surface)]`, `text-[var(--foreground)]` |

### 3-3. 골프 컬렉션·커리케이션·컨택트 섹션

| 항목 | Before | After |
|------|--------|--------|
| 섹션 배경 | `--site-bg-section` | `bg-[var(--surface-muted)]`, `ring-[var(--border)]` |
| 카드/링크 카드 | `--site-bg-elevated`, `--site-text-primary`, 그라데이션 hex 기반 | `bg-[var(--surface)]`, `text-[var(--foreground)]`, 그라데이션 `from-[var(--surface-muted)]` 등, 호버 `shadow-[var(--shadow-soft-strong)]`, `ring-[var(--border-strong)]` |
| 라디얼 오버레이 | `rgba(184,150,46,0.16)` 등 | `.overlay-radial-gold`, `.overlay-radial-blue`, `.overlay-radial-green` (토큰 `--overlay-accent-*`) |
| 전체 패키지 보기 버튼 | `--site-accent` border/bg | `border-[var(--border-strong)]`, `bg-[var(--surface-muted)]`, `text-[var(--foreground)]`, `text-[var(--primary)]`, focus-visible `ring-[var(--focus-ring)]` |

### 3-4. CuratedBlock (추천 상품 카드)

| 항목 | Before | After |
|------|--------|--------|
| 블록/카드 배경·텍스트 | `--site-bg-elevated`, `--site-bg`, `site-text-primary` 등 | `bg-[var(--surface)]`, `text-[var(--foreground)]`, `text-[var(--text-muted)]` |
| 이미지 오버레이 | `from-[var(--site-bg)]/70`, `rgba(30,58,138,0.14)` | `from-[var(--overlay)]`, `.overlay-radial-blue-subtle` |
| 뱃지 | `bg-white/10`, `ring-white/20`, `bg-[var(--site-bg-section)]` | `bg-[var(--surface-muted)]`, `ring-[var(--border)]`, `text-[var(--foreground)]` / `text-[var(--text-muted)]` |

### 3-5. 푸터

| 항목 | Before | After |
|------|--------|--------|
| 푸터 배경·구분선 | `bg-[#0B1220]`, `border-[rgba(184,150,46,0.32)]` | `bg-[var(--surface-muted)]`, `border-[var(--divider)]` |
| 본문 텍스트 | `text-site-primary`, `text-site-secondary` | `text-[var(--foreground)]`, `text-[var(--text-muted)]`, 보조 `text-[var(--text-subtle)]` |
| pill 버튼(대표번호, 이메일, 이용약관 등) | `bg-[#111827]`, `hover:bg-[#1f2937]`, `border-site-border` | `.footer-pill`: `bg-[var(--surface)]`, `border-[var(--border)]`, `text-[var(--text-muted)]`, hover `bg-[var(--surface-muted)]`, `border-[var(--border-strong)]`, `text-[var(--foreground)]`, focus-visible `ring-[var(--focus-ring)]` |
| 카카오채널 / 인스타 | `#facc15`, `#fef9c3`, `#c4b5fd` 등 | 카카오: `.footer-pill-cta` (--primary-soft, --primary). 인스타: `.footer-pill` (동일 neutral 규격) |
| 하단 저작권 | `text-site-muted` | `text-[var(--text-subtle)]` |

---

## 4. Footer 재사용 구조 정리

- **공통 클래스 (globals.css)**  
  - `.footer-pill`: 기본 pill 스타일  
    - `bg: var(--surface)`, `border: var(--border)`, `color: var(--text-muted)`  
    - hover: `bg: var(--surface-muted)`, `border: var(--border-strong)`, `color: var(--foreground)`  
    - focus-visible: `box-shadow: 0 0 0 3px var(--focus-ring)`  
  - `.footer-pill-cta`: CTA용 변형  
    - `border: var(--primary)`, `background: var(--primary-soft)`, `color: var(--primary)`  
    - hover: `background: var(--primary-bg)`, `border: var(--primary-hover)`, `color: var(--primary-hover)`  
    - focus-visible: 동일 3px ring

- **컴포넌트**  
  - `GlobalSiteFooter.tsx`에서 상수 `footerPillClass`, `footerPillCtaClass`로 위 클래스만 참조.  
  - 대표번호·이메일·이용약관·개인정보처리방침·인스타: `footerPillClass`  
  - 카카오채널: `footerPillCtaClass`  
  - 새 pill 링크 추가 시 동일 클래스만 붙이면 라이트/다크 모두 토큰에 따라 일관 동작.

---

## 5. 다크 앵커 섹션 (1개만 유지)

- **유일한 다크 섹션**: 히어로만 `--site-bg`, `--site-text-primary`, `--site-accent`, `--site-border` 사용.  
- Trust / 골프 컬렉션 / Curated / Contact는 모두 **라이트 토큰** (`--surface`, --surface-muted`, `--foreground`, `--text-muted`, `--border`, `--divider`, `--primary`)으로 통일하여, 라이트 모드에서는 밝고, 다크 모드에서는 `.dark` 토큰으로 자동 대응.

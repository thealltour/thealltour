# 컬러 토큰 점검 보고서 — 밝은 UI(아고다/클룩 스타일) 전환

## 1. 현재 구조 문제점

### 1.1 `:root` (라이트) — 이미 라이트 기반이지만 개선 여지 있음

| 항목 | 현재 상태 | 문제점 |
|------|-----------|--------|
| **background / foreground** | `--bg`(#e9eef5), `--foreground`→`--text-primary`(#0f172a) | 페이지 배경이 청회색이라 아고다/클룩처럼 "밝은 흰색 계열"이 아님. 포그라운드 구조는 명확함. |
| **surface / card / elevated** | `--surface`=#fff, `--surface-muted`=#f3f6fb, card/card-muted 별칭만 존재 | **elevated 레이어 없음** — 모달·드롭다운·플로팅 카드용 "한 단계 더 뜬" 레이어가 없어 shadow만으로 구분 중. |
| **border / divider** | `--border`(#d9e1ec), `--border-strong`(#c4d0e2) | 구분선 전용 `--divider` 없음. 밝은 UI에서는 보통 border보다 더 연한 divider를 쓰는 경우가 많음. |
| **primary / secondary** | `--primary`(네이비 블루), 골드는 브랜드만 있고 시맨틱 토큰 없음 | primary는 라이트 UI에 적합. **secondary(보조 액션/강조)** 토큰이 없어 골드나 연한 블루를 쓸 때 일관성이 떨어짐. |
| **success / warning / error** | `--success`, `--warning`, `--danger`만 존재 | 상태 **배경용 토큰**(success-bg, warning-bg, danger-bg) 없음. 밝은 UI에서는 연한 배경+진한 텍스트 조합이 많음. |
| **shadow / overlay** | `--shadow-soft`(0.02), `--shadow-soft-strong`(0.06) | 라이트에서 그림자가 너무 약해 카드/버튼 입체감이 부족. **overlay(모달 딤)** 토큰 없음. |

### 1.2 `.dark` — 다크가 "기본 대비"로 설계됨

- 라이트를 기본으로 삼을 경우, `.dark`는 "선택 모드"로만 유지하면 됨.
- 현재 다크용 shadow/glass 값은 적절함. 라이트 전환 시 **기본은 :root 라이트 값**만 강화하면 됨.

### 1.3 `@theme inline` (Tailwind v4)

- `--color-background`, `--color-foreground`, `--color-primary`, content/site 계열만 매핑됨.
- **border, surface, card, muted, success, warning, danger** 등은 theme에 없어서 컴포넌트가 전부 `var(--border)` 형태로 사용 중. 통일을 위해 theme에 추가해 두면 유지보수에 유리함.

### 1.4 기타

- **Input/Textarea/Select**에서 `bg-white` 하드코딩 — 라이트 기준이면 `var(--surface)` 또는 `var(--card)`로 통일하는 편이 좋음.
- **AdminConfirmProvider** 모달: `shadow-[0_18px_55px_rgba(15,23,42,0.45)]` 하드코딩 — `--overlay` 또는 `--shadow-modal`로 대체 권장.

---

## 2. 밝은 UI 기준 추천 토큰 구조

아고다/클룩 스타일: **흰색·연한 회색 배경 + 명확한 카드 계층 + 부드러운 shadow + 상태 컬러 연한 배경**.

```
레이어
├── page (배경)     — 밝은 흰색~연한 회색 (--bg)
├── surface        — 카드/패널 기본 (--surface, --card)
├── surface-muted  — 보조 패널/비활성 영역 (--surface-muted, --card-muted)
├── elevated       — 모달/드롭다운/플로팅 (--surface-elevated) [신규]
└── glass          — 유지 (--glass-surface, --glass-border)

텍스트
├── text-primary   — 본문 제목/강조
├── text-secondary — 본문 보조
└── text-muted     — 캡션/비활성

경계
├── border         — 일반 테두리
├── border-strong  — 강조 테두리/포커스
└── divider       — 구분선만 (선택, border보다 연하게) [신규]

브랜드
├── primary / primary-hover
├── secondary / secondary-hover  [신규, 골드 또는 연한 블루]
└── brand / brand-strong (기존 별칭 유지)

상태
├── success / success-bg [신규]
├── warning / warning-bg [신규]
├── danger / danger-bg   [신규]

시각 효과
├── shadow-sm / shadow / shadow-lg (또는 shadow-soft, shadow-soft-strong 강화)
└── overlay [신규] — 모달 백드롭
```

---

## 3. 교체·추가해야 할 토큰 목록

### 3.1 `:root`에서 변경

| 토큰 | 현재 | 제안 (밝은 UI) |
|------|------|-----------------|
| `--theall-page-bg` | #e9eef5 | #f8fafc 또는 #f1f5f9 (더 밝은 배경) |
| `--shadow-soft` | rgba(15,23,42,0.02) | 0.04~0.06 (카드 입체감) |
| `--shadow-soft-strong` | 0.06 | 0.08~0.12 |

### 3.2 `:root`에서 추가

| 토큰 | 제안값 | 용도 |
|------|--------|------|
| `--surface-elevated` | #ffffff | 모달/드롭다운 |
| `--divider` | #e2e8f0 또는 var(--border) | 구분선 |
| `--secondary` | #b8962e (골드) 또는 연한 블루 | 보조 액션 |
| `--secondary-hover` | 어두운 골드/블루 | hover |
| `--success-bg` | rgba(22,163,74,0.12) | 성공 영역 배경 |
| `--warning-bg` | rgba(245,158,11,0.12) | 경고 영역 배경 |
| `--danger-bg` | rgba(220,38,38,0.08) | 에러 영역 배경 |
| `--overlay` | rgba(15,23,42,0.25) | 모달 백드롭 |
| `--shadow-modal` | 0 25px 50px rgba(15,23,42,0.15) | 모달 그림자 |

### 3.3 `.dark` 유지

- 구조는 그대로 두고, 필요 시 `--surface-elevated`, `--divider`, `--overlay`, `--*-bg`만 동일한 이름으로 다크 값 정의.

### 3.4 `@theme inline` 추가 권장

- `--color-border`, `--color-surface`, `--color-card`, `--color-muted`, `--color-success`, `--color-warning`, `--color-danger` 등으로 매핑하면 Tailwind 유틸과 컴포넌트에서 통일 사용 가능.

---

## 4. 적용 완료 사항 (`src/app/globals.css`)

- **:root**: `--theall-page-bg` → #f8fafc, `--theall-card-muted-bg` → #f1f5f9, `--theall-card-border` → #e2e8f0. `--surface-elevated`, `--divider`, `--secondary`/`--secondary-hover`, `--success-bg`/`--warning-bg`/`--danger-bg`, `--shadow-soft`/`--shadow-soft-strong` 강화, `--shadow-modal`, `--overlay` 추가.
- **.dark**: 위 신규 토큰에 대응하는 다크 값 추가.
- **@theme inline**: `--color-border`, `--color-surface`, `--color-surface-muted`, `--color-surface-elevated`, `--color-card`, `--color-card-muted`, `--color-muted`, `--color-secondary`, `--color-success`, `--color-warning`, `--color-danger` 매핑 추가.
- **.surface-card**: `box-shadow`를 `--shadow-soft` / `--shadow-soft-strong` 사용으로 변경해 밝은 UI에서 카드 입체감 확보.

모달(AdminConfirmProvider)에서 `--overlay` / `--shadow-modal` 사용으로 교체하려면 해당 컴포넌트의 인라인 shadow를 `var(--shadow-modal)` 등으로 바꾸면 됩니다.

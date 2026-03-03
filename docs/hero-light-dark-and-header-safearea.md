# 히어로 라이트/다크 전환 + 헤더 Safe Area 산출물

## 1) 히어로 섹션: 라이트 테마 전환

### 발견된 하드코딩 오버레이/필터 원인

- **섹션 배경**: `bg-[var(--site-bg)]` → 항상 네이비 `#0f172a`로 고정되어 라이트에서도 어두움.
- **메인 스크림**: `bg-gradient-to-r from-[var(--site-bg)] via-[var(--site-bg)]/96 via-[45%] to-transparent` → 왼쪽이 항상 네이비라 라이트 모드에서도 어두움.
- **중앙 블러**: `via-[var(--site-bg)]/38` → 동일하게 네이비 기반.
- **비네트**: `.hero-vignette` / `.hero-vignette-soft`가 `--hero-vignette-edge`, `--hero-vignette-soft`를 사용하지만, 이 토큰이 `:root`에서도 어두운 rgba로만 정의되어 있어 라이트에서도 어두운 비네트가 적용됨.
- **텍스트**: `--site-text-primary`, `--site-text-secondary`, `--site-accent` → 항상 “네이비 위의 밝은 텍스트”용이라 라이트 모드에서도 밝은 글자만 바뀌고 배경은 어두운 상태로 유지됨.
- **뱃지**: `--hero-badge-bg` / `--hero-badge-border`가 `:root`에서 흰색 반투명으로만 정의되어, 라이트 모드에서 대비가 약할 수 있음 → 라이트용으로 “검정 쪽 반투명”으로 재정의함.

### 수정된 코드

**globals.css**

- **:root (라이트)**  
  - `--hero-bg: var(--theall-page-bg)`  
  - `--hero-scrim-from: rgba(255, 255, 255, 0.88)`, `--hero-scrim-to: transparent`  
  - `--hero-text-primary: var(--foreground)`, `--hero-text-secondary: var(--text-muted)`, `--hero-accent: var(--primary)`  
  - `--hero-badge-bg: rgba(0, 0, 0, 0.06)`, `--hero-badge-border: rgba(0, 0, 0, 0.12)`  
  - `--hero-vignette-edge: rgba(255, 255, 255, 0.35)`, `--hero-vignette-soft: transparent`  
  - `--hero-overlay-warm-start/end`: 라이트용 연한 웜톤  
  - `--overlay-image-from/via`: 모바일 이미지 하단 오버레이 약하게 조정  

- **.dark**  
  - `--hero-bg: var(--site-bg)`  
  - `--hero-scrim-from: var(--site-bg)`, `--hero-scrim-to: transparent`  
  - `--hero-text-primary/secondary/accent`: `--site-text-*`, `--site-accent`  
  - `--hero-badge-*`, `--hero-vignette-*`, `--hero-overlay-warm-*`, `--overlay-image-*`: 다크용으로 재정의  

- **새 유틸 클래스**  
  - `.hero-scrim`: `linear-gradient(to right, var(--hero-scrim-from) 0%, var(--hero-scrim-from) 45%, var(--hero-scrim-to) 100%)`  
  - 기존 `.hero-overlay-warm`, `.hero-vignette`, `.hero-vignette-soft`, `.image-overlay-bottom`는 위 토큰을 참조하도록 유지.

**page.tsx (히어로)**

- 섹션: `bg-[var(--hero-bg)]`, `text-[var(--hero-text-primary)]`, `ring-[var(--border)]`
- 데스크톱 메인 스크림: `from-[var(--site-bg)]` 그라데이션 제거 → `hero-scrim` 한 겹만 사용
- 중앙 블러: `via-[var(--hero-scrim-from)]/40`
- 모든 히어로 텍스트: `--hero-text-primary`, `--hero-text-secondary`, `--hero-accent`
- 뱃지: `--hero-badge-bg`, `--hero-badge-border`
- 모바일 캡션: `text-[var(--hero-text-primary)]`, `text-[var(--hero-text-secondary)]/90`

### :root / .dark에 추가·변경된 토큰 값 요약

| 토큰 | :root (라이트) | .dark |
|------|----------------|--------|
| `--hero-bg` | `var(--theall-page-bg)` | `var(--site-bg)` |
| `--hero-scrim-from` | `rgba(255, 255, 255, 0.88)` | `var(--site-bg)` |
| `--hero-scrim-to` | `transparent` | `transparent` |
| `--hero-text-primary` | `var(--foreground)` | `var(--site-text-primary)` |
| `--hero-text-secondary` | `var(--text-muted)` | `var(--site-text-secondary)` |
| `--hero-accent` | `var(--primary)` | `var(--site-accent)` |
| `--hero-badge-bg` | `rgba(0, 0, 0, 0.06)` | `rgba(255, 255, 255, 0.08)` |
| `--hero-badge-border` | `rgba(0, 0, 0, 0.12)` | `rgba(255, 255, 255, 0.12)` |
| `--hero-vignette-edge` | `rgba(255, 255, 255, 0.35)` | `rgba(2, 6, 23, 0.85)` |
| `--hero-vignette-soft` | `transparent` | `rgba(148, 163, 184, 0.26)` |
| `--hero-overlay-warm-start` | `rgba(255, 248, 240, 0.2)` | `rgba(248, 196, 113, 0.26)` |
| `--hero-overlay-warm-end` | `transparent` | `rgba(248, 196, 113, 0.08)` |
| `--overlay-image-from` | `rgba(0, 0, 0, 0.28)` | `rgba(0, 0, 0, 0.5)` |
| `--overlay-image-via` | `rgba(0, 0, 0, 0.04)` | `rgba(0, 0, 0, 0.08)` |

---

## 2) 헤더 짤림(Safe Area) 해결

### 짤림 원인 요약

- **환경**: iOS Safari 등에서 노치·다이나믹 아일랜드·상태바 영역이 뷰포트 상단을 차지하는데, 헤더가 `top: 0`에 붙어 있어서 그 아래로 콘텐츠가 들어가 상단이 가려짐.
- **브라우저**: `env(safe-area-inset-top)`을 쓰려면 뷰포트 메타에 `viewport-fit=cover` 필요. (이미 `layout.tsx`에 설정됨.)
- **기존 대응**: `pt-[max(0px,env(safe-area-inset-top))]`를 Tailwind로 주고 있었으나, 빌드/버전에 따라 arbitrary value가 기대대로 적용되지 않을 수 있음.

### SiteHeaderUI.tsx 수정

- **sticky 유지**: `sticky top-0 z-40` 그대로 사용 (fixed 미사용).
- **Safe area**: Tailwind arbitrary 대신 **globals.css**에 정의한 `.header-safe-top` 사용.
  - `padding-top: env(safe-area-inset-top, 0px);`
- **헤더 마크업**:  
  `className`에 `header-safe-top` 추가하고, 기존 `pt-[max(0px,env(safe-area-inset-top))]` 제거.

```tsx
<header
  className={cn(
    "sticky top-0 z-40 min-h-[3.5rem] transition-all duration-200 header-safe-top",
    scrolled
      ? "border-b border-[var(--divider)] bg-[var(--surface)] ..."
      : "bg-[var(--theall-page-bg)]",
  )}
>
```

- **내부 행 높이**: 모바일 `HeaderMobileShell`은 `h-14`(56px) 유지. safe-area 패딩은 헤더 래퍼에만 적용되어, 노치 영역은 헤더 배경색으로 채워지고 그 아래에 56px 행이 오도록 함.

### 관련 레이아웃(overflow / z-index)

- **overflow**: `layout.tsx`의 `body` / `div.flex-1`에는 `overflow-hidden`·`overflow-clip` 없음. 헤더 짤림 원인으로 보이지 않음.
- **z-index**: 헤더 `z-40`, 드로어·검색 드롭다운·모달 등은 `z-50`. 겹칠 때 헤더가 가려지는 구조이므로, 노치 쪽 “빈 공간”이 잘리는 현상과는 무관.

### globals.css 추가

```css
.header-safe-top {
  padding-top: env(safe-area-inset-top, 0px);
}
```

- iOS Safari에서 `env(safe-area-inset-top)`이 적용되는지 확인하려면:  
  노치 있는 기기/시뮬레이터에서 홈 로드 후, 헤더 맨 위(로고·브랜드명)가 노치 바로 아래에서 시작하는지 보면 됨.  
  개발자 도구에서 `<header>`의 `padding-top` 계산값이 0이 아닌지 확인해도 됨.

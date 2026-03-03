# 모바일 Sticky 헤더 짤림 해결 — 원인·수정·확인

## 1. 짤림 원인 (코드 기준)

### 1) Safe-area 미반영
- **원인**: 헤더에 `padding-top: env(safe-area-inset-top)`이 없거나, Tailwind arbitrary `pt-[env(safe-area-inset-top)]`만 사용되어 빌드/환경에 따라 적용이 누락되거나, `env()` 미지원 시 fallback이 없었음.
- **결과**: iOS Safari 등에서 노치/다이나믹 아일랜드 영역이 뷰포트 상단을 차지하는데, 헤더가 `top: 0`에 붙어 있어 상단이 노치 뒤로 들어가 짤려 보임.

### 2) 상위 overflow
- **확인 경로**: `body` → `ConsultModalProvider` → `div.flex-1` → `{children}`(페이지) → `div.min-h-screen` → `SiteHeader` → `<header>`.
- **결과**:  
  - `layout.tsx`: `body`, `div.flex-1`에 `overflow-hidden` / `overflow-clip` / `overflow-auto` 없음.  
  - `page.tsx`: 루트가 `div.min-h-screen`이고, 그 자식이 `SiteHeader`와 `main`. `overflow-hidden`은 `main` 안의 섹션/카드에만 있음.  
  → **헤더를 감싸는 상위에는 overflow가 없어, overflow로 인한 짤림 원인 없음.**

### 3) Sticky 구조
- **현재**: `<header className="sticky top-0 z-40 ...">`. 스크롤 컨테이너는 뷰포트이며, 헤더의 containing block도 뷰포트.
- **결과**: sticky 자체가 원인은 아님. 다만 `top: 0`이면 “뷰포트 최상단”에 붙는데, 그 최상단이 iOS에서는 노치 아래가 아니라 노치 포함 영역이라, 패딩 없으면 콘텐츠가 노치에 가려짐.

### 4) z-index·stacking context
- **헤더**: `z-40`, 스크롤 시 `backdrop-blur-sm` 적용(헤더 자신).
- **드로어/모달**: `z-50` (MobileFloatingMenu, 검색 드롭다운 등).
- **결과**: 헤더는 드로어보다 아래, 일반 컨텐츠보다 위로 유지됨. `backdrop-blur-sm`은 헤더에만 있어 상위에 transform/filter로 인한 stacking 꼬임 없음.

---

## 2. SiteHeaderUI.tsx 수정 코드

**변경 요약**
- `header-safe-top` 제거 후 **`safe-top`** 단일 클래스 사용.
- safe-area는 **globals.css**의 `.safe-top`에서 `padding-top: max(0px, env(safe-area-inset-top))`로 적용(fallback 포함).

```tsx
<header
  className={cn(
    "sticky top-0 z-40 min-h-[3.5rem] transition-all duration-200 safe-top",
    scrolled
      ? "border-b border-[var(--divider)] bg-[var(--surface)] shadow-[var(--shadow-soft)] backdrop-blur-sm"
      : "bg-[var(--theall-page-bg)]",
  )}
>
  {/* 데스크톱 영역 */}
  <HeaderMobileShell ... />  <!-- 내부 h-14(56px) 유지 -->
  <MobileFloatingMenu ... />
</header>
```

- **sticky** 유지.
- **safe-area**: 헤더 래퍼에만 `.safe-top`으로 패딩 적용. 내부 로우(모바일 `HeaderMobileShell`)는 `h-14`(56px) 그대로.

---

## 3. globals.css (safe-area 유틸)

```css
/* Sticky header: safe-area so content is not hidden under notch/address bar (iOS Safari 등) */
.safe-top {
  padding-top: max(0px, env(safe-area-inset-top));
}
/* 별칭 (기존 참조 호환) */
.header-safe-top {
  padding-top: max(0px, env(safe-area-inset-top));
}
```

- `max(0px, env(safe-area-inset-top))`: `env()` 미지원 또는 0일 때 0으로 fallback.

---

## 4. Layout wrapper 수정

- **필요 없음.**  
  `layout.tsx`의 `body`, `div.flex-1`에는 overflow/transform이 없고, 헤더 상위 경로에 overflow로 잘리는 구간이 없음.

---

## 5. 모바일(iOS Safari) 재현·해결 확인 방법

1. **뷰포트 메타**: `layout.tsx`에 `viewportFit: "cover"` 설정되어 있는지 확인 → `env(safe-area-inset-top)` 적용 조건.
2. **실기기/시뮬레이터**:  
   - 노치 있는 iPhone(iOS Safari)에서 홈 로드.  
   - 헤더 **맨 위(로고·브랜드명·햄버거)**가 노치 바로 아래에서 시작하는지 확인.  
   - 상단이 노치에 들어가지 않으면 해결된 것.
3. **개발자 도구**:  
   - `<header>` 선택 후 Computed에서 `padding-top`이 0이 아닌 값(예: 47px)인지 확인.  
   - 노치 없는 환경이면 0px이면 정상.
4. **스크롤**:  
   - 스크롤 시 헤더가 상단에 붙을 때도 safe-area 패딩이 유지되는지(노치 구간이 헤더 배경색으로 채워지는지) 확인.

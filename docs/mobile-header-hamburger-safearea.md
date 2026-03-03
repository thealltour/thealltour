# 모바일 헤더·햄버거 토큰 및 Safe Area 산출물

## 1. 수정된 파일 목록 (모바일 헤더/햄버거 관련)

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/HeaderMobileShell.tsx` | 햄버거 버튼 ghost 스타일 + focus ring 3px, 토큰만 사용 |
| `src/components/SiteHeaderUI.tsx` | sticky 헤더에 safe-area 보정 적용 (`pt-[max(0px,env(safe-area-inset-top))]`, `min-h-[3.5rem]`) |
| `src/components/HeroQuickConsultButton.tsx` | 홈 컨택트 섹션 CTA·모달 제출 버튼·토스트 색상 하드코딩 제거, 토큰 적용 |
| `docs/mobile-header-hamburger-safearea.md` | 본 산출물 문서 |

---

## 2. 헤더 방식: **sticky** (fixed 아님)

- **현재 구조**: `<header className="sticky top-0 z-40 ...">`  
  → 스크롤 시 문서 흐름 안에서 상단에 붙는 **sticky** 방식입니다.
- **고정(fixed)이 아닌 이유**:  
  sticky는 레이아웃 공간을 유지하므로 본문에 별도 `padding-top` 보정이 필요 없고, 주소창 축소/확대로 뷰포트가 바뀌어도 레이아웃이 깨지지 않습니다.

### 반영된 코드 (SiteHeaderUI.tsx)

```tsx
<header
  className={cn(
    "sticky top-0 z-40 min-h-[3.5rem] transition-all duration-200",
    "pt-[max(0px,env(safe-area-inset-top))]",
    scrolled
      ? "border-b border-[var(--divider)] bg-[var(--surface)] shadow-[var(--shadow-soft)] backdrop-blur-sm"
      : "bg-[var(--theall-page-bg)]",
  )}
>
  {/* 데스크톱 영역 */}
  {/* 모바일: HeaderMobileShell (h-14 = 56px) */}
</header>
```

- **padding-top**: `max(0px, env(safe-area-inset-top))`  
  - 노치/다이나믹 아일랜드가 있는 기기에서만 상단 여백이 생기고, 나머지는 0으로 유지됩니다.
- **배경**: `bg-[var(--theall-page-bg)]` / 스크롤 시 `bg-[var(--surface)]`  
  → 패딩 영역까지 같은 배경이 적용되어, safe area가 헤더 색으로 채워집니다.
- **내부 콘텐츠**: 모바일에서 `HeaderMobileShell`이 `h-14`(56px)로 유지되고, safe area는 **헤더 래퍼의 padding-top**으로만 처리됩니다.

---

## 3. iOS Safari 상단 가림 해결 확인 포인트

스크린샷 없이 확인할 수 있는 방법입니다.

1. **viewport 메타**  
   - `layout.tsx`에 `viewportFit: "cover"` 설정 여부 확인  
   → `env(safe-area-inset-top)`이 동작하려면 필요합니다.

2. **개발자 도구(Simulator)**  
   - iOS Safari 시뮬레이터에서 상단 노치/다이나믹 아일랜드 있는 기기 선택  
   - 페이지 로드 후 헤더 **맨 위 텍스트/로고**가 노치에 들어가지 않고 그 아래부터 시작하는지 확인.

3. **실기기**  
   - iPhone(iOS Safari)에서 홈 접속  
   - 주소창을 최대한 내린 상태에서 헤더 상단이 잘리지 않는지 확인.

4. **상위 overflow**  
   - `body` 또는 헤더를 감싼 요소에 `overflow-hidden` / `overflow-clip`이 있으면 제거  
   → 현재 레이아웃에는 해당 없음.

---

## 4. 햄버거 버튼 Before / After

### Before (className)

- `border border-[var(--border)]`  
- `hover:bg-[var(--surface-muted)]`  
- `focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]`  
- 아이콘: `bg-[var(--foreground)]` (3개 막대 각각)

### After (className)

- **기본**: `bg-transparent`  
  → ghost 타입으로 배경 없음.
- **텍스트/아이콘**: `text-[var(--foreground)]`  
  → 막대는 `bg-current`로 부모 색 상속.
- **hover / pressed**: `hover:bg-[var(--surface-muted)]`  
  `active:bg-[var(--surface-muted)]`
- **focus-visible**: `focus-visible:outline-none`  
  `focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]`  
  → 3px 링, 색상은 `--focus-ring` 토큰.
- **disabled**: `disabled:pointer-events-none disabled:opacity-50`  
  (현재 DOM에는 disabled 미사용이지만 규격으로 추가)

제거된 항목: `border`, `ring-2`(→ `ring-[3px]`로 변경).

---

## 5. 홈·푸터·히어로 토큰 적용 요약

- **홈 전체·푸터**: 이전 마이그레이션에서 `page.tsx`, `GlobalSiteFooter.tsx` 등에 토큰 적용 완료.  
  히어로 섹션은 `--site-bg`, `--site-text-primary`, `--hero-badge-bg`, `--hero-badge-border` 등으로만 구성되어 있으며, 사진에 나온 배너 영역 역시 동일 토큰으로만 렌더링됩니다.
- **HeroQuickConsultButton** (홈 컨택트 섹션):  
  - “1:1 상담 문의” 버튼:  
    `border-[var(--primary)]`, `bg-[var(--primary)]`, `text-[var(--on-primary)]`,  
    `hover:bg-[var(--primary-hover)]`, `focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]`  
  - 모달 내 “상담 신청” 버튼: 동일 토큰 체계.  
  - 토스트: `bg-[var(--success)]` / `bg-[var(--danger)]`, `text-[var(--on-primary)]`  
  → 홈에 노출되는 구간에서 hex/하드코딩 제거 완료.

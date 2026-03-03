# 모달/다이얼로그/드로어/팝오버 테마 토큰 통일 — 산출물

## 1. 적용 규칙

- **모달 컨테이너**: `background: var(--surface-elevated)`
- **모달 shadow**: `var(--shadow-modal)` (기존 `shadow-[0_18px_55px_...]` 등 하드코딩 제거)
- **백드롭(딤)**: `var(--overlay)` (rgba/black 하드코딩 제거)
- **z-index / 애니메이션**: 기존 유지, 색·그림자만 토큰으로 통일

---

## 2. 변경된 컴포넌트 목록

| 컴포넌트 | 변경 내용 |
|----------|------------|
| **AdminConfirmProvider.tsx** | (이미 적용됨) 백드롭 `--overlay`, 컨테이너 `--surface-elevated`, `--shadow-modal` |
| **ConsultModal.tsx** | 백드롭 `bg-[#020617]/75` → `bg-[var(--overlay)]` + backdrop-blur. 컨테이너 `bg-[#0F172A]` → `bg-[var(--surface-elevated)]`, `shadow-xl` → `shadow-[var(--shadow-modal)]`, border/텍스트/폼 입력 토큰화 |
| **HeaderQuickConsultCtas.tsx** | 동일: 백드롭 `--overlay`, 컨테이너 `--surface-elevated` + `--shadow-modal`, 폼/버튼 토큰 |
| **HeroQuickConsultButton.tsx** | 동일: 백드롭 `--overlay`, 컨테이너 `--surface-elevated` + `--shadow-modal`, 텍스트/닫기/제출 버튼 토큰 |
| **GuidePdfModal.tsx** | 백드롭 `bg-black/70` → `bg-[var(--overlay)]`. 컨테이너 `bg-white shadow-2xl` → `bg-[var(--surface-elevated)] shadow-[var(--shadow-modal)] ring-1 ring-[var(--border)]`. 헤더/링크/닫기 버튼 토큰 |
| **ProductImageGalleryModal.tsx** | 백드롭 `bg-black/70` → `bg-[var(--overlay)]`. 컨테이너 `bg-white shadow-2xl` → `bg-[var(--surface-elevated)] shadow-[var(--shadow-modal)] ring-1 ring-[var(--border)]`, 헤더 border/텍스트 토큰 |
| **ImageCollageModal.module.css** | `.backdrop` background → `var(--overlay)`. `.modal` background → `var(--surface-elevated)`, border → `var(--border)`, `box-shadow: var(--shadow-modal)` 추가 |
| **ThumbnailCropSelector.tsx** | 전체 배경 `bg-slate-900/95` → `bg-[var(--overlay)]`. 헤더·본문 영역 `bg-[var(--surface-elevated)]`, border/제목 텍스트 토큰 |
| **SignupForm.tsx** (약관/개인정보 모달) | 백드롭 `bg-slate-900/50` → `bg-[var(--overlay)]`. 컨테이너 `bg-white shadow-xl` → `bg-[var(--surface-elevated)] shadow-[var(--shadow-modal)] ring-1 ring-[var(--border)]`, 헤더/닫기/본문 텍스트 토큰 |

**팝오버** (이미 토큰 적용됨):

- **AdminNotificationBell.tsx** — 드롭다운 패널 `bg-[var(--surface-elevated)]`, `shadow-[var(--shadow-modal)]`, border 토큰

---

## 3. 공통 모달 스타일 유틸

### 3.1 CSS 클래스 (`src/app/globals.css`)

아래 클래스를 추가해 두었습니다. 기존 인라인 클래스 대신 조합해서 사용할 수 있습니다.

```css
.modal-backdrop {
  background: var(--overlay);
}
.modal-container {
  background: var(--surface-elevated);
  box-shadow: var(--shadow-modal);
  border: 1px solid var(--border);
}
```

**사용 예 (Tailwind와 함께)**

- 백드롭: `className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4"`
- 컨테이너: `className="modal-container rounded-2xl p-6 w-full max-w-md"`

필요 시 `backdrop-blur-[2px]` 등은 그대로 인라인으로 두면 됩니다.

### 3.2 공통 모달 컴포넌트 (`src/components/ui/Modal.tsx`)

테마 토큰을 쓰는 공통 모달 래퍼를 추가해 두었습니다. 새 모달은 이 컴포넌트를 사용하면 됩니다.

```tsx
"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** 백드롭 클릭 시 닫기 (기본 true) */
  closeOnBackdropClick?: boolean;
  /** 컨테이너 추가 클래스 (크기·패딩 등) */
  className?: string;
  /** role="dialog" 등 접근성용 */
  "aria-label"?: string;
};

export function Modal({
  isOpen,
  onClose,
  children,
  closeOnBackdropClick = true,
  className = "",
  "aria-label": ariaLabel,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-[2px]"
      onClick={closeOnBackdropClick ? onClose : undefined}
      role="presentation"
    >
      <div
        className={`rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-[var(--shadow-modal)] ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>
  );
}
```

- **백드롭**: `bg-[var(--overlay)]` + `backdrop-blur-[2px]`
- **컨테이너**: `bg-[var(--surface-elevated)]`, `shadow-[var(--shadow-modal)]`, `border-[var(--border)]`
- z-index·레이아웃·Esc/백드롭 닫기는 유지, 색·그림자만 토큰 사용

**사용 예**: `<Modal isOpen={isOpen} onClose={() => setIsOpen(false)} aria-label="안내">...</Modal>`

기존 모달들을 한 번에 이 컴포넌트로 교체할 필요는 없고, 새로 만드는 모달부터 `Modal`을 사용하면 됩니다.

---

## 4. 미적용·예외

- **GuideNotionModal.tsx**: 전체 화면 네이비(`bg-[#0f172a]`) 전용이라, 이번 “모달 컨테이너/백드롭 토큰 통일” 대상에서 제외했습니다. 나중에 테마 전환 시 별도 처리 가능.
- **ProductImageGalleryModal** 내부: 탭(기본/콜라주), 네비 버튼 등은 기존대로 두었고, **컨테이너·백드롭·헤더**만 토큰 적용했습니다.
- **ImageCollageModal.module.css**: `.header`, `.navButton`, `.gridItem` 등 내부 border/background는 기존 rgba 유지(테마 토큰으로 확장 가능).

이 문서는 모달/다이얼로그/드로어/팝오버의 **배경·그림자·백드롭**을 테마 토큰으로 통일한 범위와, 공통 스타일/컴포넌트 제안을 정리한 산출물입니다.

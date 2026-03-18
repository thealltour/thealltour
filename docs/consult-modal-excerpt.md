# 글로벌 빠른 상담 모달(ConsultModal) 코드 발췌

사이트 내 모든 문의 버튼 클릭 시 공통으로 열리는 글로벌 '빠른 상담 모달' 관련 코드를,  
**모달 오픈 트리거 → 상태 전달 → 모달 렌더 → 제출 처리** 순으로 정리한 발췌본입니다.

---

## 1. 글로벌 빠른 상담 모달 컴포넌트 + 전역 상태(Context/Hook)

**파일 경로:** `src/components/ConsultModal.tsx`  
**관련:** `ConsultModalParams`, `ConsultModalContextValue`, `useConsultModal`, `ConsultModalProvider`, 폼 상태·제출·토스트

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Send, X } from "lucide-react";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import { trackReviewConversionInquiry } from "@/lib/reviewExperimentTracking";

export type ConsultModalParams = {
  productId?: string;
  productTitle?: string;
  sourcePath?: string;
};

type ConsultModalContextValue = {
  isOpen: boolean;
  openModal: (params?: ConsultModalParams) => void;
  closeModal: () => void;
};

const ConsultModalContext = createContext<ConsultModalContextValue | null>(null);

export function useConsultModal() {
  const ctx = useContext(ConsultModalContext);
  if (!ctx) {
    return {
      isOpen: false,
      openModal: () => {},
      closeModal: () => {},
    };
  }
  return ctx;
}

type QuickFormState = {
  name: string;
  phone: string;
  content: string;
};

const initialFormState: QuickFormState = {
  name: "",
  phone: "",
  content: "",
};

function formatPhoneInput(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function ConsultModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [params, setParams] = useState<ConsultModalParams>({});
  const [form, setForm] = useState<QuickFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const quoteCtx = useProductQuote();

  const openModal = useCallback((nextParams?: ConsultModalParams) => {
    setParams(nextParams ?? {});
    setForm(initialFormState);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const showToast = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!form.name.trim() || !form.phone.trim() || !form.content.trim()) {
        showToast("error", "이름, 연락처, 문의 내용을 모두 입력해 주세요.");
        return;
      }

      const selectedOptions = quoteCtx.selectedOptions ?? null;
      const quoteSummary = quoteCtx.quoteSummary ?? null;
      const hasOptionData =
        (selectedOptions && Object.keys(selectedOptions).length > 0) ||
        (quoteSummary && (quoteSummary.total != null || (quoteSummary.breakdown?.length ?? 0) > 0));

      const body: Record<string, unknown> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        content: form.content.trim(),
        product_id: params.productId?.trim() || undefined,
        product_title: params.productTitle?.trim() || undefined,
        source_path: params.sourcePath?.trim() || undefined,
      };
      if (hasOptionData) {
        if (selectedOptions && Object.keys(selectedOptions).length > 0) {
          body.selected_options = selectedOptions;
        }
        if (quoteSummary && (quoteSummary.total != null || (quoteSummary.breakdown?.length ?? 0) > 0)) {
          body.quote_summary = {
            total: quoteSummary.total,
            base_price: quoteSummary.basePrice,
            breakdown: quoteSummary.breakdown.map((b) => ({
              group_label: b.groupLabel,
              option_label: b.optionLabel,
              price_delta: b.priceDelta,
            })),
          };
        }
        body.inquired_at = new Date().toISOString();
      }

      setIsSubmitting(true);
      try {
        const response = await fetch("/api/inquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          showToast("error", "문의 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }

        if (params.productId) {
          trackReviewConversionInquiry(params.productId);
        }
        setForm(initialFormState);
        closeModal();
        showToast("success", "상담 요청이 접수되었습니다. 담당자가 곧 연락드립니다.");
      } catch {
        showToast("error", "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, params, closeModal, showToast, quoteCtx],
  );

  const value: ConsultModalContextValue = { isOpen, openModal, closeModal };

  return (
    <ConsultModalContext.Provider value={value}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[60] bg-[var(--overlay)] backdrop-blur-[2px]">
          <div className="flex min-h-full items-center justify-center px-4 py-6">
            <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 text-[var(--text-primary)] shadow-[var(--shadow-modal)]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-[var(--text-muted)]">
                    THEALL QUICK CONSULT
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)] md:text-2xl">
                    상담 문의하기
                  </h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)] md:text-sm">
                    간단한 정보만 남겨주시면, 전담 상담사가 순차적으로 연락드립니다.
                  </p>
                  {params.productTitle ? (
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      상품: {params.productTitle}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                  aria-label="상담 모달 닫기"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="flex flex-col gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  <label className="space-y-1.5">
                    <span>이름 *</span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="성함을 입력해 주세요"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                      required
                    />
                  </label>
                </div>
                <div className="flex flex-col gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  <label className="space-y-1.5">
                    <span>연락처 *</span>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, phone: formatPhoneInput(e.target.value) }))
                      }
                      placeholder="010-0000-0000"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                      required
                    />
                  </label>
                </div>
                <div className="flex flex-col gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  <label className="space-y-1.5">
                    <span>문의 내용 *</span>
                    <textarea
                      rows={4}
                      value={form.content}
                      onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                      placeholder="예: 5월 중 일본 골프 3박 4일, 4인 강습 포함 일정 희망"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                      required
                    />
                  </label>
                </div>
                <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-[10px] text-[var(--text-muted)] md:text-xs">
                    남겨주신 연락처로만 상담 연락을 드리며, 다른 용도로는 사용하지 않습니다.
                  </p>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full border border-[#60a5fa]/70 bg-gradient-to-r from-[#1d4ed8] to-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:border-[#93c5fd] hover:from-[#2563eb] hover:to-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Send className="h-4 w-4 opacity-90" strokeWidth={1.5} />
                      {isSubmitting ? "전송 중..." : "상담 신청"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {toast ? (
        <div className="fixed top-4 right-4 z-[70]">
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
              toast.kind === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </ConsultModalContext.Provider>
  );
}
```

---

## 2. Provider 배치 (전역에서 모달 사용 가능하도록)

**파일 경로:** `src/app/layout.tsx`  
**관련:** 루트 레이아웃에서 `ConsultModalProvider`로 앱 전체 감싸기

```tsx
// 발췌: body 내부
        <ConsultModalProvider>
          <div className="flex-1">{children}</div>
          <KakaoFloatingButton />
          <GlobalSiteFooter />
        </ConsultModalProvider>
```

- 상품 상세 페이지(`src/app/products/[id]/page.tsx`)에서는 동일 트리에서 `ConsultModalProvider`를 한 번 더 감싸고 있음 (필요 시 해당 페이지만 다른 설정을 쓸 수 있는 구조).

---

## 3. 모달 오픈 트리거 + 상품명/상품ID 등 컨텍스트 전달

모든 문의 버튼은 `useConsultModal()`의 `openModal(params?)`를 호출하며, `ConsultModalParams`로 `productId`, `productTitle`, `sourcePath`를 넘깁니다.

---

### 3-1. 상품 상세 · CTA (ProductConsultCTA)

**파일 경로:** `src/components/products/ProductConsultCTA.tsx`  
**함수:** `handlePrimary` → `openModal({ productId, productTitle, sourcePath })`

```tsx
  const { openModal } = useConsultModal();
  // ...
  const handlePrimary = () => {
    if (requiredGroupsMissing && scrollToOptions) {
      scrollToOptions();
      return;
    }
    if (isSoldOut && typeof window !== "undefined") {
      window.alert("마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.");
      return;
    }
    trackProductCtaClick({ productId, ctaType: "primary", section });
    onPrimaryClick?.();
    openModal({ productId, productTitle, sourcePath });
  };
```

- 상품 상세 상단/스티키/일정 등 문의 버튼이 이 컴포넌트를 쓰면 모두 위 트리거로 모달이 열립니다.

---

### 3-2. 상품 상세 · 요약 카드 문의하기 (ProductSummaryInfo)

**파일 경로:** `src/components/products/ProductSummaryInfo.tsx`  
**관련:** `productId`가 있을 때 버튼 클릭 → `openModal({ productId, productTitle, sourcePath })`

```tsx
  const { openModal } = useConsultModal();
  // ...
  {productId ? (
    <button
      type="button"
      onClick={() => openModal({ productId, productTitle, sourcePath })}
      className="..."
      aria-label="상품 문의하기"
    >
      문의하기
    </button>
  ) : consultHref ? ( ... ) : null}
```

- 상품 상세 상단 요약 카드의 「문의하기」가 모달을 띄우는 트리거입니다.

---

### 3-3. 상품 상세 히어로 (ProductDetailHero)

**파일 경로:** `src/components/ProductDetailHero.tsx`  
**관련:** 버튼 `onClick` → `openModal({ productId, productTitle, sourcePath })`

```tsx
  const { openModal } = useConsultModal();
  // ...
        <button
          type="button"
          onClick={() => openModal({ productId, productTitle, sourcePath })}
          className="type-btn inline-flex items-center justify-center rounded-xl bg-[#1E3A8A] px-5 py-3 text-white ..."
        >
          상담 문의하기
        </button>
```

---

### 3-4. 상품 상세 스티키 데스크탑/모바일 (ProductDetailSticky)

**파일 경로:** `src/components/ProductDetailSticky.tsx`  
**관련:** `ProductDetailStickyDesktop`, `ProductDetailStickyMobile` 내부 버튼

```tsx
  const { openModal } = useConsultModal();
  // Desktop
  <button
    type="button"
    onClick={() => openModal({ productId, productTitle, sourcePath })}
    className="..."
  >
    상담 문의하기
  </button>
  // Mobile
  <button
    type="button"
    onClick={() => openModal({ productId, productTitle, sourcePath })}
    className="..."
  >
    {compact ? "상담" : "상담 문의"}
  </button>
```

---

### 3-5. 모바일 플로팅 메뉴 (MobileFloatingMenu)

**파일 경로:** `src/components/MobileFloatingMenu.tsx`  
**함수:** `handleQuoteConsult` → 상품 없이 모달만 오픈

```tsx
  const { openModal } = useConsultModal();
  // ...
  function handleQuoteConsult() {
    triggerHapticFeedback();
    setIsOpen(false);
    setPendingKey(null);
    setPressedKey(null);
    openModal({
      productTitle: "패키지/골프 맞춤 상담",
      sourcePath: `${pathname || "/"}#mobile-menu-quote`,
    });
  }
```

---

### 3-6. 모바일 헤더 메뉴 (MobileHeaderMenu)

**파일 경로:** `src/components/header/MobileHeaderMenu.tsx`  
**관련:** 상담 문의 클릭 시 `openModal` 호출 (트래킹 후)

```tsx
  const { openModal } = useConsultModal();
  // 상담 문의 클릭 시
    openModal({
      productTitle: "패키지/골프 맞춤 상담",
      sourcePath: typeof window !== "undefined" ? `${window.location.pathname}#mobile-header-consult` : "",
    });
```

---

### 3-7. 상품 목록 히어로 (ProductsHero)

**파일 경로:** `src/components/ProductsHero.tsx`  
**함수:** `handleConsultCtaClick` — 모바일일 때만 모달, 데스크탑은 `/quote` 등으로 이동

```tsx
  const { openModal } = useConsultModal();
  function handleConsultCtaClick() {
    const isMobile = typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false;
    if (isMobile) {
      const query = searchParams.toString();
      openModal({
        productTitle: selectedOption?.label || (variant === "golf" ? "골프/파크골프 맞춤 일정" : "패키지 맞춤 일정"),
        sourcePath: query ? `${pathname}?${query}` : pathname,
      });
      return;
    }
    router.push(ctaHref);
  }
```

---

### 3-8. 상품 카탈로그 섹션 (ProductCatalogSection)

**파일 경로:** `src/components/ProductCatalogSection.tsx`  
**함수:** `handleProductConsult(product)` — 모바일에서 상품별로 모달 오픈

```tsx
  const { openModal } = useConsultModal();
  function handleProductConsult(product: Product) {
    const isMobile = typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false;
    if (isMobile) {
      const query = searchParams.toString();
      openModal({
        productId: product.id,
        productTitle: product.title,
        sourcePath: query ? `${pathname}?${query}` : pathname,
      });
      return;
    }
    router.push(`/quote?productId=${encodeURIComponent(product.id)}`);
  }
```

---

## 4. 제출 처리 요약 (ConsultModal 내부)

- **API:** `POST /api/inquiries`  
  - body: `name`, `phone`, `content`, `product_id`, `product_title`, `source_path`  
  - 옵션 선택 시: `selected_options`, `quote_summary`, `inquired_at` 추가 (ProductQuoteContext 사용)
- **유효성:** `name` / `phone` / `content` 모두 trim 후 비어 있으면 토스트 에러만 표시 후 return.
- **성공 시:**  
  - `params.productId`가 있으면 `trackReviewConversionInquiry(params.productId)` 호출  
  - 폼 초기화 → `closeModal()` → 성공 토스트  
- **실패 시:** 에러 토스트만 표시, 모달은 유지.

---

## 5. 제출 성공/실패 · 토스트 · 모달 닫기

**위치:** `src/components/ConsultModal.tsx` 내부

- **토스트 상태:** `toast: { kind: "success" | "error", message: string } | null`  
  - `showToast("success" | "error", message)` 호출 시 2.6초 후 자동으로 `setToast(null)`.
- **렌더:** `toast`가 있을 때 `fixed top-4 right-4 z-[70]`에 메시지 표시 (success: emerald, error: red).
- **모달 닫기:** 성공 시에만 `closeModal()` 호출. 실패 시에는 모달을 닫지 않고 토스트만 표시.

---

## 6. Analytics / Track 이벤트

**모달 제출 성공 시 (상품 문의 전환):**  
**파일 경로:** `src/lib/reviewExperimentTracking.ts`  
**함수:** `trackReviewConversionInquiry(productId, options?)`

```ts
export function trackReviewConversionInquiry(
  productId: string,
  options?: { experimentKey?: string; variant?: string },
): Promise<{ ok: boolean; error?: string }> {
  return sendEvent({
    productId,
    eventType: "product_inquiry",
    experimentKey: options?.experimentKey ?? "review_highlight_variant",
    variant: options?.variant ?? "control",
  });
}
```

- `ConsultModal`의 `handleSubmit`에서 API 성공 후 `params.productId`가 있을 때만 위 함수를 호출합니다.
- 그 외 문의 버튼 클릭 시에는 각 컴포넌트에서 `trackProductCtaClick` 등 별도 이벤트를 보내며, 모달 자체는 추가 track을 하지 않습니다.

---

## 7. 정리 (흐름)

| 단계 | 내용 |
|------|------|
| 1) 트리거 | 전역: `ConsultModalProvider` (layout). 각 문의 버튼에서 `useConsultModal().openModal(params)` 호출. |
| 2) 상태 전달 | `openModal({ productId?, productTitle?, sourcePath? })` → Provider 내부 `params` 상태에 저장. |
| 3) 모달 렌더 | `isOpen === true`일 때 오버레이 + 모달 박스 렌더. `params.productTitle` 있으면 "상품: {productTitle}" 표시. 폼: 이름/연락처/문의 내용 (모두 required). |
| 4) 제출 처리 | `handleSubmit` → `/api/inquiries` POST. 성공 시 `trackReviewConversionInquiry(productId)` → 폼 초기화 → `closeModal()` → 성공 토스트. 실패/예외 시 에러 토스트만. |

이 문서는 모달 개편 시 **수정 대상(ConsultModal.tsx)** 과 **모달을 여는 모든 진입점(위 트리거 목록)** 을 한 번에 보기 위한 발췌입니다.

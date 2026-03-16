# 모바일 Sticky CTA 스크롤 방향별 잘림 현상 — 코드 발췌

수정 없이 원인 분석용 발췌만 제공합니다.

---

## 1. ProductConsultCTA 전체 코드 발췌

**File:** `src/components/products/ProductConsultCTA.tsx`

```tsx
"use client";

import { useConsultModal } from "@/components/ConsultModal";
import { Button } from "@/components/ui/Button";
import { getProductCtaLabel, type ProductCtaStatus } from "@/lib/products/getProductCtaLabel";
import { trackProductCtaClick } from "@/lib/analytics/trackProductClick";

export type ProductConsultCTASection = "top" | "sticky" | "itinerary";

export type ProductConsultCTAProps = {
  productId: string;
  productTitle: string;
  sourcePath?: string;
  status?: ProductCtaStatus;
  kakaoHref?: string;
  section: ProductConsultCTASection;
  priceFormatted?: string | null;
  requiredGroupsMissing?: boolean;
  scrollToOptions?: () => void;
  isSoldOut?: boolean;
  copy?: string;
  subCopy?: string;
  className?: string;
  /** sticky에서 버튼만 compact 표시 */
  compact?: boolean;
  onPrimaryClick?: () => void;
  primaryLabel?: string;
  helperText?: string;
};

export function ProductConsultCTA({
  productId,
  productTitle,
  sourcePath = "",
  status,
  kakaoHref,
  section,
  priceFormatted,
  requiredGroupsMissing,
  scrollToOptions,
  isSoldOut,
  copy,
  subCopy,
  className = "",
  compact = false,
  onPrimaryClick,
  primaryLabel: primaryLabelOverride,
  helperText: helperTextOverride,
}: ProductConsultCTAProps) {
  const { openModal } = useConsultModal();
  const primaryLabel = primaryLabelOverride ?? getProductCtaLabel(status);

  const handlePrimary = () => { /* ... */ };
  const handleKakao = () => { /* ... */ };

  if (section === "sticky") {
    return (
      <div className={`flex h-11 w-full min-w-0 items-center gap-3 sm:gap-4 ${className}`}>
        <div className="flex shrink-0 flex-col justify-center" style={{ minWidth: "6rem" }}>
          {priceFormatted != null && priceFormatted !== "" ? (
            <>
              <span className="font-price-strong text-[1.0625rem] font-bold leading-tight text-[#1E3A8A]">
                ₩{priceFormatted}~
              </span>
              <span className="mt-0.5 text-[0.6875rem] text-slate-600">1인 기준</span>
            </>
          ) : (
            <span className="text-sm font-semibold text-slate-600">상담 후 안내</span>
          )}
        </div>
        <div className="flex h-11 min-w-0 shrink flex-1 items-center gap-2">
          <Button variant="primary" size="md" onClick={handlePrimary} className="h-11 min-h-11 flex-1 min-w-0 shrink-0 whitespace-nowrap">
            {isSoldOut ? "대기" : "예약 상담"}
          </Button>
          {kakaoHref && (
            <a href={kakaoHref} target="_blank" rel="noopener noreferrer" onClick={handleKakao} className="min-w-0 shrink">
              <Button variant="outline" size="md" className="h-11 min-h-11 w-full whitespace-nowrap">
                카카오톡 상담
              </Button>
            </a>
          )}
        </div>
      </div>
    );
  }
  // ... itinerary, top 분기 ...
}
```

**설명**

- **역할:** 상품 상세의 예약/카톡 CTA. `section === "sticky"`일 때 하단 Sticky 바용 한 줄 레이아웃(가격 + 버튼 2개)을 렌더합니다.
- **compact 사용:** `compact`는 props로 받지만 **`section === "sticky"` 분기 안에서는 전혀 사용하지 않습니다.**  
  - className 분기 없음, height/min-height 분기 없음, transform/translate/opacity/scale 없음.  
  - sticky일 때는 항상 `h-11`(44px) row, `gap-3 sm:gap-4`, 동일한 가격·버튼 UI만 렌더합니다.
- **sticky 전용 레이아웃:**  
  - 최상위: `flex h-11 w-full min-w-0 items-center gap-3 sm:gap-4`  
  - 가격 블록: `minWidth: "6rem"`, 고정 폰트 크기  
  - 버튼 영역: `flex h-11 ...`, 버튼 `h-11 min-h-11`  
- **motion/animation/transition:** 없음.
- **정리:** 스크롤 방향에 따른 잘림이 **ProductConsultCTA 내부**에서 compact나 height/transform으로 바뀌는 부분은 없습니다. 원인은 상위(ProductDetailStickyV2) 또는 뷰포트/측정 타이밍 쪽일 가능성이 큽니다.

---

## 2. ProductDetailStickyV2.tsx — compact 관련 로직 전체 발췌

**File:** `src/components/products/ProductDetailStickyV2.tsx`

```tsx
export function ProductDetailStickyV2Mobile({
  priceFormatted,
  productId,
  productTitle,
  sourcePath,
  kakaoHref,
  status = "AVAILABLE",
  experimentKey,
  variant,
}: ProductDetailStickyV2Props) {
  const { quoteSummary, requiredGroupsMissing, scrollToOptions } = useProductQuote();
  const isSoldOut = status === "SOLD_OUT";
  const [compact, setCompact] = useState(false);
  const lastScrollYRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayPrice = quoteSummary?.total != null
    ? formatPriceKR(quoteSummary.total)
    : priceFormatted;

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;
    const onScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;
      if (delta > 6) {
        setCompact(true);
      } else if (delta < -4) {
        setCompact(false);
      }
      lastScrollYRef.current = currentY;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setCompact(false), 240);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  /** CTA 바 실제 높이를 측정해 body 하단 여백(--cta-h)에 반영. ref + ResizeObserver 사용, 미표시(offsetHeight 0) 시 0 */
  const PADDING_TOP = 12;
  const PADDING_BOTTOM_BASE = 12;
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-mobile-cta", "on");
    const el = wrapperRef.current;
    const setCtaHeight = () => {
      const height = el && el.offsetHeight > 0 ? el.offsetHeight : 0;
      document.documentElement.style.setProperty("--cta-h", `${height}px`);
    };
    setCtaHeight();
    if (el && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(setCtaHeight);
      ro.observe(el);
      return () => {
        ro.disconnect();
        document.documentElement.removeAttribute("data-mobile-cta");
        document.documentElement.style.setProperty("--cta-h", "0px");
      };
    }
    return () => {
      document.documentElement.removeAttribute("data-mobile-cta");
      document.documentElement.style.setProperty("--cta-h", "0px");
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      role="banner"
      aria-label="상품 예약 상담"
      className="fixed left-0 right-0 bottom-0 z-50 box-border w-full border-t border-[var(--divider)] bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)] md:hidden"
      style={{
        paddingTop: `${PADDING_TOP}px`,
        paddingBottom: `calc(${PADDING_BOTTOM_BASE}px + env(safe-area-inset-bottom, 0px))`,
        paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
        paddingRight: "max(12px, env(safe-area-inset-right, 0px))",
      }}
    >
      <div className="mx-auto flex min-h-[44px] w-full max-w-[100%] items-center gap-3">
        <ProductConsultCTA
          productId={productId}
          productTitle={productTitle}
          sourcePath={sourcePath}
          status={status}
          kakaoHref={kakaoHref}
          section="sticky"
          priceFormatted={displayPrice}
          requiredGroupsMissing={requiredGroupsMissing}
          scrollToOptions={scrollToOptions}
          isSoldOut={isSoldOut}
          compact={compact}
          onPrimaryClick={() => trackReviewConversionCtaClick(productId, { experimentKey, variant })}
        />
      </div>
    </div>
  );
}
```

**설명**

- **역할:** 모바일 전용 하단 고정 CTA 바. wrapper 높이를 측정해 `--cta-h`로 설정하고, 내부에 ProductConsultCTA(sticky)를 한 줄로 렌더합니다.
- **compact 상태:**  
  - `useState(false)` → 스크롤 시에만 변경.  
  - **아래로 스크롤** (delta > 6): `setCompact(true)`.  
  - **위로 스크롤** (delta < -4): `setCompact(false)`.  
  - 240ms 후 `setCompact(false)`로 항상 리셋.  
  - **중요:** wrapper의 padding/height/transform/className은 **compact와 무관**하게 고정입니다. compact는 ProductConsultCTA에만 전달되며, CTA는 위에서 본 것처럼 sticky 분기에서 compact를 사용하지 않습니다.
- **스크롤 방향에 따라 높이/위치가 달라질 수 있는 부분:**  
  - 코드 상으로는 **없음**. compact가 바뀌어도 wrapper 스타일과 내부 레이아웃은 동일합니다.  
  - 가능한 원인 후보: (1) 스크롤 시 뷰포트 높이 변화(주소창 표시/숨김)로 인한 fixed 위치·safe-area 해석 차이, (2) ResizeObserver가 한 프레임 늦게 반영되거나 스크롤 중에 다른 높이를 읽는 경우, (3) 브라우저의 스크롤 시 compositing/repaint로 인한 일시적 잘림.

---

## 3. compact에 따른 실제 높이/스타일 변경 여부

| 항목 | ProductConsultCTA (sticky) | ProductDetailStickyV2 wrapper |
|------|----------------------------|--------------------------------|
| compact일 때 button height | 변경 없음 (항상 h-11 min-h-11) | — |
| compact일 때 wrapper padding | — | 변경 없음 (항상 PADDING_TOP 12, paddingBottom calc(12 + safe-area)) |
| compact일 때 translateY / bottom / scale / opacity | 없음 | 없음 |
| compact일 때 price block line-height / text size | 변경 없음 | — |

**정리:** 두 파일 모두 **compact 값에 따라 실제 높이나 위치가 바뀌는 코드는 없습니다.**  
따라서 “스크롤 올릴 때만 잘림” 현상은 compact 상태 자체보다는, **스크롤 방향에 따라 달라지는 뷰포트/타이밍(주소창, ResizeObserver, repaint)** 쪽을 의심하는 것이 타당합니다.

---

## 4. Sticky CTA 높이 계산 및 --cta-h

**File:** `src/components/products/ProductDetailStickyV2.tsx` (해당 부분만)

- **상수:**  
  - `PADDING_TOP = 12`  
  - `PADDING_BOTTOM_BASE = 12`  
  - (과거 PR에서 사용하던 `ROW_HEIGHT` / `TOTAL_BAR_HEIGHT_NO_SAFE`는 현재 코드에는 없고, **고정값 대신 실제 측정값**을 쓰는 구조입니다.)
- **--cta-h 설정:**  
  - wrapper ref의 `el.offsetHeight`를 읽어 `document.documentElement.style.setProperty("--cta-h", `${height}px`)` 로 설정.  
  - `el.offsetHeight === 0`이면 `--cta-h`를 0으로 둠.  
  - ResizeObserver로 wrapper 크기 변경 시마다 다시 설정.
- **실제 높이와의 관계:**  
  - `--cta-h`는 **측정된 wrapper 전체 높이**(padding + safe-area 포함)와 일치해야 합니다.  
  - 스크롤 중이나 초기 마운트 직후 한 프레임에 `offsetHeight`가 다르게 나오거나, safe-area가 스크롤에 따라 바뀌는 환경에서는 `--cta-h`와 실제 보이는 높이가 잠깐 어긋날 수 있습니다.  
  - `globals.css`의 `padding-bottom: calc(var(--cta-h) + 12px)` 가 이 값을 사용하므로, `--cta-h`가 순간적으로 작게 잡히면 body 하단 여백이 줄어들어 CTA가 “잘린 것처럼” 보일 수 있습니다.

---

## 5. 요약

- **ProductConsultCTA:** sticky일 때 `compact`를 받지만 **사용하지 않음**. height/transform/padding/애니메이션 모두 compact와 무관하게 고정.
- **ProductDetailStickyV2:** compact는 스크롤 방향(delta > 6 / < -4)과 240ms 타이머로만 바뀌며, **wrapper 스타일·높이에는 반영되지 않음**.
- **높이 계산:** 고정 상수 대신 **wrapper의 offsetHeight + ResizeObserver**로 `--cta-h`를 설정. 스크롤/뷰포트 변화 시 측정 타이밍이나 safe-area 해석에 따라 일시적으로 잘못된 `--cta-h`가 적용되면, body 하단 여백이 부족해 “스크롤 올릴 때만 하단이 잘린다” 같은 현상이 나올 수 있음.

이 문서는 수정 없이 **원인 분석용 코드 발췌와 설명만** 포함합니다.

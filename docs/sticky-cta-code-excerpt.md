# 하단 Sticky CTA 바 코드 발췌 (사라진 문제 분석용)

수정 없이 관련 코드만 발췌·구조 설명만 정리합니다.

---

## 1. 상품 상세페이지 파일

**실제 사용 경로:** `src/app/products/[id]/page.tsx` (경로는 `[id]`, `[slug]` 아님)

### File: src/app/products/[id]/page.tsx

```tsx
import {
  ProductDetailStickyDesktop,
  ProductDetailStickyMobile,
} from "@/components/ProductDetailSticky";
import {
  ProductDetailStickyV2Desktop,
  ProductDetailStickyV2Mobile,
} from "@/components/products/ProductDetailStickyV2";
// ... 중략 ...

export default async function ProductDetailPage({ params, searchParams }: ProductDetailPageProps) {
  // ...
  const product = await getProductByIdFresh(id);

  if (!product) {
    notFound();
  }

  if (product.is_active === false) {
    notFound();
  }

  // ... 중략 ...

  return (
    <ConsultModalProvider>
      <ProductQuoteProvider>
        <SiteHeader activeTab="products" />
      <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white py-6 sm:py-10 md:py-14">
        <PageContainer size="wide">
          <main className="w-full">
            {/* ... 본문 콘텐츠 ... */}
            <ProductDetailStickyV2Desktop ... />
          </div>
        </main>
        </PageContainer>

        <ProductDetailStickyV2Mobile
          priceFormatted={formattedPrice}
          productId={product.id}
          productTitle={product.title}
          sourcePath={sourcePath}
          kakaoHref={kakaoHref}
          status={statusV2}
          trust={product.trust}
          experimentKey="review_highlight_variant"
          variant={reviewExperimentVariant}
        />
      </div>
      </ProductQuoteProvider>
    </ConsultModalProvider>
  );
}
```

**설명**
- 상품 상세 페이지는 **`[id]`** 동적 라우트를 사용합니다.
- **하단 Sticky CTA**는 `ProductDetailStickyV2Mobile`로, `PageContainer` 밖·`div.min-h-screen` 안에서 **형제**로 렌더됩니다.
- **조건부 렌더링:** `product` 없으면 위에서 `notFound()`로 빠지므로, CTA가 렌더되는 경우에는 항상 `product`가 존재합니다. CTA 자체는 조건 없이 항상 렌더됩니다.
- 참고: `ProductDetailSticky`(구버전)는 import만 되어 있고, 이 페이지에서는 **V2**만 사용됩니다.

---

## 2. Sticky CTA 컴포넌트 코드

**실제 사용 컴포넌트:** `ProductDetailStickyV2Mobile` (파일: `ProductDetailStickyV2.tsx`)  
요청하신 이름(ProductStickyBar, ProductBottomCTA 등)은 이 프로젝트에 없습니다.

### File: src/components/products/ProductDetailStickyV2.tsx

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import TrustSignals from "@/components/products/TrustSignals";
import { ProductConsultCTA } from "@/components/products/ProductConsultCTA";
// ... 기타 import ...

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
    const onScroll = () => { /* compact 상태 토글 */ };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); /* ... */ };
  }, []);

  const PADDING_TOP = 12;
  const ROW_HEIGHT = 44;
  const PADDING_BOTTOM_BASE = 12;
  const TOTAL_BAR_HEIGHT_NO_SAFE = PADDING_TOP + ROW_HEIGHT + PADDING_BOTTOM_BASE;

  useEffect(() => {
    document.documentElement.setAttribute("data-mobile-cta", "on");
    document.documentElement.style.setProperty("--cta-h", `${TOTAL_BAR_HEIGHT_NO_SAFE}px`);
    return () => {
      document.documentElement.removeAttribute("data-mobile-cta");
      document.documentElement.style.setProperty("--cta-h", "0px");
    };
  }, []);

  return (
    <div
      role="banner"
      aria-label="상품 예약 상담"
      className="fixed left-0 right-0 bottom-0 z-50 box-border hidden w-full border-t border-[var(--divider)] bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)] md:!hidden"
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

**확인 포인트**
- **position / bottom:** `fixed left-0 right-0 bottom-0`, `z-50`.
- **display 조건:** `className`에 **`hidden`** 과 **`md:!hidden`** 이 둘 다 있음.  
  → Tailwind에서 `hidden`은 `display: none`이라 **모든 뷰포트에서 숨김**. `md:!hidden`은 md 이상에서만 추가로 숨기는 의미라, **모바일에서도 이미 `hidden` 때문에 보이지 않음. (사라진 원인 후보)**
- **safe-area:** wrapper의 `paddingBottom` / `paddingLeft` / `paddingRight`에 `env(safe-area-inset-*)` 반영.
- **props:** priceFormatted, productId, productTitle, sourcePath, kakaoHref, status, trust, experimentKey, variant.

---

## 3. Sticky CTA가 포함된 레이아웃 구조

### File: src/app/layout.tsx

```tsx
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: ...) {
  return (
    <html lang="ko">
      <head>...</head>
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased ...">
        <WebVitalsReporter />
        <ConsultModalProvider>
          <div className="flex-1">{children}</div>
          <KakaoFloatingButton />
          <GlobalSiteFooter />
        </ConsultModalProvider>
      </body>
    </html>
  );
}
```

**설명**
- 루트 레이아웃만 존재. `src/app/products/layout.tsx`는 없음.
- **overflow / transform / contain:** body와 `flex-1` div에는 `overflow`, `transform`, `contain` 없음. Sticky CTA는 `children`(상품 상세 페이지) 안에서 렌더되므로, 레이아웃이 fixed를 가리는 구조는 아님.

### 상품 상세 페이지 wrapper (같은 파일 내)

- Sticky CTA 부모: `div.min-h-screen.bg-gradient-to-b.from-[#f3f8ff].to-white.py-6.sm:py-10.md:py-14`  
- 여기도 overflow/transform/contain 없음.

---

## 4. Sticky CTA 관련 스타일 코드

### 4.1 컴포넌트 내부 className (ProductDetailStickyV2Mobile)

- **최상위 div:**  
  `fixed left-0 right-0 bottom-0 z-50 box-border hidden w-full border-t border-[var(--divider)] bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)] md:!hidden`
- **속성 요약**
  - position: fixed, bottom: 0 (left/right 0)
  - overflow: 없음
  - transform: 없음
  - height/min-height: 없음 (내부 row만 min-h-[44px])
  - padding: style로 paddingTop / paddingBottom( safe-area 포함 ) / paddingLeft / paddingRight

### 4.2 globals.css

**File: src/app/globals.css**

```css
/* 루트 변수 (일부) */
:root {
  --cta-h: 0px;
}

/* 모바일에서만 적용 */
@media (max-width: 767px) {
  html[data-mobile-cta="on"] body {
    padding-bottom: calc(var(--cta-h) + env(safe-area-inset-bottom) + 12px);
  }
  /* ... */
}
```

**설명**
- `--cta-h`: ProductDetailStickyV2Mobile의 useEffect에서 68px로 설정.
- Sticky CTA 표시 시 `data-mobile-cta="on"`이 html에 붙고, body에 `padding-bottom`이 CTA 높이 + safe-area + 12px로 적용됨.
- position / bottom / overflow / transform / height / min-height / padding-bottom / safe-area는 컴포넌트 쪽에서 처리, globals는 본문 하단 여백만 담당.

---

## 5. 조건부 렌더링 여부 확인

| 항목 | 내용 |
|------|------|
| product 없을 때 | 페이지에서 `notFound()` 호출로 CTA까지 도달하지 않음. CTA는 조건 없이 항상 렌더됨. |
| isMobile 조건 | 컴포넌트 내부에 isMobile 상태 없음. **대신 Tailwind로 표시 제어:** `hidden` + `md:!hidden`. |
| isScrolled 조건 | `compact` 상태만 스크롤로 변경하며, 렌더 여부에는 사용하지 않음. |
| viewport 조건 | **`hidden`** 으로 인해 **모든 뷰포트에서 display: none**. 의도는 “모바일에서만 보이고 md 이상에서 숨기기”인데, 현재는 “항상 숨김”이 됨. |
| useEffect 상태값 | `data-mobile-cta` / `--cta-h` 설정만 하고, CTA 표시/비표시에는 사용하지 않음. |

**결론 (사라진 원인)**  
- **Sticky CTA가 완전히 사라진 직접 원인:**  
  `ProductDetailStickyV2Mobile` 루트 div의 `className`에 **`hidden`** 이 들어 있어, **모든 해상도에서 `display: none`** 이 적용됨.  
- 의도는 “md 이상에서만 숨기기”이므로, **모바일에서는 보이게 하려면** `hidden`을 제거하고 **`md:hidden`** 만 두어 “기본은 보이고, md 이상에서만 숨김”으로 바꿔야 함.  
  (현재는 `hidden` + `md:!hidden` → 항상 숨김.)

---

## 발췌 요약

| 구분 | 파일 | 역할 |
|------|------|------|
| 1 | `src/app/products/[id]/page.tsx` | 상품 상세 페이지. Sticky CTA는 `ProductDetailStickyV2Mobile`로 PageContainer 형제에 렌더. |
| 2 | `src/components/products/ProductDetailStickyV2.tsx` | Sticky CTA 컴포넌트. `ProductDetailStickyV2Mobile`이 fixed 하단 바. **`hidden` + `md:!hidden` 으로 인해 전 구간에서 미표시.** |
| 2 보조 | `src/components/products/ProductConsultCTA.tsx` | CTA 내부 UI(가격 + 예약/카카오 버튼). `section="sticky"`일 때 사용. |
| 3 | `src/app/layout.tsx` | 루트 레이아웃. overflow/transform/contain 없음. |
| 4 | `src/app/globals.css` | `--cta-h`, `data-mobile-cta` 시 body `padding-bottom` 적용. |
| 3 참고 | `src/components/layout/PageContainer.tsx` | 폭/패딩만 담당. overflow 등 없음. |

수정은 하지 않았으며, 원인 분석을 위한 코드 발췌와 구조 설명만 포함했습니다.

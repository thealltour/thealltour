# 예약 인원 · 포인트(쿠폰팩) 할인 — 코드 발췌

저장일: **2026-08-09**  
원본 요청: [`excerpt-request-booking-pax-coupon-discount.md`](./excerpt-request-booking-pax-coupon-discount.md)  
관련 랜딩: `/golf/kakao-sync` · 기존 포인트 발췌: [`member-rewards-system-code-excerpts-1.md`](./member-rewards-system-code-excerpts-1.md)

---

## 현황 요약

| 요청 항목 | 현황 | 실제 위치 |
|-----------|------|-----------|
| 1. 인원 선택 UI / 상태 | **있음** — `travelerCount` Context + 패널 UI | `ProductQuoteContext`, `ProductBookingSelectionPanel`, `ProductDetailV2` |
| 2. 결제 서머리 (총액 − 할인 = 최종) | **부분 있음** — 견적 합계 / 포인트 할인 / 예약금·잔금 표시. 클래식 “쿠폰 할인” 라벨 없음 | `ProductCheckoutSection`, 마이페이지·관리자 스냅샷 |
| 3. 쿠폰×인원 할인 계산 | **없음 (갭)** — 쿠폰 엔진·`pax×5만/3만` 자동 차감 로직 없음. 가장 가까운 것: **보유 포인트 사용액** 정규화·캡 | `inquiryPointsUse`, `buildCheckoutQuote` |
| 4. 쿠폰 스키마 / 첫예약 티어 판별 | **없음 (갭)** — 쿠폰 테이블 없음. 웰컴은 **가입 시 50,000P 1회 지급** (`KAKAO_SIGNUP_WELCOME`). “첫 예약 사용 여부 → 이후 3만” 판별 API 없음 | `grantKakaoSignupWelcomePoints`, `point_ledger`, `members.point_balance` |

### 핵심 갭 (랜딩 카피 vs 구현)

1. **마케팅은 “쿠폰팩 / 1인당 5만 × N명”**, 구현은 **포인트 잔액(`point_balance`)을 사용자가 입력한 금액만큼 차감**.
2. `kakaoSyncGolf/config.ts`에 **인원 비례 자동 할인 백엔드 미구현**이 명시되어 있음 (2026-08).
3. `buildCheckoutQuote`는 `travelerCount`로 **견적 합계를 인원 배율**하지만, `ProductCheckoutSection`은 현재 **`travelerCount`를 넘기지 않아 기본값 1명**으로 계산됨 (UI 인원과 checkout 미리보기 불일치 가능).
4. `hasKakaoSignupWelcomePoints`는 **지급 여부(이미 받았는지)** 만 본다. **웰컴 포인트 소진/첫 예약 사용 완료** 플래그는 없다.
5. **차기 1인당 3만 원** 자동 전환 로직·데이터 모델은 코드베이스에 없다.

---

## 목차

1. [상품 상세 / 예약 인원 선택 (Frontend)](#1-상품-상세--예약-인원-선택-frontend)
2. [결제 / 주문 서머리 UI](#2-결제--주문-서머리-ui)
3. [할인(포인트) 계산 로직](#3-할인포인트-계산-로직)
4. [포인트 데이터 구조 · 웰컴 지급 · “첫 예약” 근접 로직 (Backend)](#4-포인트-데이터-구조--웰컴-지급--첫-예약-근접-로직-backend)
5. [랜딩 카피 · 명시적 갭 주석](#5-랜딩-카피--명시적-갭-주석)

---

## 1. 상품 상세 / 예약 인원 선택 (Frontend)

요청 예시 경로(`src/components/booking/*`, `src/app/tours/[id]/*`)는 이 저장소에 없음.  
실제 퍼널은 **`src/components/products/*` + `src/app/products/[id]`**.

### 1-1. 인원 상태 Context

==================================================  
파일 경로: `src/components/products/ProductQuoteContext.tsx`  
역할: 상품 상세 전역 견적 상태. `travelerCount` 기본 2, 범위 1–20.  
==================================================

```tsx
export const DEFAULT_TRAVELER_COUNT = 2;
export const MIN_TRAVELER_COUNT = 1;
export const MAX_TRAVELER_COUNT = 20;

export function clampTravelerCount(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TRAVELER_COUNT;
  return Math.min(MAX_TRAVELER_COUNT, Math.max(MIN_TRAVELER_COUNT, Math.round(value)));
}

// ...

export function ProductQuoteProvider({ children }: { children: ReactNode }) {
  const [quoteSummary, setQuoteSummary] = useState<QuoteResult | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions | null>(null);
  const [selectedDeparture, setSelectedDeparture] = useState<SelectedDeparture | null>(null);
  const [travelerCount, setTravelerCountState] = useState(DEFAULT_TRAVELER_COUNT);
  // ...

  const setTravelerCount = useCallback((n: number) => {
    setTravelerCountState(clampTravelerCount(n));
  }, []);

  const value: ProductQuoteContextValue = {
    quoteSummary,
    selectedOptions,
    selectedDeparture,
    travelerCount,
    // ...
    setTravelerCount,
    // ...
  };

  return (
    <ProductQuoteContext.Provider value={value}>
      {children}
    </ProductQuoteContext.Provider>
  );
}
```

### 1-2. 인원 선택 UI (+/−)

==================================================  
파일 경로: `src/components/products/ProductBookingSelectionPanel.tsx`  
역할: 출발일·인원·옵션 통합 패널. 인원 변경 시 `onTravelerCountChange` 호출.  
==================================================

```tsx
  const canDecrease = travelerCount > MIN_TRAVELER_COUNT;
  const canIncrease = travelerCount < MAX_TRAVELER_COUNT;

  const travelerSection = (
    <div id="product-traveler-section" className="space-y-3 scroll-mt-24">
      <div>
        <h3 className="text-base font-bold text-[#0f172a]">인원</h3>
        <p className="mt-0.5 text-xs text-slate-500">여행에 참여하는 총 인원을 선택해 주세요.</p>
      </div>
      <div className={selectionAreaClass(true)}>
        <div className="flex items-center justify-between gap-4 px-1 py-1">
          <span className="text-sm font-medium text-slate-700">총 인원</span>
          <div className="inline-flex items-center gap-3" role="group" aria-label="인원 선택">
            <button
              type="button"
              onClick={() => onTravelerCountChange(travelerCount - 1)}
              disabled={!canDecrease}
              aria-label="인원 줄이기"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <span className="min-w-[3.5rem] text-center text-lg font-bold tabular-nums" aria-live="polite">
              {travelerCount}명
            </span>
            <button
              type="button"
              onClick={() => onTravelerCountChange(travelerCount + 1)}
              disabled={!canIncrease}
              aria-label="인원 늘리기"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
```

### 1-3. 상품 상세에서 Context ↔ 패널 연결

==================================================  
파일 경로: `src/components/products/ProductDetailV2.tsx`  
역할: `useProductQuote()`의 `travelerCount` / `setTravelerCount`를 패널에 전달.  
체크아웃 섹션에는 인원을 props로 넘기지 않음.  
==================================================

```tsx
  const {
    // ...
    travelerCount,
    setTravelerCount,
  } = useProductQuote();

  const quote = useMemo(
    () => calcQuote(options, selectedOptions),
    [options, selectedOptions],
  );
  // 참고: calcQuote는 1인 기준 옵션 합계. 인원 배율은 여기서 적용하지 않음.

  // ...

            <ProductBookingSelectionPanel
              // ...
              travelerCount={travelerCount}
              onTravelerCountChange={setTravelerCount}
              // ...
            />
            {showCalendarBooking && portOneEnabled ? (
              <ProductCheckoutSection
                productId={product?.id ?? ""}
                productTitle={title ?? ""}
                options={hasOptions ? options : undefined}
                selectedOptions={selectedOptions}
                selectedDepartureKey={selectedDepartureKey}
                departureRequired={departureRequiredForBooking}
                requiredGroupsMissing={requiredGroupsMissing}
              />
            ) : null}
```

### 1-4. Sticky CTA 요약의 인원 표시

==================================================  
파일 경로: `src/components/products/ProductBookingSelectionSummary.tsx`  
역할: Sticky CTA 영역에 선택 출발일·인원·옵션 요약. 가격×인원 재계산은 없음.  
==================================================

```tsx
  const {
    selectedDeparture,
    quoteSummary,
    requiredGroupsMissing,
    departureRequired,
    travelerCount,
  } = useProductQuote();

  // ...

      <p className="font-medium text-slate-800">
        <span className="text-slate-500">인원</span>
        {" · "}
        {travelerCount}명
      </p>
```

### 1-5. 문의 prefill에 인원 포함

==================================================  
파일 경로: `src/components/products/ProductConsultCTA.tsx`  
역할: 상담 CTA 시 `travelerCount`를 문의 본문 prefill에 넣음.  
==================================================

```tsx
  const buildPrefill = () =>
    buildProductInquiryPrefill({
      productTitle,
      selectedDeparture: quoteCtx.selectedDeparture,
      travelerCount: quoteCtx.travelerCount,
      quoteSummary: quoteCtx.quoteSummary,
      selectedOptions: quoteCtx.selectedOptions,
    });
```

### 1-6. 1인 기준 옵션 견적 (인원 미반영)

==================================================  
파일 경로: `src/lib/pricing/calcQuote.ts`  
역할: `basePrice + Σ priceDelta`. **travelerCount 인자 없음.**  
==================================================

```ts
/**
 * 기준가 + 선택된 옵션으로 견적 계산.
 * - total = basePrice + sum(선택된 items의 priceDelta)
 * - breakdown에는 선택된 항목만 포함
 */
export function calcQuote(
  options: ProductOptions | undefined,
  selected: SelectedOptions,
): QuoteResult {
  // ...
}
```

---

## 2. 결제 / 주문 서머리 UI

요청 예시 `PaymentSummary.tsx`는 없음. 실제 결제 요약은 **`ProductCheckoutSection`**.

### 2-1. 체크아웃 미리보기 · 포인트 입력 · prepare 호출

==================================================  
파일 경로: `src/components/products/ProductCheckoutSection.tsx`  
역할: 견적 합계 / 포인트 할인 / 예약금 / 잔금 표시. `/api/me/points`로 잔액 조회 후 사용액 입력.  
**갭:** `buildCheckoutQuote`에 `travelerCount` 미전달 → 합계가 1인 기준일 수 있음. prepare body에도 `traveler_count` 미포함.  
==================================================

```tsx
  const { selectedDeparture } = useProductQuote();
  const [pointBalance, setPointBalance] = useState<number | null>(null);
  const [pointsUse, setPointsUse] = useState(0);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/me/points", { cache: "no-store" });
      if (res.status === 401) {
        setLoggedIn(false);
        return;
      }
      if (!res.ok) return;
      setLoggedIn(true);
      const data = await res.json();
      setPointBalance(Number(data.balance ?? 0));
    })();
  }, []);

  const quotePreview = useMemo(() => {
    return buildCheckoutQuote({
      options,
      selectedOptions,
      departure: selectedDeparture
        ? {
            label: selectedDeparture.label,
            inquiryValue: selectedDeparture.inquiryValue,
            price: selectedDeparture.price,
          }
        : null,
      pointsUse,
      // travelerCount 미전달 → buildCheckoutQuote 기본값 1
    });
  }, [options, selectedOptions, selectedDeparture, pointsUse]);

  useEffect(() => {
    if (pointBalance == null || pointBalance <= 0) return;
    if (pointsUse > 0) return;
    setPointsUse(resolveDefaultPointsUseAmount(pointBalance, quotePreview.quoteTotal));
  }, [pointBalance, pointsUse, quotePreview.quoteTotal]);

  // prepare body
  body: JSON.stringify({
    product_id: productId,
    product_title: productTitle,
    source_path: `/products/${productId}`,
    departure: { /* ... */ },
    selected_options: selectedOptions,
    points_use: pointsUse,
    // traveler_count 없음
  }),
```

서머리 렌더:

```tsx
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">견적 합계</dt>
          <dd className="font-semibold">{formatPriceKR(quotePreview.quoteTotal)}</dd>
        </div>
        {quotePreview.pointsApplied > 0 ? (
          <div className="flex justify-between gap-3 text-[var(--primary)]">
            <dt>포인트 할인</dt>
            <dd>-{quotePreview.pointsApplied.toLocaleString("ko-KR")}P</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">예약금 (지금 결제)</dt>
          <dd className="font-semibold">{formatPriceKR(quotePreview.depositAmount)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">잔금 (마이페이지)</dt>
          <dd>{formatPriceKR(quotePreview.balanceDue)}</dd>
        </div>
      </dl>

      {loggedIn && pointBalance != null && pointBalance > 0 ? (
        <div className="mt-4">
          <label htmlFor="checkout-points-use">
            포인트 사용 (보유 {pointBalance.toLocaleString("ko-KR")}P)
          </label>
          <input
            id="checkout-points-use"
            type="number"
            min={0}
            max={pointBalance}
            value={pointsUse}
            onChange={(e) => setPointsUse(normalizePointsUseRequested(e.target.value))}
          />
        </div>
      ) : null}
```

### 2-2. CheckoutSnapshot 타입

==================================================  
파일 경로: `src/types/checkout.ts`  
역할: prepare 시점 스냅샷. `pointsUseRequested` + `travelerCount` 필드 존재.  
==================================================

```ts
export type CheckoutSnapshot = {
  productId: string;
  productTitle: string;
  sourcePath: string;
  departure: {
    label: string;
    inquiryValue: string;
    ymd: string | null;
    price: number | null;
  };
  selectedOptions: SelectedOptions;
  quoteBreakdown: QuoteBreakdownItem[];
  quoteTotal: number;
  pointsUseRequested: number;
  depositAmount: number;
  balanceDue: number;
  travelerCount: number;
  preparedAt: string;
};
```

### 2-3. ConsultModal — 문의 경로 포인트 사용 UI

==================================================  
파일 경로: `src/components/inquiry/ConsultModal.tsx`  
역할: 빠른문의에서 보유 포인트 사용 요청. 인원×쿠폰 자동 계산 없음.  
==================================================

```tsx
  const [pointBalance, setPointBalance] = useState<number | null>(null);
  const [pointsUseEnabled, setPointsUseEnabled] = useState(false);
  const [pointsUseAmount, setPointsUseAmount] = useState(0);

  // open 시 /api/me/points → resolveDefaultPointsUseAmount
  // submit 시:
  if (pointsUseEnabled && pointsUseAmount > 0 && pointBalance != null) {
    body.points_use_requested = pointsUseAmount;
  }
```

UI:

```tsx
                    {pointBalance != null && pointBalance > 0 ? (
                      <div className="rounded-xl border ...">
                        <p>보유 포인트: {pointBalance.toLocaleString("ko-KR")}P</p>
                        <label>
                          <input
                            type="checkbox"
                            checked={pointsUseEnabled}
                            onChange={(e) => setPointsUseEnabled(e.target.checked)}
                          />
                          <span>포인트 사용 요청 (카카오 50,000P 포함)</span>
                        </label>
                        {pointsUseEnabled ? (
                          <input
                            type="number"
                            min={1}
                            max={pointBalance}
                            value={pointsUseAmount}
                            onChange={(e) => {
                              const next = Number.parseInt(e.target.value, 10);
                              // clamp to [0, pointBalance]
                            }}
                          />
                        ) : null}
                      </div>
                    ) : null}
```

문의 API는 스냅샷에만 기록 (즉시 차감 아님):

==================================================  
파일 경로: `src/app/api/inquiries/route.ts` (발췌)  
==================================================

```ts
  const pointsUseRequested = normalizePointsUseRequested(body.points_use_requested);
  // ...
  if (pointsUseRequested > 0) {
    // 로그인·잔액 검증
    memberPointBalance = Number((memberRow as { point_balance?: number }).point_balance ?? 0);
    const validation = validateInquiryPointsUse({ pointsUseRequested, pointBalance: memberPointBalance });
    // ...
  }
  if (pointsUseRequested > 0 && memberPointBalance != null) {
    if (!quoteSnapshot) quoteSnapshot = {};
    quoteSnapshot.pointsUseRequested = pointsUseRequested;
    quoteSnapshot.pointsBalanceAtSubmit = memberPointBalance;
  }
```

---

## 3. 할인(포인트) 계산 로직

**쿠폰 hook (`useCoupon`) / `pax × 단가` 엔진은 없음.**  
가장 가까운 계산 레이어:

### 3-1. 포인트 사용액 정규화 · 기본값 · 잔액 검증

==================================================  
파일 경로: `src/lib/inquiry/inquiryPointsUse.ts`  
역할: 문의·체크아웃 공통. 인원(pax)과 무관.  
==================================================

```ts
export function normalizePointsUseRequested(raw: unknown): number {
  if (raw === null || raw === undefined || raw === "") return 0;
  const amount = typeof raw === "number" ? raw : Number.parseInt(String(raw).replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount);
}

export function validateInquiryPointsUse(params: {
  pointsUseRequested: number;
  pointBalance: number;
}): { ok: true } | { ok: false; message: string } {
  const { pointsUseRequested, pointBalance } = params;
  if (pointsUseRequested <= 0) return { ok: true };
  if (pointBalance <= 0) {
    return { ok: false, message: "사용 가능한 포인트가 없습니다." };
  }
  if (pointsUseRequested > pointBalance) {
    return { ok: false, message: "요청 포인트가 보유 잔액을 초과합니다." };
  }
  return { ok: true };
}

export function resolveDefaultPointsUseAmount(balance: number, quoteTotal: number | null | undefined): number {
  if (balance <= 0) return 0;
  if (quoteTotal != null && Number.isFinite(quoteTotal) && quoteTotal > 0) {
    return Math.min(balance, Math.floor(quoteTotal));
  }
  return balance;
}
```

### 3-2. 체크아웃 견적 = (1인 합계 × 인원) − 포인트

==================================================  
파일 경로: `src/lib/payments/buildCheckoutQuote.ts`  
역할: 인원 배율은 **상품 합계**에만 적용. 할인액은 **요청 포인트 그대로** (인원×5만 아님).  
예약금 고정 100,000원.  
==================================================

```ts
export const CHECKOUT_DEPOSIT_AMOUNT = 100_000;

export function buildCheckoutQuote(input: CheckoutQuoteInput): CheckoutQuoteResult {
  const travelerCount = Math.max(1, Math.floor(input.travelerCount ?? 1));
  const pointsApplied = normalizePointsUseRequested(input.pointsUse);
  const quote = calcQuote(input.options ?? undefined, input.selectedOptions);

  // optionDelta / departurePrice / baseComponent ...
  const perPersonTotal = baseComponent + optionDelta;
  const quoteTotal = Math.max(0, perPersonTotal * travelerCount);
  const afterPoints = Math.max(0, quoteTotal - pointsApplied);
  const balanceDue = Math.max(0, afterPoints - CHECKOUT_DEPOSIT_AMOUNT);

  return {
    quoteTotal,
    // ...
    pointsApplied,
    depositAmount: CHECKOUT_DEPOSIT_AMOUNT,
    balanceDue,
    breakdown: quote.breakdown,
    travelerCount,
  };
}
```

### 3-3. prepare API → pending 예약 생성

==================================================  
파일 경로: `src/app/api/bookings/checkout/prepare/route.ts`  
역할: `traveler_count` optional 수신 → `createPendingDepositBooking`.  
프론트는 현재 미전송.  
==================================================

```ts
const bodySchema = z.object({
  product_id: z.string().min(1),
  // ...
  points_use: z.number().int().min(0).optional(),
  traveler_count: z.number().int().min(1).max(99).optional(),
});

const result = await createPendingDepositBooking({
  memberId: auth.session.memberId,
  // ...
  pointsUse: body.points_use,
  travelerCount: body.traveler_count,
  returnDate,
});
```

==================================================  
파일 경로: `src/lib/bookings/createPendingDepositBooking.ts`  
역할: 잔액 검증 후 `checkout_snapshot` · `travel_bookings.traveler_count` 저장.  
==================================================

```ts
  const { balance: pointBalance } = await fetchMemberPoints(supabaseAdmin, input.memberId);

  const checkoutQuote = buildCheckoutQuote({
    options: input.options,
    selectedOptions: input.selectedOptions,
    departure: input.departure,
    productBasePrice: input.productBasePrice,
    pointsUse: input.pointsUse,
    travelerCount: input.travelerCount,
  });

  const pointsValidation = validateInquiryPointsUse({
    pointsUseRequested: checkoutQuote.pointsApplied,
    pointBalance,
  });
  // ...

  const checkoutSnapshot: CheckoutSnapshot = {
    // ...
    quoteTotal: checkoutQuote.quoteTotal,
    pointsUseRequested: checkoutQuote.pointsApplied,
    depositAmount: checkoutQuote.depositAmount,
    balanceDue: checkoutQuote.balanceDue,
    travelerCount: checkoutQuote.travelerCount,
    preparedAt: new Date().toISOString(),
  };
```

### 3-4. 결제 확정 시 포인트 RESERVE

==================================================  
파일 경로: `src/lib/payments/confirmPortOneBookingPayment.ts` + `src/lib/payments/reserveBookingPoints.ts`  
역할: 예약금 확정 시 `snapshot.pointsUseRequested`만큼 `point_ledger` RESERVE + `point_balance` 차감.  
==================================================

```ts
    if (memberId && snapshot?.pointsUseRequested && snapshot.pointsUseRequested > 0) {
      await reserveBookingPoints({
        memberId,
        bookingId,
        amount: snapshot.pointsUseRequested,
        refType: "BOOKING_DEPOSIT",
      });
    }
```

```ts
export async function reserveBookingPoints(params: {
  memberId: string;
  bookingId: string;
  amount: number;
  refType?: typeof BOOKING_DEPOSIT_REF_TYPE | typeof BOOKING_BALANCE_REF_TYPE;
}): Promise<void> {
  // idempotent by (user, RESERVE, ref_type, ref_id)
  // balance check → ledger insert type RESERVE → members.point_balance -= amount
}
```

---

## 4. 포인트 데이터 구조 · 웰컴 지급 · “첫 예약” 근접 로직 (Backend)

### 4-1. 스키마 (쿠폰 테이블 없음 → 포인트 원장)

==================================================  
파일 경로: `supabase/migrations/20250304000000_points_rewards_v2.sql`  
역할: `members.point_balance` / `point_pending`, `point_ledger`.  
==================================================

```sql
alter table public.members add column if not exists point_balance integer not null default 0;
alter table public.members add column if not exists point_pending integer not null default 0;

create table public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete cascade,
  type text not null check (type in ('EARN','USE','EXPIRE','ADJUST','RESERVE','RELEASE')),
  status text not null default 'CONFIRMED' check (status in ('PENDING','CONFIRMED','CANCELED')),
  amount integer not null check (amount > 0),
  reason text,
  ref_type text,
  ref_id text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
```

==================================================  
파일 경로: `src/types/pointsRewardsV2.ts`  
==================================================

```ts
export type MemberPointsExtension = {
  point_balance: number;
  point_pending: number;
  grade_id: string | null;
  marketing_opt_in: boolean;
};

export type PointLedgerType =
  | "EARN" | "USE" | "EXPIRE" | "ADJUST" | "RESERVE" | "RELEASE";

export type PointLedgerRow = {
  id: string;
  user_id: string;
  type: PointLedgerType;
  status: PointLedgerStatus;
  amount: number; // 항상 양수
  reason: string | null;
  ref_type: string | null;
  ref_id: string | null;
  expires_at: string | null;
  created_at: string;
};
```

### 4-2. 카카오 웰컴 50,000P (쿠폰팩 프레이밍의 실체)

==================================================  
파일 경로: `src/lib/auth/kakaoSignupWelcome.ts`  
==================================================

```ts
export const KAKAO_SIGNUP_WELCOME_POINTS = 50_000;
export const KAKAO_SIGNUP_WELCOME_REASON = "카카오 50,000P";
export const KAKAO_SIGNUP_WELCOME_REF_TYPE = "KAKAO_SIGNUP_WELCOME";

export const KAKAO_WELCOME_QUERY_KEY = "welcome_kakao_points";
```

==================================================  
파일 경로: `src/lib/auth/grantKakaoSignupWelcomePoints.ts`  
역할: `ref_type = KAKAO_SIGNUP_WELCOME` 존재 여부로 **이미 지급했는지**만 판별 (사용 완료 여부 아님).  
==================================================

```ts
export async function hasKakaoSignupWelcomePoints(memberId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("point_ledger")
    .select("id")
    .eq("user_id", memberId)
    .eq("ref_type", KAKAO_SIGNUP_WELCOME_REF_TYPE)
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

export async function grantKakaoSignupWelcomePoints(
  memberId: string,
): Promise<GrantKakaoSignupWelcomeResult> {
  if (await hasKakaoSignupWelcomePoints(userId)) {
    return { granted: false, reason: "already_granted" };
  }

  const { ledgerId } = await grantPointsToUser({
    userId,
    amount: KAKAO_SIGNUP_WELCOME_POINTS,
    status: "CONFIRMED",
    reason: KAKAO_SIGNUP_WELCOME_REASON,
    refType: KAKAO_SIGNUP_WELCOME_REF_TYPE,
    refId: userId,
    notificationTitle: "카카오 50,000P",
    notificationBody: `${KAKAO_SIGNUP_WELCOME_POINTS.toLocaleString("ko-KR")}P가 지급되었습니다. 빠른문의 시 사용할 수 있습니다.`,
  });

  return { granted: true, ledgerId };
}
```

가입 시점 호출:

==================================================  
파일 경로: `src/lib/auth/memberAuthService.ts`  
==================================================

```ts
  let kakaoWelcomeGranted = false;
  if (provider === "kakao") {
    const welcomeResult = await grantKakaoSignupWelcomePoints(String(member.id)).catch((err) => {
      console.error("[memberAuthService] grantKakaoSignupWelcomePoints failed", err);
      return null;
    });
    kakaoWelcomeGranted = welcomeResult?.granted === true;
  }
```

토스트 (쿠폰팩 문구):

==================================================  
파일 경로: `src/components/mypage/WelcomeKakaoPointsToast.tsx`  
==================================================

```tsx
    showToast("success", "5만원 쿠폰팩(50,000P)이 지급되었습니다. 빠른문의 시 바로 사용할 수 있습니다.");
```

### 4-3. 잔액 조회 API

==================================================  
파일 경로: `src/app/api/me/points/route.ts`  
==================================================

```ts
  const balance = Number((memberRes.data as { point_balance?: number }).point_balance ?? 0);
  const pending = Number((memberRes.data as { point_pending?: number }).point_pending ?? 0);
  // ...
  return NextResponse.json({ balance, pending, expiringSoon, ledger });
```

### 4-4. “첫 예약 / 웰컴 사용 후 3만” 판별 — **미구현**

검색 결과:

- `hasKakaoSignupWelcomePoints` = **지급 이력**만 확인
- `travel_bookings` 유무로 “첫 예약 여부”를 보고 할인 티어를 바꾸는 API/헬퍼 **없음**
- `pax × 30_000` / “차기 쿠폰팩” 상수·로직 **없음**

근접 데이터만 존재:

| 질문 | 가능한 데이터 | 현재 용도 |
|------|----------------|-----------|
| 웰컴 50k를 받았나? | `point_ledger.ref_type = KAKAO_SIGNUP_WELCOME` | 중복 지급 방지, 어드민 분석 |
| 포인트 잔액은? | `members.point_balance` | 사용 가능액 |
| 예약이 있나? | `travel_bookings` (+ checkout_snapshot) | 예약/결제 — 할인 티어 전환에 미사용 |
| 웰컴 포인트를 “다 썼나”? | RESERVE/USE 원장과 EARN을 대조하면 **추론 가능**하나 전용 API 없음 | — |

---

## 5. 랜딩 카피 · 명시적 갭 주석

==================================================  
파일 경로: `src/lib/hardcodedLandings/kakaoSyncGolf/config.ts`  
역할: 마케팅 티어 카피. **인원 비례 자동 할인 미구현**을 코드 주석으로 명시.  
==================================================

```ts
/** 예약 인원수별 할인 티어 — 총무(리더) 1인이 가입하면 팀 전체 인원수에 비례해 혜택이 커진다는 프레이밍용.
 *  ⚠️ 카피 상의 목표 금액이며, 실제 결제 시 인원수에 비례해 자동으로 더 큰 금액이 차감되는 백엔드 로직은
 *  아직 구현되어 있지 않다(2026-08 기준). 상세는 kakaoSyncGolf 랜딩 작업 내역 참고. */
export type KakaoSyncDiscountTier = {
  headcountLabel: string;
  amountLabel: string;
  best?: boolean;
  badgeLabel?: string;
};

/** 카카오싱크 가입 혜택 포인트 금액(원) — 혜택 문구·상품 정가 표시에 공통 사용
 *  실제 지급 수단은 포인트(마이페이지에서 확인·차감)이지만, 유입 카피에서는
 *  "적립해서 나중에 쓴다"는 인상을 피하기 위해 "5만원 쿠폰팩/즉시 할인"으로 프레이밍한다. */
export const KAKAO_SYNC_COIN_BENEFIT_WON = 50_000;
```

티어 UI 카피 예:

```ts
    tiersTitle: "예약 인원수만큼, 할인이 커져요",
    // ...
      { headcountLabel: "1인 예약 시", amountLabel: "5만원 즉시 할인" },
      { headcountLabel: "2인 예약 시", amountLabel: "10만원 즉시 할인" },
      // 4인 → 총 20만원 ...
```

---

## 파일 인덱스 (실경로)

| 영역 | 경로 |
|------|------|
| 인원 Context | `src/components/products/ProductQuoteContext.tsx` |
| 인원 UI | `src/components/products/ProductBookingSelectionPanel.tsx` |
| 상세 연결 | `src/components/products/ProductDetailV2.tsx` |
| Sticky 요약 | `src/components/products/ProductBookingSelectionSummary.tsx` |
| 체크아웃 UI | `src/components/products/ProductCheckoutSection.tsx` |
| 견적×인원·포인트 | `src/lib/payments/buildCheckoutQuote.ts` |
| 포인트 정규화 | `src/lib/inquiry/inquiryPointsUse.ts` |
| 옵션 견적 | `src/lib/pricing/calcQuote.ts` |
| prepare API | `src/app/api/bookings/checkout/prepare/route.ts` |
| pending 예약 | `src/lib/bookings/createPendingDepositBooking.ts` |
| 포인트 예약 차감 | `src/lib/payments/reserveBookingPoints.ts` |
| ConsultModal | `src/components/inquiry/ConsultModal.tsx` |
| 문의 API 포인트 | `src/app/api/inquiries/route.ts` |
| 웰컴 상수 | `src/lib/auth/kakaoSignupWelcome.ts` |
| 웰컴 지급 | `src/lib/auth/grantKakaoSignupWelcomePoints.ts` |
| 가입 연동 | `src/lib/auth/memberAuthService.ts` |
| 잔액 API | `src/app/api/me/points/route.ts` |
| 스키마 | `supabase/migrations/20250304000000_points_rewards_v2.sql` |
| 랜딩 갭 주석 | `src/lib/hardcodedLandings/kakaoSyncGolf/config.ts` |

---

## 개선 시 참고 (발췌 범위 밖 — 요약만)

요청 정책(웰컴 `pax×5만` → 사용 후 `pax×3만`)을 구현하려면 대략:

1. **할인 정책 엔진** (쿠폰 or 포인트 자동 제안): `suggestedDiscount = min(balance, perPaxRate * travelerCount)`
2. **티어 판별**: “첫 예약/웰컴 미사용” vs “이후” — 전용 플래그 또는 원장·예약 조회
3. **UI**: 인원 변경 시 실시간 `-N원` 표기 (`ProductBookingSelectionPanel` / `ProductCheckoutSection`)
4. **프론트 버그 수정**: checkout prepare에 `travelerCount` 전달 (이미 API·`buildCheckoutQuote`는 지원)

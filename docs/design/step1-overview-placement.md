# [STEP 1] 오버뷰 삽입 위치 확정

## 1) 현재 상세 첫 화면 레이아웃 요약

**페이지 구조 (products/[id]):**
```
[← 상품 목록으로]
┌─ White Section (rounded-3xl) ─────────────────┐
│ [TravelOverview] ← 페이지 레벨, ProductDetailV2 밖 │
│   - 커버 이미지 (aspect 16:9)                    │
│   - 요약 카드 그리드 (항공/숙소/테마 등)            │
│   - 일정 테마 차트 (선택)                         │
│   - Day 타임라인 요약 (선택)                      │
├───────────────────────────────────────────────┤
│ [ProductDetailV2 - DetailHero]                 │
│   - TagRow (지역/카테고리/상태)                   │
│   - h1 타이틀                                    │
│   - oneLiner                                    │
│   - Price Summary Card                         │
│   - OptionPanel (옵션 있을 때)                   │
│   - QuoteSummary (옵션+견적 있을 때)              │
│   - TrustSignals                               │
│   - CTA 버튼 (상담 문의, 카톡 상담)                │
├───────────────────────────────────────────────┤
│ [ProductDetailV2 - Tabs]                       │
│   - TabsTrigger (일정/포함/예약/환불)             │
│   - Tab 콘텐츠                                    │
└───────────────────────────────────────────────┘
```

**히어로 블록 범위:** TagRow ~ CTA 버튼 (ProductDetailV2 내부 `<section className="space-y-5">`)

---

## 2) 삽입 위치 후보

| 안 | 위치 | 설명 |
|---|------|------|
| **1안(권장)** | 히어로 블록 바로 아래, 탭 시작 전 | `</section>`(DetailHero) 다음, `{/* Tabs */}` 전 |
| **2안** | 히어로 내부 하단 (가격 카드 아래) | Price Card 다음, OptionPanel 전 |

---

## 3) Responsive 전략 제안

**목표:** 첫 화면에 오버뷰가 최대한 들어오도록

| viewport | 전략 |
|----------|------|
| **데스크톱 (lg~)** | 1안 유지. 공간 여유로 오버뷰+탭 시작점까지 첫 화면 가능 |
| **태블릿/모바일** | 1안 유지. 단, 오버뷰 요약 영역(summaryCards/chart/days)에 `max-h-[40vh] overflow-y-auto` 적용해 과도한 세로 확장 방지. 커버는 aspect 비율 유지 |

**2안으로 자동 조정 시점:**  
- 1안 적용 시 첫 화면 높이가 viewport의 150%를 초과하면 → 2안(히어로 내부)으로 전환  
- 구현: `useEffect` + `ResizeObserver`로 첫 화면 콘텐츠 높이 측정, 임계값 초과 시 `overviewPlacement="inside"` 등으로 2안 렌더

**권장:** 우선 1안만 적용. 실제 기기 테스트 후 과도하게 길면 2안 분기 추가.

---

## 4) 결론: 적용할 위치

**선택: 1안** — 히어로 블록 바로 아래, 탭 시작 전

**코드 삽입 블록 (ProductDetailV2.tsx):**

```tsx
// 293행 </section> (DetailHero 끝) 직후
// 295행 {/* Tabs */} 직전

      </section>

      {/* [STEP 1] 여행 오버뷰: 히어로 바로 아래, 탭 전 (첫 화면 보장) */}
      {overviewSection}

      {/* Tabs */}
      <section>
```

**전제:** ProductDetailV2가 `overviewCoverUrl`, `overviewFallbackUrl`, `overview` props를 받아 `TravelOverview`를 렌더.  
현재 TravelOverview는 페이지에서 렌더되므로, **커버는 페이지 상단 유지**, **요약 카드/차트/일정만** ProductDetailV2 내 1안 위치에 삽입하는 분리 구조가 적합.

**최종 구조:**
- **페이지:** TravelOverview(커버만) 또는 커버 이미지 단독 → 상단 고정
- **ProductDetailV2:** (TagRow~CTA) → **TravelOverviewSummary(요약 카드/차트/일정)** → Tabs

또는 TravelOverview 전체를 ProductDetailV2 최상단(히어로 위)에 두어,  
**커버 → 태그/타이틀/가격/CTA → 요약카드/차트/일정 → 탭** 순서로 통일.

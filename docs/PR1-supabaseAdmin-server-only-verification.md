# supabaseAdmin 서버 전용 검증 결과

## 1. service_role 키가 클라이언트 번들에 노출되지 않는지

### 환경 변수 사용처
- **`src/lib/supabaseAdmin.ts`**: `process.env.SUPABASE_SERVICE_ROLE_KEY!` 사용 (NEXT_PUBLIC_ 없음).
- **`src/lib/storage/providers/SupabaseStorageProvider.ts`**: `process.env.SUPABASE_SERVICE_ROLE_KEY` 사용 (NEXT_PUBLIC_ 없음).

Next.js에서는 `NEXT_PUBLIC_` 접두어가 없는 환경 변수는 **서버 번들에만** 주입되며, 클라이언트 번들에는 포함되지 않습니다.

### 빌드 산출물 확인
`.next/` 내 검색 결과:
- `SUPABASE_SERVICE_ROLE_KEY` / `supabaseAdmin` 참조는 모두 **`server/chunks/`** 또는 **`ssr/`** 경로의 청크에만 존재.
- 클라이언트용 청크(예: `static/chunks/`, `client/`)에는 없음.

**결론: service_role 키는 클라이언트 번들로 노출되지 않습니다.**

---

## 2. 해당 파일들이 client component에서 import되지 않는지

### customerProfiles
| 소비처 | 파일 | 구분 |
|--------|------|------|
| `findOrCreateCustomerProfile` | `src/app/api/inquiries/route.ts` | API Route (서버) |

**client component에서 import 없음.**

### travelBookings
- `createTravelBooking`, `getTravelBookingByInquiryId`, `updateTravelBookingStatus` 를 **import하는 파일 없음** (후속 PR 관리자 API 등에서 사용 예정).

**client component에서 사용되지 않음.**

### reviewEligibilities
- `createReviewEligibility`, `getEligibilityByBookingId`, `getEligibilitiesByMemberId` 를 **import하는 파일 없음**.

**client component에서 사용되지 않음.**

### supabaseAdmin 직접 import
| 파일 | 구분 |
|------|------|
| `src/lib/customerProfiles.ts` | 서버 전용 lib |
| `src/lib/travelBookings.ts` | 서버 전용 lib |
| `src/lib/reviewEligibilities.ts` | 서버 전용 lib |
| `src/app/api/analytics/events/route.ts` | API Route |
| `src/lib/adminAnalytics/aggregation.ts` | 서버 전용 lib (API Route에서만 사용) |

**client component에서는 supabaseAdmin을 import하지 않습니다.**

### adminAnalytics와 AdminDashboardKpiSection
- `AdminDashboardKpiSection.tsx` ("use client")는 **`import type { AdminAnalyticsOverview } from "@/lib/adminAnalytics"`** 로 **타입만** 가져옴.
- `AdminAnalyticsOverview` 타입은 `adminAnalytics/types.ts`에서 export되며, `aggregation.ts`(supabaseAdmin 사용)의 런타임 코드는 타입만 쓰는 경우 번들에 포함되지 않음.

**결론: client component에서 customerProfiles / travelBookings / reviewEligibilities / supabaseAdmin을 import하지 않습니다.**

---

## 3. server route / server-only lib 안에서만 쓰이는지

| 모듈 | 사용처 | 구분 |
|------|--------|------|
| customerProfiles | `src/app/api/inquiries/route.ts` | API Route |
| travelBookings | (미사용 — 후속 PR 예정) | — |
| reviewEligibilities | (미사용 — 후속 PR 예정) | — |
| supabaseAdmin | customerProfiles, travelBookings, reviewEligibilities, api/analytics/events/route.ts, adminAnalytics/aggregation.ts | lib/ 또는 API Route |
| adminAnalytics/aggregation | `src/app/api/admin/dashboard/route.ts`, `src/app/api/admin/product-taxonomies/route.ts` | API Route |
| SupabaseStorageProvider (service_role) | `src/lib/storage/index.ts` → `getStorageProvider()` | API Route (uploads 등) |

**모든 사용처가 API Route 또는 서버 전용 lib입니다.**

---

## 4. 권장 강화: server-only 적용 (적용 완료)

검증상으로는 안전하나, **실수로 client에서 import 시 빌드 단계에서 막기 위해** 다음을 적용함.

- **`server-only` 패키지** 설치 완료.
- 아래 파일 상단에 **`import "server-only"`** 추가:
  - `src/lib/supabaseAdmin.ts`
  - `src/lib/customerProfiles.ts`
  - `src/lib/travelBookings.ts`
  - `src/lib/reviewEligibilities.ts`

이제 위 모듈을 client component에서 import하면 **빌드 에러**가 발생합니다.

---

**검증 일자:** PR1 보완 직후  
**검증자:** Cursor (요청 기준으로 코드/번들 검색 수행)

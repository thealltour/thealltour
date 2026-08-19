# 상품(Product) · 출발일/가격 · 상세일정 스키마 및 등록 API 발췌

요청: 사이트 코드에서 상품·출발일/가격·상세일정의 DB/TypeScript 구조와, 익스텐션이 수집한 JSON을 받아 등록하는 API를 발췌.
코드는 수정하지 않고, 관련 파일만 발췌·정리함. (작성일: 2026-08-19)

## 핵심 요약

- Prisma는 쓰지 않는다. **Supabase/PostgreSQL** + TypeScript 타입.
- **출발일/가격(Schedule)과 상세일정(Itinerary)은 별도 테이블이 아니다.** 모두 `public.products`의 **jsonb 컬럼**에 저장한다.
  - 출발일/가격: `departure_schedules_json`
  - 상세일정(권장): `itinerary_v2_json`
  - 레거시 일정: `itinerary_days_json`, `detailed_schedule`(text), `itinerary`(text)
- 익스텐션 수집 JSON 수신 엔드포인트: **`POST /api/admin/products/import-external`**
- 관리자 폼 수동 등록: `POST /api/admin/products` (같은 `products` 테이블)

TypeScript 단일 소스: `src/types/product.ts`

---

## 1. 전체 흐름 (익스텐션 → DB)

```
[Chrome 익스텐션]
  tools/thealltour_extension/content.js  scrapePagePayload()
  tools/thealltour_extension/background.js  importExternal()
  POST {apiBase}/api/admin/products/import-external
  credentials: include (관리자 쿠키)
  body: ImportExternalBody (아래 2절)

        │
        ▼
[1. API 라우트]
  src/app/api/admin/products/import-external/route.ts
  - CORS (chrome-extension:// origin)
  - requireAdminSession()
  - product_source_url 중복 검사 (409)
  - Gemini/OpenAI 키 확인

        │
        ▼
[2. AI 파싱]  parseExternalProductPage()
  src/lib/admin/externalImport/parseExternalProductPage.ts
  - cleanHtmlStructure / rawHtmlText → 메타 + 일정 스키마

        │
        ▼
[3. 병합]  mergeExternalImport()
  - 익스텐션이 준 갤러리 URL·히어로·SEO 해시태그·itineraryBlocks와 AI 결과 병합

        │
        ▼
[4. DB 매핑]  mapExternalParsedToInsert()
  src/lib/admin/externalImport/mapExternalParsedToInsert.ts
  - hanatourCalendarPayload → departure_schedules_json + min price
  - itineraryBlocks/AI 일정 → itinerary_v2_json
  - packageCatalog → package_catalog_json

        │
        ▼
[5. 저장]
  insertProductWithSchemaFallback()
  supabaseAdmin.from("products").insert(...)
  → 201 { id, message, provider, parsed }
```

---

## 2. 익스텐션이 보내는 Request Body

파일: `src/app/api/admin/products/import-external/route.ts` (`ImportExternalBody`)

익스텐션 수집 원본: `tools/thealltour_extension/content.js` `scrapePagePayload()` 반환값.

```ts
type ImportExternalBody = {
  /** 페이지에서 추출한 구조화 HTML (AI 메타/일정 파싱 입력). rawHtmlText와 둘 중 하나 필수 */
  cleanHtmlStructure?: string;
  /** 상품 갤러리 이미지 URL */
  productGalleryUrls?: string[];
  /** 히어로(대표) 이미지 URL */
  heroImageUrl?: string;
  /** 페이지에서 읽은 상품명 (AI title보다 우선) */
  sourceProductTitle?: string;
  /** SEO 해시태그 (# 없이) */
  seoHashtags?: string[];
  /** 원본 상품 URL. 중복 등록 방지 키 */
  product_source_url?: string;
  /** @deprecated 관리자 수동 폼용. 페이지 플레인텍스트 */
  rawHtmlText?: string;
  /** DOM에서 추출한 일차별 일정 블록 */
  itineraryBlocks?: unknown[];
  /** 하나투어 달력(출발일·가격) 페이로드 */
  hanatourCalendarPayload?: unknown;
  /** 호텔/관광지/선택관광 카탈로그 */
  packageCatalog?: unknown;
};
```

익스텐션이 실제로 보내는 필드 (`content.js`):

```js
{
  cleanHtmlStructure,
  rawHtmlText,
  productGalleryUrls,
  heroImageUrl,
  sourceProductTitle,
  seoHashtags,
  itineraryBlocks,
  itineraryExtractMeta,   // 서버 ImportExternalBody에는 없음. 무시됨
  packageCatalog,
  hanatourCalendarPayload,
  hanatourCalendarMeta,   // 서버 ImportExternalBody에는 없음. 무시됨
  product_source_url: window.location.href,
}
```

### 2.1 itineraryBlocks 원소 형태

파일: `src/lib/admin/externalImport/itineraryBlockTypes.ts`

```ts
export type ItineraryBlockKind = "meal" | "sightseeing" | "move" | "notice" | "other";
export type ItineraryBlockDisplayRole = "summary" | "activity";

export type ItineraryBlock = {
  day?: number;
  dateText?: string;
  dayTitle?: string;
  heading: string;
  description: string;
  imageUrls: string[];
  kind?: ItineraryBlockKind;
  timeText?: string;
  timeOfDay?: "오전" | "오후" | "저녁" | "종일";
  displayRole?: ItineraryBlockDisplayRole;
};
```

### 2.2 hanatourCalendarPayload 형태

파일: `src/lib/admin/externalImport/hanatour/types.ts`

```ts
export type HanatourCalendarDay = {
  depDay: string;
  depDayNm?: string;
  adtAmt?: string;
  minAmtYn?: string;
  selected?: string;
};

export type HanatourCalendarDataRow = {
  saleProdCd?: string;
  rprsProdCd?: string;
  saleProdNm?: string;
  nrmlAmt?: number;
  adtAmt?: number;
  reserveStatus?: string;
  arrDay?: string;
  depDay?: string;
};

export type HanatourCalendarPayload = {
  prodCode?: string;
  saleProdCd?: string | null;
  rprsProdCd?: string | null;
  depDay?: string | null;
  searchCalendar?: Record<string, HanatourCalendarDay[]>; // key: YYYYMM
  calendarData?: HanatourCalendarDataRow[];
  fetchMeta?: Array<{
    yearMonth?: string;
    ok: boolean;
    error?: string;
    source?: string;
    reason?: string;
  }>;
};
```

서버에서 `mapHanatourCalendarToImport()`가 이 페이로드를 `ProductDepartureSchedule[]`로 변환하고, 최저가를 `products.price`에 넣는다.

---

## 3. 상품 등록 API (익스텐션용 Route Handler)

파일: `src/app/api/admin/products/import-external/route.ts`

- 인증: `requireAdminSession()` (더올투어 관리자 로그인 쿠키)
- CORS: `chrome-extension://` origin만 `Access-Control-Allow-Credentials: true`
- `export const maxDuration = 300;` (대형 캘린더 상품의 AI 파싱 시간 여유)
- 중복: `product_source_url`이 이미 있으면 **409** `{ message, existingId }`
- 성공: **201** `{ id, message, provider, parsed }`

```ts
import { NextRequest } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findExistingProductIdBySourceUrl } from "@/lib/admin/bandImport/checkProductSourceUrl";
import {
  buildExternalImportCorsHeaders,
  externalImportOptionsResponse,
  withExternalImportCors,
} from "@/lib/admin/externalImport/cors";
import {
  detectExternalProvider,
  getExternalProviderLabel,
  logExternalProvider,
} from "@/lib/admin/externalImport/detectExternalProvider";
import { normalizeItineraryBlocks } from "@/lib/admin/externalImport/itineraryBlockTypes";
import { hasImportAiKey, MISSING_IMPORT_AI_KEY_MESSAGE } from "@/lib/admin/ai/importAiModel";
import { parseExternalProductPage, formatExternalParseError } from "@/lib/admin/externalImport/parseExternalProductPage";
import { mergeExternalImport } from "@/lib/admin/externalImport/mergeExternalImport";
import {
  mapExternalParsedToInsert,
  summarizeExternalParsedForResponse,
} from "@/lib/admin/externalImport/mapExternalParsedToInsert";
import { normalizeHanatourCalendarPayload } from "@/lib/admin/externalImport/hanatour/types";
import { insertProductWithSchemaFallback } from "@/lib/supabaseProductsColumnFallback";
import { normalizePackageCatalog } from "@/lib/admin/packageCatalog";

export const maxDuration = 300;

export async function OPTIONS(request: NextRequest) {
  return externalImportOptionsResponse(request);
}

export async function POST(request: NextRequest) {
  const corsOnly = (body: Record<string, unknown>, status: number) =>
    withExternalImportCors(request, body, { status });

  const auth = await requireAdminSession();
  if (!auth.ok) {
    return new Response(auth.res.body, {
      status: auth.res.status,
      headers: {
        ...Object.fromEntries(auth.res.headers.entries()),
        ...buildExternalImportCorsHeaders(request),
      },
    });
  }

  let body: ImportExternalBody;
  try {
    body = (await request.json()) as ImportExternalBody;
  } catch {
    return corsOnly({ message: "요청 본문이 올바르지 않습니다." }, 400);
  }

  const cleanHtmlStructure = body.cleanHtmlStructure?.trim() ?? "";
  const rawHtmlText = body.rawHtmlText?.trim() ?? "";
  if (!cleanHtmlStructure && !rawHtmlText) {
    return corsOnly(
      { message: "페이지 HTML(cleanHtmlStructure) 또는 텍스트(rawHtmlText)가 비어 있습니다." },
      400,
    );
  }

  const productSourceUrl = body.product_source_url?.trim() ?? "";
  if (productSourceUrl) {
    const existingId = await findExistingProductIdBySourceUrl(productSourceUrl);
    if (existingId) {
      return corsOnly(
        { message: "이미 같은 원본 URL로 생성된 상품이 있습니다.", existingId },
        409,
      );
    }
  }

  if (!hasImportAiKey()) {
    return corsOnly({ message: MISSING_IMPORT_AI_KEY_MESSAGE }, 500);
  }

  const itineraryBlocks = normalizeItineraryBlocks(body.itineraryBlocks);
  const productGalleryUrls = normalizeUrlList(body.productGalleryUrls);
  const heroImageUrl = body.heroImageUrl?.trim() || null;
  const sourceProductTitle = body.sourceProductTitle?.trim() || null;
  const seoHashtags = normalizeUrlList(body.seoHashtags);
  const hanatourCalendarPayload = normalizeHanatourCalendarPayload(body.hanatourCalendarPayload);
  const packageCatalog = normalizePackageCatalog(body.packageCatalog);

  let metaResult;
  try {
    metaResult = await parseExternalProductPage({
      cleanHtmlStructure: cleanHtmlStructure || undefined,
      rawHtmlText: rawHtmlText || undefined,
      itineraryBlocks: itineraryBlocks.length > 0 ? itineraryBlocks : undefined,
      productSourceUrl,
      provider,
    });
  } catch (error) {
    console.error("[import-external] AI parse failed:", error);
    return corsOnly({ message: formatExternalParseError(error) }, 500);
  }

  const parsed = mergeExternalImport({ /* meta + 갤러리 + itineraryBlocks + AI 일정 */ });
  const insertPayload = mapExternalParsedToInsert({
    parsed,
    productSourceUrl: productSourceUrl || null,
    provider,
    sourceProductTitle,
    seoHashtags: seoHashtags.length > 0 ? seoHashtags : undefined,
    hanatourCalendarPayload,
    packageCatalog,
  });

  const insertResult = await insertProductWithSchemaFallback(
    async (payload) =>
      await supabaseAdmin.from("products").insert(payload).select("id").maybeSingle(),
    insertPayload as Record<string, unknown>,
  );

  if (insertResult.error) {
    return corsOnly(
      { message: `상품 등록에 실패했습니다. (${insertResult.error.message})` },
      500,
    );
  }
  if (!insertResult.data?.id) {
    return corsOnly({ message: "상품 등록 권한이 없습니다. (RLS 정책 확인 필요)" }, 403);
  }

  revalidateTag(CACHE_TAGS.PRODUCTS, REVALIDATE_MAX);
  revalidatePath("/products");

  return corsOnly(
    {
      id: insertResult.data.id,
      message: "외부 상품이 등록되었습니다.",
      provider: getExternalProviderLabel(provider),
      parsed: parsedSummary,
    },
    201,
  );
}
```

성공 응답 `parsed` 요약 (`summarizeExternalParsedForResponse`):

```ts
{
  title: string | null;
  price: number | null;
  duration: string | null;
  galleryCount: number;
  itineraryEventCount: number;
  itineraryImageCount: number;
  departureScheduleCount: number;
}
```

### 3.1 INSERT 시 채워지는 products 컬럼

파일: `src/lib/admin/externalImport/mapExternalParsedToInsert.ts` (발췌)

```ts
return {
  title,
  description,
  image_url: imageUrl,
  images_json: finalGallery.length > 0 ? finalGallery : null,
  category,                    // hanatour → "하나투어", modetour → "모두투어"
  theme,
  price,                       // 달력 최저가가 있으면 그 값 우선
  duration,
  overview_duration: duration,
  overview_region,
  included_items,
  excluded_items,
  optional_expenses,
  optional_tours,              // packageCatalog 선택관광 텍스트 폴백
  selling_points_json,
  booking_notes,
  is_active: true,
  status,
  meta_title,
  meta_info,                   // "항공사 편명"
  departure_flight_name,
  departure_from_airport,
  departure_to_airport,
  departure_from_date,         // 달력 있으면 첫 출발일
  departure_from_time,
  departure_to_date,
  departure_to_time,
  arrival_flight_name,
  arrival_from_airport,
  arrival_to_airport,
  arrival_from_date,
  arrival_from_time,
  arrival_to_date,
  arrival_to_time,
  itinerary_v2_json,
  theme_chart_json,
  departure_schedules_json,    // Hanatour 달력 → ProductDepartureSchedule[]
  product_source_url,
  package_catalog_json,
};
```

---

## 4. TypeScript 인터페이스 (가장 중요)

파일: `src/types/product.ts`

출발일/가격·상세일정·상품 본체는 모두 이 파일에서 정의한다.

### 4.1 출발일 / 가격 (`departure_schedules_json`)

```ts
/** 출발일별 스케줄 (departure_schedules_json) */
export type ProductDepartureSchedule = {
  /** YYYY-MM-DD 또는 표시용 "2025.07.23(수)" */
  departureDate: string;
  returnDate?: string | null;
  price?: number | null;
  /** UI 표시용 (없으면 departureDate) */
  label?: string | null;
  status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | null;
};
```

정규화: `src/lib/products/normalizeDepartureSchedules.ts`  
(`departure_date` / `departure` 별칭도 허용, 날짜는 YYYY-MM-DD로 맞춤)

계절 구간가(별도 jsonb, 출발일과 무관):

```ts
export type SeasonalPriceBands = {
  offSeason?: number | null;
  weekend?: number | null;
  peakSeason?: number | null;
};
```

### 4.2 상세일정 (`itinerary_v2_json` — 현재 권장)

```ts
export type ItineraryEventImage = {
  url: string;
  alt?: string;
  sortOrder?: number;
  isCover?: boolean;
  status?: "active" | "deleted" | "unassigned";
  isThumbnailCandidate?: boolean;
  isLogoCandidate?: boolean;
  isLowResolution?: boolean;
};

export type ItineraryV2Event = {
  timeOfDay?: "오전" | "오후" | "저녁" | "종일";
  timeText?: string;
  iconKey?: string;
  heading: string;
  description?: string;
  location?: string;
  order?: number;
  displayRole?: "summary" | "activity";
  images?: ItineraryEventImage[];
};

export type ItineraryV2Day = {
  day: number;
  dateText?: string;
  title?: string;
  coverImageUrl?: string;
  coverImages?: ItineraryEventImage[];
  events: ItineraryV2Event[];
};

export type ItineraryV2 = {
  days: ItineraryV2Day[];
};
```

레거시 구조화 일정 (`itinerary_days_json`):

```ts
export type ItineraryStructuredEvent = {
  heading: string;
  description?: string;
  timeOfDay?: "오전" | "오후" | "저녁" | "종일";
  iconKey?: string;
  images?: ItineraryEventImage[];
};

export type ItineraryStructuredDay = {
  day: number;
  dateText?: string;
  title?: string;
  coverImageUrl?: string | null;
  events: ItineraryStructuredEvent[];
};
```

타임라인용 단순 일차 (`itinerary_days` — 앱 레이어, DB 컬럼 아님):

```ts
export type ProductItineraryDay = {
  day: number;
  title?: string;
  subtitle?: string;
  description?: string;
  meals?: string[];
  hotel?: string;
};
```

### 4.3 상품 (`Product`)

```ts
export type Product = {
  id: string;
  title: string;
  description: string;
  golf_course_info?: string | null;
  golf_courses_json?: GolfCourseInfoItem[] | null;
  package_catalog_json?: PackageCatalog | null;
  image_url: string;
  images_json?: string[];
  category: string;
  theme?: string;
  destination_id?: string | null;
  product_line_id?: string | null;
  campaigns?: string[] | null;
  campaigns_json?: string[] | null;
  tags?: string[] | null;
  highlights?: string[] | null;
  price?: number;
  seasonal_price_bands?: SeasonalPriceBands | null;
  duration?: string;
  departure?: string;
  airline?: string;
  hotel?: string;
  travelStyle?: string;
  departures?: string[];
  departureSchedules?: ProductDepartureSchedule[];
  itinerary_days?: ProductItineraryDay[];
  itinerary?: string;
  inclusions?: string;
  point_benefits?: string;
  point_tourism?: string;
  point_guide?: string;
  meeting_info?: string;
  travel_insurance?: string;
  included_items?: string;
  excluded_items?: string;
  detailed_schedule?: string;
  optional_tours?: string;
  optional_expenses?: string;
  selling_points_json?: ProductSellingPoints | null;
  min_departure_people?: string;
  terms_and_notes?: string | null;
  booking_notes?: string | null;
  travel_notes?: string | null;
  booking_conditions?: string | null;
  refund_policy?: string | null;
  refund_policy_template_type?: string | null;
  booking_notes_template_type?: string | null;
  travel_notes_template_type?: string | null;
  booking_conditions_template_type?: string | null;
  terms_template_type?: string;
  product_source_url?: string;
  departure_from_airport?: string;
  departure_from_date?: string;
  departure_from_time?: string;
  departure_to_airport?: string;
  departure_to_date?: string;
  departure_to_time?: string;
  departure_flight_name?: string;
  departure_baggage_limit?: string;
  arrival_from_airport?: string;
  arrival_from_date?: string;
  arrival_from_time?: string;
  arrival_to_airport?: string;
  arrival_to_date?: string;
  arrival_to_time?: string;
  arrival_flight_name?: string;
  arrival_baggage_limit?: string;
  meta_title?: string;
  meta_description?: string;
  is_active?: boolean;
  is_recommend?: boolean;
  is_popular?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
  status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  fuel_included?: boolean;
  price_meta?: string;
  meta_info?: string;
  one_liner?: string;
  overview_json?: ProductOverview | null;
  itinerary_media_json?: Record<string, string> | null;
  itinerary_days_json?: ItineraryStructuredDay[] | null;
  itinerary_v2_json?: ItineraryV2 | null;
  theme_chart_json?: { items: Array<{ label: string; percent: number }> } | null;
  overview_accommodation?: string;
  overview_region?: string;
  overview_duration?: string;
  trust?: ProductTrust;
  options?: ProductOptions;
  campaign_card_meta?: ProductCampaignCardMeta[];
};
```

관련 서브타입:

```ts
export type ProductSellingPoints = {
  corePoints?: string | null;
  tourism?: string | null;
  meals?: string | null;
  transport?: string | null;
  insurance?: string | null;
};

export type PackageCatalog = {
  hotels: { name: string }[];
  attractions: { name: string; description: string; imageUrls: string[] }[];
  optionalTours: {
    name: string;
    description: string;
    priceText?: string;
    scheduleText?: string;
    alternativeText?: string;
    included?: boolean;
    imageUrls: string[];
  }[];
  referenceNotes?: string;
};

export type ProductOptions = {
  basePrice: number;
  currency: "KRW";
  requiredGroups?: string[];
  groups: ProductOptionGroup[];
};
```

앱이 DB row를 읽을 때 `departure_schedules_json` → `departureSchedules`로 hydrate한다 (`src/lib/products.ts`).

---

## 5. DB 스키마 (`public.products`)

별도 `schedules` / `itineraries` 테이블 없음. 컬럼은 baseline + 다수 migration의 `ADD COLUMN IF NOT EXISTS`로 누적된다.

### 5.1 베이스 테이블

파일: `supabase/products_safe_upgrade.sql`, `supabase/schema/baseline.sql`

```sql
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  image_url text not null,
  category text not null default '여행상품',
  price integer,          -- 성인 1인 기준가 (KRW). 달력 최저가로 덮어쓸 수 있음
  duration text,
  itinerary text,         -- 레거시 일정 텍스트
  inclusions text,
  is_active boolean not null default true,
  sort_order integer,
  created_at timestamptz not null default now()
);
```

### 5.2 출발일 / 가격 컬럼

```sql
-- supabase/migrations/20260628100000_departure_schedules_json.sql
alter table public.products add column if not exists departure_schedules_json jsonb;
comment on column public.products.departure_schedules_json is
  '출발일별 스케줄 [{ departureDate, returnDate?, price?, label?, status? }]';

-- supabase/migrations/20260407120000_products_seasonal_price_bands.sql
alter table public.products add column if not exists seasonal_price_bands jsonb;
-- { "offSeason"?, "weekend"?, "peakSeason"? } KRW 정수
```

### 5.3 상세일정 컬럼

```sql
-- supabase/products_itinerary_days_json.sql  (STEP 0, 레거시 구조화)
alter table public.products add column if not exists itinerary_days_json jsonb;
-- [{ day, title?, coverImageUrl?, events: [{ heading, description?, timeOfDay?, iconKey? }] }]

-- supabase/products_itinerary_v2_json.sql  (STEP 1, 권장)
alter table public.products add column if not exists itinerary_v2_json jsonb;
-- { days: [{ day, dateText?, title?, coverImageUrl?, events: [...] }] }

-- supabase/products_itinerary_media_json.sql
alter table public.products add column if not exists itinerary_media_json jsonb;
-- Day별 대표 이미지 { "1": "https://...", "2": "..." }

-- 레거시 텍스트
-- itinerary text
-- detailed_schedule text   (supabase/products_travel_fields_upgrade.sql)
```

상세 화면 우선순위: `itinerary_v2_json` → `itinerary_days_json` → `detailed_schedule` / `itinerary` 텍스트.

### 5.4 나머지 products 컬럼 (누적)

| 컬럼 | 타입 | 출처(대표) |
|------|------|------------|
| `theme` | text | PR10-B1 |
| `images_json` | jsonb | `products_images_json_upgrade.sql` |
| `product_source_url` | text | PR10-B1 |
| `destination_id` | uuid → product_taxonomies | `20260319000000_products_taxonomy_axes.sql` |
| `product_line_id` | uuid → product_taxonomies | 동일 |
| `campaigns_json` | jsonb | 동일 |
| `tags_json` | jsonb | 동일 |
| `point_benefits`, `point_tourism`, `point_guide`, `meeting_info`, `travel_insurance` | text | `products_travel_fields_upgrade.sql` |
| `included_items`, `excluded_items`, `detailed_schedule`, `optional_tours`, `terms_and_notes` | text | 동일 |
| `optional_expenses` | text | `20260627100000_add_optional_expenses_selling_points.sql` |
| `selling_points_json` | jsonb | 동일. `{ corePoints, tourism, meals, transport, insurance }` |
| `min_departure_people` | integer | PR10-B1 |
| `booking_notes`, `travel_notes`, `booking_conditions` | text | `20260408120000_add_product_notice_fields.sql` |
| `*_template_type`, `refund_policy` | text | `20260409120000`, `20260411120000` |
| `departure_*` / `arrival_*` (공항·일시·편명·수하물) | text | PR10-B2 / flight upgrade |
| `meta_title`, `meta_description` | text | PR10-B2 |
| `status` | text | `AVAILABLE` \| `LIMITED` \| `SOLD_OUT` \| `CONSULT_REQUIRED` |
| `options` | jsonb | ProductOptions |
| `fuel_included` | boolean | |
| `price_meta`, `meta_info`, `one_liner` | text | |
| `overview_json`, `overview_cover_url` | jsonb / text | overview upgrade |
| `overview_accommodation`, `overview_region`, `overview_duration` | text | |
| `theme_chart_json` | jsonb | `{ items: [{ label, percent }] }` |
| `golf_course_info` | text | `20260818010000` |
| `golf_courses_json` | jsonb | `20260818163000` `[{ name, content }]` |
| `package_catalog_json` | jsonb | `20260818183000` PackageCatalog |

---

## 6. 관리자 수동 등록 API (참고)

파일: `src/app/api/admin/products/route.ts`

익스텐션이 아니라 관리자 상품 폼이 호출한다. 같은 `products` 테이블에 INSERT.

`POST /api/admin/products` body (`ProductBody`)는 폼 필드를 거의 1:1로 받는다. 출발일·일정은 이미 정규화된 JSON으로 들어온다:

```ts
departure_schedules_json?: Array<Record<string, unknown>> | null;
itinerary_days_json?: Array<{ day: number; dateText?: string; title?: string; ... }> | null;
itinerary_v2_json?: ItineraryV2 | null;
seasonal_price_bands?: Record<string, unknown> | null;
```

저장 시:

```ts
insertPayload.departure_schedules_json = departureSchedulesToJsonColumn(
  normalizeDepartureSchedulesFromUnknown(body.departure_schedules_json),
);
```

수정: `PATCH/PUT /api/admin/products/[id]` (`src/app/api/admin/products/[id]/route.ts`) — 동일 컬럼 업데이트.

밴드(텍스트) 자동 등록은 별도 `POST /api/admin/products/import-band`. 발췌: `docs/band-import-text-parse-excerpt.md`.

---

## 7. 관련 파일 목록

| 역할 | 경로 |
|------|------|
| TS 상품/일정/출발일 타입 | `src/types/product.ts` |
| 관리자 폼 상태 | `src/types/adminProductForm.ts` |
| products 베이스 DDL | `supabase/products_safe_upgrade.sql` |
| 출발일 jsonb | `supabase/migrations/20260628100000_departure_schedules_json.sql` |
| 일정 v2 jsonb | `supabase/products_itinerary_v2_json.sql` |
| 익스텐션 등록 API | `src/app/api/admin/products/import-external/route.ts` |
| 요청 body → INSERT 매핑 | `src/lib/admin/externalImport/mapExternalParsedToInsert.ts` |
| AI 파싱 스키마 | `src/lib/admin/externalImport/externalProductSchema.ts` |
| 달력 → 출발일 매핑 | `src/lib/admin/externalImport/hanatour/mapHanatourCalendarToImport.ts` |
| 출발일 정규화 | `src/lib/products/normalizeDepartureSchedules.ts` |
| 수동 등록 API | `src/app/api/admin/products/route.ts` |
| 익스텐션 scrape payload | `tools/thealltour_extension/content.js` |
| 익스텐션 POST | `tools/thealltour_extension/background.js` `importExternal()` |

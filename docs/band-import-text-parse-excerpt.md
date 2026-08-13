# 밴드/HWP 텍스트 → 상품 상세 파싱·자동 등록 백엔드 발췌

요청: 텍스트(또는 HWP 텍스트)를 받아 상품 상세 정보를 파싱/자동 설정하는 백엔드 로직.
코드는 수정하지 않고, 관련 파일만 발췌·정리함. (작성일: 2026-08-13)

## 전체 흐름

```
[관리자 UI]
  src/components/admin/band/BandNewProductPage.tsx
  POST /api/admin/products/import-band
  body: { bandText, hwpText, product_source_url?, imageUrls? }

        │
        ▼
[1. API 라우트]
  src/app/api/admin/products/import-band/route.ts
  - 관리자 세션 확인
  - bandText / hwpText 필수(둘 중 하나)
  - product_source_url 중복 검사
  - OPENAI_API_KEY 확인

        │
        ▼
[2. 파싱 서비스]  parseBandProductText()
  src/lib/admin/bandImport/parseBandProductText.ts
  ① 원문 truncate (메타 18,000자 / 일정 48,000자)
  ② OpenAI generateObject #1 → bandProductMetaSchema (상품 메타)
  ③ OpenAI generateObject #2 → bandItineraryOnlySchema (일차별 일정)
  ④ mergeBandParsed(meta, itinerary) → BandParsedProduct

        │
        ▼
[3. DB 매핑]  mapBandParsedToInsert()
  src/lib/admin/bandImport/mapBandParsedToInsert.ts
  BandParsedProduct + 원문 + 이미지 URL → products INSERT payload

        │
        ▼
[4. 저장]
  insertProductWithSchemaFallback()
  supabaseAdmin.from("products").insert(...)
  → { id, parsed: { title, price, duration, status } }
```

HWP 파일 업로드는 지원하지 않음. UI에서 HWP를 열어 텍스트를 복사·붙여넣기한 뒤 `hwpText`로 전달한다.

---

## 1. API 엔드포인트 / 컨트롤러

파일: `src/app/api/admin/products/import-band/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findExistingProductIdBySourceUrl } from "@/lib/admin/bandImport/checkProductSourceUrl";
import { parseBandProductText, formatBandParseError } from "@/lib/admin/bandImport/parseBandProductText";
import {
  mapBandParsedToInsert,
  summarizeBandParsedForResponse,
} from "@/lib/admin/bandImport/mapBandParsedToInsert";
import { insertProductWithSchemaFallback } from "@/lib/supabaseProductsColumnFallback";

type ImportBandBody = {
  bandText?: string;
  hwpText?: string;
  product_source_url?: string;
  imageUrls?: string[];
};

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: ImportBandBody;
  try {
    body = (await request.json()) as ImportBandBody;
  } catch {
    return NextResponse.json({ message: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const bandText = body.bandText?.trim() ?? "";
  const hwpText = body.hwpText?.trim() ?? "";
  if (!bandText && !hwpText) {
    return NextResponse.json(
      { message: "밴드 본문 또는 HWP 텍스트 중 하나 이상을 입력해 주세요." },
      { status: 400 },
    );
  }

  const productSourceUrl = body.product_source_url?.trim() ?? "";
  if (productSourceUrl) {
    const existingId = await findExistingProductIdBySourceUrl(productSourceUrl);
    if (existingId) {
      return NextResponse.json(
        {
          message: "이미 같은 원본 URL로 생성된 상품이 있습니다.",
          existingId,
        },
        { status: 409 },
      );
    }
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { message: "OPENAI_API_KEY가 설정되어 있지 않습니다. 배포 환경 변수를 확인해 주세요." },
      { status: 500 },
    );
  }

  let parsed;
  try {
    parsed = await parseBandProductText({ bandText, hwpText });
  } catch (error) {
    console.error("[import-band] AI parse failed:", error);
    return NextResponse.json({ message: formatBandParseError(error) }, { status: 500 });
  }

  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((v): v is string => typeof v === "string")
    : [];

  const insertPayload = mapBandParsedToInsert({
    parsed,
    bandText,
    hwpText,
    productSourceUrl: productSourceUrl || null,
    imageUrls,
  });

  const insertResult = await insertProductWithSchemaFallback(
    async (payload) =>
      await supabaseAdmin.from("products").insert(payload).select("id").maybeSingle(),
    insertPayload as Record<string, unknown>,
  );

  if (insertResult.strippedColumns.length > 0) {
    console.warn("[import-band] stripped missing columns:", insertResult.strippedColumns.join(", "));
  }

  if (insertResult.error) {
    console.error("[import-band] insert failed:", insertResult.error);
    return NextResponse.json(
      { message: `상품 등록에 실패했습니다. (${insertResult.error.message})` },
      { status: 500 },
    );
  }

  if (!insertResult.data?.id) {
    return NextResponse.json(
      { message: "상품 등록 권한이 없습니다. (RLS 정책 확인 필요)" },
      { status: 403 },
    );
  }

  revalidateTag(CACHE_TAGS.PRODUCTS, REVALIDATE_MAX);
  revalidatePath("/products");

  return NextResponse.json(
    {
      id: insertResult.data.id,
      message: "밴드 상품이 등록되었습니다.",
      parsed: summarizeBandParsedForResponse(parsed),
    },
    { status: 201 },
  );
}
```

호출 UI: `src/components/admin/band/BandNewProductPage.tsx` (페이지: `/theall_manager_only/products/new-band`)

```ts
const res = await fetch("/api/admin/products/import-band", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    bandText,
    hwpText,
    product_source_url: productSourceUrl.trim() || undefined,
    imageUrls: parseImageUrls(imageUrlsText),
  }),
});
```

원본 URL 중복 검사: `src/lib/admin/bandImport/checkProductSourceUrl.ts`

```ts
export async function findExistingProductIdBySourceUrl(
  productSourceUrl: string,
): Promise<string | null> {
  const url = productSourceUrl.trim();
  if (!url) return null;

  const { data } = await supabaseAdmin
    .from("products")
    .select("id")
    .eq("product_source_url", url)
    .limit(1)
    .maybeSingle();

  return data?.id ? String(data.id) : null;
}
```

---

## 3. 요청(Request) DTO / 파라미터

라우트에 인라인된 요청 타입 (`ImportBandBody`):

```ts
type ImportBandBody = {
  bandText?: string;           // 네이버 밴드 게시글 본문
  hwpText?: string;            // HWP에서 복사한 텍스트 (파일 업로드 아님)
  product_source_url?: string; // 원본 URL (있으면 중복 등록 409)
  imageUrls?: string[];        // 상품 이미지 URL 목록
};
```

파싱 서비스 입력: `src/lib/admin/bandImport/parseBandProductText.ts`

```ts
export type ParseBandProductTextInput = {
  bandText: string;
  hwpText: string;
};
```

DB 매핑 입력: `src/lib/admin/bandImport/mapBandParsedToInsert.ts`

```ts
export type MapBandParsedInput = {
  parsed: BandParsedProduct;
  bandText: string;
  hwpText: string;
  productSourceUrl?: string | null;
  imageUrls?: string[];
};
```

성공 응답 (201):

```ts
{
  id: string;
  message: "밴드 상품이 등록되었습니다.";
  parsed: {
    title: string | null;
    price: number | null;
    duration: string | null;
    status: string | null;
  };
}
```

---

## 2. 파싱·저장 비즈니스 로직

### 2-1. 원문 길이 제한 (HWP 우선)

파일: `src/lib/admin/bandImport/bandTextTruncate.ts`

```ts
const ITINERARY_MARKERS = /(?:^|\n)\s*(?:제\s*)?\d+\s*일차|일정표|DAY\s*\d+/i;

export const BAND_MAX_META_CHARS = 18_000;
export const BAND_MAX_ITINERARY_CHARS = 48_000;

export function truncateBandText(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars);
}

/** 긴 HWP에서 일정표 구간을 우선 보존해 잘라냅니다. */
export function truncateBandItineraryText(text: string, maxChars: number = BAND_MAX_ITINERARY_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const match = trimmed.match(ITINERARY_MARKERS);
  if (!match?.index || match.index <= 0) {
    return trimmed.slice(0, maxChars);
  }

  const start = Math.max(0, match.index - 500);
  const slice = trimmed.slice(start, start + maxChars);
  return slice.length < maxChars && start > 0
    ? trimmed.slice(Math.max(0, trimmed.length - maxChars))
    : slice;
}

export function buildBandMetaSourceText(hwpText: string, bandText: string): string {
  const parts: string[] = [];
  const hwp = hwpText.trim();
  const band = bandText.trim();
  if (hwp) parts.push(hwp);
  if (band) parts.push(band);
  return truncateBandText(parts.join("\n\n"), BAND_MAX_META_CHARS);
}

export function buildBandItinerarySourceText(hwpText: string, bandText: string): string {
  const hwp = hwpText.trim();
  const band = bandText.trim();
  const source = hwp || band;
  return truncateBandItineraryText(source);
}
```

### 2-2. OpenAI 2-pass 파서

파일: `src/lib/admin/bandImport/parseBandProductText.ts`

핵심 규칙:
- HWP 원문이 포함/불포함/선택경비/비고/약관/항공표의 권위 소스
- 밴드 본문은 HWP에 없는 홍보 문단(`band_marketing_copy`)의 권위 소스
- 1차: 메타데이터만 (`bandProductMetaSchema`)
- 2차: 일정만 (`bandItineraryOnlySchema`)
- 모델: `process.env.BAND_IMPORT_MODEL` 또는 기본 `gpt-4o-mini`

```ts
import "server-only";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { bandItineraryOnlySchema } from "@/lib/admin/bandImport/bandItineraryOnlySchema";
import { bandProductMetaSchema } from "@/lib/admin/bandImport/bandProductMetaSchema";
import { mergeBandParsed } from "@/lib/admin/bandImport/mergeBandParsed";
import type { BandParsedProduct } from "@/lib/admin/bandImport/productParserSchema";
import {
  buildBandItinerarySourceText,
  buildBandMetaSourceText,
} from "@/lib/admin/bandImport/bandTextTruncate";

export type ParseBandProductTextInput = {
  bandText: string;
  hwpText: string;
};

export const BAND_IMPORT_MODEL = process.env.BAND_IMPORT_MODEL?.trim() || "gpt-4o-mini";

const META_SYSTEM_PROMPT = `You map Korean travel-agency band/HWP text into a strict JSON metadata schema.
Rules:
- Do NOT summarize, omit, paraphrase, or merge lines for prices, conditions, hotel names, inclusions, or surcharges.
- Fill every schema field when the source contains relevant data. Use null only when truly absent.
- HWP document text is authoritative for inclusions, exclusions, optional expenses, booking notes, terms, and flight tables.
- Band post text is authoritative for band_marketing_copy (promotional paragraphs not in HWP).
- description: copy HWP product overview/selling paragraphs verbatim. Do NOT include day-by-day schedule (handled separately).
- included_items, excluded_items, optional_expenses, booking_notes, travel_notes, booking_conditions, terms_and_notes, refund_policy: preserve line breaks, ■ bullets, and [category] brackets.
- Also extract each surcharge/option into options[] (name + priceText) in addition to booking_notes when present.
- overview_accommodation: hotel names like "천홍 호텔 또는 동급".
- seasonal_price_bands: numeric KRW integers only. Put date ranges and conditions in seasonal_price_band_notes.
- Flight: split outbound (가는편) and return (오는편/귀국). Use YYYY-MM-DD for dates, HH:mm for times when available.
- departure_schedules: each row from 출발일/회차/가격 tables = one array item (departure_date, return_date, price, label, status). Multiple departure dates = multiple items. departure_from_date = first schedule date only when no single flight departure date in the table. If the source text has NO year as "20xx년", do NOT guess a year in departure_date — use month/day only (e.g. 7/23 or 07.23) and put the display text in label. Use YYYY-MM-DD only when "20xx년" (or an explicit tour year) is stated in the source. status defaults to AVAILABLE when not stated.
- selling_points_json: extract 핵심포인트, 관광, 식사, 교통, 보험 sections verbatim when present.
- point_tourism, point_guide, meeting_info, travel_insurance: "O" or "X" only when explicitly stated; else null.
- Do NOT build itinerary_v2_json in this pass.`;

const ITINERARY_SYSTEM_PROMPT = `You extract day-by-day itinerary from Korean travel HWP/band schedule text into itinerary_v2_json only.
Rules:
- Focus on the schedule table / 일차 sections in the source.
- itinerary_v2_json[].description must include meeting times, transfer duration (e.g. 약 40분), golf course names, and ALL schedule details for that day. Do NOT summarize.
- meals: copy breakfast/lunch/dinner from the schedule row verbatim.
- Preserve every day from 1일차 through the last day. Do not skip days.
- Use null for itinerary_v2_json only when no schedule exists at all.`;

export async function parseBandProductText(
  input: ParseBandProductTextInput,
): Promise<BandParsedProduct> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되어 있지 않습니다.");
  }

  const model = openai(BAND_IMPORT_MODEL);

  const { object: meta } = await generateObject({
    model,
    schema: bandProductMetaSchema,
    system: META_SYSTEM_PROMPT,
    prompt: buildBandMetaPrompt(input),
  });

  const { object: itinerary } = await generateObject({
    model,
    schema: bandItineraryOnlySchema,
    system: ITINERARY_SYSTEM_PROMPT,
    prompt: buildBandItineraryPrompt(input),
  });

  return mergeBandParsed(meta, itinerary);
}
```

병합: `src/lib/admin/bandImport/mergeBandParsed.ts`

```ts
export function mergeBandParsed(
  meta: BandParsedMeta,
  itinerary: BandParsedItineraryOnly,
): BandParsedProduct {
  return {
    ...meta,
    itinerary_v2_json: itinerary.itinerary_v2_json,
  };
}
```

### 2-3. 파싱 결과 스키마 (AI 출력 DTO)

공유 서브스키마: `src/lib/admin/bandImport/bandSharedSchemas.ts`

```ts
export const itineraryDaySchema = z.object({
  day: z.number().int().positive().describe("일차 (1, 2, 3, 4...)"),
  title: nullableString.describe("해당 일차 타이틀 (예: 인천 출발 / 연태 도착 / 18홀 라운드)"),
  description: nullableString.describe(
    `이동·미팅·골프장·라운드 등 해당 일차 모든 상세 행동 지침. ${VERBATIM}`,
  ),
  meals: mealsSchema,
});

export const bandOptionSchema = z.object({
  name: z.string().describe("옵션 명칭 (예: 싱글룸 이용 추가, 취원코스 주중 변경)"),
  priceText: z.string().describe("옵션 가격 및 조건 원문 (예: 인/박/4만원)"),
});
```

메타 스키마: `src/lib/admin/bandImport/bandProductMetaSchema.ts` (주요 필드)

```ts
export const bandProductMetaSchema = z.object({
  title: nullableString,
  description: nullableString,          // HWP 개요·셀링 (일차 일정 제외)
  band_marketing_copy: nullableString,  // 밴드 전용 홍보 문단
  one_liner: nullableString,
  price: z.number().int().positive().nullable(),
  duration: nullableString,
  category: nullableString,
  theme: nullableString,
  overview_accommodation: nullableString,
  overview_region: nullableString,
  included_items: nullableString,
  excluded_items: nullableString,
  optional_expenses: nullableString,
  optional_tours: nullableString,
  booking_notes: nullableString,
  options: z.array(bandOptionSchema).nullable(),
  status: z.enum(["AVAILABLE", "LIMITED", "SOLD_OUT", "CONSULT_REQUIRED"]).nullable(),
  // 항공 가는편/오는편 필드들...
  departure_schedules: z.array(z.object({
    departure_date: nullableString,
    return_date: nullableString,
    price: z.number().int().positive().nullable(),
    label: nullableString,
    status: z.enum(["AVAILABLE", "LIMITED", "SOLD_OUT"]).nullable(),
  })).nullable(),
  seasonal_price_bands: z.object({
    offSeason: nullablePrice,
    weekend: nullablePrice,
    peakSeason: nullablePrice,
  }).nullable(),
  seasonal_price_band_notes: seasonalPriceBandNotesSchema,
  selling_points_json: sellingPointsSchema,
  detailed_schedule: nullableString,
  travel_notes: nullableString,
  booking_conditions: nullableString,
  terms_and_notes: nullableString,
  refund_policy: nullableString,
  min_departure_people: nullableString,
  meta_title: nullableString,
  meta_description: nullableString,
  point_benefits: nullableString,
  point_tourism: oxFieldSchema,   // "O" | "X" | null
  point_guide: oxFieldSchema,
  meeting_info: oxFieldSchema,
  travel_insurance: oxFieldSchema,
});
```

일정 전용 스키마: `src/lib/admin/bandImport/bandItineraryOnlySchema.ts`

```ts
export const bandItineraryOnlySchema = z.object({
  itinerary_v2_json: z
    .array(itineraryDaySchema)
    .nullable()
    .describe("1일차부터 마지막 날까지 일정. 텍스트 유실 엄금."),
});
```

병합 타입: `src/lib/admin/bandImport/productParserSchema.ts`

```ts
export const productParserSchema = bandProductMetaSchema.extend(bandItineraryOnlySchema.shape);
export type BandParsedProduct = z.infer<typeof productParserSchema>;
```

### 2-4. 파싱 결과 → products INSERT payload

파일: `src/lib/admin/bandImport/mapBandParsedToInsert.ts`

하는 일:
- 제목/설명/가격/카테고리/테마/포함·불포함 등 상품 컬럼 매핑
- 출발일 스케줄 연도 정규화 (`20xx년`이 원문에 있을 때만 YYYY-MM-DD, 없으면 KST 올해로 force)
- `itinerary_v2_json` Day/Event 구조로 변환
- 옵션 가격 텍스트 → `priceDelta`
- 스케줄 최저가를 `products.price`로 사용

```ts
export function mapBandParsedToInsert(input: MapBandParsedInput): Record<string, unknown> {
  const { parsed, bandText, hwpText, productSourceUrl, imageUrls } = input;
  const images = normalizeImageUrls(imageUrls);
  const imageUrl = images[0] ?? BAND_IMPORT_PLACEHOLDER_IMAGE;

  const title = trimOrNull(parsed.title) ?? "제목 미정 상품";
  const description = buildBandDescription(parsed, bandText, hwpText);
  const duration = trimOrNull(parsed.duration);

  const seasonalBands = seasonalPriceBandsToJsonColumn(
    parseSeasonalPriceBandsFromUnknown(parsed.seasonal_price_bands),
  );

  const allowedYears = extractExplicitScheduleYearsFromText(`${bandText}\n${hwpText}`);
  const defaultYear = inferBandScheduleDefaultYear(bandText, hwpText);
  const forceDefaultYear = allowedYears.length === 0;
  const dateOpts: NormalizeBandDateOptions = { forceDefaultYear, allowedYears };
  const departureSchedulesJson = mapBandDepartureSchedules(parsed, defaultYear, dateOpts);

  let price = toSafeInteger(parsed.price);
  const scheduleMinPrice = getDepartureSchedulesMinPrice(departureSchedulesJson ?? undefined);
  if (scheduleMinPrice != null) {
    price = scheduleMinPrice;
  } else if (price == null && seasonalBands) {
    const vals = [seasonalBands.offSeason, seasonalBands.weekend, seasonalBands.peakSeason].filter(
      (v): v is number => typeof v === "number" && v > 0,
    );
    if (vals.length > 0) price = Math.min(...vals);
  }

  const itineraryV2 = mapItineraryDaysToV2(parsed.itinerary_v2_json);
  const bookingNotes = buildBandBookingNotes(parsed.booking_notes, parsed.seasonal_price_band_notes);
  const productOptions = mapBandOptionsToProductOptions(parsed.options, price);
  const sellingPoints = sellingPointsToJsonColumn(parsed.selling_points_json ?? undefined);

  const payload: Record<string, unknown> = {
    title,
    description,
    image_url: imageUrl,
    images_json: images.length > 0 ? images : null,
    category: trimOrNull(parsed.category) ?? BAND_IMPORT_DEFAULT_CATEGORY, // "여행상품"
    theme: trimOrNull(parsed.theme),
    one_liner: trimOrNull(parsed.one_liner),
    price,
    seasonal_price_bands: seasonalBands,
    duration,
    overview_duration: duration,
    overview_region: trimOrNull(parsed.overview_region),
    overview_accommodation: trimOrNull(parsed.overview_accommodation),
    included_items: trimOrNull(parsed.included_items),
    excluded_items: trimOrNull(parsed.excluded_items),
    optional_expenses: trimOrNull(parsed.optional_expenses),
    optional_tours: trimOrNull(parsed.optional_tours),
    selling_points_json: sellingPoints,
    detailed_schedule: trimOrNull(parsed.detailed_schedule),
    travel_notes: trimOrNull(parsed.travel_notes),
    booking_conditions: trimOrNull(parsed.booking_conditions),
    terms_and_notes: trimOrNull(parsed.terms_and_notes),
    refund_policy: trimOrNull(parsed.refund_policy),
    min_departure_people: trimOrNull(parsed.min_departure_people),
    meta_title: trimOrNull(parsed.meta_title),
    meta_description: trimOrNull(parsed.meta_description),
    point_benefits: trimOrNull(parsed.point_benefits),
    point_tourism: parsed.point_tourism ?? null,
    point_guide: parsed.point_guide ?? null,
    meeting_info: parsed.meeting_info ?? null,
    travel_insurance: parsed.travel_insurance ?? null,
    booking_notes: bookingNotes,
    options: productOptions,
    is_active: true,
    status: parsed.status ?? "AVAILABLE",
    // 항공편 필드들 (가는편/오는편) ...
    itinerary_v2_json: itineraryV2,
    departure_schedules_json: departureSchedulesJson,
    product_source_url: trimOrNull(productSourceUrl ?? undefined),
  };

  return payload;
}
```

일정 → `ItineraryV2` 변환 (같은 파일):

```ts
export function mapItineraryDaysToV2(days: BandParsedItineraryDay[] | null): ItineraryV2 | null {
  if (!days?.length) return null;
  const mapped = days
    .slice()
    .sort((a, b) => a.day - b.day)
    .map((day) => {
      const events: ItineraryV2["days"][number]["events"] = [];
      if (day.meals?.breakfast?.trim()) {
        events.push({ heading: "조식", description: day.meals.breakfast.trim(), timeOfDay: "오전" });
      }
      if (day.meals?.lunch?.trim()) {
        events.push({ heading: "중식", description: day.meals.lunch.trim(), timeOfDay: "오후" });
      }
      if (day.meals?.dinner?.trim()) {
        events.push({ heading: "석식", description: day.meals.dinner.trim(), timeOfDay: "저녁" });
      }
      const description = day.description?.trim();
      if (description) {
        events.push({
          heading: day.title?.trim() || `${day.day}일차`,
          description,
          timeOfDay: "종일",
        });
      }
      if (events.length === 0) return null;
      return { day: day.day, title: day.title?.trim() || `${day.day}일차`, events };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);
  return mapped.length > 0 ? { days: mapped } : null;
}
```

옵션 매핑: `src/lib/admin/bandImport/mapBandOptionsToProductOptions.ts`

```ts
export function mapBandOptionsToProductOptions(
  options: BandParsedOption[] | null | undefined,
  basePrice: number | null,
): ProductOptions | null {
  // options[].name + priceText("인/박/4만원") → groups[0].items[].label / meta / priceDelta
}
```

### 2-5. DB insert (스키마 컬럼 누락 시 fallback)

파일: `src/lib/supabaseProductsColumnFallback.ts`

원격 `products` 테이블에 아직 없는 컬럼이 있으면 PostgREST 에러 메시지를 파싱해 해당 키를 빼고 재시도한다.

```ts
export async function insertProductWithSchemaFallback(
  insert: ProductsMutator,
  payload: Record<string, unknown>,
  maxRetries = 6,
): Promise<SupabaseMutationResult & { strippedColumns: string[] }> {
  return mutateProductWithSchemaFallback(insert, payload, maxRetries);
}
```

---

## 관련 파일 목록

| 역할 | 경로 |
|---|---|
| API 라우트 | `src/app/api/admin/products/import-band/route.ts` |
| 관리자 UI (요청 송신) | `src/components/admin/band/BandNewProductPage.tsx` |
| 페이지 엔트리 | `src/app/theall_manager_only/products/new-band/page.tsx` |
| AI 파서 | `src/lib/admin/bandImport/parseBandProductText.ts` |
| 원문 truncate | `src/lib/admin/bandImport/bandTextTruncate.ts` |
| 메타 Zod 스키마 | `src/lib/admin/bandImport/bandProductMetaSchema.ts` |
| 일정 Zod 스키마 | `src/lib/admin/bandImport/bandItineraryOnlySchema.ts` |
| 공유 서브스키마 | `src/lib/admin/bandImport/bandSharedSchemas.ts` |
| 병합 타입 | `src/lib/admin/bandImport/productParserSchema.ts` |
| 메타+일정 merge | `src/lib/admin/bandImport/mergeBandParsed.ts` |
| INSERT 매핑 | `src/lib/admin/bandImport/mapBandParsedToInsert.ts` |
| 옵션 매핑 | `src/lib/admin/bandImport/mapBandOptionsToProductOptions.ts` |
| URL 중복 검사 | `src/lib/admin/bandImport/checkProductSourceUrl.ts` |
| 기본 카테고리/이미지 | `src/lib/admin/bandImport/constants.ts` |
| 스키마 fallback insert | `src/lib/supabaseProductsColumnFallback.ts` |
| 단위 테스트 | `src/lib/admin/bandImport/__tests__/parseBandProductText.test.ts` |
| 단위 테스트 | `src/lib/admin/bandImport/__tests__/mapBandParsedToInsert.test.ts` |

---

## 참고: 이 흐름이 아닌 것

아래는 텍스트 파싱이 있으나 **밴드/HWP → 상품 자동 등록**과는 별개다.

- **하나투어/모두투어 외부 페이지 임포트** (`/api/admin/products/import-external`): HTML/DOM 스크랩 기반. `src/lib/admin/externalImport/parseExternalProductPage.ts`
- **레거시 일정 텍스트 → ItineraryV2** (`src/lib/products/parseLegacyItineraryText.ts`): 이미 저장된 일정 문자열을 에디터용 V2 초안으로 변환. API가 텍스트를 받아 상품을 생성하지 않음.
- **밴드 훅/블로그 생성** (`/api/admin/products/[id]/band-hook`): 기존 상품에서 마케팅 문구를 생성. 상품 상세를 파싱해 넣는 경로가 아님.

# 블로그/콘텐츠 자동생성 코드 발췌 2차

==================================================
파일 경로:
`src/types/product.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
import type { ProductCampaignCardMeta } from "@/types/productCampaignCard";

/** 모두투어 등 계절·주말·성수기 구간가 (KRW 정수). 비어 있으면 필드 생략 또는 null */
export type SeasonalPriceBands = {
  offSeason?: number | null;
  weekend?: number | null;
  peakSeason?: number | null;
};

export type ProductTrust = {
  recentConsultCount?: number;
  recentDays?: number;
  totalInquiries?: number;
  ratingAvg?: number;
  reviewCount?: number;
};

/**
 * 옵션 항목: 단일 선택지 (예: "3박4일", "싱글룸")
 * - value: 선택 시 SelectedOptions에 저장되는 값
 * - priceDelta: 기준가에 더할 금액(원). 미설정 시 0
 * - meta: "1인1실", "성수기" 등 부가 표시
 * - isDefault: true면 초기 선택값 후보
 */
export type ProductOptionItem = {
  value: string;
  label: string;
  priceDelta?: number;
  meta?: string;
  isDefault?: boolean;
};

/**
 * 옵션 그룹: 선택 그룹 (예: "기간", "룸 타입")
 * - key: 그룹 식별자, SelectedOptions의 키로 사용
 * - type: UI 타입 (radio / select / stepper / multi)
 */
export type ProductOptionGroup = {
  key: string;
  title: string;
  type: "radio" | "select" | "stepper" | "multi";
  items: ProductOptionItem[];
};

/**
 * 상품 옵션 정의 (Phase 4-3 통일 구조)
 * - basePrice + 선택된 items의 priceDelta 합으로 총액 계산
 * - requiredGroups에 포함된 key는 반드시 하나 선택
 */
export type ProductOptions = {
  basePrice: number;
  currency: "KRW";
  /** 필수 그룹 key 목록. 이 key들은 반드시 하나 선택 */
  requiredGroups?: string[];
  groups: ProductOptionGroup[];
};

/** 선택된 옵션: groupKey -> itemValue (UI/계산용) */
export type SelectedOptions = Record<string, string>;

/** 여행 오버뷰 요약 카드 kind */
export type OverviewSummaryCardKind =
  | "flight"
  | "hotel"
  | "region"
  | "theme"
  | "golf"
  | "etc";

/** 여행 오버뷰 요약 카드 */
export type OverviewSummaryCard = {
  kind: OverviewSummaryCardKind;
  label: string;
  value: string;
};

/** 여행 오버뷰 차트 아이템 */
export type OverviewChartItem = { label: string; percent: number };

/** 여행 오버뷰 타임라인 Day */
export type OverviewTimelineDay = {
  day: number;
  dateText?: string;
  headline?: string;
  bullets: string[];
};

/** 일정 이벤트 이미지 1건 (모두투어 검수 status·수집 휴리스틱 메타) */
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

/** [STEP 0] 구조화 일정 이벤트 1개 (시간대·아이콘 지원) */
export type ItineraryStructuredEvent = {
  heading: string;
  description?: string;
  timeOfDay?: "오전" | "오후" | "저녁" | "종일";
  iconKey?: string;
  /** 이벤트별 이미지 URL 목록 (대표·정렬 포함) */
  images?: ItineraryEventImage[];
};

/** [STEP 0] 구조화 일정 Day 1개 */
export type ItineraryStructuredDay = {
  day: number;
  dateText?: string;
  title?: string;
  coverImageUrl?: string | null;
  events: ItineraryStructuredEvent[];
};

/** [STEP 1] 구조화 일정 v2 (시각화 최적화, jsonb 1컬럼) */
export type ItineraryV2Event = {
  timeOfDay?: "오전" | "오후" | "저녁" | "종일";
  /** 시각 (예: 09:00, 14:30). 오전/오후 옆에 표시 */
  timeText?: string;
  iconKey?: string;
  heading: string;
  description?: string;
  location?: string;
  order?: number;
  /** 이벤트별 이미지 URL 목록 (대표·정렬 포함) */
  images?: ItineraryEventImage[];
};

export type ItineraryV2Day = {
  day: number;
  dateText?: string;
  title?: string;
  coverImageUrl?: string;
  events: ItineraryV2Event[];
};

export type ItineraryV2 = {
  days: ItineraryV2Day[];
};

/** 이벤트 선택 상태: 상품 공용 이미지 → "이 이벤트에 추가" 시 참조 (관리자 UI용) */
export type SelectedEventRef =
  | { editorType: "v2"; dayIndex: number; eventIndex: number }
  | { editorType: "structured"; dayIndex: number; eventIndex: number };

/** PR42: 상세 일정 타임라인용 일차 데이터 (title/subtitle/description/meals/hotel) */
export type ProductItineraryDay = {
  day: number;
  title?: string;
  subtitle?: string;
  description?: string;
  meals?: string[];
  hotel?: string;
};

/** 여행 오버뷰 (jsonb 1컬럼 스키마) */
export type ProductOverview = {
  enabled: boolean;
  title?: string;
  summaryCards: OverviewSummaryCard[];
  coverImageUrl?: string;
  chart?: {
    enabled: boolean;
    items: OverviewChartItem[];
  };
  timeline?: {
    enabled: boolean;
    days: OverviewTimelineDay[];
  };
};

export type Product = {
  id: string;
  title: string;
  description: string;
  /** 상세 히어로용 (hero 1920px). 카드 썸네일은 image_card_url 우선, 없으면 이 값 사용 */
  image_url: string;
  /** 상품 이미지 갤러리 URL 배열. 첫 번째가 대표 이미지로 사용됨 */
  images_json?: string[];
  /** TODO: 목록 카드 썸네일용 (card 800px). 확장 시 ProductCatalogSection 등에서 우선 사용. */
  // image_card_url?: string;
  /**
   * @deprecated legacy. destination_id / product_line_id 비어 있을 때만 fallback 사용.
   * 지역·상품군이 혼재했던 단일 문자열. 점진적 이전 후 제거 검토.
   */
  category: string;
  /**
   * @deprecated legacy. 테마 이름 토큰 문자열(쉼표/구분자).
   * 새 스키마에서는 theme_ids_json 등 검토. 당분간 유지.
   */
  theme?: string;
  /** 지역 1개 (product_taxonomies.id, taxonomy_type=destination). 비어 있으면 category fallback */
  destination_id?: string | null;
  /** 상품군 1개 (product_taxonomies.id, taxonomy_type=product_line). 비어 있으면 category fallback */
  product_line_id?: string | null;
  /** 기획/강조 항목. taxonomy 이름 배열 또는 id 배열. 선택 */
  campaigns?: string[] | null;
  /** DB 컬럼명. API 응답에서 올 수 있음 */
  campaigns_json?: string[] | null;
  /** 태그 이름 배열. 선택 */
  tags?: string[] | null;
  /** PR22: 핵심 여행 요약용 문구 배열. 없으면 tags/themes로 대체 */
  highlights?: string[] | null;
  price?: number;
  /** 비수기·주말·성수기 구간가 (jsonb). 없으면 undefined — 목록/상세는 기존 price 사용 */
  seasonal_price_bands?: SeasonalPriceBands | null;
  duration?: string;
  /** 출발지역 (Summary 블록용) */
  departure?: string;
  /** 항공 요약 (Summary 블록용) */
  airline?: string;
  /** 숙소 요약 (Summary 블록용) */
  hotel?: string;
  /** 여행스타일 (Summary 블록용) */
  travelStyle?: string;
  /** 출발일 목록 (ProductDepartureSelector용). 예: ["2025-06-12", "2025-07-03"] */
  departures?: string[];
  /** PR42: 일차별 타임라인용 일정 (ProductItineraryTimeline). 없으면 기존 itinerary / detailed_schedule 사용 */
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
  min_departure_people?: string;
  /** 레거시 단일 약관/유의. 상세 노출은 예약 유의사항 폴백에만 사용(PR-H). */
  terms_and_notes?: string | null;
  /** 예약 시 유의사항 (직접입력; 비면 템플릿·레거시 순) */
  booking_notes?: string | null;
  /** 여행 시 유의사항 (직접입력; 비면 템플릿만) */
  travel_notes?: string | null;
  /** 예약조건 (직접입력; 비면 템플릿만) */
  booking_conditions?: string | null;
  /** 환불·취소 규정 전용 (직접입력; 비면 refund 템플릿만, 타 필드 폴백 없음) */
  refund_policy?: string | null;
  refund_policy_template_type?: string | null;
  /** 예약 유의사항에 적용할 공통 템플릿 키 (product_terms_templates.type) */
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
  /** 출발편 수하물 한도 (예: 23KG) */
  departure_baggage_limit?: string;
  arrival_from_airport?: string;
  arrival_from_date?: string;
  arrival_from_time?: string;
  arrival_to_airport?: string;
  arrival_to_date?: string;
  arrival_to_time?: string;
  arrival_flight_name?: string;
  /** 도착편 수하물 한도 (예: 23KG) */
  arrival_baggage_limit?: string;
  meta_title?: string;
  meta_description?: string;
  is_active?: boolean;
  /** 추천 여행 컬렉션용. true면 /products?collection=recommend에 노출 */
  is_recommend?: boolean;
  /** 인기 여행 컬렉션용. true면 /products?collection=popular에 노출 */
  is_popular?: boolean;
  sort_order?: number;
  created_at?: string;
  /** DB에 컬럼이 있으면 목록 등에서 사용. 없으면 undefined */
  updated_at?: string;
  /** 상품 상태: 없으면 AVAILABLE로 간주 */
  status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  /** 유류할증료 포함 여부. null이면 상세에서 문구 미노출 */
  fuel_included?: boolean;
  /** 가격 기준 문구 (예: 1인 기준). 카드/상세에 표시 */
  price_meta?: string;
  /** 카드 부가 문구 (예: 항공 포함). 카드 메타 영역에 표시 */
  meta_info?: string;
  /** 상세 상단 한 줄 소개. 비우면 description 첫 줄 사용 */
  one_liner?: string;
  /** [STEP 2] 오버뷰 jsonb 1컬럼. enabled/summaryCards/chart/timeline/coverImageUrl */
  overview_json?: ProductOverview | null;
  /** [STEP 3] 일정 Day별 대표 이미지 URL. 예: { "1": "https://...", "2": "https://..." } */
  itinerary_media_json?: Record<string, string> | null;
  /** [STEP 0] 구조화 일정. 있으면 상세에서 시각화 타임라인 우선 사용, 없으면 detailed_schedule 텍스트 fallback */
  itinerary_days_json?: ItineraryStructuredDay[] | null;
  /** [STEP 1] 구조화 일정 v2 (jsonb 1컬럼, 시각화 최적화) */
  itinerary_v2_json?: ItineraryV2 | null;
  /** 일정 테마 구성비. 상품 등록 시 입력, 없으면 theme/category 기반 자동 생성 */
  theme_chart_json?: { items: Array<{ label: string; percent: number }> } | null;
  /** 여행 오버뷰 카드 전용 입력 (숙소·지역·기간). 있으면 우선 사용 */
  overview_accommodation?: string;
  overview_region?: string;
  overview_duration?: string;
  trust?: ProductTrust;
  /** 옵션 정의. 없거나 groups가 비어 있으면 옵션 UI 미노출 */
  options?: ProductOptions;
  /**
   * PR3: 기획(campaign) taxonomy 기반 카드 배지 해석.
   * `getProducts` 등에서 hydrate; 없으면 `campaigns` 문자열 + 레거시 규칙 사용.
   */
  campaign_card_meta?: ProductCampaignCardMeta[];
};
```

[2] 관련 함수 전체

없음

[3] 호출부 전체

전역 도메인 타입으로 블로그/스마트스토어/SEO/미리보기/랜딩 등 대부분의 생성 로직에서 사용됩니다.

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/lib/products/resolveProductDetailBodyFields.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
import type { Product } from "@/types/product";
```

[2] 관련 함수 전체

```ts
import type { Product } from "@/types/product";

/**
 * 상품 상세 SSR(`src/app/products/[id]/page.tsx`)과 동일한 포함/불포함/선택관광 해석.
 * 스마트스토어 HTML 등에서 재사용한다.
 */
export function resolveProductDetailBodyFields(product: Product): {
  resolvedIncludedItems: string;
  resolvedExcludedItems: string;
  resolvedOptionalTours: string | undefined;
} {
  const normalizedIncluded = product.included_items?.trim() ?? "";
  const normalizedExcluded = product.excluded_items?.trim() ?? "";
  const normalizedOptional = product.optional_tours?.trim() ?? "";
  const normalizedTerms = product.terms_and_notes?.trim() ?? "";
  const shouldFallbackFromLegacyDetailFields =
    !normalizedIncluded && !normalizedExcluded && (normalizedOptional || normalizedTerms);
  const resolvedIncludedItems = shouldFallbackFromLegacyDetailFields
    ? (product.optional_tours ?? product.inclusions ?? "") || ""
    : (product.included_items ?? product.inclusions ?? "") || "";
  const resolvedExcludedItems = shouldFallbackFromLegacyDetailFields
    ? product.terms_and_notes ?? ""
    : product.excluded_items ?? "";
  const resolvedOptionalTours = shouldFallbackFromLegacyDetailFields ? undefined : product.optional_tours;
  return { resolvedIncludedItems, resolvedExcludedItems, resolvedOptionalTours };
}
```

[3] 호출부 전체

`src/lib/blog/mapProductToBlogPostViewModel.ts`, `src/lib/smartstore/mapProductToSmartstoreHtmlViewModel.ts`

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/lib/products/images.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
import type { Product } from "@/types/product";
```

[2] 관련 함수 전체

```ts
import type { Product } from "@/types/product";

export function normalizeImageList(images: Array<string | null | undefined> | null | undefined): string[] {
  if (!Array.isArray(images)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of images) {
    if (typeof raw !== "string") continue;
    const url = raw.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }
  return result;
}

export function getPrimaryImageUrl(product: Pick<Product, "image_url" | "images_json">): string {
  const list = normalizeImageList(product.images_json);
  if (list.length > 0) return list[0];
  return product.image_url?.trim() || "";
}
```

[3] 호출부 전체

`src/lib/blog/mapProductToBlogPostViewModel.ts`, `src/lib/smartstore/mapProductToSmartstoreHtmlViewModel.ts`, `src/lib/admin/productPreview.ts`

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/lib/products/mapProductToTimelineModel.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
import type { Product, ItineraryStructuredDay, ItineraryV2 } from "@/types/product";

export type TimeOfDayLabel = "오전" | "오후" | "저녁" | "종일";

export type TimelineEvent = {
  timeOfDay?: TimeOfDayLabel;
  /** 시각 (예: 09:00). 오전/오후 옆에 표시 */
  timeText?: string;
  iconKey?: string;
  heading: string;
  description?: string;
  side?: "left" | "right";
  /** 이벤트별 이미지 목록 (url/alt/sortOrder/isCover). 없으면 undefined, 표시 시 (event.images ?? []) 사용 */
  images?: Array<{ url: string; alt?: string; sortOrder?: number; isCover?: boolean }>;
  /** 썸네일용 URL. isCover=true인 이미지 우선, 없으면 images[0].url, 없으면 null */
  thumbnailUrl?: string | null;
};

export type TimelineDay = {
  day: number;
  dateText?: string;
  title?: string;
  imageUrl?: string | null;
  events: TimelineEvent[];
};

export type TimelineModel = {
  days: TimelineDay[];
};
```

[2] 관련 함수 전체

```ts
/**
 * [STEP 0/2] 텍스트 일정 → 시각화 타임라인 ViewModel
 * - 기존 detailed_schedule / itinerary 유지, 파생 모델만 생성
 * - STEP 2: TimelineModel (events, timeOfDay, side) 추가
 */

import type { Product, ItineraryStructuredDay, ItineraryV2 } from "@/types/product";
import { parseTimelineDays } from "@/lib/products/mapProductToOverview";

function getThumbnailUrl(
  images: TimelineEvent["images"],
): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const cover = images.find((i) => i.isCover);
  if (cover?.url?.trim()) return cover.url.trim();
  const first = images[0];
  return first?.url?.trim() ?? null;
}

const MAX_EVENTS_PER_DAY = 4;
const TITLE_MAX_LEN = 40;

function parseKeyValueLine(line: string): { heading: string; description?: string } {
  const trimmed = line.trim();
  if (!trimmed) return { heading: "" };

  const colonMatch = trimmed.match(/^([^:]+):\s*([\s\S]*)$/);
  if (colonMatch) {
    let label = colonMatch[1].trim();
    const value = colonMatch[2].trim();
    if (/^TEE\s*OFF\s*TIME$/i.test(label)) label = "TEE OFF";
    return { heading: label, description: value || undefined };
  }

  return { heading: trimmed };
}

function extractTimeOfDay(text: string): TimeOfDayLabel | undefined {
  if (/오전/.test(text)) return "오전";
  if (/오후/.test(text)) return "오후";
  if (/저녁/.test(text)) return "저녁";
  if (/종일/.test(text)) return "종일";
  return undefined;
}

function inferIconKey(heading: string): string | undefined {
  const h = heading.trim().toLowerCase();
  if (/이동|차량|버스|출발|도착|항공|비행|기내/.test(h)) return "plane";
  if (/식사|조식|중식|석식|디너|기내식/.test(h)) return "utensils";
  if (/tee\s*off|티오프|라운드|골프/.test(h)) return "flag";
  if (/호텔|숙소|체크인|숙박/.test(h)) return "hotel";
  if (/관광|시내|투어|탐방/.test(h)) return "landmark";
  if (/자유|프리/.test(h)) return "clock";
  return undefined;
}

function lineToEvent(line: string, index: number): TimelineEvent | null {
  const { heading, description } = parseKeyValueLine(line);
  if (!heading) return null;

  const timeOfDay = extractTimeOfDay(line) ?? extractTimeOfDay(description ?? "");
  const iconKey = inferIconKey(heading);
  const side: "left" | "right" = index % 2 === 0 ? "left" : "right";

  return {
    ...(timeOfDay && { timeOfDay }),
    ...(iconKey && { iconKey }),
    heading,
    ...(description && { description }),
    side,
  };
}

function bulletsToEvents(bullets: string[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (let i = 0; i < Math.min(bullets.length, MAX_EVENTS_PER_DAY); i++) {
    const ev = lineToEvent(bullets[i], i);
    if (ev && ev.heading) events.push(ev);
  }
  return events;
}

function inferDayTitle(dayNumber: number, events: TimelineEvent[], rawBullets: string[]): string | undefined {
  const firstHeading = events[0]?.heading?.trim();
  if (firstHeading && firstHeading.length <= TITLE_MAX_LEN) return firstHeading;
  const firstLine = rawBullets[0]?.trim();
  if (firstLine) return firstLine.slice(0, TITLE_MAX_LEN);
  return undefined;
}

function toTimelineDay(
  parsed: { day: number; headline: string; bullets: string[] },
): TimelineDay {
  const events = bulletsToEvents(parsed.bullets);
  const title = inferDayTitle(parsed.day, events, parsed.bullets);

  return {
    day: parsed.day,
    title,
    imageUrl: null,
    events,
  };
}

export function mapProductToTimelineModel(product: Product | null): TimelineModel {
  if (!product || typeof product !== "object") {
    return { days: [] };
  }

  const v2 = product.itinerary_v2_json;
  const hasV2 = v2 && Array.isArray(v2.days) && v2.days.length > 0;

  if (hasV2) {
    const media = product.itinerary_media_json;
    const fallbackUrl = product.image_url?.trim() || null;
    return {
      days: v2.days.map((d) => {
        const dayKey = String(d.day);
        const imageUrl =
          d.coverImageUrl?.trim() ||
          (media && typeof media[dayKey] === "string" && media[dayKey].trim() ? media[dayKey].trim() : null) ||
          fallbackUrl;
        return {
          day: d.day,
          dateText: d.dateText,
          title: d.title,
          imageUrl: imageUrl || null,
          events: d.events.map((e, i) => ({
            timeOfDay: e.timeOfDay,
            timeText: e.timeText,
            iconKey: e.iconKey,
            heading: e.heading,
            description: e.description,
            side: (i % 2 === 0 ? "left" : "right") as "left" | "right",
            images: Array.isArray(e.images) ? e.images : undefined,
            thumbnailUrl: getThumbnailUrl(Array.isArray(e.images) ? e.images : undefined),
          })),
        };
      }),
    };
  }

  const structured = product.itinerary_days_json;
  const hasStructured = Array.isArray(structured) && structured.length > 0;

  let model: TimelineModel;

  if (hasStructured) {
    const media = product.itinerary_media_json;
    const fallbackUrl = product.image_url?.trim() || null;
    model = {
      days: structured.map((d) => {
        const dayKey = String(d.day);
        const imageUrl =
          d.coverImageUrl && d.coverImageUrl.trim()
            ? d.coverImageUrl.trim()
            : media && typeof media[dayKey] === "string" && media[dayKey].trim()
              ? media[dayKey].trim()
              : fallbackUrl;
        return {
          day: d.day,
          dateText: d.dateText,
          title: d.title,
          imageUrl: imageUrl || null,
          events: d.events.map((e, i) => ({
            timeOfDay: e.timeOfDay,
            timeText: (e as { timeText?: string }).timeText,
            iconKey: e.iconKey,
            heading: e.heading,
            description: e.description,
            side: (i % 2 === 0 ? "left" : "right") as "left" | "right",
            images: Array.isArray(e.images) ? e.images : undefined,
            thumbnailUrl: getThumbnailUrl(Array.isArray(e.images) ? e.images : undefined),
          })),
        };
      }),
    };
  } else {
    const raw = product.detailed_schedule?.trim() || product.itinerary?.trim() || "";
    model = getTimelineModelFromSchedule(raw);
    const media = product.itinerary_media_json;
    const fallbackUrl = product.image_url?.trim() || null;
    model.days.forEach((d) => {
      const dayKey = String(d.day);
      const dayUrl =
        media && typeof media[dayKey] === "string" && media[dayKey].trim()
          ? media[dayKey].trim()
          : fallbackUrl;
      d.imageUrl = dayUrl || null;
    });
  }

  return model;
}

export function getTimelineModelFromSchedule(rawSchedule: string): TimelineModel {
  const raw = rawSchedule?.trim() || "";
  const parsed = parseTimelineDays(raw);
  if (parsed.length === 0) return { days: [] };

  const days: TimelineDay[] = parsed.map(toTimelineDay);
  return { days };
}

export function timelineModelToStructuredDays(model: TimelineModel | null): ItineraryStructuredDay[] {
  if (!model?.days?.length) return [];
  return model.days.map((d) => ({
    day: d.day,
    dateText: d.dateText,
    title: d.title,
    coverImageUrl: d.imageUrl ?? undefined,
    events: d.events.map((e) => ({
      heading: e.heading,
      description: e.description,
      timeOfDay: e.timeOfDay,
      iconKey: e.iconKey,
      images: Array.isArray(e.images) ? e.images : undefined,
    })),
  }));
}

export function serializeStructuredDaysToSchedule(days: ItineraryStructuredDay[]): string {
  if (!days?.length) return "";
  return days
    .map((d) => {
      const label = `${d.day}일차`;
      const lines = d.events.map((e) =>
        e.description?.trim() ? `${e.heading}: ${e.description.trim()}` : e.heading,
      );
      return lines.length ? `[${label}]\n${lines.join("\n")}` : `[${label}]`;
    })
    .join("\n\n");
}

export function itineraryV2ToTimelineModel(v2: ItineraryV2 | null | undefined): TimelineModel {
  if (!v2?.days?.length) return { days: [] };
  return {
    days: v2.days.map((d) => ({
      day: d.day,
      dateText: d.dateText,
      title: d.title,
      imageUrl: d.coverImageUrl?.trim() || null,
      events: d.events.map((e, i) => ({
        timeOfDay: e.timeOfDay,
        timeText: e.timeText,
        iconKey: e.iconKey,
        heading: e.heading,
        description: e.description,
        side: (i % 2 === 0 ? "left" : "right") as "left" | "right",
        images: Array.isArray(e.images) ? e.images : undefined,
        thumbnailUrl: getThumbnailUrl(Array.isArray(e.images) ? e.images : undefined),
      })),
    })),
  };
}
```

[3] 호출부 전체

`src/lib/blog/mapProductToBlogPostViewModel.ts`, `src/lib/smartstore/mapProductToSmartstoreHtmlViewModel.ts`, 관리자 미리보기/상세 타임라인 계열에서 재사용됩니다.

[4] 관련 상수/템플릿 전체

```ts
const MAX_EVENTS_PER_DAY = 4;
const TITLE_MAX_LEN = 40;
```

==================================================
파일 경로:
`src/lib/noticeTemplates.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
export type NoticeTemplateGroup =
  | "booking_notes"
  | "travel_notes"
  | "booking_conditions"
  | "refund_policy";

export type NoticeTemplatesByGroup = Record<NoticeTemplateGroup, TermsTemplateMap>;

export type NoticeTemplateRow = {
  id: string;
  template_group: NoticeTemplateGroup;
  type: string;
  label: string | null;
  content: string | null;
  sort_order: number;
  updated_at: string;
};

export type ResolvedProductNoticesForDetail = {
  bookingNotes: string;
  travelNotes: string;
  bookingConditions: string;
  refundPolicy: string;
};
```

[2] 관련 함수 전체

```ts
/**
 * PR-E: 그룹별 상품 안내 공통 템플릿 (product_notice_templates)
 * - 신규 테이블 우선, booking_notes 만 product_terms_templates 레거시 폴백
 */

import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/types/product";
import {
  TERMS_TEMPLATE_TYPES,
  type TermsTemplateType,
  getTermsTemplateContent,
  getTermsTemplateContentFromMap,
  type TermsTemplateMap,
} from "@/lib/termsTemplates";

function emptyTypeMap(): TermsTemplateMap {
  return {
    overseas_brokerage: "",
    domestic_brokerage: "",
    overseas_direct: "",
    domestic_direct: "",
  };
}

export function createEmptyNoticeTemplatesByGroup(): NoticeTemplatesByGroup {
  return {
    booking_notes: emptyTypeMap(),
    travel_notes: emptyTypeMap(),
    booking_conditions: emptyTypeMap(),
    refund_policy: emptyTypeMap(),
  };
}

function isKnownType(type: string): type is TermsTemplateType {
  return (TERMS_TEMPLATE_TYPES as readonly string[]).includes(type);
}

function rowGroupIsNotice(g: string): g is NoticeTemplateGroup {
  return (
    g === "booking_notes" ||
    g === "travel_notes" ||
    g === "booking_conditions" ||
    g === "refund_policy"
  );
}

export const getNoticeTemplatesByGroup = unstable_cache(
  async (): Promise<NoticeTemplatesByGroup> => {
    const result = createEmptyNoticeTemplatesByGroup();
    const { data, error } = await supabase
      .from("product_notice_templates")
      .select("template_group,type,content,sort_order")
      .order("sort_order", { ascending: true })
      .order("type", { ascending: true });

    if (error || !data) return result;

    for (const row of data as { template_group: string; type: string; content: string | null }[]) {
      if (!rowGroupIsNotice(row.template_group)) continue;
      if (!isKnownType(row.type)) continue;
      result[row.template_group][row.type] = row.content?.trim() ?? "";
    }
    return result;
  },
  ["product-notice-templates-by-group"],
  { revalidate: 60, tags: ["products"] },
);

export async function getNoticeTemplateContent(
  group: NoticeTemplateGroup,
  type?: string | null,
): Promise<string> {
  if (!type || !isKnownType(type)) return "";
  const maps = await getNoticeTemplatesByGroup();
  const fromNew = maps[group][type].trim();
  if (fromNew) return fromNew;
  if (group === "booking_notes") {
    return (await getTermsTemplateContent(type)).trim();
  }
  return "";
}

export function getNoticeTemplateContentFromMaps(
  maps: NoticeTemplatesByGroup,
  group: NoticeTemplateGroup,
  type?: string | null,
  legacyTermsMap?: TermsTemplateMap | null,
): string {
  if (!type || !isKnownType(type)) return "";
  const fromNew = maps[group][type].trim();
  if (fromNew) return fromNew;
  if (group === "booking_notes" && legacyTermsMap) {
    return getTermsTemplateContentFromMap(legacyTermsMap, type).trim();
  }
  return "";
}

export async function resolveBookingNoticeForDetail(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  legacyTerms: string | null | undefined,
): Promise<string> {
  const d = direct?.trim() ?? "";
  if (d) return d;
  const t = (await getNoticeTemplateContent("booking_notes", templateType ?? undefined)).trim();
  if (t) return t;
  return legacyTerms?.trim() ?? "";
}

export async function resolveTravelNoticeForDetail(
  direct: string | null | undefined,
  templateType: string | null | undefined,
): Promise<string> {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return (await getNoticeTemplateContent("travel_notes", templateType ?? undefined)).trim();
}

export async function resolveBookingConditionsForDetail(
  direct: string | null | undefined,
  templateType: string | null | undefined,
): Promise<string> {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return (await getNoticeTemplateContent("booking_conditions", templateType ?? undefined)).trim();
}

export async function resolveRefundPolicyForDetail(
  direct: string | null | undefined,
  templateType: string | null | undefined,
): Promise<string> {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return (await getNoticeTemplateContent("refund_policy", templateType ?? undefined)).trim();
}

export async function resolveProductNoticesForDetailPage(
  product: Product,
): Promise<ResolvedProductNoticesForDetail> {
  const [bookingNotes, travelNotes, bookingConditions, refundPolicy] = await Promise.all([
    resolveBookingNoticeForDetail(
      product.booking_notes,
      product.booking_notes_template_type,
      product.terms_and_notes,
    ),
    resolveTravelNoticeForDetail(product.travel_notes, product.travel_notes_template_type),
    resolveBookingConditionsForDetail(
      product.booking_conditions,
      product.booking_conditions_template_type,
    ),
    resolveRefundPolicyForDetail(product.refund_policy, product.refund_policy_template_type),
  ]);
  return { bookingNotes, travelNotes, bookingConditions, refundPolicy };
}

export function resolveBookingNoticeForDetailSync(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  legacyTerms: string | null | undefined,
  noticeMaps: NoticeTemplatesByGroup,
  legacyTermsMap: TermsTemplateMap | null | undefined,
): string {
  const d = direct?.trim() ?? "";
  if (d) return d;
  const t = getNoticeTemplateContentFromMaps(
    noticeMaps,
    "booking_notes",
    templateType,
    legacyTermsMap ?? undefined,
  );
  if (t) return t;
  return legacyTerms?.trim() ?? "";
}

export function resolveTravelNoticeForDetailSync(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  noticeMaps: NoticeTemplatesByGroup,
): string {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return getNoticeTemplateContentFromMaps(noticeMaps, "travel_notes", templateType);
}

export function resolveBookingConditionsForDetailSync(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  noticeMaps: NoticeTemplatesByGroup,
): string {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return getNoticeTemplateContentFromMaps(noticeMaps, "booking_conditions", templateType);
}

export function resolveRefundPolicyForDetailSync(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  noticeMaps: NoticeTemplatesByGroup,
): string {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return getNoticeTemplateContentFromMaps(noticeMaps, "refund_policy", templateType);
}
```

[3] 호출부 전체

`src/app/api/admin/products/[id]/blog-post/route.ts`, `src/app/api/admin/products/[id]/smartstore-html/route.ts`, `src/app/api/admin/products/preview/route.ts`

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/lib/seo/productSeoCopy.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
export type ProductSeoCopy = {
  description: string;
  ogSubtitle: string;
};

export type ProductSeoCopyKey = keyof typeof productSeoCopy;
```

[2] 관련 함수 전체

없음

[3] 호출부 전체

`src/lib/seo/resolveProductSeoCopy.ts`

[4] 관련 상수/템플릿 전체

```ts
/**
 * 상품군 단위 SEO/OG 카피 (slug·제목·태그 등에 키워드가 포함될 때 패턴 매칭).
 * 우선순위: DB meta → 이 매핑 → fallback (getProductSeoData).
 */

export const productSeoCopy = {
  bali: {
    description: "발리에서 즐기는 골프와 휴양을 함께하는 맞춤 여행 상품입니다.",
    ogSubtitle: "휴양과 골프를 함께",
  },
  danang: {
    description: "다낭에서 즐기는 인기 골프여행을 일정에 맞게 편하게 준비하세요.",
    ogSubtitle: "인기 골프여행 맞춤 제안",
  },
  japan: {
    description: "가깝고 만족도 높은 일본 골프여행을 맞춤 일정으로 준비해드립니다.",
    ogSubtitle: "가까운 프리미엄 골프여행",
  },
  jeju: {
    description: "제주에서 즐기는 편안한 국내 골프여행을 맞춤 일정으로 제안합니다.",
    ogSubtitle: "국내 프리미엄 골프여행",
  },
  filial: {
    description: "부모님과 함께하는 편안한 맞춤형 효도여행 상품입니다.",
    ogSubtitle: "부모님과 함께하는 여행",
  },
  family: {
    description: "가족과 함께 즐기기 좋은 맞춤형 여행 상품을 준비했습니다.",
    ogSubtitle: "가족과 함께하는 여행",
  },
  premium: {
    description: "숙소, 일정, 이동까지 세심하게 준비된 프리미엄 맞춤 여행입니다.",
    ogSubtitle: "더 세심한 맞춤 여행",
  },
} as const satisfies Record<string, ProductSeoCopy>;
```

==================================================
파일 경로:
`src/lib/seo/resolveProductSeoCopy.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
import type { Product } from "@/types/product";
import { productSeoCopy, type ProductSeoCopy, type ProductSeoCopyKey } from "@/lib/seo/productSeoCopy";
```

[2] 관련 함수 전체

```ts
import type { Product } from "@/types/product";
import { productSeoCopy, type ProductSeoCopy, type ProductSeoCopyKey } from "@/lib/seo/productSeoCopy";

/**
 * 상품 메타·OG 패턴 매칭용 문자열 (URL id, 제목, 카테고리, 테마, 지역, 태그 등).
 */
export function buildProductSeoMatchSource(product: Product): string {
  const parts: string[] = [
    product.id,
    product.title,
    product.category,
    product.theme ?? "",
    product.overview_region ?? "",
    ...(product.tags ?? []),
    ...(product.campaigns ?? []),
    ...(product.highlights ?? []),
  ];
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

/** 키워드 출현 순서: 더 구체적인 패턴을 먼저 두지 않아도 되는 항목 위주. */
const MATCH_ORDER: Array<{ needles: string[]; key: ProductSeoCopyKey }> = [
  { needles: ["bali"], key: "bali" },
  { needles: ["danang", "da-nang", "da nang"], key: "danang" },
  { needles: ["japan", "일본"], key: "japan" },
  { needles: ["jeju", "제주"], key: "jeju" },
  { needles: ["filial", "효도"], key: "filial" },
  { needles: ["family", "가족"], key: "family" },
  { needles: ["premium", "프리미엄"], key: "premium" },
];

/**
 * 소스 문자열(소문자 권장)에 키워드가 포함되면 해당 상품군 카피 반환.
 */
export function resolveProductSeoCopy(source: string): ProductSeoCopy | null {
  const s = source.trim().toLowerCase();
  if (!s) return null;
  for (const { needles, key } of MATCH_ORDER) {
    if (needles.some((n) => s.includes(n))) {
      return productSeoCopy[key];
    }
  }
  return null;
}

export function resolveProductSeoCopyFromProduct(product: Product): ProductSeoCopy | null {
  return resolveProductSeoCopy(buildProductSeoMatchSource(product));
}
```

[3] 호출부 전체

`src/lib/products/getProductSeoData.ts`

[4] 관련 상수/템플릿 전체

```ts
const MATCH_ORDER: Array<{ needles: string[]; key: ProductSeoCopyKey }> = [
  { needles: ["bali"], key: "bali" },
  { needles: ["danang", "da-nang", "da nang"], key: "danang" },
  { needles: ["japan", "일본"], key: "japan" },
  { needles: ["jeju", "제주"], key: "jeju" },
  { needles: ["filial", "효도"], key: "filial" },
  { needles: ["family", "가족"], key: "family" },
  { needles: ["premium", "프리미엄"], key: "premium" },
];
```

==================================================
파일 경로:
`src/lib/products/getProductSeoData.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
export type ProductSeoData = {
  id: string;
  name: string;
  /** `<title>` / OG title용 (메타 필드 또는 합성) */
  browserTitle: string;
  metaDescription: string;
  regionName: string | null;
  themeNames: string[];
  summaryLine: string | null;
  priceLabel: string | null;
  /** OG 페인트용 절대 URL, 우선순위·품질 스코어 순 */
  imageCandidates: string[];
  /** 정렬·스코어링 후 1순위 후보. opengraph-image fetch 시 최우선 */
  primaryImageUrl: string | null;
  /** ProductOgCard 요약 한 줄 (패턴 매칭 ogSubtitle → summaryLine → 고정 fallback) */
  ogCardSubtitle: string;
};

type OgImageEntry = { abs: string; bucket: number; sortKey: number };
```

[2] 관련 함수 전체

```ts
import { getProductByIdFresh } from "@/lib/products";
import { getTaxonomyById, parseThemeTokens } from "@/lib/productTaxonomies";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { getSiteBaseUrl, toAbsoluteUrl } from "@/lib/seo/getSiteSeoDefaults";
import { resolveProductSeoCopyFromProduct } from "@/lib/seo/resolveProductSeoCopy";
import type { ItineraryEventImage } from "@/types/product";

const PLACEHOLDER_SUBSTR = "picsum.photos";
const MAX_ITINERARY_IMAGE_URLS = 14;

function isRealProductImageUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.length > 0 && !u.includes(PLACEHOLDER_SUBSTR);
}

function truncateSeo(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function scoreImageUrl(url: string): number {
  let score = 0;
  const u = url.trim().toLowerCase();
  if (!u) return score;

  try {
    const parsed = new URL(u);
    const path = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();
    const hay = `${path} ${search}`;

    if (/logo|favicon|apple-touch|sprite|watermark|badge/.test(hay)) score -= 55;
    if (/\bicon\b|symbol\b/.test(path)) score -= 40;

    if (/thumb|small|lowres|low-res|\bmini\b|_tn\.|_xs\.|tiny/.test(hay)) score -= 22;
    if (/large|original|\bxl\b|fullsize|full[_-]size|master/.test(hay)) score += 18;

    const rw =
      parsed.searchParams.get("resize_w") ||
      parsed.searchParams.get("w") ||
      parsed.searchParams.get("width");
    if (rw) {
      const n = parseInt(rw, 10);
      if (n > 0 && n < 360) score -= 35;
      if (n >= 800) score += 12;
    }
  } catch {
    if (/logo|icon|thumb|small/i.test(u)) score -= 30;
  }

  if (u.includes("img.modetour.com")) score += 10;

  return score;
}

function shouldSkipLikelyDecorativeUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return (
    /\/favicon\.(ico|png)(\?|$)/i.test(u) ||
    /\/apple-touch-icon/i.test(u) ||
    /\/logo[^/]*\.(svg|png|jpe?g|webp)(\?|$)/i.test(u) ||
    /\/brand[_-]?mark/i.test(u)
  );
}

function sortEventImagesForOg(images: ItineraryEventImage[]): ItineraryEventImage[] {
  return [...images].sort((a, b) => {
    if (a.isCover && !b.isCover) return -1;
    if (!a.isCover && b.isCover) return 1;
    const oa = typeof a.sortOrder === "number" ? a.sortOrder : 9999;
    const ob = typeof b.sortOrder === "number" ? b.sortOrder : 9999;
    return oa - ob;
  });
}

function eventImageSortBoost(img: ItineraryEventImage): number {
  let boost = 0;
  if (img.isCover === true) boost += 5000;
  if (img.isLowResolution === true) boost -= 3000;
  if (img.isThumbnailCandidate === true) boost -= 1000;
  boost += Math.round(scoreImageUrl(img.url));
  return boost;
}

export async function getProductSeoData(id: string): Promise<ProductSeoData | null> {
  const rawId = id?.trim();
  if (!rawId) return null;

  const product = await getProductByIdFresh(rawId);
  if (!product || product.is_active === false) return null;

  const siteUrl = getSiteBaseUrl();
  const seenAbs = new Set<string>();
  const entries: OgImageEntry[] = [];
  let itineraryUrlCount = 0;

  function tryAddEntry(raw: string | null | undefined, bucket: number, sortKey: number): boolean {
    if (!raw?.trim()) return false;
    const normalized = normalizeProductImageUrl(raw.trim());
    if (!isRealProductImageUrl(normalized)) return false;
    if (shouldSkipLikelyDecorativeUrl(normalized)) return false;
    const abs = toAbsoluteUrl(siteUrl, normalized);
    if (seenAbs.has(abs)) return false;
    seenAbs.add(abs);
    entries.push({ abs, bucket, sortKey });
    return true;
  }

  function addItineraryEntry(raw: string | null | undefined, sortKey: number): void {
    if (itineraryUrlCount >= MAX_ITINERARY_IMAGE_URLS) return;
    if (tryAddEntry(raw, 2, sortKey)) itineraryUrlCount += 1;
  }

  function absForScore(raw: string): string {
    const normalized = normalizeProductImageUrl(raw.trim());
    return toAbsoluteUrl(siteUrl, normalized);
  }

  if (Array.isArray(product.images_json)) {
    product.images_json.forEach((u, index) => {
      if (!u?.trim()) return;
      const normalized = normalizeProductImageUrl(String(u).trim());
      if (!isRealProductImageUrl(normalized) || shouldSkipLikelyDecorativeUrl(normalized)) return;
      const abs = absForScore(String(u));
      const sc = scoreImageUrl(abs);
      const sortKey = 800_000 + (sc + 200) * 1000 + (500 - Math.min(index, 499));
      tryAddEntry(u, 0, sortKey);
    });
  }

  if (product.image_url?.trim()) {
    const sc = Math.round(scoreImageUrl(absForScore(product.image_url)));
    tryAddEntry(product.image_url, 1, 750_000 + (sc + 200) * 1000);
  }

  const overviewCover = product.overview_json?.coverImageUrl;
  if (overviewCover?.trim()) {
    const sc = Math.round(scoreImageUrl(absForScore(overviewCover)));
    tryAddEntry(overviewCover, 2, 5_200_000 + sc);
  }

  const v2 = product.itinerary_v2_json;
  if (v2?.days && Array.isArray(v2.days)) {
    v2.days.forEach((day, dayIdx) => {
      if (day.coverImageUrl?.trim()) {
        const sc = Math.round(scoreImageUrl(absForScore(day.coverImageUrl)));
        addItineraryEntry(day.coverImageUrl, 4_900_000 - dayIdx * 50_000 + sc);
      }
      const events = day.events || [];
      events.forEach((evt, evtIdx) => {
        const imgs = evt.images;
        if (!imgs?.length) return;
        sortEventImagesForOg(imgs).forEach((img, imgIdx) => {
          if (img.isLogoCandidate === true) return;
          const boost = eventImageSortBoost(img);
          addItineraryEntry(
            img.url,
            4_800_000 - dayIdx * 50_000 - evtIdx * 500 - imgIdx + boost,
          );
        });
      });
    });
  }

  const structured = product.itinerary_days_json;
  if (structured && Array.isArray(structured)) {
    structured.forEach((day, dayIdx) => {
      if (day.coverImageUrl?.trim()) {
        const sc = Math.round(scoreImageUrl(absForScore(String(day.coverImageUrl))));
        addItineraryEntry(String(day.coverImageUrl), 4_850_000 - dayIdx * 50_000 + sc);
      }
      const events = day.events || [];
      events.forEach((evt, evtIdx) => {
        const imgs = evt.images;
        if (!imgs?.length) return;
        sortEventImagesForOg(imgs).forEach((img, imgIdx) => {
          if (img.isLogoCandidate === true) return;
          const boost = eventImageSortBoost(img);
          addItineraryEntry(
            img.url,
            4_750_000 - dayIdx * 50_000 - evtIdx * 500 - imgIdx + boost,
          );
        });
      });
    });
  }

  const media = product.itinerary_media_json;
  if (media && typeof media === "object") {
    const keys = Object.keys(media).sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));
    for (const key of keys) {
      const raw = media[key];
      if (typeof raw !== "string" || !raw.trim()) continue;
      const dayNum = parseInt(key, 10) || 0;
      const sc = Math.round(scoreImageUrl(absForScore(raw)));
      addItineraryEntry(raw, 4_600_000 - dayNum * 10_000 + sc);
    }
  }

  if (product.destination_id?.trim()) {
    const tax = await getTaxonomyById(product.destination_id.trim());
    if (tax) {
      const card = tax.card_image_url;
      const hero = tax.hero_image_url;
      if (card?.trim()) {
        const sc = Math.round(scoreImageUrl(absForScore(card)));
        tryAddEntry(card, 3, 1_050_000 + sc);
      }
      if (hero?.trim()) {
        const sc = Math.round(scoreImageUrl(absForScore(hero)));
        tryAddEntry(hero, 3, 1_040_000 + sc);
      }
    }
  }

  entries.sort((a, b) => {
    if (a.bucket !== b.bucket) return a.bucket - b.bucket;
    return b.sortKey - a.sortKey;
  });

  const imageCandidates = entries.map((e) => e.abs);
  const primaryImageUrl = imageCandidates[0] ?? null;

  const themeNames = parseThemeTokens(product.theme);
  const regionName =
    product.overview_region?.trim() || product.category?.trim() || null;

  const seoCopy = resolveProductSeoCopyFromProduct(product);

  let summaryLine = product.one_liner?.trim() || truncateSeo(product.description || "", 100) || null;
  if (!summaryLine && (regionName || themeNames.length > 0)) {
    const themePart = themeNames.slice(0, 2).join(" · ");
    const parts = [regionName, themePart || null].filter(Boolean) as string[];
    if (parts.length > 0) summaryLine = parts.join(" · ");
  }

  const priceLabel =
    typeof product.price === "number" && Number.isFinite(product.price) && product.price > 0
      ? `₩${new Intl.NumberFormat("ko-KR").format(product.price)}~`
      : null;

  const browserTitle =
    product.meta_title?.trim() ||
    `${product.title} | ${product.category} 패키지 | 더올투어`;

  const metaDescriptionFallbackRegion = regionName
    ? `${regionName}에서 즐기는 맞춤형 여행 상품입니다.`
    : "더올투어 맞춤형 여행 상품입니다.";

  const metaDescriptionRaw =
    product.meta_description?.trim() ||
    seoCopy?.description?.trim() ||
    product.one_liner?.trim() ||
    truncateSeo(product.description || "", 155) ||
    metaDescriptionFallbackRegion;

  const metaDescription = truncateSeo(metaDescriptionRaw.replace(/\s+/g, " ").trim(), 155);

  const ogCardSubtitle =
    seoCopy?.ogSubtitle?.trim() || summaryLine?.trim() || "맞춤형 여행";

  return {
    id: product.id,
    name: product.title,
    browserTitle,
    metaDescription,
    regionName,
    themeNames,
    summaryLine,
    priceLabel,
    imageCandidates,
    primaryImageUrl,
    ogCardSubtitle,
  };
}
```

[3] 호출부 전체

상품 상세 `generateMetadata`, 동적 OG 이미지 응답 계열에서 사용됩니다.

[4] 관련 상수/템플릿 전체

```ts
const PLACEHOLDER_SUBSTR = "picsum.photos";
const MAX_ITINERARY_IMAGE_URLS = 14;
```

==================================================
파일 경로:
`src/lib/smartstore/smartstoreHtml.types.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
import type { TimelineModel } from "@/lib/products/mapProductToTimelineModel";
import type { SmartstoreHtmlSafetyReport } from "@/lib/smartstore/smartstoreHtml.safety";

/** 스마트스토어 상세 HTML 생성용 ViewModel (외부 CSS 없이 문자열 조립) */
export type SmartstoreHtmlViewModel = {
  productId: string;
  title: string;
  oneLiner: string;
  concept?: "효도여행" | "가족여행" | "골프" | "휴양" | "일반";
  heroImageUrl: string;
  /** 대표 외 갤러리(정규화 URL, 중복 제거) */
  galleryImageUrls: string[];
  priceText?: string;
  priceMeta?: string;
  durationText?: string;
  regionText?: string;
  categoryText?: string;
  minDeparturePeopleText?: string;
  fuelIncluded?: boolean;
  includedLines: string[];
  excludedLines: string[];
  optionalLines: string[];
  bookingConditionLines: string[];
  bookingNotesLines: string[];
  /** 일정: 구조화 타임라인 우선, 없으면 텍스트 일정 */
  timeline: TimelineModel | null;
  detailedScheduleText: string;
};

export type SmartstoreHtmlBuildMeta = {
  title: string;
  productId: string;
  characterCount: number;
  /** 최종 HTML 기준 https 이미지 태그 수 */
  imageCount: number;
  includedSections: string[];
  hasHeroImage: boolean;
  hasTimeline: boolean;
  hasIncludedExcluded: boolean;
  hasOptionalTours: boolean;
  hasNoticesBlock: boolean;
  /** 네이버 업로드 안전성 검증 결과 */
  safety: SmartstoreHtmlSafetyReport;
};

export type SmartstoreHtmlApiResponse =
  | {
      ok: true;
      html: string;
      meta: SmartstoreHtmlBuildMeta;
    }
  | { ok: false; message: string };
```

[2] 관련 함수 전체

없음

[3] 호출부 전체

`src/lib/smartstore/mapProductToSmartstoreHtmlViewModel.ts`, `src/lib/smartstore/buildSmartstoreDetailHtml.ts`, `src/app/api/admin/products/[id]/smartstore-html/route.ts`, `src/components/admin/products/modals/SmartstoreHtmlGenerateModal.tsx`

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/lib/smartstore/smartstoreHtml.helpers.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
export type ScheduleDayBlock = { label: string; content: string };
```

[2] 관련 함수 전체

```ts
/**
 * 스마트스토어 업로드용 HTML 조립 헬퍼 (외부 의존 최소화)
 */

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** ProductDetailV2.parseBulletLines 와 동일 규칙 */
export function parseBulletLines(raw?: string): string[] {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function filterEmptyLines(lines: string[]): string[] {
  return lines.map((l) => l.trim()).filter((l) => l.length > 0);
}

/** `[1일차]` 블록 파싱 — ProductDetailV2.parseScheduleDays 와 동일 */
export function parseScheduleDayBlocks(raw?: string): ScheduleDayBlock[] {
  const source = raw?.trim();
  if (!source) return [];
  const lines = source.split(/\r?\n/);
  const days: ScheduleDayBlock[] = [];
  let currentLabel = "";
  let currentContent: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\[(.+)\]\s*$/);
    if (match) {
      if (currentLabel) {
        days.push({ label: currentLabel, content: currentContent.join("\n").trim() });
      }
      currentLabel = match[1].trim();
      currentContent = [];
      continue;
    }
    currentContent.push(line);
  }
  if (currentLabel) {
    days.push({ label: currentLabel, content: currentContent.join("\n").trim() });
  }
  const filtered = days.filter((d) => d.content.length > 0);
  if (filtered.length === 0 && source) return [{ label: "일정", content: source }];
  return filtered;
}

/** 인라인 스타일 조각 조합 (세미콜론 구분) */
export function styleAttr(parts: Record<string, string | undefined>): string {
  const s = Object.entries(parts)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return s ? ` style="${escapeHtml(s)}"` : "";
}
```

[3] 호출부 전체

`src/lib/blog/mapProductToBlogPostViewModel.ts`, `src/lib/smartstore/buildSmartstoreDetailSections.ts`, `src/lib/smartstore/mapProductToSmartstoreHtmlViewModel.ts`

[4] 관련 상수/템플릿 전체

없음

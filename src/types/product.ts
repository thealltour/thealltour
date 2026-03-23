import type { ProductCampaignCardMeta } from "@/types/productCampaignCard";

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

/** [STEP 0] 구조화 일정 이벤트 1개 (시간대·아이콘 지원) */
export type ItineraryStructuredEvent = {
  heading: string;
  description?: string;
  timeOfDay?: "오전" | "오후" | "저녁" | "종일";
  iconKey?: string;
  /** 이벤트별 이미지 URL 목록 (대표·정렬 포함) */
  images?: Array<{ url: string; alt?: string; sortOrder?: number; isCover?: boolean }>;
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
  images?: Array<{ url: string; alt?: string; sortOrder?: number; isCover?: boolean }>;
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
  terms_and_notes?: string;
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

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
  /** TODO: 목록 카드 썸네일용 (card 800px). 확장 시 ProductCatalogSection 등에서 우선 사용. docs/design/product-image-card-url-extension.md */
  // image_card_url?: string;
  category: string;
  theme?: string;
  price?: number;
  duration?: string;
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
  is_featured_home?: boolean;
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
};

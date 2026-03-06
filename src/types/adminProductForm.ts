import type { ItineraryStructuredDay, ItineraryV2 } from "@/types/product";

/** 약관 템플릿 타입 (상품 등록 폼용) */
export type TermsTemplateType =
  | "overseas_brokerage"
  | "domestic_brokerage"
  | "overseas_direct"
  | "domestic_direct";

export type ProductFormState = {
  title: string;
  description: string;
  product_source_url: string;
  point_benefits: string;
  point_tourism: "O" | "X";
  point_guide: "O" | "X";
  meeting_info: "O" | "X";
  travel_insurance: "O" | "X";
  included_items: string;
  excluded_items: string;
  departure_from_airport: string;
  departure_from_date: string;
  departure_from_time: string;
  departure_to_airport: string;
  departure_to_date: string;
  departure_to_time: string;
  departure_flight_name: string;
  departure_baggage_limit: string;
  arrival_from_airport: string;
  arrival_from_date: string;
  arrival_from_time: string;
  arrival_to_airport: string;
  arrival_to_date: string;
  arrival_to_time: string;
  arrival_flight_name: string;
  arrival_baggage_limit: string;
  detailed_schedule: string;
  optional_tours: string;
  min_departure_people: string;
  terms_template_type: "" | TermsTemplateType;
  terms_and_notes: string;
  meta_title: string;
  meta_description: string;
  image_url: string;
  images_json: string[];
  category: string;
  theme: string;
  price: string;
  duration: string;
  itinerary: string;
  inclusions: string;
  is_active: boolean;
  sort_order: string;
  /** 예약 가능 / 잔여 한정 / 마감 / 상담 후 안내 */
  status: "" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  one_liner: string;
  price_meta: string;
  /** "" = 표시 안 함, "true" = 포함, "false" = 별도 */
  fuel_included: "" | "true" | "false";
  meta_info: string;
  /** JSON 문자열. 옵션 사용 시 ProductOptions 직렬화 */
  options_json: string;
  /** [STEP 3] 일정 Day별 대표 이미지 URL. 키: "1","2",... 값: URL */
  itinerary_media_json: Record<string, string>;
  /** [STEP 0] 구조화 일정. 있으면 상세에서 시각화 타임라인 우선 사용 */
  itinerary_days_json: ItineraryStructuredDay[];
  /** [STEP 1] 시각화 일정 v2 (jsonb 1컬럼, 권장) */
  itinerary_v2_json: ItineraryV2;
  /** [STEP 3] 레거시 텍스트 붙여넣기용 (저장 안 함, 초안 생성용) */
  legacy_itinerary_text: string;
  /** 일정 테마 구성비. 상세 오버뷰 차트용. 2개 이상 입력 시 저장 */
  theme_chart_json: Array<{ label: string; percent: number }>;
  /** 여행 오버뷰 카드 전용 (숙소·지역·기간) */
  overview_accommodation: string;
  overview_region: string;
  overview_duration: string;
};

/** 임시저장 payload (로컬 저장/복원용) */
export type ProductFormDraft = {
  version: 1;
  form: ProductFormState;
  savedAt: number;
};

/** 빈 폼 상태 생성 (상품 등록 초기값·Import base 등) */
export function createEmptyProductFormState(): ProductFormState {
  return {
    title: "",
    description: "",
    product_source_url: "",
    point_benefits: "",
    point_tourism: "X",
    point_guide: "X",
    meeting_info: "X",
    travel_insurance: "X",
    included_items: "",
    excluded_items: "",
    departure_from_airport: "",
    departure_from_date: "",
    departure_from_time: "",
    departure_to_airport: "",
    departure_to_date: "",
    departure_to_time: "",
    departure_flight_name: "",
    departure_baggage_limit: "",
    arrival_from_airport: "",
    arrival_from_date: "",
    arrival_from_time: "",
    arrival_to_airport: "",
    arrival_to_date: "",
    arrival_to_time: "",
    arrival_flight_name: "",
    arrival_baggage_limit: "",
    detailed_schedule: "",
    optional_tours: "",
    min_departure_people: "",
    terms_template_type: "",
    terms_and_notes: "",
    meta_title: "",
    meta_description: "",
    image_url: "",
    images_json: [],
    category: "여행상품",
    theme: "",
    price: "",
    duration: "",
    itinerary: "",
    inclusions: "",
    is_active: true,
    sort_order: "",
    status: "AVAILABLE",
    one_liner: "",
    price_meta: "",
    fuel_included: "",
    meta_info: "",
    options_json: "",
    itinerary_media_json: {},
    itinerary_days_json: [],
    itinerary_v2_json: { days: [] },
    legacy_itinerary_text: "",
    theme_chart_json: [],
    overview_accommodation: "",
    overview_region: "",
    overview_duration: "",
  };
}

import { z } from "zod";



const nullableString = z.string().nullable();



const sellingPointsSchema = z

  .object({

    corePoints: nullableString.describe("핵심포인트 본문 (원문 보존)"),

    tourism: nullableString.describe("관광 본문 (원문 보존)"),

    meals: nullableString.describe("식사 본문 (원문 보존)"),

    transport: nullableString.describe("교통 본문 (원문 보존)"),

    insurance: nullableString.describe("보험 본문 (원문 보존)"),

  })

  .nullable()

  .describe("상품 핵심안내 (하나투어 상품안내 탭)");



/** AI가 파싱하는 메타 필드만 (이미지·일정 제외) */

export const externalProductMetaSchema = z.object({

  title: nullableString.describe(
    "상품명 원문 그대로. [대괄호], 제목 내 #키워드, 공백·특수문자 제거·요약 금지.",
  ),
  seo_hashtags: z
    .array(z.string())
    .nullable()
    .describe(
      "SEO 검색 키워드 4~8개 (# 없이). 전용 AI 해시태그 섹션이 있으면 그 토큰 우선. 없으면 목적지·테마·혜택에서 작성. 상품명 통째 복사·제목 속 #키워드 재사용 금지.",
    ),
  one_liner: nullableString.describe(
    "상세 상단용 한 줄 소개(셀링 카피). 짧은 한국어 문장 1개만. 본문·일정 요지로 추천 작성. 원문 복붙·과장·없는 목적지 금지. description보다 짧게.",
  ),
  meta_description: nullableString.describe(
    "SEO meta_description. 한국어 1~2문장, 대략 80~160자. seo_hashtags와 정합. 일정 나열·가격 숫자 나열 지양.",
  ),
  description: nullableString.describe("상품 요약 및 핵심 셀링 포인트"),

  price: z

    .union([z.number(), z.string(), z.null()])

    .transform((v) => {

      if (v === null || v === undefined || v === "") return null;

      if (typeof v === "number") {

        const n = Math.round(v);

        return n > 0 ? n : null;

      }

      const digits = String(v).replace(/[^\d]/g, "");

      if (!digits) return null;

      const n = parseInt(digits, 10);

      return n > 0 ? n : null;

    })

    .nullable()

    .describe("기본 인당 가격 (원화 정수)"),

  duration: nullableString.describe("여행 기간 (예: 3박4일)"),

  theme: nullableString.describe("여행스타일/테마 (예: 관광, 다이닝/미식). 출발지역과 혼용 금지."),

  departure_region: nullableString.describe("출발 지역 (예: 인천, 김포). 여행스타일과 구분."),

  included_items: nullableString.describe(

    "포함내역 전체. [교통] 등 대괄호 카테고리·줄바꿈 유지. 요약·병합 금지.",

  ),

  excluded_items: nullableString.describe(

    "불포함내역 전체. 불릿·각주 포함 원문 그대로. 요약·병합 금지.",

  ),

  optional_expenses: nullableString.describe(

    "선택경비 섹션만. [교통] 등 카테고리·줄바꿈 유지. 선택관광과 구분. 요약 금지.",

  ),

  booking_notes: nullableString.describe("예약 유의·비고"),

  status: z

    .enum(["AVAILABLE", "LIMITED", "SOLD_OUT", "CONSULT_REQUIRED"])

    .nullable()

    .describe("판매 상태"),

  airline_name: nullableString.describe("항공사명 (예: 제주항공)"),

  departure_flight_number: nullableString.describe("가는편 항공편명 (예: 7C8631)"),

  departure_from_airport: nullableString.describe("가는편 출발 공항"),

  departure_to_airport: nullableString.describe("가는편 도착 공항"),

  departure_from_date: nullableString.describe("가는편 출발일 YYYY-MM-DD"),

  departure_from_time: nullableString.describe("가는편 출발 시각 HH:mm"),

  departure_to_date: nullableString.describe("가는편 도착일 YYYY-MM-DD"),

  departure_to_time: nullableString.describe("가는편 도착 시각 HH:mm"),

  departure_duration: nullableString.describe("가는편 소요시간 (예: 03시간 45분)"),

  arrival_flight_number: nullableString.describe("오는편(귀국) 항공편명"),

  arrival_from_airport: nullableString.describe("오는편 출발 공항"),

  arrival_to_airport: nullableString.describe("오는편 도착 공항"),

  arrival_from_date: nullableString.describe("오는편 출발일 YYYY-MM-DD"),

  arrival_from_time: nullableString.describe("오는편 출발 시각 HH:mm"),

  arrival_to_date: nullableString.describe("오는편 도착일 YYYY-MM-DD"),

  arrival_to_time: nullableString.describe("오는편 도착 시각 HH:mm"),

  arrival_duration: nullableString.describe("오는편 소요시간"),

  /** @deprecated 레거시 — departure_to_time / arrival_to_time 사용 */

  departure_time: nullableString.describe("레거시: 가는편 출발 시각"),

  arrival_time: nullableString.describe("레거시: 가는편 도착 시각"),

  selling_points_json: sellingPointsSchema,

});



export type ExternalParsedMeta = z.infer<typeof externalProductMetaSchema>;


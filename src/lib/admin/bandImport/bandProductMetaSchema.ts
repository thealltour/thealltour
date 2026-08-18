import { z } from "zod";
import {
  bandOptionSchema,
  nullablePrice,
  nullableString,
  oxFieldSchema,
  seasonalPriceBandNotesSchema,
  sellingPointsSchema,
  VERBATIM,
} from "@/lib/admin/bandImport/bandSharedSchemas";

export const bandProductMetaSchema = z.object({
  title: nullableString.describe("상품명 원문 그대로."),
  description: nullableString.describe(
    `HWP 상품 개요·특전·셀링 문단 원문. 일차별 일정은 제외. ${VERBATIM}`,
  ),
  band_marketing_copy: nullableString.describe(
    `밴드 본문에만 있는 홍보·특가·이모지 문단 전문. HWP에 없는 내용. ${VERBATIM}`,
  ),
  one_liner: nullableString.describe("상품 한 줄 셀링 카피 (짧은 문장 1개만)"),
  price: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe("본문에서 추출 가능한 가장 낮은 기준 가격 (원화 정수)"),
  duration: nullableString.describe("여행 기간 (예: 3박4일, 4일)"),
  category: nullableString.describe("상품 카테고리 (예: 여행상품, 골프투어). 없으면 null."),
  theme: nullableString.describe("테마 토큰 (예: 골프, 해외골프, 제주)"),
  overview_accommodation: nullableString.describe("호텔/숙박 시설 이름 (예: 천홍 호텔 또는 동급)"),
  overview_region: nullableString.describe("여행 지역 (예: 연태, 제주, 동남아)"),
  included_items: nullableString.describe(`포함 사항 전체. ■·줄바꿈 유지. ${VERBATIM}`),
  excluded_items: nullableString.describe(`불포함 사항 전체. ■·줄바꿈 유지. ${VERBATIM}`),
  optional_expenses: nullableString.describe(`선택경비 섹션만. 선택관광과 구분. ${VERBATIM}`),
  optional_tours: nullableString.describe(`선택관광 섹션 원문. ${VERBATIM}`),
  booking_notes: nullableString.describe(`비고 섹션 원문 전체. ${VERBATIM}`),
  options: z
    .array(bandOptionSchema)
    .nullable()
    .describe("비고 및 추가 조건의 모든 할증/옵션 비용 리스트"),
  status: z
    .enum(["AVAILABLE", "LIMITED", "SOLD_OUT", "CONSULT_REQUIRED"])
    .nullable()
    .describe("판매 상태"),
  airline_name: nullableString.describe("항공사명 (예: 이스타항공, 제주항공)"),
  departure_flight_number: nullableString.describe("가는편 항공편명 (예: ZE817)"),
  departure_from_airport: nullableString.describe("가는편 출발 공항"),
  departure_to_airport: nullableString.describe("가는편 도착 공항"),
  departure_from_date: nullableString.describe("가는편 출발일 YYYY-MM-DD"),
  departure_from_time: nullableString.describe("가는편 출발 시각 HH:mm"),
  departure_to_date: nullableString.describe("가는편 도착일 YYYY-MM-DD"),
  departure_to_time: nullableString.describe("가는편 도착 시각 HH:mm"),
  departure_baggage_limit: nullableString.describe("가는편 수하물 허용량 원문"),
  arrival_flight_number: nullableString.describe("오는편(귀국) 항공편명"),
  arrival_from_airport: nullableString.describe("오는편 출발 공항"),
  arrival_to_airport: nullableString.describe("오는편 도착 공항"),
  arrival_from_date: nullableString.describe("오는편 출발일 YYYY-MM-DD"),
  arrival_from_time: nullableString.describe("오는편 출발 시각 HH:mm"),
  arrival_to_date: nullableString.describe("오는편 도착일 YYYY-MM-DD"),
  arrival_to_time: nullableString.describe("오는편 도착 시각 HH:mm"),
  arrival_baggage_limit: nullableString.describe("오는편 수하물 허용량 원문"),
  departure_schedules: z
    .array(
      z.object({
        departure_date: nullableString.describe("출발일 원문 또는 YYYY-MM-DD"),
        return_date: nullableString,
        price: z.number().int().positive().nullable(),
        label: nullableString.describe("표시 라벨 예: 7/23(수) 출발"),
        status: z.enum(["AVAILABLE", "LIMITED", "SOLD_OUT"]).nullable(),
      }),
    )
    .nullable()
    .describe(
      "출발일·회차·가격 표의 각 행. 동일 상품에 7/23·7/30 두 날짜면 배열 2건. price는 해당 출발일 인당 요금(원화 정수).",
    ),
  /** @deprecated 레거시 — departure_from_time / departure_to_time 우선 */
  departure_time: nullableString.describe("레거시: 가는편 출발 시각"),
  /** @deprecated 레거시 — arrival_to_time 우선 */
  arrival_time: nullableString.describe("레거시: 가는편 도착 시각"),
  seasonal_price_bands: z
    .object({
      offSeason: nullablePrice.describe("비수기 구간 숫자 요금 (원화 정수)"),
      weekend: nullablePrice.describe("주말/목요일 추가 숫자 요금 (원화 정수)"),
      peakSeason: nullablePrice.describe("성수기 구간 숫자 요금 (원화 정수)"),
    })
    .nullable()
    .describe("구간별 요금 숫자 (문자 설명은 seasonal_price_band_notes에)"),
  seasonal_price_band_notes: seasonalPriceBandNotesSchema.describe(
    "구간별 요금 설명 문장 (날짜·조건·금액 조건 포함 원문)",
  ),
  selling_points_json: sellingPointsSchema.describe("상품 핵심안내 (핵심포인트·관광·식사·교통·보험)"),
  detailed_schedule: nullableString.describe(`상세 일정 텍스트 블록 원문. ${VERBATIM}`),
  travel_notes: nullableString.describe(`여행 유의사항 원문. ${VERBATIM}`),
  booking_conditions: nullableString.describe(`예약 조건 원문. ${VERBATIM}`),
  terms_and_notes: nullableString.describe(`약관·유의사항 원문. ${VERBATIM}`),
  refund_policy: nullableString.describe(`환불 규정 원문. ${VERBATIM}`),
  min_departure_people: nullableString.describe("최소 출발 인원 (예: 10명)"),
  meta_title: nullableString.describe(
    "SEO 검색 키워드 4~8개. 공백 구분, # 없이. 목적지·테마·혜택에서 작성. 상품명 통째 복사 금지. 전용 해시태그 섹션이 있으면 그 토큰 우선.",
  ),
  meta_description: nullableString.describe("SEO meta_description"),
  point_benefits: nullableString.describe(`포인트·혜택 안내 원문. ${VERBATIM}`),
  point_tourism: oxFieldSchema,
  point_guide: oxFieldSchema,
  meeting_info: oxFieldSchema,
  travel_insurance: oxFieldSchema,
});

export type BandParsedMeta = z.infer<typeof bandProductMetaSchema>;

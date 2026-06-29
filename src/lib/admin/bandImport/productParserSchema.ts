import { z } from "zod";

const nullableString = z.string().nullable();
const nullablePrice = z.union([z.string(), z.number()]).nullable();

const mealsSchema = z
  .object({
    breakfast: nullableString.describe(
      "조식 정보 원문 (예: 호텔식, 불포함). 일정표 우측 문자열 그대로.",
    ),
    lunch: nullableString.describe(
      "중식 정보 원문 (예: 불포함, 식/90위안). 일정표 우측 문자열 그대로.",
    ),
    dinner: nullableString.describe(
      "석식 정보 원문 (예: 한식&현지식, 호텔부페+무제한주류). 일정표 우측 문자열 그대로.",
    ),
  })
  .nullable();

const itineraryDaySchema = z.object({
  day: z.number().int().positive().describe("일차 (1, 2, 3, 4...)"),
  title: nullableString.describe(
    "해당 일차 요약 타이틀 (예: 인천 출발 / 연태 도착 / 18홀 라운드)",
  ),
  description: nullableString.describe(
    "이동 시간, 가이드 미팅, 골프장명, 라운드 정보 등 원문 일정의 모든 상세 행동 지침. 요약·생략 금지.",
  ),
  meals: mealsSchema,
});

const bandOptionSchema = z.object({
  name: z.string().describe("옵션 명칭 (예: 싱글룸 이용 추가, 취원코스 주중 변경, 싱글카트 이용)"),
  priceText: z
    .string()
    .describe("옵션 가격 및 조건 원문 (예: 인/박/4만원, 인/18홀/주중/2만원)"),
});

const seasonalPriceBandNotesSchema = z
  .object({
    offSeason: nullableString.describe("비수기 구간 요금 설명 (날짜·조건·금액 포함 원문)"),
    weekend: nullableString.describe("주말/목요일 출발 추가 요금 설명 원문"),
    peakSeason: nullableString.describe("성수기 구간 요금 설명 (날짜·조건·금액 포함 원문)"),
  })
  .nullable();

export const productParserSchema = z.object({
  title: nullableString.describe("상품명 (예: 7,8월 연태6색[72홀]골프투어-이스타항공)"),
  description: nullableString.describe(
    "HWP·밴드 종합 상품 요약 및 핵심 셀링 포인트. 요약 파기·의역 금지.",
  ),
  band_marketing_copy: nullableString.describe(
    "밴드 본문에만 있는 홍보·특가·이모지 문단. 상품 설명란에 넣을 마케팅 텍스트 전문.",
  ),
  one_liner: nullableString.describe("상품 한 줄 요약 (짧은 셀링 카피)"),
  price: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe("본문에서 추출 가능한 가장 낮은 기준 가격 (기본 인당 비용, 원화 정수)"),
  duration: nullableString.describe("여행 기간 (예: 3박4일, 4일)"),
  category: nullableString.describe("상품 카테고리 (예: 여행상품, 골프투어). 없으면 null."),
  theme: nullableString.describe("테마 토큰 (예: 골프, 해외골프, 제주)"),
  overview_accommodation: nullableString.describe(
    "일정표 및 본문에 등장하는 호텔/숙박 시설 이름 (예: 천홍 호텔 또는 동급)",
  ),
  overview_region: nullableString.describe("여행 지역 (예: 연태, 제주, 동남아)"),
  included_items: nullableString.describe(
    "포함 사항 전체 (■ 왕복항공권, 특급호텔 등 모든 항목을 빠짐없이 나열)",
  ),
  excluded_items: nullableString.describe(
    "불포함 사항 전체 (■ 미팅/샌딩비, 클럽중식, 캐디피/카트비, 캐디팁 등 비용 정보 누락 없이)",
  ),
  booking_notes: nullableString.describe(
    "비고 섹션 원문 전체 (싱글룸·싱글카트·취원코스·항공 마감 조건 등 금액·조건 100% 보존)",
  ),
  options: z
    .array(bandOptionSchema)
    .nullable()
    .describe("비고 및 추가 조건의 모든 할증/옵션 비용 리스트"),
  status: z
    .enum(["AVAILABLE", "LIMITED", "SOLD_OUT", "CONSULT_REQUIRED"])
    .nullable()
    .describe("판매 상태"),
  departure_flight_number: nullableString.describe("출발 항공편명 (예: ZE817)"),
  departure_from_airport: nullableString.describe("출발 공항 (예: 인천)"),
  departure_to_airport: nullableString.describe("도착 공항 (예: 연태)"),
  departure_time: nullableString.describe("출발 시간 (예: 08:55)"),
  arrival_time: nullableString.describe("도착 시간 (예: 09:25)"),
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
  itinerary_v2_json: z
    .array(itineraryDaySchema)
    .nullable()
    .describe("1일차부터 마지막 날까지 일정. 텍스트 유실 엄금."),
});

export type BandParsedProduct = z.infer<typeof productParserSchema>;
export type BandParsedItineraryDay = z.infer<typeof itineraryDaySchema>;
export type BandParsedOption = z.infer<typeof bandOptionSchema>;
export type BandSeasonalPriceBandNotes = z.infer<typeof seasonalPriceBandNotesSchema>;

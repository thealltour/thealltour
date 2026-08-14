import { z } from "zod";

export const nullableString = z.string().nullable();
export const nullablePrice = z.union([z.string(), z.number()]).nullable();

export const VERBATIM = "원문 그대로. 요약·의역·병합·생략 금지.";

export const mealsSchema = z
  .object({
    breakfast: nullableString.describe(`조식 정보. 일정표 우측 문자열 그대로. ${VERBATIM}`),
    lunch: nullableString.describe(`중식 정보. 일정표 우측 문자열 그대로. ${VERBATIM}`),
    dinner: nullableString.describe(`석식 정보. 일정표 우측 문자열 그대로. ${VERBATIM}`),
  })
  .nullable();

const timeOfDayEnum = z.enum(["오전", "오후", "저녁", "종일"]);

export const itineraryEventSchema = z.object({
  heading: z
    .string()
    .describe("이벤트 제목. 출발과 도착은 각각 별 이벤트. 예: 인천 국제공항 출발"),
  description: nullableString.describe(`해당 이벤트 상세 원문. ${VERBATIM}`),
  timeText: nullableString.describe("구체 시각 HH:mm (예: 08:55). 일정표 시간 컬럼과 1:1. 없으면 null"),
  timeOfDay: timeOfDayEnum.nullable().describe("시간대. 시각이 있으면 맞춤. 없으면 null"),
  location: nullableString.describe("장소. 없으면 null"),
});

export const itineraryDaySchema = z.object({
  day: z.number().int().positive().describe("일차 (1, 2, 3, 4...)"),
  title: nullableString.describe("해당 일차 타이틀 (예: 인천 출발 / 연태 도착 / 18홀 라운드)"),
  events: z
    .array(itineraryEventSchema)
    .nullable()
    .optional()
    .describe(
      "일차를 시각·행동 단위로 나눈 이벤트. 시간 컬럼의 각 시각은 별 이벤트. 출발/도착 분리. 식사·숙소는 별 이벤트(본문과 섞지 말 것). 18홀은 홀 수.",
    ),
  description: nullableString.describe(
    `하위 호환. events가 있으면 null. events가 없을 때만 일차 전체 상세. ${VERBATIM}`,
  ),
  meals: mealsSchema,
});

export const bandOptionSchema = z.object({
  name: z.string().describe("옵션 명칭 (예: 싱글룸 이용 추가, 취원코스 주중 변경)"),
  priceText: z.string().describe("옵션 가격 및 조건 원문 (예: 인/박/4만원)"),
});

export const seasonalPriceBandNotesSchema = z
  .object({
    offSeason: nullableString.describe(`비수기 구간 요금 설명. ${VERBATIM}`),
    weekend: nullableString.describe(`주말/목요일 출발 추가 요금 설명. ${VERBATIM}`),
    peakSeason: nullableString.describe(`성수기 구간 요금 설명. ${VERBATIM}`),
  })
  .nullable();

export const sellingPointsSchema = z
  .object({
    corePoints: nullableString.describe(`핵심포인트 본문. ${VERBATIM}`),
    tourism: nullableString.describe(`관광 본문. ${VERBATIM}`),
    meals: nullableString.describe(`식사 본문. ${VERBATIM}`),
    transport: nullableString.describe(`교통 본문. ${VERBATIM}`),
    insurance: nullableString.describe(`보험 본문. ${VERBATIM}`),
  })
  .nullable();

export const oxFieldSchema = z
  .enum(["O", "X"])
  .nullable()
  .describe("원문에 포함(O)/불포함(X) 표시가 있을 때만. 없으면 null.");

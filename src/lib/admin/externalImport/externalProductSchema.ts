import { z } from "zod";

import { externalProductMetaSchema } from "@/lib/admin/externalImport/externalProductMetaSchema";
import { themeChartJsonSchema } from "@/lib/admin/themeChartSchema";



const timeOfDayEnum = z.enum(["오전", "오후", "저녁", "종일"]);



const externalItineraryEventSchema = z.object({

  heading: z.string().describe("이벤트 제목 (관광지명, 식사, 이동 등)"),

  description: z.string().nullable().describe("이벤트 상세 설명 원문. 요약·생략 금지."),

  timeOfDay: timeOfDayEnum.nullable().describe("시간대"),

  timeText: z.string().nullable().describe("구체 시각 (예: 09:00)"),

  imageUrls: z

    .array(z.string())

    .max(8)

    .describe("이 이벤트 HTML 블록에 인접한 <img> src URL만 (로고/아이콘/배너 제외)"),

});



const externalItineraryDaySchema = z.object({

  day: z

    .number()

    .int()

    .positive()

    .describe("HTML 내 'N일차' 또는 '제 N일' 마커를 기준으로 정확히 분리한 일차 번호"),

  dateText: z.string().nullable().describe("날짜 텍스트 (예: 11/27(금))"),

  title: z.string().nullable().describe("일차 요약 타이틀"),

  coverImageUrl: z.string().nullable().describe("일차 대표 커버 이미지 URL"),

  events: z.array(externalItineraryEventSchema).describe("일차별 이벤트 목록"),

});



const externalItineraryV2Schema = z

  .object({

    days: z.array(externalItineraryDaySchema),

  })

  .nullable();



export const externalItineraryOnlySchema = z.object({

  itinerary_v2_json: externalItineraryV2Schema,

  theme_chart_json: themeChartJsonSchema.optional(),

});



export const externalProductSchema = externalProductMetaSchema.extend({

  meta_title: z.string().nullable().optional().describe("SEO meta_title (공백 구분 키워드)"),

  itinerary_v2_json: externalItineraryV2Schema.describe(

    "ItineraryV2 구조 일정. 관광지/식사/이동마다 별도 event, 이벤트별 imageUrls 포함",

  ),

  theme_chart_json: themeChartJsonSchema,

  image_url: z.string().nullable().describe("대표 이미지 URL (본문 관련 고화질 1개)"),

  images_json: z

    .array(z.string())

    .max(10)

    .nullable()

    .describe("갤러리 이미지 URL 최대 10개"),

});



export type ExternalParsedProduct = z.infer<typeof externalProductSchema>;

export type ExternalParsedItineraryV2 = z.infer<typeof externalItineraryV2Schema>;

export type ExternalParsedItineraryDay = z.infer<typeof externalItineraryDaySchema>;

export type ExternalParsedItineraryEvent = z.infer<typeof externalItineraryEventSchema>;


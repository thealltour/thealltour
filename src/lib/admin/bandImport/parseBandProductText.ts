import "server-only";

import { generateObject } from "ai";
import { resolveImportLanguageModel, resolveImportModelId } from "@/lib/admin/ai/importAiModel";
import { bandItineraryOnlySchema } from "@/lib/admin/bandImport/bandItineraryOnlySchema";
import { bandProductMetaSchema } from "@/lib/admin/bandImport/bandProductMetaSchema";
import { mergeBandParsed } from "@/lib/admin/bandImport/mergeBandParsed";
import type { BandParsedProduct } from "@/lib/admin/bandImport/productParserSchema";
import {
  buildBandItinerarySourceText,
  buildBandMetaSourceText,
} from "@/lib/admin/bandImport/bandTextTruncate";
import { THEME_CHART_PROMPT_RULES } from "@/lib/admin/themeChartSchema";

export type ParseBandProductTextInput = {
  bandText: string;
  hwpText: string;
};

export function getBandImportModelId(): string {
  return resolveImportModelId().modelId;
}

const META_SYSTEM_PROMPT = `You map Korean travel-agency band/HWP text into a strict JSON metadata schema.
Rules:
- Do NOT summarize, omit, paraphrase, or merge lines for prices, conditions, hotel names, inclusions, or surcharges.
- Fill every schema field when the source contains relevant data. Use null only when truly absent.
- HWP document text is authoritative for inclusions, exclusions, optional expenses, booking notes, terms, and flight tables.
- Band post text is authoritative for band_marketing_copy (promotional paragraphs not in HWP).
- description: copy HWP product overview/selling paragraphs verbatim. Do NOT include day-by-day schedule (handled separately).
- included_items, excluded_items, optional_expenses, booking_notes, travel_notes, booking_conditions, terms_and_notes, refund_policy: preserve line breaks, ■ bullets, and [category] brackets.
- Also extract each surcharge/option into options[] (name + priceText) in addition to booking_notes when present. "18홀" is a hole count, not KRW. Keep "위안"/"元" in priceText as-is; never convert them to "원".
- overview_accommodation: hotel names like "천홍 호텔 또는 동급".
- seasonal_price_bands: numeric KRW integers only. Put date ranges and conditions in seasonal_price_band_notes.
- Flight: split outbound (가는편) and return (오는편/귀국). Use YYYY-MM-DD for dates, HH:mm for times when available.
- departure_schedules: each row from 출발일/회차/가격 tables = one array item (departure_date, return_date, price, label, status). Multiple departure dates = multiple items. departure_from_date = first schedule date only when no single flight departure date in the table. If the source text has NO year as "20xx년", do NOT guess a year in departure_date — use month/day only (e.g. 7/23 or 07.23) and put the display text in label. Use YYYY-MM-DD only when "20xx년" (or an explicit tour year) is stated in the source. status defaults to AVAILABLE when not stated.
- selling_points_json: extract 핵심포인트, 관광, 식사, 교통, 보험 sections verbatim when present.
- point_tourism, point_guide, meeting_info, travel_insurance: "O" or "X" only when explicitly stated; else null.
- Do NOT build itinerary_v2_json in this pass.`;

const ITINERARY_SYSTEM_PROMPT = `You extract day-by-day itinerary from Korean travel HWP/band schedule text into itinerary_v2_json and theme_chart_json.
Rules:
- Focus on the schedule table / 일차 sections in the source.
- Split each day into events[]. Do NOT dump the whole day into a single description.
- Each distinct clock time in the 시간 column is its own event with timeText as HH:mm (e.g. 08:55 인천 국제공항 출발 and 09:25 연태 국제공항 도착 are TWO events).
- Split 출발 and 도착 even when they sit in the same table row.
- Transfers, golf rounds, meetings, and rest are separate activity events. Keep transfer duration (e.g. 약 40분), course names, and surcharge notes in that event's description. Do NOT summarize.
- 18홀 is a hole count, not a price.
- Meals (조식/중식/석식) from the meal column and lodging (숙소/호텔 또는 동급) are separate events. Do not mix them into the all-day activity blob.
- meals: still copy breakfast/lunch/dinner from the schedule row verbatim (in addition to meal events).
- Preserve every day from 1일차 through the last day. Do not skip days.
- Use null for itinerary_v2_json only when no schedule exists at all.
${THEME_CHART_PROMPT_RULES}`;

function buildBandMetaPrompt(input: ParseBandProductTextInput): string {
  const hwp = input.hwpText.trim();
  const band = input.bandText.trim();
  const source = buildBandMetaSourceText(hwp, band);

  const sections: string[] = [
    "다음 원문에서 메타데이터 스키마 필드를 빠짐없이 추출하세요. 단어·금액·조건을 요약하거나 생략하지 마세요.",
    "",
    "[추출 지침]",
    "1. 비고 섹션 → booking_notes 원문 + options[] 각 항목 분리. 18홀은 가격이 아님. 위안은 원으로 바꾸지 말고 priceText에 그대로.",
    "2. 호텔/숙박 → overview_accommodation",
    "3. 밴드 홍보·특가 문단 → band_marketing_copy (HWP에 없는 내용)",
    "4. 구간 요금 날짜·조건 → seasonal_price_band_notes, 숫자만 → seasonal_price_bands",
    "5. ■ 포함/불포함/선택경비 → included_items, excluded_items, optional_expenses",
    "6. 선택관광 → optional_tours",
    "7. 약관·유의·환불 → terms_and_notes, travel_notes, booking_conditions, refund_policy",
    "8. 항공 표 → 가는편/오는편 각 필드 분리",
    "9. 출발일·회차·가격 표 → departure_schedules 각 행 분리 (7/23 89만, 7/30 92만 → 2건). price는 원화 정수. 원문에 `20xx년` 형태 연도가 없으면 departure_date에 연도를 추측하지 말고 7/23·07.23 형식만 사용하고 표기는 label에. `20xx년`이 있을 때만 YYYY-MM-DD. 각 행 status는 명시 없으면 AVAILABLE.",
    "10. price는 원화 정수(쉼표·만원·원 제거). 스케줄 가격이 있으면 최저가, 없으면 본문 기본가.",
    "11. 상품 status: AVAILABLE/LIMITED/SOLD_OUT/CONSULT_REQUIRED 또는 null. 출발일 스케줄 status는 AVAILABLE/LIMITED/SOLD_OUT (미기재 시 AVAILABLE).",
    "",
    "=== 원문 (HWP 우선, 밴드 본문 포함) ===",
    source,
  ];

  return sections.join("\n");
}

function buildBandItineraryPrompt(input: ParseBandProductTextInput): string {
  const hwp = input.hwpText.trim();
  const band = input.bandText.trim();
  const source = buildBandItinerarySourceText(hwp, band);

  return [
    "다음 원문에서 일정표만 itinerary_v2_json으로 추출하세요. 일차별 상세를 요약·생략하지 마세요.",
    "",
    "[추출 지침]",
    "1. 1일차부터 마지막 일차까지 모든 day 포함",
    "2. 시간 컬럼의 각 시각(08:55, 09:25 등)은 events[]에서 별 이벤트. 출발/도착 분리",
    "3. 이동·미팅·라운드·휴식은 각각 events 항목. description에 원문 상세",
    "4. 조식/중식/석식·숙소는 별 이벤트. 본문 일정과 한 덩어리로 합치지 말 것",
    "5. meals는 일정표 우측 식사란 문자열 그대로",
    "6. theme_chart_json: 일정 시간 비중으로 골프/관광/자유일정/식사/이동 등 2~5개, 합 100%. theme·category 균등 분할 금지. 일정 없으면 null",
    "",
    "=== 일정 원문 (HWP 우선) ===",
    source,
  ].join("\n");
}

export async function parseBandProductText(
  input: ParseBandProductTextInput,
): Promise<BandParsedProduct> {
  const model = resolveImportLanguageModel();

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

export function formatBandParseError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "밴드 상품 파싱 중 알 수 없는 오류가 발생했습니다.";
}

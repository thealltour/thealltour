import "server-only";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  productParserSchema,
  type BandParsedProduct,
} from "@/lib/admin/bandImport/productParserSchema";

export type ParseBandProductTextInput = {
  bandText: string;
  hwpText: string;
};

const SYSTEM_PROMPT = `You are a data engineer that maps Korean travel-agency band/HWP text into a strict JSON schema.
Rules:
- Do NOT summarize, omit, or paraphrase prices, conditions, hotel names, or surcharge options.
- Fill every schema field when the source text contains relevant data. Use null only when truly absent.
- HWP document text is authoritative for itinerary, inclusions, exclusions, and booking notes.
- Band post text is authoritative for band_marketing_copy (promotional paragraphs not in HWP).
- booking_notes must preserve the full "비고" section verbatim when present.
- Also extract each surcharge/option into the options array (name + priceText) in addition to booking_notes.
- overview_accommodation must capture hotel names like "천홍 호텔 또는 동급".
- itinerary_v2_json[].description must include meeting times, transfer duration (e.g. 약 40분), golf course names, and all schedule details.
- seasonal_price_bands: numeric KRW integers only. Put date ranges and conditions in seasonal_price_band_notes.`;

function buildPrompt(input: ParseBandProductTextInput): string {
  const hwp = input.hwpText.trim();
  const band = input.bandText.trim();

  const sections: string[] = [
    "다음 원문에서 스키마 필드를 빠짐없이 추출하세요. 단어·금액·조건을 요약하거나 생략하지 마세요.",
    "",
    "[추출 지침]",
    "1. 비고 섹션(싱글룸, 싱글카트, 취원코스, 항공 마감 등) → booking_notes 원문 + options[] 각 항목 분리",
    "2. 호텔/숙박(예: 천홍 호텔 또는 동급) → overview_accommodation",
    "3. 일차별 미팅·이동시간·골프장 → itinerary_v2_json[].description 상세 기술",
    "4. 밴드 홍보·특가 문단 → band_marketing_copy (HWP에 없는 셀링 카피)",
    "5. 구간 요금 날짜·조건 설명 → seasonal_price_band_notes, 숫자만 → seasonal_price_bands",
    "6. ■ 포함/불포함 항목은 included_items, excluded_items에 전부 나열",
    "7. price는 원화 정수(쉼표·만원·원 제거). 여러 가격이 있으면 가장 낮은 기본가.",
    "8. status: AVAILABLE/LIMITED/SOLD_OUT/CONSULT_REQUIRED 또는 null",
  ];

  if (hwp) {
    sections.push("", "=== HWP 문서 텍스트 (우선 참고) ===", hwp);
  }
  if (band) {
    sections.push("", "=== 네이버 밴드 본문 ===", band);
  }

  return sections.join("\n");
}

export async function parseBandProductText(
  input: ParseBandProductTextInput,
): Promise<BandParsedProduct> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되어 있지 않습니다.");
  }

  const { object } = await generateObject({
    model: openai("gpt-4o"),
    schema: productParserSchema,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(input),
  });

  return object;
}

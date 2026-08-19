import "server-only";

import { generateObject } from "ai";
import { resolveImportLanguageModel } from "@/lib/admin/ai/importAiModel";
import {
  formatQuotaExceededMessage,
  isAiQuotaError,
  isTransientAiError,
} from "@/lib/admin/ai/importAiErrors";
import {
  externalProductMetaSchema,
  type ExternalParsedMeta,
} from "@/lib/admin/externalImport/externalProductMetaSchema";
import {
  externalItineraryOnlySchema,
  type ExternalParsedItineraryV2,
} from "@/lib/admin/externalImport/externalProductSchema";
import {
  THEME_CHART_PROMPT_RULES,
  type ThemeChartJson,
} from "@/lib/admin/themeChartSchema";
import { SEO_META_TITLE_AI_PROMPT_RULES } from "@/lib/products/seoMetaTitleAi";
import type { ItineraryBlock } from "@/lib/admin/externalImport/itineraryBlockTypes";
import type { ExternalProvider } from "@/lib/admin/externalImport/detectExternalProvider";
import { getExternalProviderLabel } from "@/lib/admin/externalImport/detectExternalProvider";
import {
  minifyHtmlForAi,
  stripHtmlToText,
  truncatePageContent,
} from "@/lib/admin/externalImport/htmlContextExtract";
import {
  preferTotalPriceOverInstallment,
  stripInstallmentMetaText,
} from "@/lib/admin/externalImport/preferTotalPriceOverInstallment";

/** 메타: plain text만 (HTML 전체 금지 — TPM 초과 방지) */
const MAX_META_CHARS = 18_000;

/** 일정: minify 후 HTML */
const MAX_ITINERARY_HTML_CHARS = 48_000;

export type ParseExternalProductPageInput = {
  cleanHtmlStructure?: string;
  rawHtmlText?: string;
  itineraryBlocks?: ItineraryBlock[];
  productSourceUrl: string;
  provider: ExternalProvider | null;
};

function resolveMetaContent(input: ParseExternalProductPageInput): string {
  const text = input.rawHtmlText?.trim();
  if (text) return stripInstallmentMetaText(truncatePageContent(text, MAX_META_CHARS));
  const html = input.cleanHtmlStructure?.trim();
  if (html) {
    return stripInstallmentMetaText(
      truncatePageContent(stripHtmlToText(html), MAX_META_CHARS),
    );
  }
  return "";
}

function resolveOriginalMetaText(input: ParseExternalProductPageInput): string {
  const text = input.rawHtmlText?.trim();
  if (text) return text;
  const html = input.cleanHtmlStructure?.trim();
  if (html) return stripHtmlToText(html);
  return "";
}

function resolveItineraryContent(input: ParseExternalProductPageInput): {
  content: string;
  isHtml: boolean;
} {
  const html = input.cleanHtmlStructure?.trim();
  if (html) {
    const minified = minifyHtmlForAi(html);
    return {
      content: truncatePageContent(minified, MAX_ITINERARY_HTML_CHARS),
      isHtml: true,
    };
  }
  const text = input.rawHtmlText?.trim() ?? "";
  return {
    content: truncatePageContent(text, MAX_ITINERARY_HTML_CHARS),
    isHtml: false,
  };
}

const META_SYSTEM_PROMPT = `You extract structured Korean travel product METADATA from OTA (hanatour/modetour) page content.
Rules:
- Input is plain page text (product summary, included/excluded, flight schedule, selling points).
- Fill schema fields from page content. Use null only when truly absent.
- Do NOT invent prices or flights not in the text.
- Do NOT select images or build itinerary — server handles those separately.
- description: product summary/selling points, not day-by-day schedule.
- price: integer KRW for the adult 1-person TOTAL fare (strip commas). null if absent.
- Ignore installment quotes: 할부, 무이자, 월 n원, 할부 예상가, 카드사별 무이자. Those are monthly amounts, not the product price.
- ModeTour (모두투어) "예상가" next to ₩ amount IS the product price when it is NOT an installment (no 할부/월).
- If a "[가격 정보]" section is present in the text, it is the booking sidebar and takes PRIORITY over any other number in the page for price. Use the "성인 1인" (adult 1-person) TOTAL amount inside it.
- theme: travel style/themes only (e.g. 관광, 다이닝). NEVER put themes in departure_region.
- departure_region: geographic departure area only (e.g. 인천, 김포).
- included_items, excluded_items, optional_expenses: copy VERBATIM from source.
  Keep [교통], [숙박] bracket categories, line breaks, and footnotes. Do NOT summarize or merge lines.
- optional_expenses: only the "선택경비" section. Not optional tours (선택관광).
- Flight info from "여행 주요일정" or flight summary: split outbound (가는편) and inbound/return (오는편/귀국).
  Use YYYY-MM-DD for dates, HH:mm for times. Keep duration text as-is (e.g. 03시간 45분).
- selling_points_json: extract 핵심포인트, 관광, 식사, 교통, 보험 sections verbatim when present.
- title: copy the page product name EXACTLY as shown (include [brackets], inline #keywords, all spaces). Do NOT shorten or clean up.
- ${SEO_META_TITLE_AI_PROMPT_RULES}`;

const ITINERARY_HTML_PROMPT = `Extract itinerary_v2_json and theme_chart_json from sanitized HTML.
Rules:
- Analyze DOM sequence top-to-bottom. Tag placement encodes context.
- Split days using 'N일차' or '제 N일' markers in the HTML text.
- For sightseeing/POI events only: <img src="..."> tags immediately before, after, or inside the event block may be that event's photos.
- Flight, airline, departure, arrival, transfer, and hotel check-in events MUST have imageUrls: [] (empty array). Never attach images to these.
- "출입국 정보", "예약 전 유의사항" notice sections are NOT flight events — extract as separate events with full text and QR/guide images when present in HTML.
- Airport immigration checkpoint moves (입국/출국 as timeline steps) have imageUrls: [].
- Images are only for tourist attractions, scenic spots, hotel exterior, and restaurant photos — not airline logos, map icons, or UI icons.
- Exclude logo, icon, banner, spinner, arrow, badge, airline carrier image URLs from imageUrls.
- Create separate events per attraction, meal, flight, hotel check-in, and major move.
- event.description must preserve full source paragraphs. Do NOT summarize, paraphrase, or shorten.
- When [DOM itineraryBlocks] are provided below, copy each block's description VERBATIM onto the matching heading event. Prefer those block descriptions over HTML paraphrases. Do not invent text missing from the blocks/HTML.
- Use empty imageUrls array when no valid POI photo exists for an event.
${THEME_CHART_PROMPT_RULES}`;

const MAX_BLOCK_ANCHOR_CHARS = 24_000;

function formatItineraryBlockAnchors(blocks: ItineraryBlock[] | undefined): string {
  if (!blocks?.length) return "";
  const lines: string[] = [
    "[DOM itineraryBlocks — copy description VERBATIM onto matching events; prefer over HTML paraphrases]",
  ];
  let used = lines[0].length;
  for (const block of blocks) {
    const heading = block.heading.trim();
    if (!heading) continue;
    const dayLabel = typeof block.day === "number" && block.day > 0 ? `${block.day}일차` : "day?";
    const desc = block.description.trim();
    const chunk = [
      `---`,
      `day: ${dayLabel}`,
      `heading: ${heading}`,
      `description:`,
      desc || "(empty)",
    ].join("\n");
    if (used + chunk.length + 1 > MAX_BLOCK_ANCHOR_CHARS) break;
    lines.push(chunk);
    used += chunk.length + 1;
  }
  return lines.length > 1 ? lines.join("\n") : "";
}

function buildMetaPrompt(input: ParseExternalProductPageInput): string {
  const providerLabel = getExternalProviderLabel(input.provider) ?? "외부 여행사";
  const content = resolveMetaContent(input);

  return [
    `여행사: ${providerLabel}`,
    `원본 URL: ${input.productSourceUrl || "(없음)"}`,
    "",
    "[상품 메타 영역 텍스트]",
    content,
    "",
    "상품 메타 필드만 추출하세요 (이미지·일정 제외).",
  ].join("\n");
}

function buildItineraryPrompt(input: ParseExternalProductPageInput): string {
  const providerLabel = getExternalProviderLabel(input.provider) ?? "외부 여행사";
  const { content, isHtml } = resolveItineraryContent(input);
  const blockAnchors = formatItineraryBlockAnchors(input.itineraryBlocks);

  if (!isHtml) {
    return [
      `여행사: ${providerLabel}`,
      "",
      blockAnchors,
      blockAnchors ? "" : null,
      "[페이지 텍스트 — HTML 없음, 텍스트 기반 일정 추출]",
      content,
    ]
      .filter((line) => line != null)
      .join("\n");
  }

  return [
    `여행사: ${providerLabel}`,
    `원본 URL: ${input.productSourceUrl || "(없음)"}`,
    "",
    blockAnchors,
    blockAnchors ? "" : null,
    "[정제된 일정 HTML — DOM 시퀀스로 이벤트·이미지 매핑]",
    content,
  ]
    .filter((line) => line != null)
    .join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableAiError(error: unknown): boolean {
  return isTransientAiError(error);
}

async function withOneRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isAiQuotaError(error) || !isRetryableAiError(error)) throw error;
    console.warn(`[import-external] ${label} failed, retrying once after 1s:`, error);
    await sleep(1000);
    return await fn();
  }
}

export async function parseExternalProductMeta(
  input: ParseExternalProductPageInput,
): Promise<ExternalParsedMeta> {
  const metaContent = resolveMetaContent(input);
  if (!metaContent) {
    throw new Error("메타 추출용 페이지 텍스트가 비어 있습니다.");
  }

  const { object } = await withOneRetry("parseExternalProductMeta", async () =>
    generateObject({
      model: resolveImportLanguageModel(),
      schema: externalProductMetaSchema,
      system: META_SYSTEM_PROMPT,
      prompt: buildMetaPrompt(input),
      maxRetries: 0,
    }),
  );

  return {
    ...object,
    price: preferTotalPriceOverInstallment(object.price, resolveOriginalMetaText(input)),
  };
}

export type ParseExternalItineraryResult = {
  itinerary_v2_json: ExternalParsedItineraryV2 | null;
  theme_chart_json: ThemeChartJson | null;
};

const EMPTY_ITINERARY_RESULT: ParseExternalItineraryResult = {
  itinerary_v2_json: null,
  theme_chart_json: null,
};

export async function parseExternalItineraryFromHtml(
  input: ParseExternalProductPageInput,
): Promise<ParseExternalItineraryResult> {
  const { content } = resolveItineraryContent(input);
  if (!content) {
    return EMPTY_ITINERARY_RESULT;
  }

  const { object } = await withOneRetry("parseExternalItineraryFromHtml", async () =>
    generateObject({
      model: resolveImportLanguageModel(),
      schema: externalItineraryOnlySchema,
      system: ITINERARY_HTML_PROMPT,
      prompt: buildItineraryPrompt(input),
      maxRetries: 0,
    }),
  );

  return {
    itinerary_v2_json: object.itinerary_v2_json,
    theme_chart_json: object.theme_chart_json ?? null,
  };
}

/** @deprecated use parseExternalItineraryFromHtml */
export const parseExternalItineraryFallback = parseExternalItineraryFromHtml;

export async function parseExternalProductPage(input: {
  cleanHtmlStructure?: string;
  rawHtmlText?: string;
  itineraryBlocks?: ItineraryBlock[];
  productSourceUrl: string;
  provider: ExternalProvider | null;
}): Promise<{
  meta: ExternalParsedMeta;
  aiItineraryFallback: ExternalParsedItineraryV2 | null;
  theme_chart_json: ThemeChartJson | null;
}> {
  const itineraryPromise = parseExternalItineraryFromHtml(input).catch((error) => {
    if (isAiQuotaError(error)) throw error;
    console.warn("[import-external] itinerary AI parse failed:", error);
    return EMPTY_ITINERARY_RESULT;
  });

  const [meta, itineraryResult] = await Promise.all([
    parseExternalProductMeta(input),
    itineraryPromise,
  ]);

  return {
    meta,
    aiItineraryFallback: itineraryResult.itinerary_v2_json,
    theme_chart_json: itineraryResult.theme_chart_json,
  };
}

export function formatExternalParseError(error: unknown): string {
  if (isAiQuotaError(error)) {
    return formatQuotaExceededMessage(error);
  }
  if (!(error instanceof Error)) {
    return "외부 상품 페이지 파싱에 실패했습니다.";
  }
  if (
    error.message.includes("OPENAI_API_KEY") ||
    error.message.includes("GOOGLE_GENERATIVE_AI_API_KEY") ||
    error.message.includes("GEMINI_API_KEY") ||
    error.message.includes("상품 파서용 AI 키") ||
    error.message.includes("IMPORT_AI_PROVIDER")
  ) {
    return error.message;
  }
  if (error.message.includes("메타 추출용 페이지 텍스트가 비어")) {
    return error.message;
  }
  const lower = error.message.toLowerCase();
  if (
    lower.includes("rate_limit") ||
    lower.includes("tokens per min") ||
    lower.includes("request too large")
  ) {
    return "AI 토큰 한도를 초과했습니다. 잠시 후 다시 시도하거나 모델 사용 한도를 확인해 주세요.";
  }
  if (
    lower.includes("model") &&
    (lower.includes("not found") || lower.includes("does not exist") || lower.includes("invalid"))
  ) {
    return `AI 모델 호출 실패: ${error.message}`;
  }
  if (error.message.trim() && error.message.length <= 240) {
    return `외부 상품 페이지 파싱에 실패했습니다: ${error.message}`;
  }
  return "외부 상품 페이지 파싱에 실패했습니다.";
}

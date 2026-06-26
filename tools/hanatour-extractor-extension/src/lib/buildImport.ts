import type { HanatourImportV1, HanatourImportWarning } from "~types/hanatourImport";
import type { ExtractedDomData } from "~lib/extractTypes";
import { truncateSnippet } from "~lib/selectors";

const SNIPPET_MAX = 5000;

function addWarning(
  list: HanatourImportWarning[],
  code: string,
  message: string,
  path?: string,
): void {
  list.push({ code, message, path });
}

/**
 * Day 번호가 1부터 연속인지 검사
 */
function checkDaySequence(
  days: NonNullable<HanatourImportV1["itinerary"]>["days"],
  warnings: HanatourImportWarning[],
): void {
  if (!days?.length) return;
  const nums = days
    .map((d) => d.dayNumber)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] !== i + 1) {
      addWarning(
        warnings,
        "DAY_SEQUENCE_INVALID",
        `Day 번호가 1부터 연속이 아닙니다: ${nums.join(", ")}`,
        "itinerary.days[].dayNumber",
      );
      break;
    }
  }
}

/**
 * ExtractedDomData → HanatourImportV1 (warnings, raw 포함)
 * PR16 이후: payload는 source, product(title/nights/days/regionText/priceText), itinerary, media, warnings, raw 만 포함.
 * 설명/포함·불포함/약관/상세탭 필드는 설정하지 않음.
 */
export function buildHanatourImportV1(extracted: ExtractedDomData): HanatourImportV1 {
  const warnings: HanatourImportWarning[] = [];

  if (!extracted.product.title?.trim()) {
    addWarning(warnings, "TITLE_MISSING", "상품명을 찾지 못했습니다.", "product.title");
  }

  if (extracted.missingSections?.includes("ITINERARY_PARSE_UNCERTAIN")) {
    addWarning(
      warnings,
      "ITINERARY_PARSE_UNCERTAIN",
      "일정을 확실히 파싱하지 못했습니다. raw.textSnippets.itinerary를 확인하세요.",
      "itinerary",
    );
  }
  if (extracted.missingSections?.includes("ITINERARY_SCOPE_NOT_FOUND")) {
    addWarning(
      warnings,
      "ITINERARY_SCOPE_NOT_FOUND",
      "일정 섹션 컨테이너를 찾지 못했습니다.",
      "itinerary",
    );
  }
  if (extracted.missingSections?.includes("ITINERARY_SCOPE_TOO_SHORT")) {
    addWarning(
      warnings,
      "ITINERARY_SCOPE_TOO_SHORT",
      "일정 스코프 텍스트가 너무 짧습니다.",
      "itinerary",
    );
  }
  if (extracted.missingSections?.includes("IMAGES_LOW_CONFIDENCE")) {
    addWarning(
      warnings,
      "IMAGES_LOW_CONFIDENCE",
      "이미지 품질/수가 불확실할 수 있습니다.",
      "media",
    );
  }
  if (extracted.missingSections?.includes("ITINERARY_DOM_NOT_FOUND")) {
    addWarning(
      warnings,
      "ITINERARY_DOM_NOT_FOUND",
      "DOM에서 일정 Day 컨테이너를 찾지 못했습니다. 텍스트 파서로 대체되었습니다.",
      "itinerary",
    );
  }
  if (extracted.missingSections?.includes("ITINERARY_DOM_EVENTS_EMPTY")) {
    addWarning(
      warnings,
      "ITINERARY_DOM_EVENTS_EMPTY",
      "DOM 일정에서 이벤트 블록을 찾지 못했습니다. 텍스트 파서로 이벤트를 보완했습니다.",
      "itinerary",
    );
  }
  if (extracted.missingSections?.includes("ITINERARY_DOM_LOW_EVENTS")) {
    addWarning(
      warnings,
      "ITINERARY_DOM_LOW_EVENTS",
      "DOM 일정 이벤트 수가 적어 텍스트 파서로 보완했습니다.",
      "itinerary",
    );
  }
  if (!extracted.itinerary?.days?.length) {
    addWarning(warnings, "ITINERARY_MISSING", "상세 일정이 비어 있습니다.", "itinerary.days");
  } else {
    checkDaySequence(extracted.itinerary.days, warnings);
  }

  if (!extracted.media?.heroImageUrl?.trim()) {
    addWarning(warnings, "HERO_IMAGE_MISSING", "대표 이미지를 찾지 못했습니다.", "media.heroImageUrl");
  }

  if (extracted.missingSections?.includes("EXTRACT_ERROR")) {
    addWarning(warnings, "EXTRACT_ERROR", "DOM 추출 중 오류가 발생했습니다.", undefined);
  }

  const raw = extracted.rawSnippets
    ? {
        textSnippets: Object.fromEntries(
          Object.entries(extracted.rawSnippets)
            .filter(([, v]) => v?.trim())
            .map(([k, v]) => [k, truncateSnippet(v ?? "", k === "itineraryDomHint" ? 800 : SNIPPET_MAX)]),
        ) as Record<string, string>,
      }
    : undefined;

  if (Object.keys(raw?.textSnippets ?? {}).length === 0 && raw) {
    (raw as { textSnippets?: Record<string, string> }).textSnippets = undefined;
  }
  const finalRaw =
    raw?.textSnippets && Object.keys(raw.textSnippets).length > 0 ? raw : undefined;

  const result: HanatourImportV1 = {
    version: "hanatour-import-v1",
    source: {
      provider: "hanatour",
      url: extracted.source.url,
      fetchedAtISO: extracted.source.fetchedAtISO,
      pkgCd: extracted.source.pkgCd,
      ptnCd: extracted.source.ptnCd,
      inpPathCd: extracted.source.inpPathCd,
      type: extracted.source.type,
    },
    product: {
      title: extracted.product.title?.trim() ?? "",
      nights: extracted.product.nights,
      days: extracted.product.days,
      regionText: extracted.product.regionText?.trim() || undefined,
      priceText: extracted.product.priceText?.trim() || undefined,
      productCode: extracted.source.pkgCd,
    },
    itinerary: extracted.itinerary,
    media: extracted.media,
    warnings: warnings.length > 0 ? warnings : undefined,
    raw: finalRaw,
  };

  return result;
}

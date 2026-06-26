import type { HanatourImportV1, HanatourImportWarning } from "@/types/hanatourImport";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function isHanatourImportV1(value: unknown): value is HanatourImportV1 {
  if (!isRecord(value)) return false;
  if (value.version !== "hanatour-import-v1") return false;
  const source = (value as Record<string, unknown>).source;
  if (!isRecord(source)) return false;
  if (source.provider !== "hanatour") return false;
  if (typeof source.url !== "string") return false;
  return true;
}

export function validateHanatourImportV1(input: HanatourImportV1): {
  warnings: HanatourImportWarning[];
} {
  const warnings: HanatourImportWarning[] = [];

  if (!input.product?.title?.trim()) {
    warnings.push({
      code: "TITLE_MISSING",
      message: "상품명이 비어 있습니다.",
      path: "product.title",
    });
  }

  try {
    const url = new URL(input.source.url);
    if (!url.hostname.includes("hanatour.com")) {
      warnings.push({
        code: "SOURCE_URL_INVALID",
        message: "하나투어 도메인이 아닙니다.",
        path: "source.url",
      });
    }
  } catch {
    warnings.push({
      code: "SOURCE_URL_INVALID",
      message: "source.url 형식이 올바르지 않습니다.",
      path: "source.url",
    });
  }

  const days = input.itinerary?.days ?? [];

  if (days.length === 0) {
    warnings.push({
      code: "ITINERARY_MISSING",
      message: "상세 일정이 비어 있습니다.",
      path: "itinerary.days",
    });
  } else {
    const nums = days
      .map((d) => d.dayNumber)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

    for (let i = 0; i < nums.length; i++) {
      if (nums[i] !== i + 1) {
        warnings.push({
          code: "DAY_SEQUENCE_INVALID",
          message: `Day 번호가 1부터 연속이 아닙니다: ${nums.join(", ")}`,
          path: "itinerary.days[].dayNumber",
        });
        break;
      }
    }

    days.forEach((d, index) => {
      if (!d.events || d.events.length === 0) {
        warnings.push({
          code: "EVENTS_EMPTY",
          message: `Day ${d.dayNumber} 이벤트가 비어 있습니다.`,
          path: `itinerary.days[${index}].events`,
        });
      }
    });
  }

  if (!input.media?.heroImageUrl?.trim()) {
    warnings.push({
      code: "HERO_IMAGE_MISSING",
      message: "대표 이미지가 없습니다.",
      path: "media.heroImageUrl",
    });
  }

  return { warnings };
}

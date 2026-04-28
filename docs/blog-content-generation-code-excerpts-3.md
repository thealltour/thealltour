# 블로그/콘텐츠 자동생성 코드 발췌 3차

==================================================
파일 경로:
`src/lib/smartstore/mapProductToSmartstoreHtmlViewModel.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
import type { Product } from "@/types/product";
import type { ResolvedProductNoticesForDetail } from "@/lib/noticeTemplates";
import type { SmartstoreHtmlViewModel } from "@/lib/smartstore/smartstoreHtml.types";
import { mapProductToTimelineModel, type TimelineModel } from "@/lib/products/mapProductToTimelineModel";
```

[2] 관련 함수 전체

```ts
import type { Product } from "@/types/product";
import type { ResolvedProductNoticesForDetail } from "@/lib/noticeTemplates";
import { resolveProductDetailBodyFields } from "@/lib/products/resolveProductDetailBodyFields";
import { mapProductToTimelineModel, type TimelineModel } from "@/lib/products/mapProductToTimelineModel";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { getPrimaryImageUrl, normalizeImageList } from "@/lib/products/images";
import { parseBulletLines } from "@/lib/smartstore/smartstoreHtml.helpers";
import type { SmartstoreHtmlViewModel } from "@/lib/smartstore/smartstoreHtml.types";
import {
  acceptSmartstoreHttpsImageUrl,
  sanitizeSmartstoreUserText,
  sanitizeSmartstoreLines,
} from "@/lib/smartstore/smartstoreHtml.safety";

function formatPriceKR(price?: number): string | undefined {
  if (typeof price !== "number" || !Number.isFinite(price)) return undefined;
  return new Intl.NumberFormat("ko-KR").format(price);
}

function toSmartstoreImageUrl(raw: string): string {
  const normalized = normalizeProductImageUrl(raw.trim());
  return acceptSmartstoreHttpsImageUrl(normalized) ?? "";
}

function refineTimelineForSmartstore(model: TimelineModel): TimelineModel {
  return {
    days: model.days.map((day) => {
      const title = day.title?.trim() ? sanitizeSmartstoreUserText(day.title.trim()) : undefined;
      const dateText = day.dateText?.trim() ? sanitizeSmartstoreUserText(day.dateText.trim()) : undefined;
      const dayImgRaw = day.imageUrl?.trim();
      const dayImg = dayImgRaw ? toSmartstoreImageUrl(dayImgRaw) : "";
      const events = (day.events ?? []).map((ev) => {
        const heading = ev.heading?.trim() ? sanitizeSmartstoreUserText(ev.heading.trim()) : ev.heading;
        const description = ev.description?.trim()
          ? sanitizeSmartstoreUserText(ev.description.trim())
          : ev.description;
        const thumbnailRaw = ev.thumbnailUrl?.trim();
        const thumbnailUrl = thumbnailRaw ? toSmartstoreImageUrl(thumbnailRaw) : "";
        const images = (ev.images ?? [])
          .map((im) => {
            const url = typeof im?.url === "string" ? im.url.trim() : "";
            if (!url) return null;
            const ok = toSmartstoreImageUrl(url);
            if (!ok) return null;
            return { ...im, url: ok };
          })
          .filter((x): x is NonNullable<typeof x> => x != null);
        return {
          ...ev,
          heading,
          description,
          thumbnailUrl: thumbnailUrl || undefined,
          images: images.length > 0 ? images : undefined,
        };
      });
      return {
        ...day,
        title: title || undefined,
        dateText: dateText || undefined,
        imageUrl: dayImg || undefined,
        events,
      };
    }),
  };
}

function detectConcept(product: Product): SmartstoreHtmlViewModel["concept"] {
  const text = [
    product.title,
    ...(product.tags ?? []),
    ...(product.highlights ?? []),
    product.category,
    product.theme,
    product.description,
    product.one_liner,
    product.meta_title,
    product.meta_description,
    product.overview_region,
    product.travelStyle,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  const includesAny = (keywords: string[]) => keywords.some((keyword) => text.includes(keyword));

  if (
    includesAny(["골프", "라운딩", "라운드", "cc", "컨트리클럽", "티오프", "tee", "fairway"])
  ) {
    return "골프";
  }
  if (
    includesAny(["효도", "부모님", "어르신", "시니어", "50대", "60대", "70대", "가정의 달"])
  ) {
    return "효도여행";
  }
  if (includesAny(["가족", "아이", "아동", "어린이", "키즈", "3대", "동반"])) {
    return "가족여행";
  }
  if (includesAny(["휴양", "리조트", "풀빌라", "호캉스", "해변", "비치", "스파", "마사지"])) {
    return "휴양";
  }

  return "일반";
}

/**
 * DB Product + 상세와 동일하게 해석된 공지 → 스마트스토어 HTML ViewModel
 * (https 이미지·텍스트 정제는 이 단계에서 수행)
 */
export function mapProductToSmartstoreHtmlViewModel(
  product: Product,
  notices: ResolvedProductNoticesForDetail,
): SmartstoreHtmlViewModel {
  const { resolvedIncludedItems, resolvedExcludedItems, resolvedOptionalTours } =
    resolveProductDetailBodyFields(product);

  const heroRaw = getPrimaryImageUrl(product).trim();
  const heroImageUrl = heroRaw ? toSmartstoreImageUrl(heroRaw) : "";

  const list = normalizeImageList(product.images_json);
  const galleryRaw = list.filter((u) => u.trim() !== heroRaw);
  const galleryImageUrls = galleryRaw
    .map((u) => toSmartstoreImageUrl(u))
    .filter((u): u is string => u.length > 0)
    .slice(0, 4);

  const timelineBase = mapProductToTimelineModel(product);
  const timelineSanitized = refineTimelineForSmartstore(timelineBase);
  const allGallery = [...galleryImageUrls].slice(0, 4);

  const oneLinerRaw =
    product.one_liner?.trim() ||
    product.description?.trim().split(/\n/)[0]?.slice(0, 200) ||
    product.title;
  const oneLiner = sanitizeSmartstoreUserText(oneLinerRaw || "");

  const detailedScheduleText = sanitizeSmartstoreUserText(
    (product.detailed_schedule ?? product.itinerary ?? "").trim(),
  );

  const title = sanitizeSmartstoreUserText(product.title?.trim() || "상품");

  return {
    productId: product.id,
    title: title || "상품",
    oneLiner,
    concept: detectConcept(product),
    heroImageUrl,
    galleryImageUrls: allGallery,
    priceText: formatPriceKR(product.price),
    priceMeta: sanitizeSmartstoreUserText(product.price_meta?.trim() || "1인 기준") || "1인 기준",
    durationText: product.duration?.trim()
      ? sanitizeSmartstoreUserText(product.duration.trim()) || undefined
      : undefined,
    regionText: (() => {
      const r = product.theme?.trim() || product.overview_region?.trim();
      if (!r) return undefined;
      const t = sanitizeSmartstoreUserText(r);
      return t || undefined;
    })(),
    categoryText: product.category?.trim()
      ? sanitizeSmartstoreUserText(product.category.trim()) || undefined
      : undefined,
    minDeparturePeopleText: product.min_departure_people?.trim() || undefined,
    fuelIncluded: typeof product.fuel_included === "boolean" ? product.fuel_included : undefined,
    includedLines: sanitizeSmartstoreLines(parseBulletLines(resolvedIncludedItems)),
    excludedLines: sanitizeSmartstoreLines(parseBulletLines(resolvedExcludedItems)),
    optionalLines: sanitizeSmartstoreLines(parseBulletLines(resolvedOptionalTours ?? "")),
    bookingConditionLines: sanitizeSmartstoreLines(parseBulletLines(notices.bookingConditions)),
    bookingNotesLines: sanitizeSmartstoreLines(parseBulletLines(notices.bookingNotes)),
    timeline: timelineSanitized.days.length > 0 ? timelineSanitized : null,
    detailedScheduleText,
  };
}
```

[3] 호출부 전체

`src/lib/smartstore/buildSmartstoreDetailHtml.ts`

```ts
const vm = mapProductToSmartstoreHtmlViewModel(product, notices);
return buildSmartstoreDetailHtml(vm);
```

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/lib/smartstore/buildSmartstoreDetailSections.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
import type { SmartstoreHtmlViewModel } from "@/lib/smartstore/smartstoreHtml.types";
```

[2] 관련 함수 전체

```ts
import type { SmartstoreHtmlViewModel } from "@/lib/smartstore/smartstoreHtml.types";
import {
  SMARTSTORE_SECTION_TITLES,
  SMARTSTORE_DEFAULT_BOOKING_CONDITIONS,
  SMARTSTORE_NOTICE_TRAVEL,
  SMARTSTORE_NOTICE_REFUND,
  SMARTSTORE_NOTICE_INQUIRY,
} from "@/lib/smartstore/smartstoreHtml.defaults";
import { escapeHtml, parseScheduleDayBlocks, styleAttr } from "@/lib/smartstore/smartstoreHtml.helpers";
import { buildDaySummary } from "@/lib/products/buildDaySummary";

function h2(title: string): string {
  return `<h2${styleAttr({ "font-size": "17px", "font-weight": "700", color: "#0f172a", margin: "28px 0 12px", "padding-bottom": "8px", "border-bottom": "2px solid #e2e8f0" })}>${escapeHtml(title)}</h2>`;
}

function cardInner(html: string): string {
  return `<div${styleAttr({ background: "#f8fafc", border: "1px solid #e2e8f0", "border-radius": "12px", padding: "14px 16px", margin: "0 0 12px" })}>${html}</div>`;
}

function featureBox(
  html: string,
  styles: Record<string, string>,
): string {
  return `<div${styleAttr(styles)}>${html}</div>`;
}

function groupNoticeLines(lines: string[]): string[] {
  const result: string[] = [];
  let buffer = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const isNumbered = /^[①②③④⑤⑥⑦⑧⑨⑩]$/.test(line);
    const isDash = line === "-" || line.startsWith("-");

    if (isNumbered || isDash) {
      if (buffer) result.push(buffer);
      buffer = line;
    } else {
      buffer += `${buffer ? " " : ""}${line}`;
    }
  }

  if (buffer) result.push(buffer);

  return result;
}

function renderNoticeLine(line: string): string {
  const trimmed = line.trim();
  const numberedMatch = trimmed.match(/^([①②③④⑤⑥⑦⑧⑨⑩])\s*(.*)$/u);
  if (numberedMatch) {
    const [, marker, rest] = numberedMatch;
    return `<strong${styleAttr({
      color: "#0f172a",
      "font-weight": "800",
    })}>${escapeHtml(marker)}</strong>${rest ? ` ${escapeHtml(rest)}` : ""}`;
  }

  const normalized = trimmed.replace(/^-+\s*/, "");
  return escapeHtml(normalized);
}

function ulFromLines(lines: string[]): string {
  if (lines.length === 0) return "";
  const items = lines
    .map(
      (line) =>
        `<li${styleAttr({
          margin: "8px 0",
          "list-style": "none",
          "line-height": "1.7",
        })}>${escapeHtml(line)}</li>`,
    )
    .join("");
  return `<ul${styleAttr({ margin: "0", padding: "0", "padding-left": "0", "list-style": "none" })}>${items}</ul>`;
}

function ulFromNoticeLines(lines: string[]): string {
  const grouped = groupNoticeLines(lines);
  if (grouped.length === 0) return "";
  const items = grouped
    .map(
      (line) =>
        `<li${styleAttr({
          margin: "8px 0",
          "list-style": "none",
          "line-height": "1.7",
        })}>${renderNoticeLine(line)}</li>`,
    )
    .join("");
  return `<ul${styleAttr({ margin: "0", padding: "0", "padding-left": "0", "list-style": "none" })}>${items}</ul>`;
}

function truncateLine(line: string, max = 54): string {
  const trimmed = line.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function truncateTitle(line: string, max = 40): string {
  const trimmed = line.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function truncatePill(line: string, max = 20): string {
  const trimmed = line.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function checkList(lines: string[], color = "#334155", accent = "#ea580c"): string {
  if (lines.length === 0) return "";
  return `<div>${lines
    .map(
      (line) =>
        `<p${styleAttr({
          margin: "6px 0",
          "font-size": "14px",
          color,
          "line-height": "1.65",
        })}><span${styleAttr({
          "font-weight": "800",
          color: accent,
        })}>✓</span> ${escapeHtml(line)}</p>`,
    )
    .join("")}</div>`;
}

function minDepartureTailAfterValue(trimmed: string): string {
  if (/^\d+$/.test(trimmed)) return "명 이상 확정 시 출발";
  if (/이상\s*$/u.test(trimmed)) return " 확정 시 출발";
  if (/명\s*$/u.test(trimmed)) return " 이상 확정 시 출발";
  return "명 이상 확정 시 출발";
}

function noticeSingleParagraphCard(text: string): string {
  return cardInner(
    `<p${styleAttr({
      "font-size": "14px",
      color: "#475569",
      margin: "0",
      "line-height": "1.6",
    })}>${escapeHtml(text)}</p>`,
  );
}

const IMG_RESPONSIVE = {
  width: "100%",
  height: "auto",
  display: "block",
  "border-radius": "12px",
  margin: "0 0 16px",
  border: "1px solid #e2e8f0",
} as const;

function buildConceptHero(vm: SmartstoreHtmlViewModel): string {
  if (!vm.concept) return "";

  const map = {
    효도여행: {
      badge: "가정의 달 추천",
      title: "부모님께 드리는 편안한 다낭 여행",
      desc: "관광과 휴식을 균형 있게 담은 3박5일 일정입니다.",
    },
    골프: {
      badge: "골프패키지",
      title: "라운딩에 집중하는 실속 골프여행",
      desc: "이동 부담은 줄이고 플레이 만족도를 높인 일정입니다.",
    },
    가족여행: {
      badge: "가족여행 추천",
      title: "온 가족이 함께 즐기는 여행",
      desc: "아이부터 어른까지 부담 없이 즐길 수 있는 일정입니다.",
    },
    휴양: {
      badge: "휴양 추천",
      title: "편안하게 쉬어가는 휴양 여행",
      desc: "리조트와 휴식을 중심으로 여유롭게 즐기는 상품입니다.",
    },
    일반: {
      badge: "추천 여행",
      title: "지금 확인하기 좋은 여행상품",
      desc: "일정과 포함 사항을 한눈에 확인할 수 있습니다.",
    },
  } as const;

  const c = map[vm.concept];
  const pills = [
    vm.durationText?.trim(),
    vm.categoryText?.trim() || vm.regionText?.trim(),
    vm.priceText?.trim() ? `1인 ${vm.priceText.trim()}원~` : "",
  ]
    .filter((value): value is string => Boolean(value))
    .slice(0, 3)
    .map((value) => truncatePill(value));

  return featureBox(
    `<p${styleAttr({
      display: "inline-block",
      background: "#ffedd5",
      color: "#9a3412",
      "border-radius": "999px",
      padding: "5px 10px",
      "font-size": "12px",
      "font-weight": "800",
      margin: "0 0 10px",
    })}>${escapeHtml(c.badge)}</p><p${styleAttr({
      "font-size": "24px",
      "font-weight": "900",
      color: "#0f172a",
      "line-height": "1.28",
      margin: "0 0 8px",
    })}>${escapeHtml(c.title)}</p><p${styleAttr({
      "font-size": "14px",
      color: "#475569",
      margin: "0 0 14px",
      "line-height": "1.7",
    })}>${escapeHtml(c.desc)}</p><div>${pills
      .map(
        (pill) =>
          `<span${styleAttr({
            display: "inline-block",
            margin: "0 8px 8px 0",
            padding: "7px 11px",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            "border-radius": "999px",
            "font-size": "12px",
            "font-weight": "700",
            color: "#475569",
            "line-height": "1.4",
          })}>${escapeHtml(pill)}</span>`,
      )
      .join("")}</div>`,
    {
      background: "linear-gradient(135deg,#fff7ed 0%,#ffffff 58%,#f8fafc 100%)",
      border: "1px solid #f1f5f9",
      "border-radius": "22px",
      padding: "22px 18px",
      margin: "0 0 18px",
      "box-shadow": "0 8px 24px rgba(15,23,42,0.06)",
    },
  );
}

function buildPriceConfidenceBox(vm: SmartstoreHtmlViewModel): string {
  const bullets: string[] = [];
  const includedPreviewLines = vm.includedLines
    .filter((line) => {
      const normalized = line.trim();
      if (!normalized) return false;
      if (vm.fuelIncluded === true && normalized.includes("유류할증료")) return false;
      return true;
    })
    .slice(0, 3)
    .map((line) => truncateLine(line));

  if (vm.fuelIncluded === true) bullets.push("유류할증료 포함");
  bullets.push(...includedPreviewLines);

  const hasPrice = Boolean(vm.priceText?.trim());
  if (!hasPrice && bullets.length === 0) return "";

  const title = hasPrice
    ? `1인 ${vm.priceText}원~`
    : "포함 범위를 확인해 주세요";
  const metaParts = [vm.priceMeta?.trim(), vm.durationText?.trim()].filter(
    (part): part is string => Boolean(part),
  );
  const bulletHtml = bullets.length > 0 ? checkList(bullets, "#334155", "#2563eb") : "";

  return featureBox(
    `<p${styleAttr({
      "font-size": "22px",
      "font-weight": "800",
      color: "#0f172a",
      margin: "0 0 6px",
    })}>${escapeHtml(title)}</p>${metaParts.length > 0 ? `<p${styleAttr({
      "font-size": "14px",
      color: "#2563eb",
      margin: "0 0 12px",
      "font-weight": "600",
    })}>${escapeHtml(metaParts.join(" · "))}</p>` : ""}${bulletHtml}<p${styleAttr({
      "font-size": "13px",
      color: "#64748b",
      margin: "10px 0 0",
      "line-height": "1.6",
    })}>출발일/좌석 상황에 따라 최종 금액은 변동될 수 있습니다.</p>`,
    {
      background: "#f8fafc",
      border: "1px solid #dbeafe",
      "border-radius": "16px",
      padding: "18px",
      margin: "0 0 16px",
    },
  );
}

function buildRecommendationReasonBox(vm: SmartstoreHtmlViewModel): string {
  const concept = vm.concept ?? "일반";
  const reasonMap: Record<NonNullable<SmartstoreHtmlViewModel["concept"]>, string[]> = {
    효도여행: [
      "부모님이 부담 없이 다녀오기 좋은 일정입니다.",
      "관광과 휴식이 균형 있게 구성되어 있습니다.",
      "가족 단위로 문의하기 좋은 상품입니다.",
    ],
    가족여행: [
      "아이부터 어른까지 함께 즐기기 좋은 일정입니다.",
      "관광, 휴식, 식사가 균형 있게 구성되어 있습니다.",
      "가족 단위 일정 조율에 적합합니다.",
    ],
    골프: [
      "라운딩 중심으로 구성된 실속 상품입니다.",
      "이동 부담을 줄이고 플레이에 집중하기 좋습니다.",
      "동반자와 함께 예약하기 좋은 상품입니다.",
    ],
    휴양: [
      "리조트와 휴식 중심으로 여유롭게 즐길 수 있습니다.",
      "복잡한 이동보다 편안한 체류에 초점을 둔 상품입니다.",
      "재충전이 필요한 분께 적합합니다.",
    ],
    일반: [
      "핵심 일정과 포함 사항을 한눈에 확인할 수 있습니다.",
      "출발일과 좌석 상황에 맞춰 상담이 가능합니다.",
      "처음 문의하시는 분도 쉽게 확인할 수 있는 상품입니다.",
    ],
  };

  const reasons = reasonMap[concept];
  return featureBox(
    `<p${styleAttr({
      "font-size": "17px",
      "font-weight": "800",
      color: "#0f172a",
      margin: "0 0 12px",
    })}>이 상품이 좋은 이유</p>${checkList(reasons, "#475569", "#e0612a")}`,
    {
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      "border-radius": "16px",
      padding: "18px",
      margin: "24px 0 18px",
    },
  );
}

function buildConsultCtaBox(
  vm: SmartstoreHtmlViewModel,
  variant: "middle" | "bottom",
): string {
  const concept = vm.concept ?? "일반";
  const helperMap: Record<NonNullable<SmartstoreHtmlViewModel["concept"]>, string> = {
    효도여행: "부모님 여행 일정에 맞춰 편한 출발일을 안내드립니다.",
    가족여행: "가족 인원과 일정에 맞춰 가능 여부를 확인해 드립니다.",
    골프: "동반 인원과 라운딩 일정 기준으로 안내드립니다.",
    휴양: "원하는 휴식 일정과 숙소 조건에 맞춰 안내드립니다.",
    일반: "출발일과 인원 기준으로 가능한 상품을 안내드립니다.",
  };
  const intro =
    variant === "middle"
      ? "일정을 확인하셨다면 바로 상담을 받아보세요."
      : "예약 전 최종 가능 여부를 한 번 더 확인해 보세요.";

  return featureBox(
    `<p${styleAttr({
      "font-size": "12px",
      color: "#cbd5e1",
      margin: "0 0 8px",
      "font-weight": "700",
    })}>${escapeHtml(intro)}</p><p${styleAttr({
      "font-size": "20px",
      "font-weight": "800",
      color: "#f8fafc",
      margin: "0 0 8px",
    })}>출발일 · 가격 · 잔여좌석 확인</p><p${styleAttr({
      "font-size": "14px",
      color: "#cbd5e1",
      margin: "0 0 8px",
      "line-height": "1.7",
    })}>원하시는 출발일과 인원에 맞춰 최종 가능 여부를 안내드립니다.</p><p${styleAttr({
      "font-size": "14px",
      color: "#e2e8f0",
      margin: "0 0 14px",
      "line-height": "1.7",
    })}>${escapeHtml(helperMap[concept])}</p><div${styleAttr({
      display: "inline-block",
      padding: "10px 16px",
      background: "#e0612a",
      color: "#fff7ed",
      "border-radius": "999px",
      "font-size": "14px",
      "font-weight": "800",
    })}>스마트스토어 문의로 상담해 주세요</div>`,
    {
      background: "#0f172a",
      border: "1px solid #1e293b",
      "border-radius": "16px",
      padding: "18px",
      margin: "24px 0",
      "text-align": "center",
    },
  );
}

function buildScheduleCard(html: string): string {
  return featureBox(html, {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    "border-radius": "16px",
    padding: "16px",
    margin: "0 0 16px",
  });
}

function buildResponsiveScheduleImage(url: string): string {
  return `<img src="${escapeHtml(url)}" alt=""${styleAttr({
    width: "100%",
    height: "auto",
    "border-radius": "10px",
    margin: "6px 0 10px",
    border: "1px solid #e2e8f0",
    display: "block",
  })} loading="lazy" />`;
}

function buildScheduleSummaryChips(lines: string[]): string {
  if (lines.length === 0) return "";
  return `<div${styleAttr({
    margin: "0 0 14px",
  })}>${lines
    .slice(0, 5)
    .map(
      (line) =>
        `<span${styleAttr({
          display: "inline-block",
          margin: "0 6px 6px 0",
          padding: "6px 10px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          "border-radius": "999px",
          "font-size": "12px",
          "font-weight": "600",
          color: "#475569",
          "line-height": "1.4",
        })}>${escapeHtml(line)}</span>`,
    )
    .join("")}</div>`;
}

function buildEventThumbnailStrip(urls: string[]): string {
  if (urls.length === 0) return "";
  return `<div${styleAttr({
    margin: "8px 0 0",
    "white-space": "nowrap",
    "overflow-x": "auto",
  })}>${urls
    .map(
      (url) =>
        `<img src="${escapeHtml(url)}" alt=""${styleAttr({
          width: "88px",
          height: "88px",
          display: "inline-block",
          "object-fit": "cover",
          "border-radius": "10px",
          margin: "0 8px 0 0",
          border: "1px solid #e2e8f0",
          "vertical-align": "top",
        })} loading="lazy" />`,
    )
    .join("")}</div>`;
}

function buildScheduleEventCard(html: string): string {
  return featureBox(html, {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    "border-radius": "14px",
    padding: "14px",
    margin: "0 0 12px",
  });
}

export function buildHeroSection(vm: SmartstoreHtmlViewModel): { html: string; used: boolean } {
  if (!vm.heroImageUrl) return { html: "", used: false };
  const img = `<img src="${escapeHtml(vm.heroImageUrl)}" alt="${escapeHtml(vm.title)}"${styleAttr(
    IMG_RESPONSIVE,
  )} loading="lazy" />`;
  return { html: img, used: true };
}

export function buildTitleBlock(vm: SmartstoreHtmlViewModel): string {
  const titleHeading = `<h2${styleAttr({
    "font-size": "22px",
    "font-weight": "800",
    color: "#0f172a",
    margin: "0 0 12px",
    "line-height": "1.35",
  })}>${escapeHtml(vm.title)}</h2>`;
  const lead =
    vm.oneLiner.trim().length > 0
      ? `<p${styleAttr({
          "font-size": "15px",
          color: "#475569",
          margin: "0 0 20px",
          "line-height": "1.6",
          "white-space": "pre-wrap",
        })}>${escapeHtml(vm.oneLiner)}</p>`
      : "";
  return titleHeading + lead;
}

export function buildSummarySection(vm: SmartstoreHtmlViewModel): { html: string; used: boolean } {
  const parts: string[] = [];
  if (vm.regionText) parts.push(`<span${styleAttr({ color: "#0f172a", "font-weight": "600" })}>지역·테마</span> ${escapeHtml(vm.regionText)}`);
  if (vm.categoryText) parts.push(`<span${styleAttr({ color: "#0f172a", "font-weight": "600" })}>카테고리</span> ${escapeHtml(vm.categoryText)}`);
  if (vm.durationText) parts.push(`<span${styleAttr({ color: "#0f172a", "font-weight": "600" })}>기간</span> ${escapeHtml(vm.durationText)}`);
  if (vm.minDeparturePeopleText?.trim()) {
    const t = vm.minDeparturePeopleText.trim();
    parts.push(
      `출발 인원 <span${styleAttr({ color: "#0f172a", "font-weight": "600" })}>${escapeHtml(t)}</span>${minDepartureTailAfterValue(t)}`,
    );
  }
  if (typeof vm.fuelIncluded === "boolean") {
    parts.push(vm.fuelIncluded ? "유류할증료 포함" : "유류할증료 별도");
  }
  if (parts.length === 0) return { html: "", used: false };
  const inner = parts
    .map(
      (p) =>
        `<p${styleAttr({ "font-size": "13px", color: "#64748b", margin: "4px 0", "line-height": "1.6" })}>${p}</p>`,
    )
    .join("");
  return { html: h2(SMARTSTORE_SECTION_TITLES.summary) + cardInner(inner), used: true };
}

export function buildGallerySection(vm: SmartstoreHtmlViewModel): { html: string; count: number } {
  if (vm.galleryImageUrls.length === 0) return { html: "", count: 0 };
  const imgs = vm.galleryImageUrls
    .map(
      (url) =>
        `<img src="${escapeHtml(url)}" alt=""${styleAttr({
          width: "100%",
          height: "auto",
          "border-radius": "8px",
          display: "block",
          margin: "0 0 8px",
          border: "1px solid #e2e8f0",
        })} loading="lazy" />`,
    )
    .join("");
  return { html: h2("추가 이미지") + cardInner(imgs), count: vm.galleryImageUrls.length };
}

export function buildListSection(
  title: string,
  lines: string[],
): { html: string; used: boolean } {
  if (lines.length === 0) return { html: "", used: false };
  return { html: h2(title) + cardInner(ulFromLines(lines)), used: true };
}

export function buildScheduleSection(vm: SmartstoreHtmlViewModel): { html: string; used: boolean } {
  if (vm.timeline && vm.timeline.days.length > 0) {
    const chunks: string[] = [];
    for (const day of vm.timeline.days) {
      const titlePart = day.title?.trim() ? truncateTitle(day.title.trim()) : "";
      const dayLabel = titlePart ? `DAY ${day.day} · ${titlePart}` : `DAY ${day.day}`;
      let block = `<h3${styleAttr({
        "font-weight": "800",
        color: "#0f172a",
        margin: "0 0 6px",
        "font-size": "20px",
        "line-height": "1.4",
      })}>${escapeHtml(dayLabel)}</h3>`;
      if (day.dateText?.trim()) {
        block += `<p${styleAttr({
          "font-size": "13px",
          color: "#64748b",
          margin: "0 0 10px",
        })}>${escapeHtml(day.dateText.trim())}</p>`;
      }
      const renderedImages = new Set<string>();
      if (day.imageUrl?.trim()) {
        const dayImage = day.imageUrl.trim();
        renderedImages.add(dayImage);
        block += buildResponsiveScheduleImage(dayImage);
      }
      const summaryItems = buildDaySummary(day.events);
      block += buildScheduleSummaryChips(summaryItems);
      for (const ev of day.events ?? []) {
        const heading = ev.heading?.trim() || "일정 포인트";
        const uniqueEventImages = [ev.thumbnailUrl, ...(ev.images ?? []).map((im) => im.url)]
          .filter((url): url is string => typeof url === "string" && url.trim().length > 0)
          .map((url) => url.trim())
          .filter((url, index, arr) => arr.indexOf(url) === index)
          .filter((url) => !renderedImages.has(url));

        const primaryEventImage = uniqueEventImages[0] ?? "";
        const thumbnailImages = uniqueEventImages.slice(primaryEventImage ? 1 : 0, primaryEventImage ? 5 : 4);

        let eventBlock = `<h4${styleAttr({
          "font-weight": "800",
          color: "#0f172a",
          margin: "0 0 6px",
          "font-size": "16px",
          "line-height": "1.4",
        })}>${escapeHtml(heading)}</h4>`;
        if (primaryEventImage) {
          renderedImages.add(primaryEventImage);
          eventBlock += buildResponsiveScheduleImage(primaryEventImage);
        }
        if (ev.description?.trim()) {
          eventBlock += `<p${styleAttr({
            "font-size": "14px",
            color: "#475569",
            margin: "0 0 8px",
            "line-height": "1.65",
            "white-space": "pre-wrap",
          })}>${escapeHtml(ev.description.trim())}</p>`;
        }
        const freshThumbnails: string[] = [];
        for (const url of thumbnailImages) {
          if (renderedImages.has(url)) continue;
          renderedImages.add(url);
          freshThumbnails.push(url);
        }
        eventBlock += buildEventThumbnailStrip(freshThumbnails);
        block += buildScheduleEventCard(eventBlock);
      }
      chunks.push(buildScheduleCard(block));
    }
    return { html: h2(SMARTSTORE_SECTION_TITLES.schedule) + chunks.join(""), used: true };
  }

  const blocks = parseScheduleDayBlocks(vm.detailedScheduleText);
  if (blocks.length === 0) return { html: "", used: false };
  const inner = blocks
    .map((b) => {
      const head = `<p${styleAttr({
        "font-weight": "700",
        color: "#0f172a",
        margin: "0 0 8px",
      })}>${escapeHtml(b.label)}</p>`;
      const body = `<p${styleAttr({
        "font-size": "14px",
        color: "#475569",
        margin: "0",
        "line-height": "1.65",
        "white-space": "pre-wrap",
      })}>${escapeHtml(b.content)}</p>`;
      return buildScheduleCard(head + body);
    })
    .join("");
  return { html: h2(SMARTSTORE_SECTION_TITLES.schedule) + inner, used: true };
}

export function buildBookingSection(vm: SmartstoreHtmlViewModel): string {
  let inner = "";
  if (vm.minDeparturePeopleText?.trim()) {
    const t = vm.minDeparturePeopleText.trim();
    inner += `<p${styleAttr({ margin: "0 0 10px", "font-size": "14px" })}>출발 인원: <strong>${escapeHtml(t)}</strong>${minDepartureTailAfterValue(t)}</p>`;
  }
  inner += `<ul${styleAttr({ margin: "0 0 12px", padding: "0", "padding-left": "0", "list-style": "none" })}>`;
  inner += `<li${styleAttr({ margin: "6px 0", "list-style": "none" })}>최종 일정·가격은 주문·문의 후 확정될 수 있습니다.</li>`;
  inner += `<li${styleAttr({ margin: "6px 0", "list-style": "none" })}>예약 절차는 스마트스토어 문의를 통해 안내받으실 수 있습니다.</li>`;
  inner += `</ul>`;
  if (vm.bookingConditionLines.length > 0) {
    inner += ulFromLines(vm.bookingConditionLines);
  } else {
    inner += `<p${styleAttr({ "font-size": "14px", color: "#475569", margin: "0" })}>${escapeHtml(SMARTSTORE_DEFAULT_BOOKING_CONDITIONS)}</p>`;
  }
  return h2(SMARTSTORE_SECTION_TITLES.bookingConditions) + cardInner(inner);
}

export function buildBookingNotesSection(vm: SmartstoreHtmlViewModel): string {
  const lines =
    vm.bookingNotesLines.length > 0
      ? vm.bookingNotesLines
      : ["예약 관련 유의사항은 스마트스토어 문의를 통해 안내해 드립니다."];
  return h2(SMARTSTORE_SECTION_TITLES.bookingNotes) + cardInner(ulFromNoticeLines(lines));
}

export function buildTravelSection(): string {
  return h2(SMARTSTORE_SECTION_TITLES.travelNotes) + noticeSingleParagraphCard(SMARTSTORE_NOTICE_TRAVEL);
}

export function buildRefundSection(): string {
  return h2(SMARTSTORE_SECTION_TITLES.refund) + noticeSingleParagraphCard(SMARTSTORE_NOTICE_REFUND);
}

export function buildConsultFooter(): string {
  return (
    h2(SMARTSTORE_SECTION_TITLES.consult) +
    `<div${styleAttr({
      "margin-top": "8px",
      padding: "16px",
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
      "border-radius": "12px",
      "font-size": "14px",
      color: "#1e3a8a",
      "line-height": "1.6",
    })}>${escapeHtml(SMARTSTORE_NOTICE_INQUIRY)}</div>`
  );
}

export function buildAllSectionsHtml(vm: SmartstoreHtmlViewModel): string {
  const parts: string[] = [];
  const hero = buildHeroSection(vm);
  if (hero.html) parts.push(hero.html);
  parts.push(buildConceptHero(vm));
  parts.push(buildPriceConfidenceBox(vm));
  parts.push(buildTitleBlock(vm));
  const sum = buildSummarySection(vm);
  if (sum.html) parts.push(sum.html);
  const gal = buildGallerySection(vm);
  if (gal.html) parts.push(gal.html);
  const inc = buildListSection(SMARTSTORE_SECTION_TITLES.included, vm.includedLines);
  if (inc.html) parts.push(inc.html);
  const exc = buildListSection(SMARTSTORE_SECTION_TITLES.excluded, vm.excludedLines);
  if (exc.html) parts.push(exc.html);
  const opt = buildListSection(SMARTSTORE_SECTION_TITLES.optional, vm.optionalLines);
  if (opt.html) parts.push(opt.html);
  parts.push(buildRecommendationReasonBox(vm));
  const sched = buildScheduleSection(vm);
  if (sched.html) parts.push(sched.html);
  parts.push(buildConsultCtaBox(vm, "middle"));
  parts.push(buildBookingSection(vm));
  parts.push(buildBookingNotesSection(vm));
  parts.push(buildTravelSection());
  parts.push(buildRefundSection());
  parts.push(buildConsultCtaBox(vm, "bottom"));
  return parts.join("\n");
}
```

[3] 호출부 전체

`src/lib/smartstore/buildSmartstoreDetailHtml.ts`

[4] 관련 상수/템플릿 전체

```ts
const IMG_RESPONSIVE = {
  width: "100%",
  height: "auto",
  display: "block",
  "border-radius": "12px",
  margin: "0 0 16px",
  border: "1px solid #e2e8f0",
} as const;
```

==================================================
파일 경로:
`src/lib/smartstore/buildSmartstoreDetailHtml.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
import type { Product } from "@/types/product";
import type { ResolvedProductNoticesForDetail } from "@/lib/noticeTemplates";
import type { SmartstoreHtmlViewModel, SmartstoreHtmlBuildMeta } from "@/lib/smartstore/smartstoreHtml.types";
```

[2] 관련 함수 전체

```ts
import type { Product } from "@/types/product";
import type { ResolvedProductNoticesForDetail } from "@/lib/noticeTemplates";
import { mapProductToSmartstoreHtmlViewModel } from "@/lib/smartstore/mapProductToSmartstoreHtmlViewModel";
import type { SmartstoreHtmlViewModel, SmartstoreHtmlBuildMeta } from "@/lib/smartstore/smartstoreHtml.types";
import {
  buildAllSectionsHtml,
  buildGallerySection,
  buildHeroSection,
  buildListSection,
  buildScheduleSection,
  buildSummarySection,
} from "@/lib/smartstore/buildSmartstoreDetailSections";
import { SMARTSTORE_SECTION_TITLES } from "@/lib/smartstore/smartstoreHtml.defaults";
import { styleAttr } from "@/lib/smartstore/smartstoreHtml.helpers";
import {
  analyzeSmartstoreHtml,
  assertSmartstoreHtmlBuildSafe,
  type SmartstoreHtmlSafetyReport,
} from "@/lib/smartstore/smartstoreHtml.safety";

function collectMeta(
  vm: SmartstoreHtmlViewModel,
  html: string,
  safety: SmartstoreHtmlSafetyReport,
): SmartstoreHtmlBuildMeta {
  const includedSections: string[] = [];
  if (buildHeroSection(vm).used) includedSections.push("대표 비주얼");
  includedSections.push("상품명", "한 줄 요약");
  if (buildSummarySection(vm).used) includedSections.push("기본 정보 요약");
  const gal = buildGallerySection(vm);
  if (gal.count > 0) includedSections.push("추가 이미지");
  if (buildListSection(SMARTSTORE_SECTION_TITLES.included, vm.includedLines).used) {
    includedSections.push("포함 사항");
  }
  if (buildListSection(SMARTSTORE_SECTION_TITLES.excluded, vm.excludedLines).used) {
    includedSections.push("불포함 사항");
  }
  const hasOptional = buildListSection(SMARTSTORE_SECTION_TITLES.optional, vm.optionalLines).used;
  if (hasOptional) includedSections.push("선택 관광");
  const sched = buildScheduleSection(vm);
  if (sched.used) includedSections.push("일정 안내");
  includedSections.push(
    "예약 조건",
    "예약 시 유의사항",
    "여행 시 유의사항",
    "환불·취소 규정",
    "문의 CTA",
  );

  const hasStructuredTimeline = Boolean(vm.timeline && vm.timeline.days.length > 0);

  return {
    title: vm.title,
    productId: vm.productId,
    characterCount: html.length,
    imageCount: safety.httpsImageCount,
    includedSections,
    hasHeroImage: Boolean(vm.heroImageUrl),
    hasTimeline: hasStructuredTimeline || sched.used,
    hasIncludedExcluded: vm.includedLines.length > 0 || vm.excludedLines.length > 0,
    hasOptionalTours: hasOptional,
    hasNoticesBlock: true,
    safety,
  };
}

export function buildSmartstoreDetailHtml(vm: SmartstoreHtmlViewModel): {
  html: string;
  meta: SmartstoreHtmlBuildMeta;
} {
  const inner = buildAllSectionsHtml(vm);
  const wrapStyles = {
    width: "100%",
    "max-width": "860px",
    margin: "0 auto",
    padding: "16px 12px",
    "box-sizing": "border-box",
    "font-family":
      "-apple-system,BlinkMacSystemFont,'Malgun Gothic','Segoe UI',Roboto,sans-serif",
    color: "#334155",
    "font-size": "15px",
    "line-height": "1.65",
    "word-break": "break-word",
  };
  const html = `<div id="smartstore-theall-detail"${styleAttr(wrapStyles)}>${inner}</div>`;
  const safety = analyzeSmartstoreHtml(html);
  assertSmartstoreHtmlBuildSafe(html);
  return { html, meta: collectMeta(vm, html, safety) };
}

export function buildSmartstoreDetailHtmlFromProduct(
  product: Product,
  notices: ResolvedProductNoticesForDetail,
): { html: string; meta: SmartstoreHtmlBuildMeta } {
  const vm = mapProductToSmartstoreHtmlViewModel(product, notices);
  return buildSmartstoreDetailHtml(vm);
}
```

[3] 호출부 전체

`src/app/api/admin/products/[id]/smartstore-html/route.ts`

```ts
const notices = await resolveProductNoticesForDetailPage(product);
const { html, meta } = buildSmartstoreDetailHtmlFromProduct(product, notices);
return NextResponse.json({ ok: true, html, meta });
```

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/app/api/admin/products/[id]/smartstore-html/route.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
import type { SmartstoreHtmlApiResponse } from "@/lib/smartstore/smartstoreHtml.types";
```

[2] 관련 함수 전체

```ts
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getProductByIdFresh } from "@/lib/products";
import { resolveProductNoticesForDetailPage } from "@/lib/noticeTemplates";
import { buildSmartstoreDetailHtmlFromProduct } from "@/lib/smartstore/buildSmartstoreDetailHtml";
import type { SmartstoreHtmlApiResponse } from "@/lib/smartstore/smartstoreHtml.types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<SmartstoreHtmlApiResponse>> {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return auth.res as NextResponse<SmartstoreHtmlApiResponse>;
  }

  const { id } = await context.params;
  const rawId = id?.trim();
  if (!rawId) {
    return NextResponse.json(
      { ok: false, message: "상품 ID가 필요합니다." },
      { status: 400 },
    );
  }

  try {
    const product = await getProductByIdFresh(rawId);
    if (!product) {
      return NextResponse.json({ ok: false, message: "상품을 찾을 수 없습니다." }, { status: 404 });
    }

    const notices = await resolveProductNoticesForDetailPage(product);
    const { html, meta } = buildSmartstoreDetailHtmlFromProduct(product, notices);

    return NextResponse.json({ ok: true, html, meta });
  } catch (e) {
    console.error("[api/admin/products/[id]/smartstore-html]", e);
    return NextResponse.json(
      { ok: false, message: "HTML 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
```

[3] 호출부 전체

`src/components/admin/products/modals/SmartstoreHtmlGenerateModal.tsx`

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/components/admin/products/modals/SmartstoreHtmlGenerateModal.tsx`
==================================================

[1] 관련 타입 정의 전체

```ts
import type { SmartstoreHtmlGenerateModalProps, SmartstoreHtmlModalFetchState } from "./smartstoreHtmlModal.types";
import type { SmartstoreHtmlApiResponse } from "@/lib/smartstore/smartstoreHtml.types";

type TabKey = "preview" | "source";
```

[2] 관련 함수 전체

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { FileCode2, Copy, RefreshCw, X } from "lucide-react";
import type { SmartstoreHtmlGenerateModalProps, SmartstoreHtmlModalFetchState } from "./smartstoreHtmlModal.types";
import type { SmartstoreHtmlApiResponse } from "@/lib/smartstore/smartstoreHtml.types";

type TabKey = "preview" | "source";

export default function SmartstoreHtmlGenerateModal({
  open,
  productId,
  productTitle,
  onClose,
  onCopied,
}: SmartstoreHtmlGenerateModalProps) {
  const [tab, setTab] = useState<TabKey>("preview");
  const [state, setState] = useState<SmartstoreHtmlModalFetchState>({ status: "idle" });
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!productId?.trim()) return;
    setState({ status: "loading" });
    setCopyHint(null);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(productId.trim())}/smartstore-html`, {
        method: "GET",
        credentials: "same-origin",
      });
      const data = (await res.json()) as SmartstoreHtmlApiResponse;
      if (!res.ok || !data.ok) {
        setState({
          status: "error",
          message: !data.ok ? data.message : `요청 실패 (${res.status})`,
        });
        return;
      }
      setState({ status: "ok", html: data.html, meta: data.meta });
    } catch {
      setState({ status: "error", message: "네트워크 오류로 불러오지 못했습니다." });
    }
  }, [productId]);

  useEffect(() => {
    if (!open) {
      setState({ status: "idle" });
      setTab("preview");
      setCopyHint(null);
      return;
    }
    void load();
  }, [open, load]);

  const handleCopy = async () => {
    if (state.status !== "ok") return;
    try {
      await navigator.clipboard.writeText(state.html);
      setCopyHint("HTML이 클립보드에 복사되었습니다.");
      onCopied?.();
      setTimeout(() => setCopyHint(null), 4000);
    } catch {
      setCopyHint("클립보드 복사에 실패했습니다. 원문 탭에서 직접 선택해 복사해 주세요.");
    }
  };

  if (!open) return null;

  const meta = state.status === "ok" ? state.meta : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="smartstore-html-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <h2
              id="smartstore-html-modal-title"
              className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"
            >
              <FileCode2 className="h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden />
              스마트스토어 상세설명 HTML 생성
            </h2>
            <p className="mt-1 truncate text-sm text-[var(--text-secondary)]" title={productTitle}>
              {productTitle || "(제목 없음)"}
              {productId ? (
                <span className="ml-2 font-mono text-xs text-[var(--text-muted)]">· {productId}</span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {state.status === "loading" ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">HTML을 생성하는 중입니다…</div>
        ) : null}

        {state.status === "error" ? (
          <div className="mx-4 my-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
            {state.message}
            <button
              type="button"
              onClick={() => void load()}
              className="ml-2 font-semibold underline-offset-2 hover:underline"
            >
              다시 시도
            </button>
          </div>
        ) : null}

        {state.status === "ok" && meta ? (
          <>
            <div className="shrink-0 space-y-3 border-b border-[var(--border)] bg-[var(--surface-muted)]/50 px-4 py-3 text-xs text-[var(--text-secondary)]">
              <div>
                <p className="font-semibold text-[var(--text-primary)]">네이버 업로드 안전성</p>
                <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                  <li>
                    외부 링크:{" "}
                    <span className={meta.safety.hasExternalLinks ? "font-semibold text-[var(--danger)]" : "font-semibold text-[var(--success)]"}>
                      {meta.safety.hasExternalLinks ? "탐지됨(비권장)" : "없음"}
                    </span>
                  </li>
                  <li>
                    http 이미지·속성:{" "}
                    <span
                      className={
                        meta.safety.hasHttpInAttributes ? "font-semibold text-[var(--danger)]" : "font-semibold text-[var(--success)]"
                      }
                    >
                      {meta.safety.hasHttpInAttributes ? "탐지됨" : "없음"}
                    </span>
                  </li>
                  <li>
                    금지 태그·이벤트 핸들러:{" "}
                    <span
                      className={
                        meta.safety.hasForbiddenTagsOrHandlers
                          ? "font-semibold text-[var(--danger)]"
                          : "font-semibold text-[var(--success)]"
                      }
                    >
                      {meta.safety.hasForbiddenTagsOrHandlers ? "탐지됨" : "없음"}
                    </span>
                  </li>
                  <li>
                    안전 assert:{" "}
                    <span className={meta.safety.assertPassed ? "font-semibold text-[var(--success)]" : "font-semibold text-[var(--danger)]"}>
                      {meta.safety.assertPassed ? "통과" : "실패"}
                    </span>
                  </li>
                  <li>
                    최종 https 이미지 수:{" "}
                    <span className="font-semibold text-[var(--text-primary)]">{meta.imageCount}</span>
                  </li>
                  <li>
                    HTML 길이:{" "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {meta.characterCount.toLocaleString("ko-KR")}자
                    </span>
                  </li>
                </ul>
                {meta.safety.hints.length > 0 ? (
                  <p className="mt-1 text-[11px] text-[var(--danger)]">힌트: {meta.safety.hints.join(", ")}</p>
                ) : null}
              </div>
              <div className="border-t border-[var(--border)] pt-2">
                <p className="font-semibold text-[var(--text-primary)]">생성 요약</p>
                <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                  <li>대표 이미지: {meta.hasHeroImage ? "포함" : "없음"}</li>
                  <li>일정 섹션: {meta.hasTimeline ? "포함" : "생략 또는 요약 없음"}</li>
                  <li>포함·불포함: {meta.hasIncludedExcluded ? "내용 있음" : "본문 없음"}</li>
                  <li>선택 관광: {meta.hasOptionalTours ? "포함" : "생략"}</li>
                </ul>
                <p className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">
                  포함 섹션: {meta.includedSections.join(" · ")}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 gap-1 border-b border-[var(--border)] px-2 pt-2">
              <button
                type="button"
                onClick={() => setTab("preview")}
                className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${
                  tab === "preview"
                    ? "bg-[var(--surface)] text-[var(--primary)] ring-1 ring-b-0 ring-[var(--border)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                미리보기
              </button>
              <button
                type="button"
                onClick={() => setTab("source")}
                className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${
                  tab === "source"
                    ? "bg-[var(--surface)] text-[var(--primary)] ring-1 ring-b-0 ring-[var(--border)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                HTML 원문
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
```

[3] 호출부 전체

`src/components/admin/products/AdminProductManager.tsx`

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/lib/adminLandings/draftCopyBuilder.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
import type { LandingTaxonomyType } from "@/types/adminLanding";

export type BuildLandingDraftCopyInput = {
  taxonomyName: string;
  taxonomyType: LandingTaxonomyType;
  suggestedSlug: string;
  suggestedSourcePath?: string | null;
  suggestedQuoteCategory?: string | null;
};

export type LandingSectionBlockCopy = {
  title: string;
  description: string;
  body: string;
};

/** hero / intro / cta / consulting_points 시드용 (FAQ는 템플릿에서 라벨만 치환) */
export type LandingSectionDraftCopy = {
  hero: LandingSectionBlockCopy;
  intro: LandingSectionBlockCopy;
  cta: LandingSectionBlockCopy;
  consultingPoints: LandingSectionBlockCopy;
};

export type LandingDraftCopy = {
  /** 목록·메타용 짧은 제목 (히어로 헤드라인과 별도) */
  title: string;
  summary: string;
  seoTitle: string;
  seoDescription: string;
  sourcePath: string;
  quoteCategory: string;
  sections: LandingSectionDraftCopy;
};
```

[2] 관련 함수 전체

```ts
import type { LandingTaxonomyType } from "@/types/adminLanding";

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function rootSlugFromLandingSlug(slug: string): string {
  const s = normalizeSlug(slug);
  if (!s) return "";
  return s.endsWith("-travel") ? s.slice(0, -"-travel".length) : s;
}

function nonEmptyDisplayName(name: string, slug: string): string {
  const t = name.trim();
  if (t) return t;
  const fromSlug = rootSlugFromLandingSlug(slug).replace(/-/g, " ").trim();
  if (fromSlug) return fromSlug;
  return "여행";
}

const CTA_BODY =
  "상품을 둘러보신 뒤 맞춤 상담을 요청하시면\n일정과 예산에 맞춰 여행을 설계해드립니다.";

const CONSULTING_BODY =
  "항공, 숙소, 이동 동선, 일정 구성까지 함께 고려해\n실제 여행에 맞는 구성을 안내합니다.";

export function buildConsultingSectionCopyForLabel(
  label: string,
  taxonomyType: "destination" | "theme" | "product_line",
): LandingSectionDraftCopy {
  const name = label.trim() || "여행";

  const ctaTitle = `${name} 여행 상담 신청`;
  const ctaDescription = "상품을 먼저 살펴보신 뒤 맞춤 상담을 요청해 보세요.";

  if (taxonomyType === "destination") {
    return {
      hero: {
        title: `${name} 여행 상품을 먼저 확인해보세요`,
        description: `${name} 여행은 일정, 예산, 지역에 따라 추천 구성이 달라집니다.`,
        body: "마음에 드는 상품이 없다면 맞춤 상담으로 여행을 함께 설계해드립니다.",
      },
      intro: {
        title: `${name} 여행 안내`,
        description: "",
        body: `${name} 여행은 지역과 일정에 따라 추천 구성이 달라집니다.\n추천 상품을 먼저 살펴보신 뒤, 원하시는 조건이 없다면 상담으로 이어가세요.`,
      },
      cta: {
        title: ctaTitle,
        description: ctaDescription,
        body: CTA_BODY,
      },
      consultingPoints: {
        title: `${name} 여행 체크 포인트`,
        description: "동선·일정을 기준으로 구체적으로 짚어드립니다.",
        body: CONSULTING_BODY,
      },
    };
  }

  if (taxonomyType === "theme") {
    return {
      hero: {
        title: `${name} 테마 여행 상품을 먼저 확인해보세요`,
        description: `${name} 테마 여행은 일정, 예산, 스타일에 따라 추천 구성이 달라집니다.`,
        body: "마음에 드는 상품이 없다면 맞춤 상담으로 여행을 함께 설계해드립니다.",
      },
      intro: {
        title: `${name} 여행 안내`,
        description: "",
        body: `${name} 테마 여행은 지역과 일정에 따라 추천 구성이 달라집니다.\n추천 상품을 먼저 살펴보신 뒤, 원하시는 조건이 없다면 상담으로 이어가세요.`,
      },
      cta: {
        title: ctaTitle,
        description: ctaDescription,
        body: CTA_BODY,
      },
      consultingPoints: {
        title: `${name} 여행 체크 포인트`,
        description: "테마에 맞는 동선·일정을 기준으로 정리합니다.",
        body: CONSULTING_BODY,
      },
    };
  }

  return {
    hero: {
      title: `${name} 여행 상품을 먼저 확인해보세요`,
      description: `${name} 상품은 일정, 예산, 포함 조건에 따라 구성이 달라집니다.`,
      body: "마음에 드는 상품이 없다면 맞춤 상담으로 여행을 함께 설계해드립니다.",
    },
    intro: {
      title: `${name} 상품 안내`,
      description: "",
      body: `${name} 상품은 일정과 포함 조건에 따라 추천이 달라집니다.\n추천 상품을 먼저 살펴보신 뒤, 원하시는 조건이 없다면 상담으로 이어가세요.`,
    },
    cta: {
      title: ctaTitle,
      description: ctaDescription,
      body: CTA_BODY,
    },
    consultingPoints: {
      title: `${name} 선택 포인트`,
      description: "포함·일정 기준으로 구체적으로 짚어드립니다.",
      body: CONSULTING_BODY,
    },
  };
}

function metaForType(
  name: string,
  taxonomyType: LandingTaxonomyType,
): { summary: string; seoTitle: string; seoDescription: string } {
  switch (taxonomyType) {
    case "destination":
      return {
        summary: `${name} 추천 여행 상품을 먼저 확인해 보세요. 원하는 조건이 있으면 일정·예산에 맞춰 상담으로 이어가실 수 있습니다.`,
        seoTitle: `${name} 여행 상품 | 추천 일정`,
        seoDescription: `${name} 여행 상품을 살펴보고, 일정과 예산에 맞는 구성은 맞춤 상담으로 확인해 보세요.`,
      };
    case "theme":
      return {
        summary: `${name} 테마 추천 상품을 먼저 확인해 보세요. 스타일·일정에 맞는 구성은 상담으로 이어가실 수 있습니다.`,
        seoTitle: `${name} 테마 여행 상품 | 추천`,
        seoDescription: `${name} 테마 여행 상품을 살펴보고, 원하는 일정·예산은 맞춤 상담으로 확인해 보세요.`,
      };
    case "product_line":
      return {
        summary: `${name} 상품을 먼저 확인해 보세요. 포함 조건·일정에 맞는 선택은 상담으로 이어가실 수 있습니다.`,
        seoTitle: `${name} 여행 상품 | 일정·포함 안내`,
        seoDescription: `${name} 상품을 살펴보고, 일정과 포함 조건에 맞는 구성은 맞춤 상담으로 확인해 보세요.`,
      };
  }
}

export function buildLandingDraftCopy(input: BuildLandingDraftCopyInput): LandingDraftCopy {
  const slug = normalizeSlug(input.suggestedSlug);
  const name = nonEmptyDisplayName(input.taxonomyName, slug);

  const quoteFromSuggested = String(input.suggestedQuoteCategory ?? "").trim();
  const quoteCategory = quoteFromSuggested || rootSlugFromLandingSlug(slug) || slug || "landing";

  const pathFromSuggested = String(input.suggestedSourcePath ?? "").trim();
  const sourcePath =
    pathFromSuggested || (slug ? `/recommended/${encodeURIComponent(slug)}` : "/recommended");

  const sections = buildConsultingSectionCopyForLabel(name, input.taxonomyType);

  const title = `${name} 여행 상품`;

  const { summary, seoTitle, seoDescription } = metaForType(name, input.taxonomyType);

  return {
    title,
    summary,
    seoTitle,
    seoDescription,
    sourcePath,
    quoteCategory,
    sections,
  };
}
```

[3] 호출부 전체

`src/lib/adminLandings/generationService.ts`

```ts
const copy = buildLandingDraftCopy({
  taxonomyName: candidate.taxonomyName,
  taxonomyType: candidate.taxonomyType,
  suggestedSlug: candidate.suggestedSlug,
  suggestedSourcePath: candidate.suggestedSourcePath,
  suggestedQuoteCategory: candidate.suggestedQuoteCategory,
});
```

[4] 관련 상수/템플릿 전체

```ts
const CTA_BODY =
  "상품을 둘러보신 뒤 맞춤 상담을 요청하시면\n일정과 예산에 맞춰 여행을 설계해드립니다.";

const CONSULTING_BODY =
  "항공, 숙소, 이동 동선, 일정 구성까지 함께 고려해\n실제 여행에 맞는 구성을 안내합니다.";
```

==================================================
파일 경로:
`src/lib/adminLandings/generationService.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
import type {
  LandingGenerationCandidatesResponse,
  LandingGenerationRequestItem,
  LandingGenerationResult,
  LandingGenerationResultEntry,
  LandingTaxonomyType,
} from "@/types/adminLanding";
```

[2] 관련 함수 전체

```ts
import { buildLandingDraftCopy } from "@/lib/adminLandings/draftCopyBuilder";
import { createAdminLanding } from "@/lib/adminLandings/service";
import { listLandingGenerationCandidates, toCandidateKey } from "@/lib/adminLandings/generationRepository";
import type {
  LandingGenerationCandidatesResponse,
  LandingGenerationRequestItem,
  LandingGenerationResult,
  LandingGenerationResultEntry,
  LandingTaxonomyType,
} from "@/types/adminLanding";

function toSummary(item: {
  taxonomyId: string;
  taxonomyType: LandingTaxonomyType;
  taxonomyName: string;
  landingId?: string | null;
  landingSlug?: string | null;
  reason?: string;
}): LandingGenerationResultEntry {
  return {
    taxonomyId: item.taxonomyId,
    taxonomyType: item.taxonomyType,
    taxonomyName: item.taxonomyName,
    landingId: item.landingId ?? undefined,
    landingSlug: item.landingSlug ?? undefined,
    reason: item.reason,
  };
}

export async function getLandingGenerationCandidates(input: {
  taxonomyType?: "all" | LandingTaxonomyType;
  alreadyGenerated?: boolean | null;
}): Promise<LandingGenerationCandidatesResponse> {
  const items = await listLandingGenerationCandidates({
    taxonomyType: input.taxonomyType ?? "all",
    alreadyGenerated: input.alreadyGenerated ?? null,
  });
  return { items, total: items.length };
}

export async function generateLandingsFromTaxonomy(
  items: LandingGenerationRequestItem[],
): Promise<LandingGenerationResult> {
  const candidates = await listLandingGenerationCandidates({
    taxonomyType: "all",
    alreadyGenerated: null,
  });
  const byKey = new Map(candidates.map((candidate) => [toCandidateKey(candidate), candidate]));

  const created: LandingGenerationResultEntry[] = [];
  const skipped: LandingGenerationResultEntry[] = [];
  const failed: LandingGenerationResultEntry[] = [];

  for (const requestItem of items) {
    const key = toCandidateKey(requestItem);
    const candidate = byKey.get(key);
    if (!candidate) {
      failed.push(
        toSummary({
          taxonomyId: requestItem.taxonomyId,
          taxonomyType: requestItem.taxonomyType,
          taxonomyName: requestItem.taxonomyId,
          reason: "CANDIDATE_NOT_FOUND",
        }),
      );
      continue;
    }

    if (candidate.isAlreadyGenerated) {
      skipped.push(
        toSummary({
          taxonomyId: candidate.taxonomyId,
          taxonomyType: candidate.taxonomyType,
          taxonomyName: candidate.taxonomyName,
          landingId: candidate.existingLandingId,
          landingSlug: candidate.existingLandingSlug,
          reason: "ALREADY_EXISTS",
        }),
      );
      continue;
    }

    try {
      const copy = buildLandingDraftCopy({
        taxonomyName: candidate.taxonomyName,
        taxonomyType: candidate.taxonomyType,
        suggestedSlug: candidate.suggestedSlug,
        suggestedSourcePath: candidate.suggestedSourcePath,
        suggestedQuoteCategory: candidate.suggestedQuoteCategory,
      });
      const item = await createAdminLanding({
        title: copy.title,
        slug: candidate.suggestedSlug,
        templateType: candidate.suggestedTemplateType,
        status: "draft",
        summary: copy.summary,
        seoTitle: copy.seoTitle,
        seoDescription: copy.seoDescription,
        quoteCategory: copy.quoteCategory,
        sourceTaxonomyId: candidate.taxonomyId,
        sourceTaxonomyType: candidate.taxonomyType,
        sourceTaxonomySlug: candidate.taxonomySlug,
        sourcePath: copy.sourcePath,
        taxonomyDisplayName: candidate.taxonomyName,
        defaultSectionCopy: copy.sections,
      });
      created.push(
        toSummary({
          taxonomyId: candidate.taxonomyId,
          taxonomyType: candidate.taxonomyType,
          taxonomyName: candidate.taxonomyName,
          landingId: item.id,
          landingSlug: item.slug,
        }),
      );
      byKey.set(key, { ...candidate, isAlreadyGenerated: true, existingLandingId: item.id, existingLandingSlug: item.slug });
    } catch (error) {
      const message = error instanceof Error ? error.message : "생성 실패";
      if (message.includes("SLUG_CONFLICT") || message.includes("이미 사용 중인 slug")) {
        skipped.push(
          toSummary({
            taxonomyId: candidate.taxonomyId,
            taxonomyType: candidate.taxonomyType,
            taxonomyName: candidate.taxonomyName,
            reason: "SLUG_CONFLICT",
          }),
        );
      } else {
        failed.push(
          toSummary({
            taxonomyId: candidate.taxonomyId,
            taxonomyType: candidate.taxonomyType,
            taxonomyName: candidate.taxonomyName,
            reason: message,
          }),
        );
      }
    }
  }

  return { created, skipped, failed };
}
```

[3] 호출부 전체

`src/app/api/admin/landings/generate-from-taxonomy/route.ts`, `src/app/api/admin/landings/generation-candidates/route.ts`

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/app/api/admin/landings/generate-from-taxonomy/route.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
type GenerateRequestBody = {
  items?: LandingGenerationRequestItem[];
};
```

[2] 관련 함수 전체

```ts
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { generateLandingsFromTaxonomy } from "@/lib/adminLandings/generationService";
import type { LandingGenerationRequestItem } from "@/types/adminLanding";

type GenerateRequestBody = {
  items?: LandingGenerationRequestItem[];
};

function isValidItem(item: LandingGenerationRequestItem): boolean {
  return Boolean(
    item &&
      typeof item.taxonomyId === "string" &&
      item.taxonomyId.trim() &&
      (item.taxonomyType === "destination" ||
        item.taxonomyType === "theme" ||
        item.taxonomyType === "product_line"),
  );
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: GenerateRequestBody;
  try {
    body = (await request.json()) as GenerateRequestBody;
  } catch {
    return NextResponse.json({ error: "요청 본문(JSON)을 확인해주세요." }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items.filter(isValidItem) : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "생성할 taxonomy 항목이 없습니다." }, { status: 400 });
  }

  try {
    const result = await generateLandingsFromTaxonomy(items);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "초안 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

[3] 호출부 전체

`src/components/admin/landings/api/adminLandings.client.ts`, `src/components/admin/products/AdminProductTaxonomyView.tsx`, `src/components/admin/landings/AdminLandingGenerationManager.tsx`

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/components/admin/landings/api/adminLandings.client.ts`
==================================================

[1] 관련 타입 정의 전체

관련 타입 import만 발췌:

```ts
LandingGenerationCandidatesResponse
LandingGenerationRequestItem
LandingGenerationResult
```

[2] 관련 함수 전체

```ts
export async function generateLandingsFromTaxonomyClient(
  items: LandingGenerationRequestItem[],
): Promise<LandingGenerationResult> {
  const response = await fetch(`${BASE}/generate-from-taxonomy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const data = await parseJsonResponse<LandingGenerationResult | { error?: string; message?: string }>(
    response,
  ).catch(() => ({} as { error?: string; message?: string }));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "taxonomy 기반 초안 생성에 실패했습니다."));
  }
  return data as LandingGenerationResult;
}
```

[3] 호출부 전체

`src/components/admin/landings/AdminLandingGenerationManager.tsx`

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/components/admin/landings/AdminLandingGenerationManager.tsx`
==================================================

[1] 관련 타입 정의 전체

```ts
import type { LandingGenerationCandidate, LandingGenerationResult } from "@/types/adminLanding";
```

[2] 관련 함수 전체

```tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLandingGenerationFilters from "@/components/admin/landings/AdminLandingGenerationFilters";
import AdminLandingGenerationTable from "@/components/admin/landings/AdminLandingGenerationTable";
import {
  generateLandingsFromTaxonomyClient,
  listLandingGenerationCandidatesClient,
} from "@/components/admin/landings/api/adminLandings.client";
import {
  ADMIN_LANDINGS_ROUTE,
  buildAdminLandingEditHref,
} from "@/components/admin/landings/adminLandings.constants";
import type { LandingGenerationCandidate, LandingGenerationResult } from "@/types/adminLanding";

function candidateKey(item: LandingGenerationCandidate): string {
  return `${item.taxonomyType}:${item.taxonomyId}`;
}

export default function AdminLandingGenerationManager() {
  const router = useRouter();
  const [taxonomyType, setTaxonomyType] = useState<"all" | "destination" | "theme" | "product_line">("all");
  const [onlyNotGenerated, setOnlyNotGenerated] = useState(true);
  const [items, setItems] = useState<LandingGenerationCandidate[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<LandingGenerationResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listLandingGenerationCandidatesClient({
        taxonomyType,
        alreadyGenerated: onlyNotGenerated ? false : undefined,
      });
      setItems(response.items);
      setSelectedKeys(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "후보 목록을 불러오지 못했습니다.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [onlyNotGenerated, taxonomyType]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedKeys.has(candidateKey(item)) && !item.isAlreadyGenerated),
    [items, selectedKeys],
  );

  function formatReason(reason?: string) {
    switch (reason) {
      case "ALREADY_EXISTS":
        return "이미 생성된 랜딩이 있어 건너뜀";
      case "SLUG_CONFLICT":
        return "slug 충돌로 건너뜀";
      case "CANDIDATE_NOT_FOUND":
        return "후보를 찾을 수 없음";
      default:
        return reason ?? "오류";
    }
  }

  async function handleGenerate() {
    if (selectedItems.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const generationResult = await generateLandingsFromTaxonomyClient(
        selectedItems.map((item) => ({
          taxonomyId: item.taxonomyId,
          taxonomyType: item.taxonomyType,
        })),
      );
      setResult(generationResult);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "초안 생성에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--text-primary)]">taxonomy 기반 랜딩 초안 생성</p>
        <p className="text-xs text-[var(--text-muted)]">
          지역·테마는 활성 상품이 연결된 taxonomy만, 상품군은 상품 수와 관계없이 사전 초안 후보로 포함됩니다. 생성 시 항상 draft만 만들어집니다.
        </p>
      </div>

      <AdminLandingGenerationFilters
        taxonomyType={taxonomyType}
        onlyNotGenerated={onlyNotGenerated}
        onTaxonomyTypeChange={setTaxonomyType}
        onOnlyNotGeneratedChange={setOnlyNotGenerated}
        disabled={loading || submitting}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--text-muted)]">
          선택 {selectedItems.length}건 / 전체 {items.length}건
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(ADMIN_LANDINGS_ROUTE)}
          >
            목록으로
          </button>
          <button
            type="button"
            disabled={selectedItems.length === 0 || submitting}
            onClick={() => {
              void handleGenerate();
            }}
          >
            {submitting ? "생성 중..." : "선택 항목 draft 생성"}
          </button>
        </div>
      </div>
    </section>
  );
}
```

[3] 호출부 전체

관리자 랜딩 생성 페이지 엔트리에서 렌더됩니다.

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/lib/admin/productPreview.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
export type ProductFormPayload = {
  title?: string;
  description?: string;
  one_liner?: string;
  options_json?: string;
  image_url?: string;
  images_json?: string[];
  category?: string;
  destination_id?: string;
  theme?: string;
  product_line_id?: string;
  campaigns?: string;
  price?: string;
  seasonal_price_bands?: {
    offSeason: string;
    weekend: string;
    peakSeason: string;
  };
  duration?: string;
  itinerary?: string;
  inclusions?: string;
  point_benefits?: string;
  point_tourism?: string;
  point_guide?: string;
  meeting_info?: string;
  travel_insurance?: string;
  included_items?: string;
  excluded_items?: string;
  detailed_schedule?: string;
  optional_tours?: string;
  min_departure_people?: string;
  terms_and_notes?: string;
  terms_template_type?: string;
  booking_notes?: string;
  travel_notes?: string;
  booking_conditions?: string;
  booking_notes_template_type?: string;
  travel_notes_template_type?: string;
  booking_conditions_template_type?: string;
  refund_policy?: string;
  refund_policy_template_type?: string;
  product_source_url?: string;
  departure_from_airport?: string;
  departure_from_date?: string;
  departure_from_time?: string;
  departure_to_airport?: string;
  departure_to_date?: string;
  departure_to_time?: string;
  departure_flight_name?: string;
  departure_baggage_limit?: string;
  arrival_from_airport?: string;
  arrival_from_date?: string;
  arrival_from_time?: string;
  arrival_to_airport?: string;
  arrival_to_date?: string;
  arrival_to_time?: string;
  arrival_flight_name?: string;
  arrival_baggage_limit?: string;
  meta_title?: string;
  meta_description?: string;
  is_active?: boolean;
  sort_order?: string;
  status?: "" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  fuel_included?: "" | "true" | "false";
  price_meta?: string;
  meta_info?: string;
  overview_accommodation?: string;
  overview_region?: string;
  overview_duration?: string;
  itinerary_media_json?: Record<string, string>;
  itinerary_days_json?: ItineraryStructuredDay[];
  itinerary_v2_json?: ItineraryV2;
  theme_chart_json?: Array<{ label: string; percent: number }>;
};

export type ProductCardPropsPayload = {
  title?: string;
  price?: number;
  seasonal_price_bands?: SeasonalPriceBands | null;
  duration?: string;
  region?: string;
  categories?: string[];
  tags?: string[];
  status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  badges?: { type: string; label: string; priority?: number; isActive?: boolean }[];
  infoBadges?: { type: string; label: string; priority?: number; isActive?: boolean }[];
  thumbnailUrl?: string;
  priceMeta?: string;
  metaInfo?: string;
  campaignPitchLine?: string;
};

export type ProductDetailV2PropsPayload = {
  title?: string;
  region?: string;
  category?: string;
  statusTag?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  oneLiner?: string;
  priceFormatted: string | null;
  duration?: string;
  priceMeta?: string;
  fuelIncluded?: boolean;
  includedItems?: string;
  excludedItems?: string;
  detailedSchedule?: string;
  optionalTours?: string;
  minDeparturePeople?: string;
  bookingNotes?: string;
  travelNotes?: string;
  bookingConditions?: string;
  refundPolicy?: string;
  trust?: unknown;
  options?: ProductOptions;
  basePrice?: number;
  product?: Product | null;
  overviewModel?: TravelOverviewModel | null;
  overviewFallbackUrl?: string;
};
```

[2] 관련 함수 전체

```ts
/**
 * 공용 미리보기 로직: 저장 API와 preview API가 동일한 규칙 사용
 */

import type {
  Product,
  ProductOptions,
  ItineraryStructuredDay,
  ItineraryV2,
  SeasonalPriceBands,
} from "@/types/product";
import {
  sanitizeSeasonalPriceBandsFromFormStrings,
} from "@/lib/products/seasonalPriceBands";
import type { TravelOverviewModel } from "@/lib/products/mapProductToOverview";
import { mapProductToOverview } from "@/lib/products/mapProductToOverview";
import { buildProductCardInfoBadges } from "@/lib/productCardProps";
import { buildCampaignRepresentativeBadges } from "@/lib/productCampaignBadges";
import { buildCampaignPitchLineFromProduct } from "@/lib/productCampaignPresentation";
import { parseMetaTitleAsHashtags } from "@/lib/products/parseMetaTitleAsHashtags";
import { formatPriceKR } from "@/lib/pricing/calcQuote";
import { getPrimaryImageUrl, normalizeImageList } from "@/lib/products/images";
import type { TermsTemplateMap } from "@/lib/termsTemplates";
import type {
  NoticeTemplatesByGroup,
  ResolvedProductNoticesForDetail,
} from "@/lib/noticeTemplates";
import {
  resolveBookingConditionsForDetailSync,
  resolveBookingNoticeForDetailSync,
  resolveRefundPolicyForDetailSync,
  resolveTravelNoticeForDetailSync,
} from "@/lib/noticeTemplates";

function logProductNoticeMigrationCheckDev(product: Product) {
  if (process.env.NODE_ENV !== "development") return;
  const id = product.id?.trim();
  if (!id || id === "_preview") return;
  const travelEmpty = !(product.travel_notes?.trim());
  const legacy = product.terms_and_notes?.trim();
  if (travelEmpty && legacy) {
    console.warn("[MIGRATION CHECK] travel_notes empty but legacy exists:", id);
  }
}

export function formToPreviewProduct(
  form: ProductFormPayload,
  imageUrlForPreview: string,
): Product {
  const priceNumRaw = form.price ? parseInt(String(form.price).replace(/\D/g, ""), 10) : undefined;
  let price =
    priceNumRaw !== undefined && !Number.isNaN(priceNumRaw) && priceNumRaw > 0 ? priceNumRaw : undefined;
  const bandsSanitized: SeasonalPriceBands | null = form.seasonal_price_bands
    ? sanitizeSeasonalPriceBandsFromFormStrings(form.seasonal_price_bands)
    : null;
  const oneLiner = (
    (form.one_liner?.trim() ||
      form.description?.trim().split(/\n/)[0]?.slice(0, 200) ||
      form.title ||
      "") as string
  ).trim();
  const options = (() => {
    const raw = form.options_json?.trim();
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray(parsed.groups) &&
        (parsed.groups as unknown[]).length > 0
      ) {
        return parsed as ProductOptions;
      }
    } catch {
    }
    return undefined;
  })();

  const imagesJson = normalizeImageList(form.images_json);
  const primaryImageUrl = imageUrlForPreview?.trim() || imagesJson[0] || form.image_url?.trim() || "";

  return {
    id: "_preview",
    title: ((form.title?.trim() || "상품명") as string).slice(0, 200),
    description: (form.description?.trim() || "") as string,
    image_url: primaryImageUrl as string,
    images_json: imagesJson.length > 0 ? imagesJson : undefined,
    category: (form.category?.trim() || "여행상품") as string,
    destination_id: form.destination_id?.trim() || null,
    theme: form.theme?.trim() || undefined,
    product_line_id: form.product_line_id?.trim() || null,
    campaigns: (() => {
      const s = form.campaigns?.trim();
      if (!s) return undefined;
      const arr = s.split(/[,\s]+/).map((v) => v.trim()).filter(Boolean);
      return arr.length > 0 ? arr : undefined;
    })(),
    campaigns_json: (() => {
      const s = form.campaigns?.trim();
      if (!s) return undefined;
      const arr = s.split(/[,\s]+/).map((v) => v.trim()).filter(Boolean);
      return arr.length > 0 ? arr : undefined;
    })(),
    price,
    seasonal_price_bands: bandsSanitized ?? undefined,
    duration: form.duration?.trim() || undefined,
    itinerary: form.itinerary?.trim() || undefined,
    inclusions: form.inclusions?.trim() || undefined,
    point_benefits: form.point_benefits?.trim() || undefined,
    point_tourism: form.point_tourism as "O" | "X" | undefined,
    point_guide: form.point_guide as "O" | "X" | undefined,
    meeting_info: form.meeting_info as "O" | "X" | undefined,
    travel_insurance: form.travel_insurance as "O" | "X" | undefined,
    included_items: form.included_items?.trim() || undefined,
    excluded_items: form.excluded_items?.trim() || undefined,
    detailed_schedule: form.detailed_schedule?.trim() || undefined,
    optional_tours: form.optional_tours?.trim() || undefined,
    min_departure_people: form.min_departure_people?.trim() || undefined,
    terms_and_notes: form.terms_and_notes?.trim() || undefined,
    terms_template_type: form.terms_template_type?.trim() || undefined,
    booking_notes: form.booking_notes?.trim() || undefined,
    travel_notes: form.travel_notes?.trim() || undefined,
    booking_conditions: form.booking_conditions?.trim() || undefined,
    booking_notes_template_type:
      form.booking_notes_template_type?.trim() || undefined,
    travel_notes_template_type:
      form.travel_notes_template_type?.trim() || undefined,
    booking_conditions_template_type:
      form.booking_conditions_template_type?.trim() || undefined,
    refund_policy: form.refund_policy?.trim() || undefined,
    refund_policy_template_type:
      form.refund_policy_template_type?.trim() || undefined,
    product_source_url: form.product_source_url?.trim() || undefined,
    departure_from_airport: form.departure_from_airport?.trim() || undefined,
    departure_from_date: form.departure_from_date?.trim() || undefined,
    departure_from_time: form.departure_from_time?.trim() || undefined,
    departure_to_airport: form.departure_to_airport?.trim() || undefined,
    departure_to_date: form.departure_to_date?.trim() || undefined,
    departure_to_time: form.departure_to_time?.trim() || undefined,
    departure_flight_name: form.departure_flight_name?.trim() || undefined,
    departure_baggage_limit: form.departure_baggage_limit?.trim() || undefined,
    arrival_from_airport: form.arrival_from_airport?.trim() || undefined,
    arrival_from_date: form.arrival_from_date?.trim() || undefined,
    arrival_from_time: form.arrival_from_time?.trim() || undefined,
    arrival_to_airport: form.arrival_to_airport?.trim() || undefined,
    arrival_to_date: form.arrival_to_date?.trim() || undefined,
    arrival_to_time: form.arrival_to_time?.trim() || undefined,
    arrival_flight_name: form.arrival_flight_name?.trim() || undefined,
    arrival_baggage_limit: form.arrival_baggage_limit?.trim() || undefined,
    meta_title: form.meta_title?.trim() || undefined,
    meta_description: form.meta_description?.trim() || undefined,
    is_active: form.is_active ?? true,
    sort_order: form.sort_order ? parseInt(String(form.sort_order), 10) : undefined,
    status: form.status || "AVAILABLE",
    fuel_included:
      form.fuel_included === ""
        ? undefined
        : form.fuel_included === "true",
    price_meta: ((form.price_meta?.trim() || "1인 기준") as string) || undefined,
    meta_info: form.meta_info?.trim() || undefined,
    overview_accommodation: form.overview_accommodation?.trim() || undefined,
    overview_region: form.overview_region?.trim() || undefined,
    overview_duration: form.overview_duration?.trim() || undefined,
    one_liner: oneLiner || undefined,
    options,
    itinerary_media_json:
      form.itinerary_media_json && Object.keys(form.itinerary_media_json).length > 0
        ? form.itinerary_media_json
        : undefined,
    itinerary_days_json:
      form.itinerary_days_json && form.itinerary_days_json.length > 0
        ? form.itinerary_days_json
        : undefined,
    itinerary_v2_json:
      form.itinerary_v2_json?.days?.length
        ? form.itinerary_v2_json
        : undefined,
    theme_chart_json: (() => {
      const items = form.theme_chart_json?.filter((i) => i?.label?.trim() && typeof i.percent === "number") ?? [];
      return items.length >= 2 ? { items } : undefined;
    })(),
  };
}

export function productToCardPropsPayload(product: Product): ProductCardPropsPayload {
  return {
    title: product.title,
    price: product.price,
    seasonal_price_bands: product.seasonal_price_bands ?? undefined,
    duration: product.duration,
    region: product.theme,
    categories: [product.category],
    tags: parseMetaTitleAsHashtags(product.meta_title),
    status: (product.status ?? "AVAILABLE") as ProductCardPropsPayload["status"],
    badges: buildCampaignRepresentativeBadges(product),
    infoBadges: buildProductCardInfoBadges(product),
    thumbnailUrl: getPrimaryImageUrl(product),
    priceMeta: product.price_meta || "1인 기준",
    metaInfo: product.meta_info ?? "",
    campaignPitchLine: buildCampaignPitchLineFromProduct(product, "grid"),
  };
}

export function productToDetailV2PropsPayload(
  product: Product,
  noticeTemplatesByGroup?: NoticeTemplatesByGroup | null,
  legacyTermsTemplateMap?: TermsTemplateMap | null,
  resolvedNotices?: ResolvedProductNoticesForDetail | null,
): ProductDetailV2PropsPayload {
  logProductNoticeMigrationCheckDev(product);
  const oneLiner =
    product.one_liner?.trim() ||
    product.description?.trim().split(/\n/)[0]?.slice(0, 200) ||
    product.title ||
    "";
  const priceFormatted = product.price != null ? formatPriceKR(product.price) : null;

  let bookingNotes: string;
  let travelNotes: string;
  let bookingConditions: string;
  let refundPolicy: string;
  if (resolvedNotices) {
    bookingNotes = resolvedNotices.bookingNotes;
    travelNotes = resolvedNotices.travelNotes;
    bookingConditions = resolvedNotices.bookingConditions;
    refundPolicy = resolvedNotices.refundPolicy;
  } else if (noticeTemplatesByGroup) {
    bookingNotes = resolveBookingNoticeForDetailSync(
      product.booking_notes,
      product.booking_notes_template_type,
      product.terms_and_notes,
      noticeTemplatesByGroup,
      legacyTermsTemplateMap,
    );
    travelNotes = resolveTravelNoticeForDetailSync(
      product.travel_notes,
      product.travel_notes_template_type,
      noticeTemplatesByGroup,
    );
    bookingConditions = resolveBookingConditionsForDetailSync(
      product.booking_conditions,
      product.booking_conditions_template_type,
      noticeTemplatesByGroup,
    );
    refundPolicy = resolveRefundPolicyForDetailSync(
      product.refund_policy,
      product.refund_policy_template_type,
      noticeTemplatesByGroup,
    );
  } else {
    bookingNotes = product.booking_notes?.trim() ?? "";
    travelNotes = product.travel_notes?.trim() ?? "";
    bookingConditions = product.booking_conditions?.trim() ?? "";
    refundPolicy = product.refund_policy?.trim() ?? "";
  }
  return {
    title: product.title,
    region: product.theme,
    category: product.category,
    statusTag: (product.status ?? "AVAILABLE") as ProductDetailV2PropsPayload["statusTag"],
    oneLiner,
    priceFormatted,
    duration: product.duration ?? "",
    priceMeta: product.price_meta || "1인 기준",
    fuelIncluded: product.fuel_included,
    includedItems: product.included_items ?? "",
    excludedItems: product.excluded_items ?? "",
    detailedSchedule: product.detailed_schedule ?? product.itinerary ?? "",
    optionalTours: product.optional_tours ?? "",
    minDeparturePeople: product.min_departure_people ?? "",
    bookingNotes,
    travelNotes,
    bookingConditions,
    refundPolicy,
    trust: undefined,
    options: product.options,
    basePrice: product.price,
    product,
    overviewModel: mapProductToOverview(product),
    overviewFallbackUrl: getPrimaryImageUrl(product),
  };
}
```

[3] 호출부 전체

`src/app/api/admin/products/preview/route.ts`, `src/components/admin/products/AdminProductManager.tsx`, `src/components/admin/products/editor/adminProductPreview.mapper.ts`

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/app/api/admin/products/preview/route.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
type PreviewRequestBody = {
  form: ProductFormPayload;
  imageUrl?: string;
};
```

[2] 관련 함수 전체

```ts
import { NextResponse } from "next/server";
import {
  formToPreviewProduct,
  productToCardPropsPayload,
  productToDetailV2PropsPayload,
  type ProductFormPayload,
} from "@/lib/admin/productPreview";
import { getCampaignTaxonomiesForCard } from "@/lib/productTaxonomies";
import { hydrateProductWithCampaignCardMeta } from "@/lib/productCampaignResolve";
import { resolveProductNoticesForDetailPage } from "@/lib/noticeTemplates";

type PreviewRequestBody = {
  form: ProductFormPayload;
  imageUrl?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PreviewRequestBody;
    const form = body.form;
    const imageUrl = body.imageUrl ?? form?.image_url?.trim() ?? "";

    if (!form || typeof form !== "object") {
      return NextResponse.json(
        { message: "form 객체가 필요합니다." },
        { status: 400 },
      );
    }

    const campaignTaxonomies = await getCampaignTaxonomiesForCard();
    const previewProduct = hydrateProductWithCampaignCardMeta(
      formToPreviewProduct(form, imageUrl),
      campaignTaxonomies,
    );
    const resolvedNotices = await resolveProductNoticesForDetailPage(previewProduct);
    const cardProps = productToCardPropsPayload(previewProduct);
    const detailProps = productToDetailV2PropsPayload(
      previewProduct,
      null,
      null,
      resolvedNotices,
    );

    return NextResponse.json({
      previewProduct,
      cardProps,
      detailProps,
    });
  } catch (error) {
    console.error("[api/admin/products/preview]", error);
    return NextResponse.json(
      { message: "미리보기 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
```

[3] 호출부 전체

`src/components/admin/products/AdminProductManager.tsx`

```ts
fetch("/api/admin/products/preview", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ form, imageUrl }),
})
```

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/components/admin/products/editor/adminProductPreview.mapper.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
export type PreviewWarning = {
  id: string;
  message: string;
  sectionId: "basic" | "price" | "schedule";
};
```

[2] 관련 함수 전체

```ts
/**
 * Admin product form → 미리보기용 Product 변환
 * 우측 미리보기 패널이 기대하는 shape 유지
 */

import type { Product } from "@/types/product";
import type { ProductFormState } from "@/types/adminProductForm";
import { formToPreviewProduct } from "@/lib/admin/productPreview";
import {
  hasRealText,
  hasValidNumber,
  hasAnyValidSeasonalPriceBand,
  hasValidPriceOptionJson,
  hasCoverImage,
  hasNonEmptyArray,
} from "@/lib/products/formCompletion";
import { parseDetailedSchedule } from "./adminProductForm.helpers";

export function mapAdminProductFormToPreviewProduct(
  form: ProductFormState,
  imageUrlForPreview: string,
): Product {
  return formToPreviewProduct(form, imageUrlForPreview);
}

export function getPreviewWarnings(
  form: ProductFormState,
  hasPreviewImage: boolean,
): PreviewWarning[] {
  const warnings: PreviewWarning[] = [];

  if (!hasRealText(form.category)) {
    warnings.push({
      id: "category",
      message: "카테고리 미입력 → 카드/상세에 카테고리 칩이 비어 보입니다.",
      sectionId: "basic",
    });
  }

  if (
    !hasValidNumber(form.price) &&
    !hasAnyValidSeasonalPriceBand(form) &&
    !hasValidPriceOptionJson(form.options_json)
  ) {
    warnings.push({
      id: "price",
      message: "가격 미입력 또는 0원 → 카드/상세에 '상담 후 견적'으로만 표시됩니다.",
      sectionId: "price",
    });
  }

  if (!hasCoverImage(form.image_url, form.images_json) && !hasPreviewImage) {
    warnings.push({
      id: "image",
      message: "대표 이미지 없음 → 카드/상세에 이미지가 비어 보입니다.",
      sectionId: "basic",
    });
  }

  const scheduleDrafts = parseDetailedSchedule(form.detailed_schedule);
  const hasEmptySchedule =
    !hasNonEmptyArray(form.itinerary_days_json) &&
    (!hasNonEmptyArray(scheduleDrafts) || scheduleDrafts.every((d) => !hasRealText(d.content)));
  if (hasEmptySchedule) {
    warnings.push({
      id: "schedule",
      message: "일정(일차) 비어 있음 → 상세 '일정 안내' 탭에 내용이 없습니다.",
      sectionId: "schedule",
    });
  }

  return warnings;
}
```

[3] 호출부 전체

`src/components/admin/products/AdminProductManager.tsx`

[4] 관련 상수/템플릿 전체

없음

## 요약

1. 블로그 생성 로직으로 추정되는 핵심 파일 목록
- `src/lib/blog/buildBlogPostText.ts`
- `src/lib/blog/mapProductToBlogPostViewModel.ts`
- `src/lib/blog/postProcessText.ts`
- `src/lib/blog/blogPost.sanitize.ts`
- `src/app/api/admin/products/[id]/blog-post/route.ts`
- `src/components/admin/products/modals/BlogPostGenerateModal.tsx`

2. 상품 데이터 → 문장 변환 로직 파일 목록
- `src/lib/blog/mapProductToBlogPostViewModel.ts`
- `src/lib/products/resolveProductDetailBodyFields.ts`
- `src/lib/products/getProductSeoData.ts`
- `src/lib/seo/resolveProductSeoCopy.ts`
- `src/lib/adminLandings/draftCopyBuilder.ts`
- `src/lib/admin/productPreview.ts`
- `src/lib/smartstore/mapProductToSmartstoreHtmlViewModel.ts`

3. 일정/이미지 데이터 사용 로직 파일 목록
- `src/types/product.ts`
- `src/lib/products/mapProductToTimelineModel.ts`
- `src/lib/products/images.ts`
- `src/lib/products/getProductSeoData.ts`
- `src/lib/smartstore/mapProductToSmartstoreHtmlViewModel.ts`
- `src/lib/smartstore/buildSmartstoreDetailSections.ts`
- `src/lib/admin/productPreview.ts`

4. 기존 로직의 한계로 보이는 부분
- 블로그 생성은 현재 `plain text` 중심이며 HTML/구조화 블록/에디터 친화 포맷이 없습니다.
- 블로그 톤 분기는 `info/deal/compare` 3종으로 고정이고, 상품 컨셉 탐지는 스마트스토어 쪽에 비해 약합니다.
- 블로그 본문은 일정 요약을 `humanizeSchedule()`의 단순 규칙으로 축약해 실제 일정 서사를 충분히 살리지 못합니다.
- SEO/블로그/스마트스토어/랜딩이 각각 별도 템플릿을 가져 공통 카피 규칙이 분산돼 있습니다.
- 관리자 미리보기는 상세/카드 기준이고, 블로그 자동생성 결과를 같은 화면에서 비교·교정하는 통합 미리보기는 없습니다.
- 랜딩 자동생성은 taxonomy 이름 기반 정적 문장 템플릿 수준이라 상품 데이터/이미지/일정 문맥 활용이 약합니다.

5. 다음 PR에서 수정해야 할 후보 파일 목록
- `src/lib/blog/buildBlogPostText.ts`
- `src/lib/blog/mapProductToBlogPostViewModel.ts`
- `src/lib/blog/postProcessText.ts`
- `src/lib/smartstore/mapProductToSmartstoreHtmlViewModel.ts`
- `src/lib/products/mapProductToTimelineModel.ts`
- `src/lib/products/getProductSeoData.ts`
- `src/lib/adminLandings/draftCopyBuilder.ts`
- `src/components/admin/products/modals/BlogPostGenerateModal.tsx`
- `src/app/api/admin/products/[id]/blog-post/route.ts`

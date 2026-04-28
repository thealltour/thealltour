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

/** DB에 "2" / "2명" / "2명 이상" 등이 섞여 있어도 "명 이상"이 두 번 붙지 않게 */
function minDepartureTailAfterValue(trimmed: string): string {
  if (/^\d+$/.test(trimmed)) return "명 이상 확정 시 출발";
  if (/이상\s*$/u.test(trimmed)) return " 확정 시 출발";
  if (/명\s*$/u.test(trimmed)) return " 이상 확정 시 출발";
  return "명 이상 확정 시 출발";
}

/** 하단 고정 안내 1문장용 (목록 없이 단일 문단) */
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
  // 가격: 스마트스토어 상품 자체 가격 필드 사용 — 상세 HTML에는 미포함
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

/** 섹션 HTML 조각만 순서대로 이어 붙인다. */
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

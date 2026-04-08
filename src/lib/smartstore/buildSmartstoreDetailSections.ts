import type { SmartstoreHtmlViewModel } from "@/lib/smartstore/smartstoreHtml.types";
import {
  SMARTSTORE_SECTION_TITLES,
  SMARTSTORE_DEFAULT_BOOKING_CONDITIONS,
  SMARTSTORE_NOTICE_TRAVEL,
  SMARTSTORE_NOTICE_REFUND,
  SMARTSTORE_NOTICE_INQUIRY,
} from "@/lib/smartstore/smartstoreHtml.defaults";
import { escapeHtml, parseScheduleDayBlocks, styleAttr } from "@/lib/smartstore/smartstoreHtml.helpers";

function h2(title: string): string {
  return `<h2${styleAttr({ "font-size": "17px", "font-weight": "700", color: "#0f172a", margin: "28px 0 12px", "padding-bottom": "8px", "border-bottom": "2px solid #e2e8f0" })}>${escapeHtml(title)}</h2>`;
}

function cardInner(html: string): string {
  return `<div${styleAttr({ background: "#f8fafc", border: "1px solid #e2e8f0", "border-radius": "12px", padding: "14px 16px", margin: "0 0 12px" })}>${html}</div>`;
}

function ulFromLines(lines: string[]): string {
  if (lines.length === 0) return "";
  const items = lines.map((line) => `<li${styleAttr({ margin: "7px 0" })}>${escapeHtml(line)}</li>`).join("");
  return `<ul${styleAttr({ margin: "0", "padding-left": "1.2em" })}>${items}</ul>`;
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
      const dayLabel =
        (day.title?.trim() ? day.title : `Day ${day.day}`) +
        (day.dateText?.trim() ? ` · ${day.dateText.trim()}` : "");
      let block = `<p${styleAttr({
        "font-weight": "700",
        color: "#0f172a",
        margin: "12px 0 6px",
        "font-size": "16px",
      })}>${escapeHtml(dayLabel)}</p>`;
      if (day.imageUrl?.trim()) {
        block += `<img src="${escapeHtml(day.imageUrl.trim())}" alt=""${styleAttr({
          width: "100%",
          height: "auto",
          "border-radius": "8px",
          display: "block",
          margin: "0 0 8px",
          border: "1px solid #e2e8f0",
        })} loading="lazy" />`;
      }
      for (const ev of day.events ?? []) {
        if (ev.heading?.trim()) {
          block += `<p${styleAttr({
            "font-weight": "600",
            color: "#1e293b",
            margin: "8px 0 4px",
          })}>${escapeHtml(ev.heading.trim())}</p>`;
        }
        if (ev.description?.trim()) {
          block += `<p${styleAttr({
            "font-size": "14px",
            color: "#475569",
            margin: "0 0 8px",
            "white-space": "pre-wrap",
          })}>${escapeHtml(ev.description.trim())}</p>`;
        }
      }
      chunks.push(cardInner(block));
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
        "white-space": "pre-wrap",
      })}>${escapeHtml(b.content)}</p>`;
      return cardInner(head + body);
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
  inner += `<ul${styleAttr({ margin: "0 0 12px", "padding-left": "1.2em" })}>`;
  inner += `<li${styleAttr({ margin: "6px 0" })}>최종 일정·가격은 주문·문의 후 확정될 수 있습니다.</li>`;
  inner += `<li${styleAttr({ margin: "6px 0" })}>예약 절차는 스마트스토어 문의를 통해 안내받으실 수 있습니다.</li>`;
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
  return h2(SMARTSTORE_SECTION_TITLES.bookingNotes) + cardInner(ulFromLines(lines));
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
  const sched = buildScheduleSection(vm);
  if (sched.html) parts.push(sched.html);
  parts.push(buildBookingSection(vm));
  parts.push(buildBookingNotesSection(vm));
  parts.push(buildTravelSection());
  parts.push(buildRefundSection());
  parts.push(buildConsultFooter());
  return parts.join("\n");
}

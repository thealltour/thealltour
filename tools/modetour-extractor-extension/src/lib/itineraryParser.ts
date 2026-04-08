/**
 * 일정(Day/이벤트) 파서 v2: 원문 기반 + 검증 강화.
 * raw itinerary 텍스트에서 Day/이벤트 추출.
 */

import type { ModetourImportV1 } from "~types/modetourImport";
import type { ModetourImportWarning } from "~types/modetourImport";
import { isShortButImportant } from "~lib/itineraryKeywords";

type DayBlock = {
  dayNumber: number;
  title?: string;
  dateText?: string;
  descriptionText?: string;
  events: Array<{
    order: number;
    timeText?: string;
    title?: string;
    typeText?: string;
    descriptionText?: string;
  }>;
};

const DAY_SPLIT_PATTERNS = [
  /^(?:Day)\s*(\d{1,2})\b/gm,
  /^(\d{1,2})일차\b/gm,
  /^\[\s*(\d{1,2})일차\s*\]/gm,
];

const TIME_PATTERN = /\b([01]?\d|2[0-3]):[0-5]\d\b/;
const BULLET_OR_NUMBER = /^[\s]*([•\-*]\s*|\d+\.\s*)/;
const FORBIDDEN_WORDS = /상품|약관|포함|불포함|SEO/i;
const MIN_EVENT_LINE_LEN = 4;

function splitByDayBlocks(itineraryText: string): { num: number; start: number; end: number }[] {
  const text = itineraryText.trim();
  if (!text) return [];

  let bestBlocks: { num: number; start: number; end: number }[] = [];
  for (const regex of DAY_SPLIT_PATTERNS) {
    const blocks: { num: number; start: number; end: number }[] = [];
    const re = new RegExp(regex.source, regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const num = parseInt(m[1], 10);
      if (Number.isFinite(num) && num >= 1 && num <= 31) {
        blocks.push({ num, start: m.index, end: m.index + m[0].length });
      }
    }
    if (blocks.length > bestBlocks.length) bestBlocks = blocks;
  }

  if (bestBlocks.length === 0) return [];

  const result: { num: number; start: number; end: number }[] = [];
  for (let i = 0; i < bestBlocks.length; i++) {
    const end =
      i + 1 < bestBlocks.length ? bestBlocks[i + 1].start : text.length;
    result.push({
      num: bestBlocks[i].num,
      start: bestBlocks[i].start,
      end,
    });
  }
  return result;
}

function isEventLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (FORBIDDEN_WORDS.test(t)) return false;
  if (isShortButImportant(t)) return true;
  if (TIME_PATTERN.test(t)) return true;
  if (BULLET_OR_NUMBER.test(t)) return true;
  if (t.length >= MIN_EVENT_LINE_LEN) return true;
  return false;
}

function parseEventLines(blockText: string): DayBlock["events"] {
  const lines = blockText.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const events: DayBlock["events"] = [];
  let order = 0;
  lines.forEach((line) => {
    if (!isEventLine(line)) return;
    order += 1;
    const timeMatch = line.match(TIME_PATTERN);
    const timeText = timeMatch ? timeMatch[0] : undefined;
    let title = line;
    if (timeMatch) {
      title = line.replace(TIME_PATTERN, "").replace(/^[\s\-–—:]+/, "").trim();
    }
    events.push({
      order,
      timeText,
      title: title.slice(0, 300) || undefined,
      descriptionText: title.length > 300 ? title.slice(300) : undefined,
    });
  });
  if (events.length === 0) events.push({ order: 1, title: "(내용 없음)" });
  return events;
}

function checkDaySequence(days: DayBlock[], warnings: ModetourImportWarning[]): void {
  if (days.length === 0) return;
  const nums = [...days.map((d) => d.dayNumber)].sort((a, b) => a - b);
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
}

export function parseItineraryText(itineraryText: string): {
  itinerary: ModetourImportV1["itinerary"];
  warnings: ModetourImportWarning[];
} {
  const warnings: ModetourImportWarning[] = [];
  const text = itineraryText.trim();
  if (!text) {
    warnings.push({
      code: "ITINERARY_MISSING",
      message: "일정 원문이 비어 있습니다.",
      path: "itinerary",
    });
    return { itinerary: undefined, warnings };
  }

  const blocks = splitByDayBlocks(text);
  if (blocks.length === 0) {
    warnings.push({
      code: "ITINERARY_PARSE_UNCERTAIN",
      message: "Day 패턴을 찾지 못했습니다. raw.textSnippets.itinerary를 확인하세요.",
      path: "itinerary",
    });
    const days: NonNullable<ModetourImportV1["itinerary"]>["days"] = [
      {
        dayNumber: 1,
        descriptionText: text.slice(0, 5000),
        events: [{ order: 1, title: "(원문 파싱 실패)", descriptionText: text.slice(0, 2000) }],
      },
    ];
    return { itinerary: { days }, warnings };
  }

  const days: DayBlock[] = blocks.map((b) => {
    const blockText = text.slice(b.start, b.end);
    const firstLineEnd = blockText.indexOf("\n");
    const firstLine = firstLineEnd >= 0 ? blockText.slice(0, firstLineEnd) : blockText;
    const rest = firstLineEnd >= 0 ? blockText.slice(firstLineEnd + 1) : "";
    const dateMatch = firstLine.match(/(\d{4}[.-]\d{1,2}[.-]\d{1,2})/);
    const dateText = dateMatch ? dateMatch[1] : undefined;
    const title = firstLine
      .replace(/\d{1,2}일차/g, "")
      .replace(/Day\s*\d+/gi, "")
      .replace(/\d{4}[.-]\d{1,2}[.-]\d{1,2}/g, "")
      .trim() || undefined;
    return {
      dayNumber: b.num,
      title,
      dateText,
      events: parseEventLines(rest),
    };
  });

  checkDaySequence(days, warnings);

  const itinerary: ModetourImportV1["itinerary"] = {
    days: days.map((d) => ({
      dayNumber: d.dayNumber,
      title: d.title,
      dateText: d.dateText,
      descriptionText: d.descriptionText,
      events: d.events,
    })),
  };
  return { itinerary, warnings };
}

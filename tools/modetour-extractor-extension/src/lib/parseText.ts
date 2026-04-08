/**
 * "n박 m일" 형태 파싱. 예: "3박 5일", "2박 3일"
 */

import { isShortButImportant } from "~lib/itineraryKeywords";

const FALLBACK_LINE_FORBIDDEN = /상품|약관|포함|불포함|SEO/i;
const FALLBACK_TIME_PATTERN = /\b([01]?\d|2[0-3]):[0-5]\d\b/;
const FALLBACK_BULLET = /^[\s]*([•\-*]\s*|\d+\.\s*)/;
const MIN_FALLBACK_LINE_LEN = 4;

function keepFallbackEventLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (FALLBACK_LINE_FORBIDDEN.test(t)) return false;
  if (isShortButImportant(t)) return true;
  if (FALLBACK_TIME_PATTERN.test(t)) return true;
  if (FALLBACK_BULLET.test(t)) return true;
  return t.length >= MIN_FALLBACK_LINE_LEN;
}

export function parseNightsDays(text: string): { nights?: number; days?: number } {
  const m = text.match(/(\d+)\s*박\s*(\d+)\s*일/);
  if (!m) return {};
  const nights = parseInt(m[1], 10);
  const days = parseInt(m[2], 10);
  return {
    nights: Number.isNaN(nights) ? undefined : nights,
    days: Number.isNaN(days) ? undefined : days,
  };
}

/**
 * Day N / N일차 패턴으로 일정 블록 파싱 (fallback).
 * 반환: { dayNumber, title?, dateText?, events: [{ order, title?, ... }] }[]
 */
export function parseDayPatternsFromText(fullText: string): Array<{
  dayNumber: number;
  title?: string;
  dateText?: string;
  events: Array<{
    order: number;
    timeText?: string;
    title?: string;
    typeText?: string;
    descriptionText?: string;
  }>;
}> {
  const days: Array<{
    dayNumber: number;
    title?: string;
    dateText?: string;
    events: Array<{
      order: number;
      timeText?: string;
      title?: string;
      typeText?: string;
      descriptionText?: string;
    }>;
  }> = [];

  // Day 1 / 1일차 / [1일차] 등 패턴
  const dayRegex = /(?:Day\s*)?(\d+)\s*일차|\[(\d+)\s*일차\]|Day\s*(\d+)/gi;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  const dayStarts: { num: number; index: number }[] = [];

  while ((m = dayRegex.exec(fullText)) !== null) {
    const num = parseInt(m[1] ?? m[2] ?? m[3], 10);
    if (Number.isFinite(num)) dayStarts.push({ num, index: m.index });
  }

  if (dayStarts.length === 0) return days;

  for (let i = 0; i < dayStarts.length; i++) {
    const start = dayStarts[i].index;
    const end = i + 1 < dayStarts.length ? dayStarts[i + 1].index : fullText.length;
    const block = fullText.slice(start, end);
    const firstLineEnd = block.indexOf("\n");
    const firstLine = firstLineEnd >= 0 ? block.slice(0, firstLineEnd) : block;
    const rest = firstLineEnd >= 0 ? block.slice(firstLineEnd + 1).trim() : "";

    // 첫 줄에서 날짜/제목 추출 (선택)
    let title: string | undefined;
    let dateText: string | undefined;
    const dateMatch = firstLine.match(/(\d{4}[.-]\d{1,2}[.-]\d{1,2})/);
    if (dateMatch) dateText = dateMatch[1];
    title = firstLine.replace(dayRegex, "").replace(/\d{4}[.-]\d{1,2}[.-]\d{1,2}/g, "").trim() || undefined;

    const lines = rest.split(/\n/).map((l) => l.trim()).filter(Boolean).filter(keepFallbackEventLine);
    const events = lines.map((line, idx) => {
      const trimmed = line.trim();
      const titleMax = 200;
      return {
        order: idx + 1,
        title: trimmed.slice(0, titleMax) || undefined,
        descriptionText: trimmed.length > titleMax ? trimmed.slice(titleMax) : undefined,
      };
    });

    days.push({
      dayNumber: dayStarts[i].num,
      title: title || undefined,
      dateText,
      events: events.length ? events : [{ order: 1, title: "(내용 없음)" }],
    });
  }

  return days;
}

/**
 * [STEP 3] 레거시 일정 텍스트 → ItineraryV2 초안
 * - "Day 1", "1일차", "DAY1" 등으로 Day 분리
 * - 줄바꿈/불릿(•, -, *)으로 이벤트 분리
 * - " / "로 구분 시: 1→제목, 2→설명, 3→오전/오후 등, 4→시각
 * - ":"로 구분 시 제목: 설명 (기존 방식)
 * - 파싱 실패 시 Day 1개에 줄 단위 이벤트
 */

import type { ItineraryV2, ItineraryV2Day, ItineraryV2Event } from "@/types/product";

const DAY_PATTERN = /^\s*\[?\s*(?:Day\s*|DAY\s*)?(\d+)(?:\s*일차)?\s*\]?\s*(.*)$/i;
const TIMEOFDAY_PATTERNS = [
  { pattern: /오전/, value: "오전" as const },
  { pattern: /오후/, value: "오후" as const },
  { pattern: /저녁/, value: "저녁" as const },
  { pattern: /종일/, value: "종일" as const },
];
const BULLET_PATTERN = /^[\s•\-*·]+\s*|\s*$/g;

function extractTimeOfDay(text: string): ItineraryV2Event["timeOfDay"] {
  const t = text.trim();
  for (const { pattern, value } of TIMEOFDAY_PATTERNS) {
    if (pattern.test(t)) return value;
  }
  return undefined;
}

function lineToEvent(line: string): ItineraryV2Event {
  const trimmed = line.replace(BULLET_PATTERN, "").trim();
  if (!trimmed) {
    return { heading: "(제목 없음)", description: undefined };
  }
  let heading: string;
  let description: string | undefined;
  let timeOfDay: ItineraryV2Event["timeOfDay"];
  let timeText: string | undefined;

  const parts = trimmed.split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 1) {
    heading = parts[0];
    description = parts.length >= 2 ? parts[1] : undefined;
    if (parts.length >= 3) {
      const p3 = parts[2];
      if (p3 === "오전" || p3 === "오후" || p3 === "저녁" || p3 === "종일") {
        timeOfDay = p3;
        timeText = parts.length >= 4 ? parts[3] : undefined;
      } else {
        timeOfDay = extractTimeOfDay(trimmed);
        timeText = p3 || undefined;
      }
    } else {
      timeOfDay = extractTimeOfDay(trimmed);
    }
  } else {
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex > 0) {
      heading = trimmed.slice(0, colonIndex).trim();
      description = trimmed.slice(colonIndex + 1).trim() || undefined;
    } else {
      heading = trimmed;
      description = undefined;
    }
    timeOfDay = extractTimeOfDay(trimmed);
  }
  if (!heading) heading = trimmed;
  return {
    ...(timeOfDay && { timeOfDay }),
    ...(timeText && { timeText }),
    heading,
    ...(description && { description }),
  };
}

function inferIconKey(heading: string): string | undefined {
  const h = heading.trim().toLowerCase();
  if (/이동|차량|버스|출발|도착|항공|비행|기내/.test(h)) return "plane";
  if (/식사|조식|중식|석식|디너|기내식/.test(h)) return "utensils";
  if (/tee\s*off|티오프|라운드|골프/.test(h)) return "flag";
  if (/호텔|숙소|체크인|숙박/.test(h)) return "hotel";
  if (/관광|시내|투어|탐방/.test(h)) return "landmark";
  if (/자유|프리/.test(h)) return "clock";
  return undefined;
}

/**
 * 레거시 일정 텍스트를 파싱해 ItineraryV2 초안 생성
 */
export function parseLegacyItineraryText(legacyText: string): ItineraryV2 {
  const raw = (legacyText ?? "").trim();
  if (!raw) return { days: [] };

  const lines = raw.split(/\r?\n/);
  const days: ItineraryV2Day[] = [];
  let currentDayNumber: number | null = null;
  let currentLines: string[] = [];

  const flushDay = () => {
    if (currentDayNumber == null) return;
    const eventLines = currentLines
      .flatMap((line) => {
        const trimmed = line.trim();
        if (!trimmed) return [];
        return trimmed.split(/(?=[•\-*·])/).map((s) => s.replace(BULLET_PATTERN, "").trim()).filter(Boolean);
      })
      .filter((s) => s.length > 0);
    const events: ItineraryV2Event[] = eventLines.map((line) => {
      const ev = lineToEvent(line);
      const iconKey = inferIconKey(ev.heading);
      return { ...ev, ...(iconKey && { iconKey }) };
    });
    days.push({
      day: currentDayNumber,
      title: undefined,
      dateText: undefined,
      coverImageUrl: undefined,
      events: events.length > 0 ? events : [{ heading: "일정", description: undefined }],
    });
  };

  for (const line of lines) {
    const dayMatch = line.match(DAY_PATTERN);
    const dayNumFromMatch = dayMatch ? parseInt(dayMatch[1], 10) : NaN;
    const isDayHeader = dayMatch && Number.isFinite(dayNumFromMatch) && dayNumFromMatch >= 1;
    if (isDayHeader) {
      flushDay();
      currentDayNumber = dayNumFromMatch;
      const rest = (dayMatch[2] ?? "").trim();
      currentLines = rest ? [rest] : [];
      continue;
    }
    if (currentDayNumber != null) {
      currentLines.push(line);
    } else {
      currentDayNumber = 1;
      currentLines = [line];
    }
  }

  flushDay();

  if (days.length === 0) {
    const fallbackLines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return {
      days: [
        {
          day: 1,
          events: fallbackLines.length > 0
            ? fallbackLines.map((l) => {
                const ev = lineToEvent(l);
                const iconKey = inferIconKey(ev.heading);
                return { ...ev, ...(iconKey && { iconKey }) };
              })
            : [{ heading: "일정", description: raw.slice(0, 200) || undefined }],
        },
      ],
    };
  }

  return { days };
}

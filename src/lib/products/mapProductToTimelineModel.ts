/**
 * [STEP 0/2] 텍스트 일정 → 시각화 타임라인 ViewModel
 * - 기존 detailed_schedule / itinerary 유지, 파생 모델만 생성
 * - STEP 2: TimelineModel (events, timeOfDay, side) 추가
 */

import type { Product, ItineraryStructuredDay, ItineraryV2 } from "@/types/product";
import { parseTimelineDays } from "@/lib/products/mapProductToOverview";

// ---------------------------------------------------------------------------
// STEP 2: 요약 타임라인용 모델 (events, timeOfDay, side)
// ---------------------------------------------------------------------------

export type TimeOfDayLabel = "오전" | "오후" | "저녁" | "종일";

export type TimelineEvent = {
  timeOfDay?: TimeOfDayLabel;
  /** 시각 (예: 09:00). 오전/오후 옆에 표시 */
  timeText?: string;
  iconKey?: string;
  heading: string;
  description?: string;
  side?: "left" | "right";
};

export type TimelineDay = {
  day: number;
  dateText?: string;
  title?: string;
  imageUrl?: string | null;
  events: TimelineEvent[];
};

export type TimelineModel = {
  days: TimelineDay[];
};

const MAX_EVENTS_PER_DAY = 4;
const TITLE_MAX_LEN = 40;

/** key-value 한 줄 파싱: "이동: 인천 출발" → { heading: "이동", description: "인천 출발" } */
function parseKeyValueLine(line: string): { heading: string; description?: string } {
  const trimmed = line.trim();
  if (!trimmed) return { heading: "" };

  // dotAll 플래그(s) 대신 [\s\S]* 사용 (ES2018 이전 타겟 호환)
  const colonMatch = trimmed.match(/^([^:]+):\s*([\s\S]*)$/);
  if (colonMatch) {
    let label = colonMatch[1].trim();
    const value = colonMatch[2].trim();
    if (/^TEE\s*OFF\s*TIME$/i.test(label)) label = "TEE OFF";
    return { heading: label, description: value || undefined };
  }

  return { heading: trimmed };
}

function extractTimeOfDay(text: string): TimeOfDayLabel | undefined {
  if (/오전/.test(text)) return "오전";
  if (/오후/.test(text)) return "오후";
  if (/저녁/.test(text)) return "저녁";
  if (/종일/.test(text)) return "종일";
  return undefined;
}

/** [STEP 6] heading → lucide 아이콘 키: 이동/항공→plane, 숙소→hotel, 식사→utensils, 관광→landmark, 골프→flag, 자유→clock */
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

/** 한 줄을 TimelineEvent로 변환 */
function lineToEvent(line: string, index: number): TimelineEvent | null {
  const { heading, description } = parseKeyValueLine(line);
  if (!heading) return null;

  const timeOfDay = extractTimeOfDay(line) ?? extractTimeOfDay(description ?? "");
  const iconKey = inferIconKey(heading);
  const side: "left" | "right" = index % 2 === 0 ? "left" : "right";

  return {
    ...(timeOfDay && { timeOfDay }),
    ...(iconKey && { iconKey }),
    heading,
    ...(description && { description }),
    side,
  };
}

/** bullets → events (최대 MAX_EVENTS_PER_DAY개) */
function bulletsToEvents(bullets: string[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (let i = 0; i < Math.min(bullets.length, MAX_EVENTS_PER_DAY); i++) {
    const ev = lineToEvent(bullets[i], i);
    if (ev && ev.heading) events.push(ev);
  }
  return events;
}

/** Day 제목: 첫 이벤트 heading 또는 첫 문장, 없으면 생략(UI에서 "Day {n}" 사용) */
function inferDayTitle(dayNumber: number, events: TimelineEvent[], rawBullets: string[]): string | undefined {
  const firstHeading = events[0]?.heading?.trim();
  if (firstHeading && firstHeading.length <= TITLE_MAX_LEN) return firstHeading;
  const firstLine = rawBullets[0]?.trim();
  if (firstLine) return firstLine.slice(0, TITLE_MAX_LEN);
  return undefined;
}

/** parseTimelineDays 결과 → TimelineDay 한 개 */
function toTimelineDay(
  parsed: { day: number; headline: string; bullets: string[] },
): TimelineDay {
  const events = bulletsToEvents(parsed.bullets);
  const title = inferDayTitle(parsed.day, events, parsed.bullets);

  return {
    day: parsed.day,
    title,
    imageUrl: null,
    events,
  };
}

/**
 * Product → TimelineModel (STEP 2)
 * - itinerary_v2_json 우선 → itinerary_days_json → detailed_schedule/itinerary 텍스트 fallback
 * - [STEP 4] Day 이미지 fallback: coverImageUrl → itinerary_media_json[day] → product.image_url → UI placeholder
 */
export function mapProductToTimelineModel(product: Product | null): TimelineModel {
  if (!product || typeof product !== "object") {
    return { days: [] };
  }

  const v2 = product.itinerary_v2_json;
  const hasV2 = v2 && Array.isArray(v2.days) && v2.days.length > 0;

  if (hasV2) {
    const media = product.itinerary_media_json;
    const fallbackUrl = product.image_url?.trim() || null;
    return {
      days: v2.days.map((d) => {
        const dayKey = String(d.day);
        const imageUrl =
          d.coverImageUrl?.trim() ||
          (media && typeof media[dayKey] === "string" && media[dayKey].trim() ? media[dayKey].trim() : null) ||
          fallbackUrl;
        return {
          day: d.day,
          dateText: d.dateText,
          title: d.title,
          imageUrl: imageUrl || null,
          events: d.events.map((e, i) => ({
            timeOfDay: e.timeOfDay,
            timeText: e.timeText,
            iconKey: e.iconKey,
            heading: e.heading,
            description: e.description,
            side: (i % 2 === 0 ? "left" : "right") as "left" | "right",
          })),
        };
      }),
    };
  }

  const structured = product.itinerary_days_json;
  const hasStructured = Array.isArray(structured) && structured.length > 0;

  let model: TimelineModel;

  if (hasStructured) {
    const media = product.itinerary_media_json;
    const fallbackUrl = product.image_url?.trim() || null;
    model = {
      days: structured.map((d) => {
        const dayKey = String(d.day);
        const imageUrl =
          d.coverImageUrl && d.coverImageUrl.trim()
            ? d.coverImageUrl.trim()
            : media && typeof media[dayKey] === "string" && media[dayKey].trim()
              ? media[dayKey].trim()
              : fallbackUrl;
        return {
          day: d.day,
          dateText: d.dateText,
          title: d.title,
          imageUrl: imageUrl || null,
          events: d.events.map((e, i) => ({
            timeOfDay: e.timeOfDay,
            timeText: (e as { timeText?: string }).timeText,
            iconKey: e.iconKey,
            heading: e.heading,
            description: e.description,
            side: (i % 2 === 0 ? "left" : "right") as "left" | "right",
          })),
        };
      }),
    };
  } else {
    const raw = product.detailed_schedule?.trim() || product.itinerary?.trim() || "";
    model = getTimelineModelFromSchedule(raw);
    const media = product.itinerary_media_json;
    const fallbackUrl = product.image_url?.trim() || null;
    model.days.forEach((d) => {
      const dayKey = String(d.day);
      const dayUrl =
        media && typeof media[dayKey] === "string" && media[dayKey].trim()
          ? media[dayKey].trim()
          : fallbackUrl;
      d.imageUrl = dayUrl || null;
    });
  }

  return model;
}

/**
 * raw 일정 텍스트 → TimelineModel
 */
export function getTimelineModelFromSchedule(rawSchedule: string): TimelineModel {
  const raw = rawSchedule?.trim() || "";
  const parsed = parseTimelineDays(raw);
  if (parsed.length === 0) return { days: [] };

  const days: TimelineDay[] = parsed.map(toTimelineDay);
  return { days };
}

/** TimelineModel → 구조화 일정 (Admin 편집용) */
export function timelineModelToStructuredDays(model: TimelineModel | null): ItineraryStructuredDay[] {
  if (!model?.days?.length) return [];
  return model.days.map((d) => ({
    day: d.day,
    dateText: d.dateText,
    title: d.title,
    coverImageUrl: d.imageUrl ?? undefined,
    events: d.events.map((e) => ({
      heading: e.heading,
      description: e.description,
      timeOfDay: e.timeOfDay,
      iconKey: e.iconKey,
    })),
  }));
}

/** 구조화 일정 → 레거시 detailed_schedule 텍스트 (Admin 저장 시 동기화용) */
export function serializeStructuredDaysToSchedule(days: ItineraryStructuredDay[]): string {
  if (!days?.length) return "";
  return days
    .map((d) => {
      const label = `${d.day}일차`;
      const lines = d.events.map((e) =>
        e.description?.trim() ? `${e.heading}: ${e.description.trim()}` : e.heading,
      );
      return lines.length ? `[${label}]\n${lines.join("\n")}` : `[${label}]`;
    })
    .join("\n\n");
}

/** ItineraryV2 → TimelineModel (Admin 미리보기·상세 노출용). [STEP 4] Day 이미지는 coverImageUrl만 설정하고, fallback은 호출측에서 fallbackImageUrl(product.image_url)로 적용 */
export function itineraryV2ToTimelineModel(v2: ItineraryV2 | null | undefined): TimelineModel {
  if (!v2?.days?.length) return { days: [] };
  return {
    days: v2.days.map((d) => ({
      day: d.day,
      dateText: d.dateText,
      title: d.title,
      imageUrl: d.coverImageUrl?.trim() || null,
      events: d.events.map((e, i) => ({
        timeOfDay: e.timeOfDay,
        timeText: e.timeText,
        iconKey: e.iconKey,
        heading: e.heading,
        description: e.description,
        side: (i % 2 === 0 ? "left" : "right") as "left" | "right",
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Legacy: TimelineViewModel (ScheduleTimelineV2 호환)
// ---------------------------------------------------------------------------

/** 일정 하루 단위 (레거시 시각화용) */
export type TimelineDayModel = {
  day: number;
  headline: string;
  bullets: string[];
  imageUrl?: string | null;
};

/** 상세 타임라인 시각화용 ViewModel (레거시) */
export type TimelineViewModel = {
  days: TimelineDayModel[];
};

/**
 * TimelineModel → TimelineViewModel (기존 ScheduleTimelineV2 호환)
 */
export function timelineModelToViewModel(model: TimelineModel | null): TimelineViewModel | null {
  if (!model?.days?.length) return null;

  const days: TimelineDayModel[] = model.days.map((d) => ({
    day: d.day,
    headline: d.title || `Day ${d.day}`,
    bullets: d.events.flatMap((e) => (e.description ? [e.description] : [e.heading])),
    imageUrl: d.imageUrl ?? null,
  }));

  return { days };
}

/**
 * Product → TimelineViewModel (레거시, ScheduleTimelineV2용)
 */
export function getLegacyTimelineViewModel(product: Product | null): TimelineViewModel | null {
  return timelineModelToViewModel(mapProductToTimelineModel(product));
}

/**
 * raw 일정 → TimelineViewModel (레거시)
 */
export function getLegacyTimelineViewModelFromSchedule(rawSchedule: string): TimelineViewModel | null {
  return timelineModelToViewModel(getTimelineModelFromSchedule(rawSchedule));
}

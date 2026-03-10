/**
 * Day별 일정 요약 (2~4개 키워드). 스캔용.
 * 기존 TimelineEvent[]만 사용, 원본 구조 유지.
 */

import type { TimelineEvent } from "./mapProductToTimelineModel";

const MAX_SUMMARY_ITEMS = 4;
const MAX_ITEM_LENGTH = 24;

/**
 * 해당 Day 이벤트 중 상위 2~4개를 요약 문자열로 반환.
 * 우선순위: heading 사용, 너무 길면 잘라냄. description은 첫 줄만 최대 20자.
 */
export function buildDaySummary(events: TimelineEvent[]): string[] {
  if (!Array.isArray(events) || events.length === 0) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < events.length && out.length < MAX_SUMMARY_ITEMS; i++) {
    const ev = events[i];
    const heading = ev.heading?.trim();
    if (!heading) continue;
    let text = heading.length <= MAX_ITEM_LENGTH ? heading : `${heading.slice(0, MAX_ITEM_LENGTH - 1)}…`;
    if (seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

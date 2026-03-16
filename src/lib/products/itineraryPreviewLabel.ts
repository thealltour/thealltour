/**
 * PR23: 일정 미리보기용 Day 대표 문구 생성.
 * 이동/출발·도착보다 관광·체험 중심 문구를 우선하고, 없을 때만 fallback.
 */

import type { TimelineDay, TimelineEvent } from "@/lib/products/mapProductToTimelineModel";

const MAX_PARTS = 2;
const MAX_LENGTH_PER_PART = 22;

/** 이벤트 텍스트에서 노출용 짧은 문구 추출 (군더더기 제거) */
function shortenForPreview(text: string): string {
  let s = (text || "").trim();
  if (!s) return "";

  // 자주 나오는 접두어 제거
  const prefixes = [
    /^현지\s*가이드\s*미팅\s*후\s*/i,
    /^전용\s*차량을\s*이용하여\s*/i,
    /^전용\s*차량으로\s*/i,
    /^차량으로\s*이동\s*후\s*/i,
    /^이동\s*후\s*/i,
    /^.*?이동\s*후\s*/i,
    /^도착\s*후\s*/i,
    /^체크인\s*후\s*/i,
  ];
  for (const re of prefixes) {
    s = s.replace(re, "").trim();
  }

  // "~관광 진행", "~체험 진행" 등 접미어 정리
  s = s.replace(/\s*(관광|체험|방문)\s*진행\s*\.?\s*$/i, " $1").trim();
  s = s.replace(/\s*\.\s*$/, "").trim();

  if (s.length <= MAX_LENGTH_PER_PART) return s;
  // 어절 단위로 자르기
  const words = s.slice(0, MAX_LENGTH_PER_PART + 5).split(/\s+/);
  let out = "";
  for (const w of words) {
    if ((out + " " + w).trim().length <= MAX_LENGTH_PER_PART) {
      out = (out + " " + w).trim();
    } else break;
  }
  return out || s.slice(0, MAX_LENGTH_PER_PART);
}

/** 한 이벤트의 대표 문구 (heading vs description: 구체적 내용 우선) */
function eventToDisplayText(e: TimelineEvent): string {
  const desc = (e.description || "").trim();
  const head = (e.heading || "").trim();
  if (desc && desc.length <= 60) return desc;
  if (head) return head;
  return desc || "";
}

/** 관광/체험/방문 등 경험 중심 문구인지 */
function isExperienceLike(text: string): boolean {
  const t = text.replace(/\s+/g, " ");
  return (
    /관광|체험|방문|사원|보호소|투어|시티투어|마사지|클래스|전통|안마|탐방|시내|골프|티오프|라운드|식사|조식|중식|석식|디너/i.test(
      t,
    ) && !/^(이동|출발|도착|항공|비행|기내|체크인|숙소|숙박)\s*[:：]?\s*$/i.test(t)
  );
}

/** 도시 간 이동 문구인지 (예: 인천 → 치앙마이, 치앙라이 이동) */
function isCityMove(text: string): boolean {
  const t = text.replace(/\s+/g, " ");
  return (
    (/→|경유|이동/.test(t) && /[가-힣a-zA-Z]/.test(t)) ||
    /(치앙마이|방콕|파타야|치앙라이|인천|김해|제주|세부|다낭|호치민|하노이|싱가포르|쿠알라룸푸르|발리|마닐라)/i.test(
      t,
    )
  );
}

/** 출발/도착/귀국 등 이동만 있는지 */
function isDepartureOrArrival(text: string): boolean {
  const t = text.replace(/\s+/g, " ");
  return (
    /출발|도착|귀국|인천\s*공항|탑승|출국|복귀|체크인|해산/.test(t) &&
    !/관광|체험|방문|사원|투어|마사지|보호소/.test(t)
  );
}

/** 장소명 추출: "인천공항 출발" → "인천", "치앙마이 도착" → "치앙마이" */
function extractPlaceName(text: string): string {
  const t = (text || "").trim().replace(/\s+/g, " ");
  const out = t
    .replace(/\s*(출발|도착|탑승|출국|복귀|해산|공항)\s*\.?\s*$/gi, "")
    .replace(/^.*?(\d+일차)\s*/i, "")
    .trim();
  if (out.length > 0 && out.length <= 15) return out;
  const cityMatch = t.match(
    /(인천|김해|제주|세부|다낭|방콕|치앙마이|치앙라이|파타야|호치민|하노이|싱가포르|쿠알라룸푸르|발리|마닐라|오사카|도쿄|다카마쓰)/i,
  );
  return cityMatch ? cityMatch[1] : out.slice(0, 10);
}

/** 출발/도착 문구 배열을 "인천 → 치앙마이" 형태로 한 줄 요약 */
function formatDepartureArrivalFallback(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return shortenForPreview(items[0]);
  const places = items.map((raw) => extractPlaceName(raw)).filter(Boolean);
  const uniq: string[] = [];
  for (const p of places) {
    if (p && !uniq.includes(p)) uniq.push(p);
  }
  if (uniq.length >= 2) return `${uniq[0]} → ${uniq[1]}`;
  if (uniq.length === 1) return uniq[0];
  return shortenForPreview(items[0]);
}

/** TimelineDay에서 미리보기용 한 줄 문구 생성 (경험 우선, fallback 이동/출도착) */
export function getDayPreviewLabel(day: TimelineDay): string {
  if (!day?.events?.length) {
    return day?.title?.trim() ? shortenForPreview(day.title) : "일정";
  }

  const experience: string[] = [];
  const cityMoves: string[] = [];
  const departureArrival: string[] = [];

  for (const e of day.events) {
    const raw = eventToDisplayText(e);
    if (!raw) continue;
    const short = shortenForPreview(raw);
    if (!short) continue;

    if (isExperienceLike(raw)) {
      experience.push(short);
    } else if (isCityMove(raw)) {
      cityMoves.push(short);
    } else if (isDepartureOrArrival(raw)) {
      departureArrival.push(short);
    } else {
      // 미분류: 관광/체험 키워드가 조금이라도 있으면 경험으로
      if (/관광|체험|방문|사원|투어|마사지|보호소|시내|탐방/i.test(raw)) {
        experience.push(short);
      } else {
        cityMoves.push(short);
      }
    }
  }

  const parts: string[] = [];
  for (const s of experience.slice(0, MAX_PARTS)) {
    if (s && !parts.includes(s)) parts.push(s);
  }
  if (parts.length < MAX_PARTS && cityMoves.length > 0) {
    const move = cityMoves[0];
    if (move && !parts.includes(move)) parts.push(move);
  }
  if (parts.length === 0 && departureArrival.length > 0) {
    parts.push(formatDepartureArrivalFallback(departureArrival));
  }
  if (parts.length === 0 && cityMoves.length > 0) {
    parts.push(shortenForPreview(cityMoves[0]));
  }
  if (parts.length === 0 && day.title?.trim()) {
    parts.push(shortenForPreview(day.title));
  }
  if (parts.length === 0) {
    const first = eventToDisplayText(day.events[0]);
    if (first) parts.push(shortenForPreview(first));
  }
  if (parts.length === 0) return "일정";

  return parts.slice(0, MAX_PARTS).join(" · ");
}

/** 레거시 텍스트 일정용: content 첫 줄들 중 경험 중심 문구 우선, 없으면 첫 줄 */
export function getLegacyDayPreviewLabel(label: string, content: string): string {
  const lines = (content || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return (label || "일정").trim();

  const experience: string[] = [];
  const others: string[] = [];
  for (const line of lines) {
    const short = shortenForPreview(line);
    if (!short) continue;
    if (isExperienceLike(line)) {
      experience.push(short);
    } else {
      others.push(short);
    }
  }

  const pick = experience.length > 0 ? experience[0] : others[0] || lines[0];
  return shortenForPreview(pick);
}

/** 한 줄이 이동 정보인지 (출발/도착/이동 등) */
function isMovementLine(text: string): boolean {
  const t = (text || "").trim();
  return isDepartureOrArrival(t) || isCityMove(t) || /^이동\s*[:：]?/i.test(t) || /항공|비행|차량|버스/i.test(t);
}

/** PR32: 레거시 일정 content를 핵심 일정 / 이동 정보로 분리 */
export function parseDayContentToSections(content: string): {
  experience: string[];
  movement: string[];
} {
  const lines = (content || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const experience: string[] = [];
  const movement: string[] = [];
  for (const line of lines) {
    const short = shortenForPreview(line);
    if (!short) continue;
    if (isMovementLine(line)) {
      movement.push(short);
    } else {
      experience.push(short);
    }
  }
  return { experience, movement };
}

/** PR32: TimelineDay의 이벤트를 핵심 일정 / 이동 정보로 분리 */
export function getDaySectionsForTimeline(day: TimelineDay): {
  experience: string[];
  movement: string[];
} {
  if (!day?.events?.length) {
    return { experience: [], movement: [] };
  }
  const experience: string[] = [];
  const movement: string[] = [];
  for (const e of day.events) {
    const raw = eventToDisplayText(e);
    if (!raw) continue;
    const short = shortenForPreview(raw);
    if (!short) continue;
    if (isExperienceLike(raw)) {
      experience.push(short);
    } else if (isDepartureOrArrival(raw) || isCityMove(raw)) {
      movement.push(short);
    } else if (/이동|항공|비행|차량|버스/i.test(raw)) {
      movement.push(short);
    } else {
      experience.push(short);
    }
  }
  return { experience, movement };
}

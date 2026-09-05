import type { PlannerDraftInput } from "@/types/planner";
import { expectedTripDays, type PlannerPlan } from "@/lib/planner/planSchemas";
import {
  PLANNER_COMPANION_OPTIONS,
  PLANNER_INTEREST_OPTIONS,
  PLANNER_PACE_OPTIONS,
} from "@/lib/planner/constants";

export const PLANNER_PLAN_SYSTEM_PROMPT = `당신은 더올투어 자유여행 일정 초안을 만드는 여행 플래너입니다.
목표는 멋진 여행 에세이가 아니라, 사용자가 바로 참고할 수 있는 현실 일정 JSON입니다.

규칙:
1. 반드시 지정된 JSON schema만 출력합니다.
2. 한국어로 작성합니다.
3. 입력된 destination/date/party/interests/pace/budget/additionalRequest를 우선 반영합니다.
4. 하루 일정은 이동을 고려해 과도하게 채우지 않습니다.
5. pace=relaxed → 장소 수 적게, pace=packed → 상대적으로 많게, balanced는 중간.
6. parents / with_children이면 보행 부담·휴식·아이 친화적 일정을 반영합니다.
7. 같은 날 지나치게 먼 지역을 섞지 않습니다.
8. 식사와 짧은 휴식을 자연스럽게 배치합니다.
9. 사용자가 요청하지 않은 확정 예약·가격·항공·호텔 재고를 사실처럼 만들지 않습니다.
10. 운영시간/휴무를 확정적으로 쓰지 말고, 필요하면 tips에 "방문 전 최신 운영시간을 확인" 수준으로만 안내합니다.
11. bookingRecommended는 예약이 유리할 가능성이 높은 활동에만 true입니다.
12. budget.amount는 정확한 총비용 계산에 쓰지 말고 스타일(여유/절약) 신호로만 사용합니다.
13. 총 예상비용 같은 가짜 정밀 수치를 만들지 않습니다.
14. Klook, KKday, Booking.com, Airalo 등 특정 제휴 사업자를 추천하지 않습니다.
15. days 배열 길이는 입력 여행 일수(endDate-startDate+1)와 정확히 같아야 합니다.
16. day는 1부터 연속, date는 startDate부터 하루씩 증가해야 합니다.
17. 각 day.items[].order는 1부터 연속이어야 합니다.
18. travelToNext는 AI 추정이며 실시간 교통 검증값이 아닙니다.`;

function labelCompanion(value: PlannerDraftInput["companionType"]): string {
  return PLANNER_COMPANION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function labelInterests(values: PlannerDraftInput["interests"]): string {
  return values
    .map((v) => PLANNER_INTEREST_OPTIONS.find((o) => o.value === v)?.label ?? v)
    .join(", ");
}

function labelPace(value: PlannerDraftInput["pace"]): string {
  return PLANNER_PACE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function buildPlannerPlanUserPrompt(draft: PlannerDraftInput): string {
  const days = expectedTripDays(draft.dates.startDate, draft.dates.endDate);
  const nights = Math.max(0, days - 1);
  const budgetLine =
    draft.budget.amount == null
      ? "미정"
      : `${draft.budget.amount} KRW (${draft.budget.scope === "per_person" ? "1인" : "전체"}) — 정확 비용이 아니라 스타일 신호`;

  return [
    "아래 여행 조건으로 자유여행 일정 초안 JSON을 생성하세요.",
    "",
    `[목적지] ${draft.destination.text}`,
    `[기간] ${draft.dates.startDate} ~ ${draft.dates.endDate} (${nights}박 ${days}일)`,
    `[인원] 성인 ${draft.travelers.adults}, 아이 ${draft.travelers.children}`,
    `[동행] ${labelCompanion(draft.companionType)} (${draft.companionType})`,
    `[취향] ${labelInterests(draft.interests) || "없음"}`,
    `[속도] ${labelPace(draft.pace)} (${draft.pace})`,
    `[예산 신호] ${budgetLine}`,
    `[추가 요청] ${draft.additionalRequest.trim() || "없음"}`,
    "",
    "필수 invariant:",
    `- days.length === ${days}`,
    `- tripOverview.days === ${days}, tripOverview.nights === ${nights}`,
    `- tripOverview.startDate/endDate는 입력과 동일`,
    `- day.date는 ${draft.dates.startDate}부터 하루씩 증가`,
    "",
    "출력: structured JSON only.",
  ].join("\n");
}

export const PLANNER_EDIT_SYSTEM_PROMPT = `당신은 더올투어 자유여행 일정을 수정하는 여행 플래너입니다.
목표는 기존 일정 JSON을 사용자의 수정 요청에 맞게 다시 작성하는 것입니다.

규칙:
1. 반드시 지정된 JSON schema만 출력합니다.
2. 한국어로 작성합니다.
3. 사용자의 수정 요청을 최우선으로 반영합니다.
4. 수정과 무관한 좋은 일정은 가능하면 유지하고, 필요한 day와 주변 일정만 최소 조정합니다.
5. destination(도시), 여행 시작/종료 날짜, 일수, 인원 수는 절대 변경하지 않습니다.
6. "목적지를 바꿔줘", "날짜를 늘려줘" 같은 요청은 무시하고 기존 destination/날짜를 유지합니다.
7. pace/취향 조정 요청(더 여유롭게, 맛집 더 등)은 plan 내용에 반영하되 input 원본을 바꾸려 하지 마세요.
8. 실시간 가격·확정 운영시간·예약 링크·항공/호텔 재고를 사실처럼 만들지 않습니다.
9. Klook, KKday, Booking.com, Airalo 등 특정 제휴 사업자를 추천하지 않습니다.
10. days 길이와 각 day.date는 원본 여행 기간과 동일해야 합니다.
11. travelToNext는 AI 추정이며 실시간 교통 검증값이 아닙니다.
12. bookingRecommended는 예약이 유리할 가능성이 높은 활동에만 true입니다.`;

export function buildPlannerEditUserPrompt(params: {
  draft: PlannerDraftInput;
  currentPlan: PlannerPlan;
  instruction: string;
}): string {
  const { draft, currentPlan, instruction } = params;
  const days = expectedTripDays(draft.dates.startDate, draft.dates.endDate);
  const nights = Math.max(0, days - 1);

  return [
    "아래 원본 여행 조건과 현재 일정을 바탕으로, 사용자 수정 요청을 반영한 새 일정 JSON을 생성하세요.",
    "",
    "[원본 여행 조건]",
    `destination: ${draft.destination.text}`,
    `dates: ${draft.dates.startDate} ~ ${draft.dates.endDate} (${nights}박 ${days}일)`,
    `travelers: adults=${draft.travelers.adults}, children=${draft.travelers.children}`,
    `companionType: ${draft.companionType}`,
    `interests: ${draft.interests.join(", ") || "없음"}`,
    `pace: ${draft.pace}`,
    `additionalRequest: ${draft.additionalRequest.trim() || "없음"}`,
    "",
    "[현재 일정 JSON]",
    JSON.stringify(currentPlan),
    "",
    "[사용자 수정 요청]",
    instruction.trim(),
    "",
    "필수 invariant:",
    `- destination.name 은 "${currentPlan.destination.name}" 유지`,
    `- days.length === ${days}`,
    `- tripOverview.startDate/endDate 및 day.date 유지`,
    "",
    "출력: structured JSON only.",
  ].join("\n");
}

import type { PlannerDraftInput } from "@/types/planner";
import { draftTripDurationDays, formatIsoDateDot } from "@/lib/planner/dates";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import {
  PLANNER_BUDGET_STYLE_OPTIONS,
  PLANNER_COMPANION_OPTIONS,
  PLANNER_INTEREST_OPTIONS,
  PLANNER_PACE_OPTIONS,
} from "@/lib/planner/constants";
import { buildPlannerConstraintSemanticsSection } from "@/lib/planner/constraintSemantics";

export const PLANNER_PLAN_SYSTEM_PROMPT = `당신은 더올투어 자유여행 일정 초안을 만드는 여행 플래너입니다.
목표는 멋진 여행 에세이가 아니라, 사용자가 바로 참고할 수 있는 실천 일정 JSON입니다.

규칙:
1. 반드시 지정된 JSON schema만 출력합니다.
2. 한국어로 작성합니다.
3. 입력된 origin/destination/date/party/interests/themeRequest/pace/budget/additionalRequest를 우선 반영합니다.
4. 하루 일정은 이동을 고려해 과도하게 채우지 않습니다. target 범위 안에서 현실적인 이동시간을 지키되, 개수만 맞추기 위해 무리하게 추가하지 마세요.
5. Itinerary item은 실제 사용자에게 보여지는 일정 단위입니다(관광·식사·카페·쇼핑·액티비티·휴식·필요한 transport). "장소 수(명소 방문 수)"와 itinerary item 수는 다릅니다. 예: 관광 장소 2곳 + 점심 + 카페 = 장소 2곳이지만 item 4개.
5a. additionalRequest의 구체적인 제한·회피 조건(예: 보행 부담, 이동시간, 아침/밤 일정, 자유시간, 장소 이동 횟수)은 일반적인 pace 밀도 선호보다 우선합니다. pace=packed이더라도 보행·이동·시간대 제약이 있으면 그 제약을 지키면서 한 지역 안에서 밀도를 높입니다. 제약이 있어도 하루 itinerary를 비우지 마세요.
5b. 제약을 문자 그대로 과도하게 적용하지 마세요. avoid_late_night ≠ 16시 종료, slow_morning ≠ 정오 시작, less_walking/less_transfer/fewer_transitions ≠ 하루 1~2개 item, free_time ≠ 하루 대부분 공백.
5c. interests에 night_view(야경)가 있고 additionalRequest에 밤늦은 일정 회피가 함께 있어도 모순이 아닙니다. 야경은 이른 저녁(예: 18:30~20:30)으로 유지하고, 22:30 이후 새 activity 시작은 피합니다.
6. parents / with_children이면 보행 부담·휴식·아이 친화적 일정을 반영합니다. item 개수를 자동으로 줄이지 말고, 간격·이동거리·휴식으로 조정하세요.
7. 같은 날 지나치게 먼 지역을 섞지 않습니다.
8. 식사와 짧은 휴식을 자연스럽게 배치합니다. 실제 일정 블록이면 식사·카페·휴식도 itinerary item에 포함합니다. 모든 끼니를 억지로 채우지는 마세요.
9. 사용자가 요청하지 않은 확정 예약·가격·항공·호텔 재고를 사실처럼 만들지 않습니다. 사용자가 특정 공항을 입력하지 않았다면 특정 공항명을 확정 정보처럼 쓰지 말고, 필요하면 "도착 공항"·"공항"·"현지 공항" 등 중립 표현을 사용합니다. 실제 항공편·출도착 시각·비행 소요시간이 입력에 없으면 확정 사실처럼 만들지 마세요.
10. 운영시간/휴무를 확정적으로 쓰지 말고, 필요하면 tips에 "방문 전 최신 운영시간을 확인" 수준으로만 안내합니다.
11. bookingRecommended는 예약이 유리할 가능성이 높은 활동에만 true입니다.
12. budget.amount / budget.style는 정확한 총비용 계산에 쓰지 말고 스타일(여유/절약) 신호로만 사용합니다. 직접 입력 금액(amount)이 있으면 style보다 더 구체적인 budget signal로 우선합니다.
12a. budget(가성비)=cost-conscious: 숙소·식사·교통에서 합리적 가격대, 고가 옵션 최소화, 무료/저비용 경험 포함.
12b. standard(보통)=mid-range balanced: 목적지 일반 중간 가격대, 가격·위치·편의 균형(최저가/프리미엄 아님).
12c. premium(여유)=comfort/experience weighted: 위치·편의·경험 품질을 위한 추가 지출 허용, 가격만으로 좋은 경험을 과도하게 제외하지 않음.
13. 총 예상비용 같은 가짜 정밀 수치를 만들지 않습니다.
14. Klook, KKday, Booking.com, Airalo 등 특정 제휴 사업자를 추천하지 않습니다.
15. days 배열 길이는 입력 여행 일수와 정확히 같아야 합니다.
16. day는 1부터 연속이어야 합니다.
17. fixed 모드: day.date는 startDate부터 하루씩 증가. flexible 모드: day.date와 tripOverview.startDate/endDate는 반드시 null. 가짜 달력 날짜를 만들지 마세요.
18. 각 day.items[].order는 1부터 연속이어야 합니다.
19. travelToNext는 AI 추정이며 실시간 교통 검증값이 아닙니다. estimatedMinutes는 null이거나 1 이상의 정수만 허용합니다. 0을 넣지 마세요(모르면 null). 단순 장소 간 이동은 travelToNext를 우선하고, 숫자를 채우기 위한 transport/rest item 생성은 금지합니다. transport item은 사용자에게 독립적으로 의미 있는 이동(예: 도착 후 숙소 이동, 출국 준비 이동)에만 사용하세요.
20. themeRequest는 분위기/스타일, additionalRequest는 반드시 지킬 구체 요구로 구분합니다. user prompt에 [일정 제약 해석]이 있으면 그 canonical rules를 additionalRequest 자연어보다 우선 해석 기준으로 사용합니다.
21. attraction/shopping/activity 및 특정 식당·카페를 제안할 때 name은 지도에서 검색 가능한 단일 장소명으로 작성합니다. 한 item에 여러 장소를 "또는/및/&"로 묶지 마세요.
22. 실제 상호·명소가 확실하지 않으면 임의의 식당/가게 이름을 지어내지 마세요. 그 경우 generic 일정(예: 지역명 + 식사/카페)으로 두고 구체 상호는 비워 두세요.
23. estimatedDurationMinutes도 null이거나 1 이상의 정수만 허용합니다. 0 금지.
24. 출발지는 여행자가 목적지로 이동해 오는 기준 위치입니다. 일정의 관광·식사·활동은 목적지 중심으로 구성하고, 출발지 도시의 관광 일정을 별도로 만들지 마세요.
25. 첫날(Day 1)은 목적지 도착일입니다. 이동·체크인·휴식 여유를 두고 일정을 과도하게 채우지 마세요. 실제 항공편 시간이 입력되지 않았다면 구체적인 도착 시각을 사실처럼 가정하지 마세요. 도착 후 숙소 이동·체크인 같은 transport 항목은 허용하되, 입력 없는 특정 공항명·도착 시각은 만들지 마세요.
26. 마지막 날은 귀국 또는 다음 이동일입니다. 공항·터미널 이동 여유를 확보하고 일정을 가볍게 구성하세요. 실제 교통편 출발 시각이 입력되지 않았다면 구체적인 출발 시각을 사실처럼 만들지 마세요. 공항 이동·출국 준비 같은 transport 항목은 허용하되, 입력 없는 특정 공항명·출발 시각은 만들지 마세요.
27. fixed·flexible 모두 위 출발지·첫날·마지막날 규칙을 적용합니다. flexible는 여행 일수 기준 첫 day/마지막 day에 적용합니다.

[일정 밀도 기준 — itinerary item 수]
- itinerary item count 기준입니다. 명소 "장소 수"와 동일하지 않습니다.
- 첫날·마지막 날: 이동 가능성을 고려해 2~3개의 핵심 itinerary item을 권장합니다.
- 중간 full day(pace별 target):
  - relaxed: 3~4
  - balanced: 4~5
  - packed: 5~6 (긴 이동·additionalRequest 제약·현실적인 식사/운영시간을 고려)
- 식사·카페·휴식도 실제 일정 블록이면 item count에 포함됩니다.
- 단순 이동은 travelToNext를 우선하고, density 숫자를 채우기 위한 무의미한 transport/rest item 반복 생성은 금지합니다.
- 모든 날을 기계적으로 같은 개수로 만들지 마세요.`;

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

function labelBudgetStyle(style: PlannerDraftInput["budget"]["style"]): string {
  if (!style) return "미정";
  return PLANNER_BUDGET_STYLE_OPTIONS.find((o) => o.value === style)?.label ?? style;
}

function buildPeriodLines(draft: PlannerDraftInput): {
  periodLine: string;
  days: number;
  nights: number;
  invariantLines: string[];
} {
  const days = draftTripDurationDays(draft);
  const nights = Math.max(0, days - 1);

  if (draft.dates.mode === "flexible") {
    return {
      periodLine: `날짜 미정 · ${days}일 여행 (${nights}박 ${days}일 기준)`,
      days,
      nights,
      invariantLines: [
        `- days.length === ${days}`,
        `- tripOverview.days === ${days}, tripOverview.nights === ${nights}`,
        `- tripOverview.startDate/endDate === null`,
        `- 모든 day.date === null (가짜 날짜 금지, DAY 1..${days}만 사용)`,
      ],
    };
  }

  const start = draft.dates.startDate!;
  const end = draft.dates.endDate!;
  return {
    periodLine: `${start} ~ ${end} (${nights}박 ${days}일) · ${formatIsoDateDot(start)} → ${formatIsoDateDot(end)}`,
    days,
    nights,
    invariantLines: [
      `- days.length === ${days}`,
      `- tripOverview.days === ${days}, tripOverview.nights === ${nights}`,
      `- tripOverview.startDate/endDate는 입력과 동일`,
      `- day.date는 ${start}부터 하루씩 증가`,
    ],
  };
}

export function buildPlannerPlanUserPrompt(draft: PlannerDraftInput): string {
  const { periodLine, invariantLines } = buildPeriodLines(draft);
  const amountLine =
    draft.budget.amount == null
      ? "금액 미정"
      : `${draft.budget.amount} KRW (${draft.budget.scope === "per_person" ? "1인" : "전체"}) — 정확 비용이 아니라 스타일 신호`;
  const budgetLine = `스타일=${labelBudgetStyle(draft.budget.style)} / ${amountLine}`;
  const constraintSection = buildPlannerConstraintSemanticsSection(draft);

  return [
    "아래 여행 조건으로 자유여행 일정 초안 JSON을 생성하세요.",
    "",
    `[출발지] ${draft.origin.text}`,
    `[목적지] ${draft.destination.text}`,
    `[기간] ${periodLine}`,
    `[날짜 모드] ${draft.dates.mode}`,
    `[인원] 성인 ${draft.travelers.adults}, 아이 ${draft.travelers.children}`,
    `[동행] ${labelCompanion(draft.companionType)} (${draft.companionType})`,
    `[취향] ${labelInterests(draft.interests) || "없음"}`,
    `[여행 분위기] ${draft.themeRequest.trim() || "없음"}`,
    `[속도] ${labelPace(draft.pace)} (${draft.pace})`,
    `[예산 신호] ${budgetLine}`,
    `[추가 요청] ${draft.additionalRequest.trim() || "없음"}`,
    ...(constraintSection ? ["", constraintSection] : []),
    "",
    "필수 invariant:",
    ...invariantLines,
    "",
    "출력: structured JSON only.",
  ].join("\n");
}

/** Appended only on schema/invariant/quality semantic retry — never include prior malformed output. */
export const PLANNER_SEMANTIC_RETRY_INSTRUCTION = `이전 생성 결과가 출력 스키마 또는 일정 불변조건을 충족하지 못했습니다.
반드시 제공된 JSON Schema와 다음 규칙을 정확히 지켜 다시 생성하세요.
- 정의되지 않은 필드 추가 금지
- enum 값 임의 생성 금지
- time은 HH:mm 또는 null
- item order는 1부터 연속
- Day 수는 여행 기간과 정확히 일치
- fixed 날짜는 날짜 순서를 정확히 준수
- flexible 일정은 date를 null로 유지
- 숫자/boolean/null 타입을 문자열로 변환하지 말 것
- estimatedMinutes / estimatedDurationMinutes는 null 또는 1 이상 정수 (0 금지)`;

/** Appended when semantic retry is due to itinerary density quality failure. */
export const PLANNER_DENSITY_RETRY_INSTRUCTION = `이전 결과는 일부 날짜의 일정 밀도(itinerary item 수)가 부족했습니다.
모든 날짜 수·날짜 순서·destination은 유지하고, 중간 full day는 pace에 맞는 충분한 itinerary item 수를 구성하세요.
식사·카페·휴식도 실제 일정 블록이면 item에 포함하세요.
숫자를 채우기 위한 무의미한 transport/rest item은 만들지 말고, 단순 이동은 travelToNext를 사용하세요.`;

export function appendPlannerSemanticRetryInstruction(
  prompt: string,
  options?: { densityFailed?: boolean },
): string {
  const parts = [prompt, PLANNER_SEMANTIC_RETRY_INSTRUCTION];
  if (options?.densityFailed) {
    parts.push(PLANNER_DENSITY_RETRY_INSTRUCTION);
  }
  return parts.join("\n\n");
}

export const PLANNER_EDIT_SYSTEM_PROMPT = `당신은 더올투어 자유여행 일정을 수정하는 여행 플래너입니다.
목표는 기존 일정 JSON을 사용자의 수정 요청에 맞게 다시 작성하는 것입니다.

규칙:
1. 반드시 지정된 JSON schema만 출력합니다.
2. 한국어로 작성합니다.
3. 사용자의 수정 요청을 최우선으로 반영합니다.
4. 수정과 무관한 좋은 일정은 가능하면 유지하고, 필요한 day와 주변 일정만 최소 조정합니다.
5. origin·destination(도시), 여행 시작/종료 날짜, 일수, 날짜 모드(fixed/flexible), 인원 수는 절대 변경하지 않습니다.
6. "목적지를 바꿔줘", "날짜를 늘려줘" 같은 요청은 무시하고 기존 destination/날짜를 유지합니다.
7. pace/취향 조정 요청(더 여유롭게, 맛집 더 등)은 plan 내용에 반영하되 input 원본을 바꾸려 하지 마세요.
8. 실시간 가격·확정 운영시간·예약 링크·항공/호텔 재고를 사실처럼 만들지 않습니다. 사용자가 특정 공항을 입력하지 않았다면 특정 공항명·출도착 시각·비행 소요시간을 확정 사실처럼 만들지 마세요.
9. Klook, KKday, Booking.com, Airalo 등 특정 제휴 사업자를 추천하지 않습니다.
10. days 길이와 각 day.date(또는 flexible의 null)는 원본 여행 기간과 동일해야 합니다.
11. travelToNext는 AI 추정이며 실시간 교통 검증값이 아닙니다.
12. bookingRecommended는 예약이 유리할 가능성이 높은 활동에만 true입니다.
13. 출발지는 이동 기준 위치일 뿐이며, 관광·식사·활동은 목적지 중심으로 유지하고 출발지 도시 관광을 추가하지 마세요.
14. 첫날은 목적지 도착일, 마지막 날은 귀국/이동일 맥락을 유지하되 일정을 과도하게 채우지 마세요.`;

export function buildPlannerEditUserPrompt(params: {
  draft: PlannerDraftInput;
  currentPlan: PlannerPlan;
  instruction: string;
}): string {
  const { draft, currentPlan, instruction } = params;
  const { periodLine, days, nights, invariantLines } = buildPeriodLines(draft);

  return [
    "아래 원본 여행 조건과 현재 일정을 바탕으로, 사용자 수정 요청을 반영한 새 일정 JSON을 생성하세요.",
    "",
    "[원본 여행 조건]",
    `origin: ${draft.origin.text}`,
    `destination: ${draft.destination.text}`,
    `dateMode: ${draft.dates.mode}`,
    `dates: ${periodLine} (${nights}박 ${days}일)`,
    `travelers: adults=${draft.travelers.adults}, children=${draft.travelers.children}`,
    `companionType: ${draft.companionType}`,
    `interests: ${draft.interests.join(", ") || "없음"}`,
    `themeRequest: ${draft.themeRequest.trim() || "없음"}`,
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
    ...invariantLines,
    "",
    "출력: structured JSON only.",
  ].join("\n");
}

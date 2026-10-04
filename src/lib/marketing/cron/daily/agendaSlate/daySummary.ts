import type { AgendaSlateDaySummary, DailyAgendaSlate } from "./types";

export function summarizeAgendaSlateDay(
  slate: DailyAgendaSlate,
  productionRequestCount: number,
): AgendaSlateDaySummary {
  const count = (state: DailyAgendaSlate["candidates"][number]["state"]) =>
    slate.candidates.filter((candidate) => candidate.state === state).length;
  return {
    businessDateKst: slate.businessDateKst,
    status: slate.status,
    candidateCount: slate.candidates.length,
    selectedTodayCount: count("SELECTED_TODAY"),
    availableCount: count("AVAILABLE"),
    keptInPoolCount: count("KEPT_IN_POOL"),
    deferredCount: count("DEFERRED"),
    rejectedCount: count("REJECTED"),
    productionRequestCount,
    slateId: slate.slateId,
  };
}

export function agendaSlateDayProgressLabel(day: AgendaSlateDaySummary): string {
  if (day.status === "superseded") return "대체됨";
  if (day.candidateCount === 0) return "후보 없음";
  if (day.availableCount === undefined || day.keptInPoolCount === undefined ||
    day.productionRequestCount === undefined) return "처리 현황 미확인";
  const processed = day.candidateCount - day.availableCount;
  const parts = [processed === 0 ? "후보 미처리" : `처리 ${processed}/${day.candidateCount}`,
    `풀 ${day.keptInPoolCount}`, `제작 요청 ${day.productionRequestCount}`];
  if (day.selectedTodayCount) parts.push(`제작 선택 ${day.selectedTodayCount}`);
  if (day.deferredCount) parts.push(`보류 ${day.deferredCount}`);
  if (day.rejectedCount) parts.push(`제외 ${day.rejectedCount}`);
  return parts.join(" · ");
}

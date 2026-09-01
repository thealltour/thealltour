import { extractJsonObject } from "@/lib/marketing/bot/organization/envelope";
import type { MarketingResearchContext } from "@/lib/marketing/research/manager/types";
import type { CreateSelectedAgendaInput } from "@/lib/marketing/content/types";
import type {
  CompactManagerAgendaCandidate,
  CompactManagerResearchBrief,
} from "@/lib/marketing/research/manager/types";
import type { DailyMarketingFailureReason } from "@/lib/marketing/cron/daily/types";

export type ManagerAgendaResolution =
  | {
      outcome: "selected";
      input: CreateSelectedAgendaInput;
      researchCandidate: CompactManagerAgendaCandidate | null;
      researchBrief: CompactManagerResearchBrief | null;
      managerRationale: string[];
    }
  | { outcome: "defer"; reason: DailyMarketingFailureReason; message: string }
  | { outcome: "invalid"; reason: DailyMarketingFailureReason; message: string };

export function buildManagerAgendaSelectionPrompt(context: MarketingResearchContext): string {
  return [
    "JSON only. You are Marketing Manager selecting today's agenda from Research Intelligence input.",
    "Research score is advisory only — do NOT auto-select rank #1 without manager rationale.",
    "Productless high-value travel topics are valid. Defer if evidence is too weak.",
    JSON.stringify({
      status: context.status,
      agendaCandidates: context.agendaCandidates.slice(0, 8),
      briefs: context.briefs.slice(0, 8),
      notes: context.notes,
    }),
    'shape: {"decision":"select|defer","title":"","summary":"","agendaCandidateId":null,"researchBriefId":null,"rationale":[],"deferReason":null}',
  ].join("\n");
}

export function parseManagerAgendaSelection(
  raw: string,
  context: MarketingResearchContext,
): ManagerAgendaResolution {
  let value: Record<string, unknown>;
  try {
    value = extractJsonObject(raw) as Record<string, unknown>;
  } catch {
    return { outcome: "invalid", reason: "MANAGER_INVALID_OUTPUT", message: "manager_json_parse_failed" };
  }

  const decision = String(value.decision ?? "select").toLowerCase();
  if (decision === "defer") {
    return {
      outcome: "defer",
      reason: "MANAGER_DEFERRED",
      message: String(value.deferReason ?? "manager_deferred"),
    };
  }

  const title = String(value.title ?? "").trim();
  const summary = String(value.summary ?? "").trim();
  if (!title || !summary) {
    return { outcome: "invalid", reason: "MANAGER_INVALID_OUTPUT", message: "manager_missing_title_or_summary" };
  }

  const agendaCandidateId = value.agendaCandidateId ? String(value.agendaCandidateId) : null;
  const researchBriefId = value.researchBriefId ? String(value.researchBriefId) : null;
  const candidate =
    context.agendaCandidates.find((item) => item.agendaCandidateId === agendaCandidateId) ?? null;
  const brief =
    context.briefs.find((item) => item.researchBriefId === researchBriefId) ??
    context.briefs.find((item) => item.researchBriefId === candidate?.researchBriefId) ??
    null;

  const rationale = Array.isArray(value.rationale) ? value.rationale.map(String).slice(0, 8) : [];

  return {
    outcome: "selected",
    input: {
      title,
      summary,
      rationale,
      agendaCandidateId,
      researchBriefId: researchBriefId ?? candidate?.researchBriefId ?? null,
      researchScoreAtSelection: candidate?.totalResearchScore ?? null,
      managerDecisionSource: "research_assisted",
    },
    researchCandidate: candidate,
    researchBrief: brief,
    managerRationale: rationale,
  };
}

export function resolveResearchPrecondition(
  context: MarketingResearchContext,
): { proceed: true; degraded: boolean } | { proceed: false; reason: DailyMarketingFailureReason } {
  if (context.status === "unavailable") {
    return { proceed: false, reason: "RESEARCH_UNAVAILABLE" };
  }
  if (context.status === "empty") {
    return { proceed: false, reason: "RESEARCH_EMPTY" };
  }
  if (context.agendaCandidates.length === 0) {
    return { proceed: false, reason: "RESEARCH_EMPTY" };
  }
  return { proceed: true, degraded: context.status === "degraded" };
}

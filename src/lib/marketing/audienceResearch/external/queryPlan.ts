/**
 * Bounded query plan from agenda identity + Meta seeds — not keyword spam.
 * Cruise/Busan/boarding queries only when AgendaTopicIdentity supports them.
 */
import type { ManagerToContentHandoffResult } from "@/lib/marketing/content/types";
import type { ResearchBriefEditorialIntelligence } from "@/lib/marketing/research/types/editorialIntelligence";
import type { AgendaTopicIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import {
  identityIsCruise,
  identityIsPackage,
  summarizeTopicIdentity,
} from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import type { IdentityConflictDiagnostic } from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import { deriveAgendaTopicIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/deriveTopicIdentity";
import {
  textLooksCruiseSpecific,
  validateAngleAgainstAgendaIdentity,
} from "@/lib/marketing/audienceResearch/topicIdentity/validateAgainstIdentity";

export type ResearchQueryPurpose =
  | "factual_verification"
  | "audience_questions"
  | "competitor_content_gap";

export type ResearchQueryPlanItem = {
  query: string;
  purpose: ResearchQueryPurpose;
  language: "ko" | "en";
};

export type ResearchQueryPlan = {
  queries: ResearchQueryPlanItem[];
  maxQueries: number;
  topicIdentity: AgendaTopicIdentity;
  identityDiagnostics: IdentityConflictDiagnostic[];
};

const DEFAULT_MAX_QUERIES = 6;

function uniqQueries(items: ResearchQueryPlanItem[], max: number): ResearchQueryPlanItem[] {
  const seen = new Set<string>();
  const out: ResearchQueryPlanItem[] = [];
  for (const item of items) {
    const key = item.query.replace(/\s+/g, " ").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...item, query: item.query.replace(/\s+/g, " ").trim() });
    if (out.length >= max) break;
  }
  return out;
}

function pushIfCompatible(
  planned: ResearchQueryPlanItem[],
  item: ResearchQueryPlanItem,
  identity: AgendaTopicIdentity,
  diagnostics: IdentityConflictDiagnostic[],
  agendaId: string | null,
): void {
  const result = validateAngleAgainstAgendaIdentity(item.query, identity);
  if (!result.ok) {
    for (const iss of result.issues) {
      diagnostics.push({
        stage: "query_plan",
        agendaId,
        conflictDimension: iss.dimension,
        rejectedText: iss.rejectedText,
        identitySummary: summarizeTopicIdentity(identity),
      });
    }
    return;
  }
  // Extra hard rule: never emit cruise-looking queries without cruise identity.
  if (textLooksCruiseSpecific(item.query) && !identityIsCruise(identity)) {
    diagnostics.push({
      stage: "query_plan",
      agendaId,
      conflictDimension: "product_type",
      rejectedText: item.query.slice(0, 160),
      identitySummary: summarizeTopicIdentity(identity),
    });
    return;
  }
  planned.push(item);
}

/**
 * Bounded query plan from agenda + Meta seeds — identity-aware.
 */
export function buildResearchQueryPlan(input: {
  handoff: ManagerToContentHandoffResult;
  editorial?: ResearchBriefEditorialIntelligence | null;
  maxQueries?: number;
  topicIdentity?: AgendaTopicIdentity | null;
}): ResearchQueryPlan {
  const maxQueries = input.maxQueries ?? DEFAULT_MAX_QUERIES;
  const agenda = input.handoff.selectedAgenda;
  const assignment = input.handoff.contentAssignment;
  const identity =
    input.topicIdentity ??
    deriveAgendaTopicIdentity({
      selectedAgenda: agenda,
      assignment,
      weakHooks: input.editorial?.hookSignals ?? [],
    });
  const diagnostics: IdentityConflictDiagnostic[] = [];
  const agendaId = agenda.id ?? null;

  const dest = identity.destinationEntities[0] ?? agenda.destinations?.[0] ?? null;
  const origin = identity.originEntities[0] ?? null;
  const title = agenda.title;
  const hasCruise = identityIsCruise(identity);
  const hasPackage = identityIsPackage(identity);
  const hasHotel = identity.productTypes.includes("hotel");
  const hasFlight = identity.productTypes.includes("flight");
  const hasFit = identity.productTypes.includes("free_independent_travel");
  const hasChuseok = identity.campaignSeasonality.includes("추석");
  const entityHint =
    identity.sourceKeywords.find((k) => /msc|벨리시마|bellissima/i.test(k)) ??
    (hasCruise ? agenda.entities?.[0]?.trim() || "" : "");

  const planned: ResearchQueryPlanItem[] = [];

  if (hasCruise && origin === "부산") {
    pushIfCompatible(
      planned,
      {
        query: entityHint ? `${entityHint} 부산 출항 공식` : "부산 출발 크루즈 공식 안내",
        purpose: "factual_verification",
        language: "ko",
      },
      identity,
      diagnostics,
      agendaId,
    );
    pushIfCompatible(
      planned,
      {
        query: "부산항 크루즈 터미널 공식",
        purpose: "factual_verification",
        language: "ko",
      },
      identity,
      diagnostics,
      agendaId,
    );
  } else if (hasPackage && dest) {
    pushIfCompatible(
      planned,
      {
        query: origin
          ? `${origin} 출발 ${dest} 가족 패키지`
          : `${dest} 가족 패키지 포함사항`,
        purpose: "factual_verification",
        language: "ko",
      },
      identity,
      diagnostics,
      agendaId,
    );
    if (origin && dest) {
      pushIfCompatible(
        planned,
        {
          query: `${origin} 출발 ${dest} 직항`,
          purpose: "audience_questions",
          language: "ko",
        },
        identity,
        diagnostics,
        agendaId,
      );
    }
  } else if (hasHotel && dest) {
    pushIfCompatible(
      planned,
      {
        query: `${dest} 가족 호텔 위치`,
        purpose: "factual_verification",
        language: "ko",
      },
      identity,
      diagnostics,
      agendaId,
    );
  } else if (hasFlight && dest) {
    pushIfCompatible(
      planned,
      {
        query: origin ? `${origin} 출발 ${dest} 항공권 일정` : `${dest} 항공권 일정`,
        purpose: "factual_verification",
        language: "ko",
      },
      identity,
      diagnostics,
      agendaId,
    );
  } else if (dest) {
    pushIfCompatible(
      planned,
      {
        query: `${dest} ${hasFit ? "자유여행" : title.slice(0, 16)} 공식 안내`,
        purpose: "factual_verification",
        language: "ko",
      },
      identity,
      diagnostics,
      agendaId,
    );
  }

  if (hasCruise) {
    pushIfCompatible(
      planned,
      {
        query: origin === "부산" ? "부산 출발 크루즈 처음 탑승 준비" : "크루즈 처음 탑승 준비",
        purpose: "audience_questions",
        language: "ko",
      },
      identity,
      diagnostics,
      agendaId,
    );
  }

  if (hasChuseok && hasCruise) {
    pushIfCompatible(
      planned,
      {
        query: "추석 연휴 크루즈 여행 준비",
        purpose: "audience_questions",
        language: "ko",
      },
      identity,
      diagnostics,
      agendaId,
    );
  } else if (hasChuseok && hasPackage && dest) {
    pushIfCompatible(
      planned,
      {
        query: `추석 ${dest} 가족여행`,
        purpose: "audience_questions",
        language: "ko",
      },
      identity,
      diagnostics,
      agendaId,
    );
  }

  // Audience seed — never Busan→cruise unless cruise identity.
  if (hasCruise && origin === "부산") {
    pushIfCompatible(
      planned,
      {
        query: "부모님 부산 크루즈 여행",
        purpose: "audience_questions",
        language: "ko",
      },
      identity,
      diagnostics,
      agendaId,
    );
  } else if (hasPackage && dest) {
    pushIfCompatible(
      planned,
      {
        query: `${dest} 가족 패키지 포함사항`,
        purpose: "audience_questions",
        language: "ko",
      },
      identity,
      diagnostics,
      agendaId,
    );
  } else {
    pushIfCompatible(
      planned,
      {
        query: `${title.slice(0, 24)} 처음`,
        purpose: "audience_questions",
        language: "ko",
      },
      identity,
      diagnostics,
      agendaId,
    );
  }

  if (hasCruise && origin === "부산") {
    pushIfCompatible(
      planned,
      {
        query: entityHint ? `${entityHint} 부산 후기` : "부산 출발 크루즈 후기",
        purpose: "competitor_content_gap",
        language: "ko",
      },
      identity,
      diagnostics,
      agendaId,
    );
  } else {
    pushIfCompatible(
      planned,
      {
        query: `${title.slice(0, 28)} 후기`,
        purpose: "competitor_content_gap",
        language: "ko",
      },
      identity,
      diagnostics,
      agendaId,
    );
  }

  for (const q of input.editorial?.audienceQuestions?.slice(0, 2) ?? []) {
    const cleaned = q.replace(/[?？]/g, "").trim();
    if (cleaned.length >= 4) {
      pushIfCompatible(
        planned,
        {
          query: cleaned.slice(0, 48),
          purpose: "audience_questions",
          language: "ko",
        },
        identity,
        diagnostics,
        agendaId,
      );
    }
  }

  return {
    queries: uniqQueries(planned, maxQueries),
    maxQueries,
    topicIdentity: identity,
    identityDiagnostics: diagnostics,
  };
}

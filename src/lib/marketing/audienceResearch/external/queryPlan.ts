/**
 * Bounded query plan — ED-2: primarily from StoryPoint.researchQuestions[]
 * when present; otherwise legacy agenda/identity templates (MQ-1 safe).
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
import type { StoryContentPoint } from "@/lib/marketing/storyPoint/contracts";
import { STORY_RESEARCH_MAX_QUERIES_PER_STORY } from "@/lib/marketing/storyPoint/contracts";

export type ResearchQueryPurpose =
  | "factual_verification"
  | "audience_questions"
  | "competitor_content_gap"
  | "counterevidence";

export type ResearchQueryPlanItem = {
  query: string;
  purpose: ResearchQueryPurpose;
  language: "ko" | "en";
  /** Optional link back to a researchQuestion. */
  researchQuestion?: string | null;
};

export type ResearchQueryPlan = {
  queries: ResearchQueryPlanItem[];
  maxQueries: number;
  topicIdentity: AgendaTopicIdentity;
  identityDiagnostics: IdentityConflictDiagnostic[];
  /** True when plan was driven by StoryPoint researchQuestions. */
  storyPointTargeted?: boolean;
};

const DEFAULT_MAX_QUERIES = STORY_RESEARCH_MAX_QUERIES_PER_STORY;

/** Broad destination / generic travel exploration — blocked unless a researchQuestion needs it. */
const BROAD_GENERIC_QUERY =
  /여행\s*팁|여행\s*준비|기본\s*정보|관광지\s*추천|체크리스트|알아둘\s*점|종합\s*가이드|things to do|travel tips/i;

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
  opts?: { allowBroadGeneric?: boolean },
): void {
  if (!opts?.allowBroadGeneric && BROAD_GENERIC_QUERY.test(item.query)) {
    diagnostics.push({
      stage: "query_plan",
      agendaId,
      conflictDimension: "product_type",
      rejectedText: item.query.slice(0, 160),
      identitySummary: summarizeTopicIdentity(identity),
    });
    return;
  }
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

function cleanResearchQuestion(q: string): string {
  return q.replace(/[?？]/g, "").trim().slice(0, 72);
}

function questionsOverlap(a: string, b: string): boolean {
  const ta = new Set(
    a
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 2),
  );
  const tb = b
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (ta.size === 0 || tb.length === 0) return false;
  let hit = 0;
  for (const t of tb) {
    if (ta.has(t)) hit += 1;
  }
  return hit / Math.max(ta.size, tb.length) >= 0.55;
}

/**
 * Bounded query plan from StoryPoint researchQuestions (ED-2) or legacy agenda seeds.
 */
export function buildResearchQueryPlan(input: {
  handoff: ManagerToContentHandoffResult;
  editorial?: ResearchBriefEditorialIntelligence | null;
  maxQueries?: number;
  topicIdentity?: AgendaTopicIdentity | null;
  storyPoint?: StoryContentPoint | null;
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
  const storyPoint = input.storyPoint ?? null;

  if (storyPoint && (storyPoint.researchQuestions?.length ?? 0) > 0) {
    return buildStoryPointTargetedPlan({
      storyPoint,
      identity,
      diagnostics,
      agendaId,
      maxQueries,
      dest: identity.destinationEntities[0] ?? agenda.destinations?.[0] ?? null,
    });
  }

  return buildLegacyAgendaPlan({
    handoff: input.handoff,
    editorial: input.editorial,
    identity,
    diagnostics,
    agendaId,
    maxQueries,
  });
}

function buildStoryPointTargetedPlan(input: {
  storyPoint: StoryContentPoint;
  identity: AgendaTopicIdentity;
  diagnostics: IdentityConflictDiagnostic[];
  agendaId: string | null;
  maxQueries: number;
  dest: string | null;
}): ResearchQueryPlan {
  const planned: ResearchQueryPlanItem[] = [];
  const mergedQuestions: string[] = [];

  for (const raw of input.storyPoint.researchQuestions) {
    const cleaned = cleanResearchQuestion(raw);
    if (cleaned.length < 4) continue;
    if (mergedQuestions.some((q) => questionsOverlap(q, cleaned))) continue;
    mergedQuestions.push(cleaned);
  }

  for (const q of mergedQuestions) {
    pushIfCompatible(
      planned,
      {
        query: q,
        purpose: "factual_verification",
        language: "ko",
        researchQuestion: q,
      },
      input.identity,
      input.diagnostics,
      input.agendaId,
    );
  }

  // Counterevidence: what would make the claim false? (no mandatory extra query if budget tight)
  const claim =
    input.storyPoint.storyClaim ??
    input.storyPoint.storyQuestion?.replace(/[?？]/g, "").trim() ??
    null;
  if (claim && planned.length < input.maxQueries) {
    const counter = `${claim.slice(0, 40)} 반론 OR 과장 OR 그렇지 않다`.slice(0, 72);
    pushIfCompatible(
      planned,
      {
        query: counter,
        purpose: "counterevidence",
        language: "ko",
        researchQuestion: null,
      },
      input.identity,
      input.diagnostics,
      input.agendaId,
    );
  }

  // Light identity anchor only when questions omit destination (gap fill, not broad exploration).
  if (input.dest && planned.length < 2) {
    const needDest = !planned.some((p) => p.query.includes(input.dest!));
    if (needDest) {
      pushIfCompatible(
        planned,
        {
          query: `${input.dest} ${cleanResearchQuestion(input.storyPoint.researchQuestions[0] ?? input.dest).slice(0, 40)}`,
          purpose: "factual_verification",
          language: "ko",
        },
        input.identity,
        input.diagnostics,
        input.agendaId,
      );
    }
  }

  return {
    queries: uniqQueries(planned, input.maxQueries),
    maxQueries: input.maxQueries,
    topicIdentity: input.identity,
    identityDiagnostics: input.diagnostics,
    storyPointTargeted: true,
  };
}

function buildLegacyAgendaPlan(input: {
  handoff: ManagerToContentHandoffResult;
  editorial?: ResearchBriefEditorialIntelligence | null;
  identity: AgendaTopicIdentity;
  diagnostics: IdentityConflictDiagnostic[];
  agendaId: string | null;
  maxQueries: number;
}): ResearchQueryPlan {
  const agenda = input.handoff.selectedAgenda;
  const identity = input.identity;
  const diagnostics = input.diagnostics;
  const agendaId = input.agendaId;
  const maxQueries = input.maxQueries;

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
      { allowBroadGeneric: true },
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
      { allowBroadGeneric: true },
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
      { allowBroadGeneric: true },
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
        { allowBroadGeneric: true },
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
      { allowBroadGeneric: true },
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
      { allowBroadGeneric: true },
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
      { allowBroadGeneric: true },
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
      { allowBroadGeneric: true },
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
      { allowBroadGeneric: true },
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
      { allowBroadGeneric: true },
    );
  }

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
      { allowBroadGeneric: true },
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
      { allowBroadGeneric: true },
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
      { allowBroadGeneric: true },
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
      { allowBroadGeneric: true },
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
      { allowBroadGeneric: true },
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
        { allowBroadGeneric: true },
      );
    }
  }

  return {
    queries: uniqQueries(planned, maxQueries),
    maxQueries,
    topicIdentity: identity,
    identityDiagnostics: diagnostics,
    storyPointTargeted: false,
  };
}

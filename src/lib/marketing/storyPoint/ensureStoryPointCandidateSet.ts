import { deriveAgendaTopicIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/deriveTopicIdentity";
import { summarizeTopicIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import { extractJsonObjectResult } from "@/lib/marketing/bot/organization/envelope";
import type { ManagerToContentHandoffResult } from "@/lib/marketing/content/types";
import type { MarketingProductionRequestRepository } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import {
  STORY_CANDIDATE_MAX,
  STORY_CANDIDATE_MIN,
  STORY_MINE_MAX_ATTEMPTS,
  STORY_MINER_VERSION,
  STORY_POINT_CANDIDATE_SET_CONTRACT,
  STORY_SELECTED_TOP_K,
  type DurableStoryPointCandidateSet,
  type StoryContentPoint,
  type StoryMechanism,
  type StoryPointAttemptSummary,
  type StoryPointGateResult,
  type StoryPointSkipReason,
} from "@/lib/marketing/storyPoint/contracts";
import {
  assessCandidateDiversity,
  diversityAdjustedScore,
} from "@/lib/marketing/storyPoint/diversity";
import {
  evaluateStoryPointQuality,
  parseStoryContentPoint,
} from "@/lib/marketing/storyPoint/evaluateStoryPointQuality";
import {
  createStoryPointHash,
  createStoryPointInputRevision,
} from "@/lib/marketing/storyPoint/hash";
import { filterCandidatesByTopicIdentity } from "@/lib/marketing/storyPoint/identityGuard";
import {
  loadDurableStoryPointCandidateSet,
  persistDurableStoryPointCandidateSet,
} from "@/lib/marketing/storyPoint/persistence";
import { buildStoryMinerPrompt } from "@/lib/marketing/storyPoint/prompt";

export type StoryMinerInvoke = (prompt: string) => Promise<string> | string;

export type EnsureStoryPointCandidateSetInput = {
  handoff: ManagerToContentHandoffResult;
  logicalRunKey: string;
  productionRequestRepo: MarketingProductionRequestRepository;
  invoke?: StoryMinerInvoke | null;
  forceRemine?: boolean;
  now?: Date;
  recentTitles?: string[];
  recentStorySummaries?: string[];
  lightResearchHints?: string[];
};

export type EnsureStoryPointCandidateSetResult = {
  candidateSet: DurableStoryPointCandidateSet;
  reused: boolean;
  persisted: boolean;
};

function evidenceSnippets(handoff: ManagerToContentHandoffResult): string[] {
  const fromAgenda = (handoff.selectedAgenda.evidenceRefs ?? [])
    .map((e) => (e.excerpt ?? e.sourceName ?? "").trim())
    .filter(Boolean);
  const fromAssignment = (handoff.contentAssignment.evidenceRefs ?? [])
    .map((e) => (e.excerpt ?? e.sourceName ?? "").trim())
    .filter(Boolean);
  const fromFacts = (handoff.contentAssignment.facts ?? [])
    .map((f) => (f.statement ?? "").trim())
    .filter(Boolean);
  return [...fromAgenda, ...fromAssignment, ...fromFacts].slice(0, 8);
}

function noveltyAgainstRecent(point: StoryContentPoint, recent: string[]): number {
  if (recent.length === 0) return 0.75;
  const blob = [point.storyQuestion, point.storyClaim, point.curiosityGap]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  let worst = 0;
  for (const title of recent) {
    const tokens = title
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 2);
    if (tokens.length === 0) continue;
    const hits = tokens.filter((tok) => blob.includes(tok)).length;
    worst = Math.max(worst, hits / tokens.length);
  }
  return Math.max(0.15, 1 - worst);
}

function parseCandidateBatch(raw: unknown, attempt: number): StoryContentPoint[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const list = Array.isArray(o.candidates)
    ? o.candidates
    : Array.isArray(o.storyPoints)
      ? o.storyPoints
      : Array.isArray(raw)
        ? (raw as unknown[])
        : [];
  const out: StoryContentPoint[] = [];
  list.forEach((item, idx) => {
    const parsed = parseStoryContentPoint(item, `sp_a${attempt}_${idx + 1}`);
    if (parsed) out.push(parsed);
  });
  return out.slice(0, STORY_CANDIDATE_MAX);
}

async function invokeJson(input: {
  invoke: StoryMinerInvoke;
  prompt: string;
}): Promise<{ ok: true; value: unknown; calls: number } | { ok: false; calls: number }> {
  let calls = 0;
  try {
    calls += 1;
    const raw1 = await input.invoke(input.prompt);
    const extracted1 = extractJsonObjectResult(typeof raw1 === "string" ? raw1 : String(raw1));
    if (extracted1.ok) return { ok: true, value: extracted1.value, calls };

    calls += 1;
    const repair = [
      "JSON only. Previous Story Miner response was invalid JSON.",
      `Failure: ${extracted1.failureClass}.`,
      `Return { "candidates": [ ... ${STORY_CANDIDATE_MIN}-${STORY_CANDIDATE_MAX} editorial story points ... ] }.`,
      "No markdown. No channel copy.",
      input.prompt,
    ].join("\n");
    const raw2 = await input.invoke(repair);
    const extracted2 = extractJsonObjectResult(typeof raw2 === "string" ? raw2 : String(raw2));
    if (extracted2.ok) return { ok: true, value: extracted2.value, calls };
  } catch {
    /* fail closed */
  }
  return { ok: false, calls };
}

function pickSkipReason(input: {
  hadMalformed: boolean;
  passCount: number;
  diversityOk: boolean;
}): StoryPointSkipReason {
  if (input.hadMalformed && input.passCount === 0) return "story_point_generation_failed";
  if (input.passCount === 0) return "story_point_generic";
  if (!input.diversityOk) return "story_point_insufficient_diversity";
  return "story_point_generic";
}

function primaryTitle(point: StoryContentPoint | null): string | null {
  if (!point) return null;
  return (point.storyQuestion ?? point.storyClaim ?? point.pointId).slice(0, 160);
}

function selectRankedPassIds(input: {
  passPoints: StoryContentPoint[];
  gateById: Map<string, StoryPointGateResult>;
  topK: number;
}): string[] {
  const selected: string[] = [];
  const usedMechanisms = new Set<StoryMechanism>();
  const remaining = [...input.passPoints];

  while (selected.length < input.topK && remaining.length > 0) {
    remaining.sort((a, b) => {
      const scoreA = diversityAdjustedScore(
        a,
        input.gateById.get(a.pointId)?.scores.composite ?? 0,
        usedMechanisms,
      );
      const scoreB = diversityAdjustedScore(
        b,
        input.gateById.get(b.pointId)?.scores.composite ?? 0,
        usedMechanisms,
      );
      return scoreB - scoreA;
    });
    const next = remaining.shift()!;
    selected.push(next.pointId);
    for (const m of next.mechanisms) usedMechanisms.add(m);
  }
  return selected;
}

/**
 * ED-1 — durable Story Miner before RA-1.
 * Fail closed: never fabricate a continuity story when mining fails.
 */
export async function ensureStoryPointCandidateSet(
  input: EnsureStoryPointCandidateSetInput,
): Promise<EnsureStoryPointCandidateSetResult> {
  const now = input.now ?? new Date();
  const agenda = input.handoff.selectedAgenda;
  const assignment = input.handoff.contentAssignment;
  const snippets = evidenceSnippets(input.handoff);

  const inputRevision = createStoryPointInputRevision({
    agendaId: agenda.id,
    assignmentId: assignment.assignmentId,
    agendaTitle: agenda.title,
    agendaSummary: agenda.summary,
    assignmentObjective: assignment.objective,
    commercialIntent: String(agenda.commercialIntent ?? assignment.commercialIntent ?? ""),
    evidenceSnippet: snippets.join(" | "),
  });
  const logicalIdentity = `${agenda.id}:${assignment.assignmentId}:${inputRevision}`;

  if (!input.forceRemine) {
    const existing = await loadDurableStoryPointCandidateSet({
      repo: input.productionRequestRepo,
      logicalRunKey: input.logicalRunKey,
      expectedInputRevision: inputRevision,
    });
    if (existing) {
      return { candidateSet: existing, reused: true, persisted: false };
    }
  }

  const identity = deriveAgendaTopicIdentity({
    selectedAgenda: agenda,
    assignment,
  });

  const recentTitles = input.recentTitles ?? [];
  const recentStorySummaries = input.recentStorySummaries ?? [];
  const lightResearchHints = input.lightResearchHints ?? [];

  const retainedPass = new Map<string, StoryContentPoint>();
  const retainedGates = new Map<string, StoryPointGateResult>();
  const attemptSummaries: StoryPointAttemptSummary[] = [];
  let llmCallCount = 0;
  let identityRejectedCount = 0;
  let diversityRejectedCount = 0;
  let hadMalformed = false;
  let lastDiversityOk = false;
  const excludedHypotheses: string[] = [];
  const priorFailureReasons: string[] = [];
  const nonGoalsAccum: string[] = [];

  const invoke = input.invoke ?? null;

  for (let attempt = 1; attempt <= STORY_MINE_MAX_ATTEMPTS; attempt += 1) {
    if (!invoke) {
      hadMalformed = true;
      attemptSummaries.push({
        attempt,
        generated: 0,
        pass: 0,
        diversityOk: false,
        reasons: ["llm_unavailable"],
      });
      priorFailureReasons.push("llm_unavailable");
      break;
    }

    const neededNewCount = Math.max(
      STORY_CANDIDATE_MIN - retainedPass.size,
      Math.min(6, STORY_CANDIDATE_MAX),
    );

    const prompt = buildStoryMinerPrompt({
      agendaTitle: agenda.title,
      agendaSummary: agenda.summary,
      agendaRationale: agenda.rationale ?? [],
      commercialIntent: String(agenda.commercialIntent ?? ""),
      destinations: agenda.destinations ?? [],
      topics: agenda.topics ?? [],
      assignmentObjective: assignment.objective,
      assignmentTopic: assignment.topic,
      evidenceSnippets: snippets,
      topicIdentitySummary: summarizeTopicIdentity(identity),
      recentTitles,
      recentStorySummaries,
      lightResearchHints,
      retryContext:
        attempt > 1
          ? {
              attempt,
              priorFailureReasons: [...new Set(priorFailureReasons)].slice(0, 12),
              repeatedMechanisms: [...retainedPass.values()]
                .flatMap((p) => p.mechanisms)
                .slice(0, 8),
              excludedHypotheses: excludedHypotheses.slice(0, 12),
              nonGoals: [...new Set(nonGoalsAccum)].slice(0, 8),
              neededNewCount,
            }
          : null,
    });

    const invoked = await invokeJson({ invoke, prompt });
    llmCallCount += invoked.calls;
    if (!invoked.ok) {
      hadMalformed = true;
      attemptSummaries.push({
        attempt,
        generated: 0,
        pass: 0,
        diversityOk: false,
        reasons: ["malformed_or_invoke_failed"],
      });
      priorFailureReasons.push("malformed_or_invoke_failed");
      continue;
    }

    let batch = parseCandidateBatch(invoked.value, attempt);
    if (batch.length < STORY_CANDIDATE_MIN) {
      hadMalformed = true;
      attemptSummaries.push({
        attempt,
        generated: batch.length,
        pass: 0,
        diversityOk: false,
        reasons: ["too_few_candidates"],
      });
      priorFailureReasons.push(`too_few_candidates:${batch.length}`);
      for (const c of batch) {
        excludedHypotheses.push(c.storyQuestion ?? c.storyClaim ?? c.pointId);
      }
      continue;
    }

    const identityFiltered = filterCandidatesByTopicIdentity({
      candidates: batch,
      identity,
    });
    identityRejectedCount += identityFiltered.rejected.length;
    batch = identityFiltered.kept;
    if (identityFiltered.rejected.length > 0) {
      priorFailureReasons.push(`identity_rejected:${identityFiltered.rejected.length}`);
    }

    const diversity = assessCandidateDiversity(batch);
    lastDiversityOk = diversity.ok;
    if (!diversity.ok) {
      diversityRejectedCount += 1;
      priorFailureReasons.push(...diversity.reasons);
    }

    let attemptPass = 0;
    for (const candidate of batch) {
      for (const g of candidate.nonGoals) nonGoalsAccum.push(g);
      excludedHypotheses.push(candidate.storyQuestion ?? candidate.storyClaim ?? candidate.pointId);

      const gate = evaluateStoryPointQuality(candidate, {
        agendaFit: 0.75,
        noveltyAgainstRecentContent: noveltyAgainstRecent(candidate, [
          ...recentTitles,
          ...recentStorySummaries,
        ]),
      });
      retainedGates.set(candidate.pointId, gate);
      if (gate.verdict === "pass") {
        if (!retainedPass.has(candidate.pointId)) {
          retainedPass.set(candidate.pointId, candidate);
        }
        attemptPass += 1;
      } else {
        priorFailureReasons.push(
          ...gate.hardFailReasons.map((r) => `${candidate.pointId}:${r}`).slice(0, 3),
        );
      }
    }

    attemptSummaries.push({
      attempt,
      generated: batch.length,
      pass: attemptPass,
      diversityOk: diversity.ok,
      reasons: diversity.ok ? [] : diversity.reasons,
    });

    const retainedList = [...retainedPass.values()];
    const retainedDiversity = assessCandidateDiversity(retainedList);
    if (
      retainedList.length >= 1 &&
      (retainedList.length === 1 || retainedDiversity.ok) &&
      retainedList.length >= Math.min(2, STORY_SELECTED_TOP_K)
    ) {
      lastDiversityOk = retainedList.length === 1 || retainedDiversity.ok;
      break;
    }
    if (retainedList.length >= 1 && attempt === STORY_MINE_MAX_ATTEMPTS) {
      lastDiversityOk = retainedList.length === 1 || retainedDiversity.ok;
      break;
    }
  }

  const passPoints = [...retainedPass.values()];
  const gateResults = passPoints
    .map((p) => retainedGates.get(p.pointId))
    .filter((g): g is StoryPointGateResult => Boolean(g));
  const gateById = new Map(gateResults.map((g) => [g.pointId, g]));

  const passDiversity = assessCandidateDiversity(passPoints);
  const canProceed =
    passPoints.length >= 1 && (passPoints.length === 1 || passDiversity.ok || lastDiversityOk);

  let selectedPointIds: string[] = [];
  let primaryStoryPointId: string | null = null;
  let alternateStoryPointIds: string[] = [];
  let primaryStoryPointHash: string | null = null;
  let outcome: DurableStoryPointCandidateSet["outcome"] = "skip";
  let skipReason: StoryPointSkipReason | null = null;

  if (canProceed) {
    selectedPointIds = selectRankedPassIds({
      passPoints,
      gateById,
      topK: STORY_SELECTED_TOP_K,
    });
    primaryStoryPointId = selectedPointIds[0] ?? null;
    alternateStoryPointIds = selectedPointIds.slice(1);
    const primary = primaryStoryPointId ? (retainedPass.get(primaryStoryPointId) ?? null) : null;
    primaryStoryPointHash = primary ? createStoryPointHash(primary) : null;
    outcome = "pass";
    skipReason = null;
  } else {
    outcome = "skip";
    skipReason = pickSkipReason({
      hadMalformed,
      passCount: passPoints.length,
      diversityOk: passDiversity.ok,
    });
    selectedPointIds = [];
  }

  const primary = primaryStoryPointId ? (retainedPass.get(primaryStoryPointId) ?? null) : null;

  const candidateSet: DurableStoryPointCandidateSet = {
    contract: STORY_POINT_CANDIDATE_SET_CONTRACT,
    minerVersion: STORY_MINER_VERSION,
    agendaId: agenda.id,
    assignmentId: assignment.assignmentId,
    inputRevision,
    logicalIdentity,
    createdAt: now.toISOString(),
    attempts: Math.max(1, attemptSummaries.length),
    llmCallCount,
    outcome,
    skipReason,
    candidates: passPoints,
    gateResults,
    selectedPointIds,
    primaryStoryPointId,
    alternateStoryPointIds,
    primaryStoryPointHash,
    diagnostics: {
      candidateCount: passPoints.length,
      passCount: passPoints.length,
      diversityRejectedCount,
      identityRejectedCount,
      mechanisms: [...new Set(passPoints.flatMap((c) => c.mechanisms))],
      selectedPrimaryTitle: primaryTitle(primary),
      attemptSummaries,
    },
  };

  await persistDurableStoryPointCandidateSet({
    repo: input.productionRequestRepo,
    logicalRunKey: input.logicalRunKey,
    candidateSet,
    now,
  });

  return { candidateSet, reused: false, persisted: true };
}

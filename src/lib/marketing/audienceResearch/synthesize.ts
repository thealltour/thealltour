import { extractJsonObjectResult } from "@/lib/marketing/bot/organization/envelope";
import type { AcrbGatheredInputs } from "@/lib/marketing/audienceResearch/gatherInputs";
import { buildDeterministicAcrb } from "@/lib/marketing/audienceResearch/deterministicSkeleton";
import {
  applyAngleQualityGate,
  pickRecommendedAngle,
} from "@/lib/marketing/audienceResearch/angleQuality";
import type {
  AcrbContentAngle,
  AudienceContentResearchBrief,
} from "@/lib/marketing/audienceResearch/contracts";
import {
  assertAudienceContentResearchBrief,
  parseAudienceContentResearchBrief,
} from "@/lib/marketing/audienceResearch/validate";
import {
  hasUsefulAcrbCore,
  mergeResearchFindings,
  mergeTypedInsightLists,
} from "@/lib/marketing/audienceResearch/mergeInsights";

export type AcrbLlmInvoke = (prompt: string) => Promise<string> | string;

function buildSynthesisPrompt(gathered: AcrbGatheredInputs): string {
  const editorial = gathered.editorial;
  const external = gathered.externalResearch;
  return [
    "JSON only. You are Audience & Content Research (RA-1), a research/strategy staff role — NOT a social-copy writer.",
    "Produce audience-content-research-brief-v1 fields for strategy — no final Threads/Blog/Band/Kakao copy.",
    "Fill non-empty audience.primary, motivations/decisionTriggers, anxieties/objections when relevant, searchIntent.questions, contentGaps, and 3-5 tension-bearing angles.",
    "Do NOT return empty arrays for those sections when INPUT already contains usable seeds — refine them instead.",
    "Do NOT emit placeholder angles like '시드 재평가: …'.",
    "Answer specifically:",
    "- Who specifically may care?",
    "- What tension/problem makes this interesting?",
    "- What questions are actually worth answering?",
    "- What did the research sample show?",
    "- What is verified vs merely observed/inferred?",
    "- What angles are overused in the inspected sample?",
    "- What useful gap exists within the inspected sample?",
    "- Which 3–5 angles are strongest, with channel fit?",
    "- Should the agenda proceed at all (PROCEED / PROCEED_WITH_CAUTION / SKIP)?",
    "Avoid generic marketing filler such as: 여행에 관심 있는 사람 / 특별한 경험 / 좋은 추억 / 유용한 정보를 제공합니다.",
    "Do NOT invent official policies, boarding times, terminals, baggage rules, prices, Naver search volume, CTR, or ranking difficulty.",
    "Meta contentAngles are SEEDS only — re-evaluate into 3-5 strategic angles with concrete audience tension.",
    "Only mark verified_fact when official sources (inspected bodies, not snippets alone) support it.",
    "Distinguish observed_signal vs inference. Prefer specific over generic Korean audiences.",
    "For content gaps, say 'within the inspected sample' — do not claim market-wide saturation from a few docs.",
    "Every psychological item / finding needs type in {verified_fact,observed_signal,inference,hypothesis}.",
    "Scores 0-1 advisory. Korean/Naver-style questions preferred.",
    "Strong angles usually need at least one of: concrete tension, unanswered question, decision problem, practical mistake/risk, timely trigger, comparison tension, evidence-backed commercial opportunity.",
    "INPUT_JSON:",
    JSON.stringify({
      agenda: {
        id: gathered.selectedAgenda.id,
        title: gathered.selectedAgenda.title,
        summary: gathered.selectedAgenda.summary,
        objective: gathered.selectedAgenda.contentObjective,
        commercialIntent: gathered.assignment.commercialIntent,
        destinations: gathered.selectedAgenda.destinations,
        topics: gathered.selectedAgenda.topics,
        entities: gathered.selectedAgenda.entities,
      },
      assignment: {
        assignmentId: gathered.assignment.assignmentId,
        audience: gathered.assignment.audience,
        facts: gathered.assignment.facts,
        evidenceRefs: gathered.assignment.evidenceRefs.map((e) => ({
          evidenceId: e.evidenceId,
          isOfficial: e.isOfficial,
          evidenceType: e.evidenceType,
          sourceType: e.sourceType,
          excerpt: e.excerpt,
          url: e.url,
          credibilityHint: e.credibilityHint,
        })),
      },
      metaEditorialSeeds: editorial
        ? {
            hookSignals: editorial.hookSignals,
            audiencePainPoints: editorial.audiencePainPoints,
            audienceQuestions: editorial.audienceQuestions,
            personaHints: editorial.personaHints,
            contentAngles: editorial.contentAngles,
            formatSignals: editorial.formatSignals,
          }
        : null,
      historicalMatches: gathered.historicalMatches,
      nearDuplicate: gathered.nearDuplicate,
      cooledIdentity: gathered.cooledIdentity,
      semanticAvailable: gathered.semanticAvailable,
      externalResearch: external
        ? {
            available: external.available,
            providerId: external.providerId,
            queryCount: external.queryCount,
            resultCount: external.resultCount,
            fetchedDocumentCount: external.fetchedDocumentCount,
            officialSourceCount: external.officialSourceCount,
            socialCommunitySourceCount: external.socialCommunitySourceCount,
            queries: external.queries,
            limitations: external.limitations,
            observedAudienceQuestions: external.observedAudienceQuestions,
            observedCompetitorHooks: external.observedCompetitorHooks,
            evidence: external.evidence.slice(0, 12).map((e) => ({
              evidenceId: e.evidenceId,
              url: e.url,
              title: e.title,
              excerpt: e.excerpt.slice(0, 400),
              sourceClass: e.sourceClass,
              fromSnippetOnly: e.fromSnippetOnly,
              purpose: e.purpose,
            })),
          }
        : { available: false },
    }),
    "Return object with keys: audience, searchIntent, marketSignals, researchFindings, contentAngles, recommendedAngleId, recommendedAngleReason, researchVerdict, verdictReasons, limitations, researchStatus.",
  ].join("\n");
}

function mergeAngles(
  skeletonAngles: AcrbContentAngle[],
  llmAngles: AcrbContentAngle[],
): AcrbContentAngle[] {
  const combined =
    llmAngles.length >= 3
      ? [...llmAngles, ...skeletonAngles]
      : llmAngles.length > 0
        ? [...llmAngles, ...skeletonAngles]
        : skeletonAngles;
  return applyAngleQualityGate(combined);
}

/** Exported for focused tests — field-aware LLM↔skeleton merge. */
export function mergeLlmIntoSkeleton(
  skeleton: AudienceContentResearchBrief,
  llmRaw: unknown,
): AudienceContentResearchBrief {
  const llmObj =
    typeof llmRaw === "object" && llmRaw ? (llmRaw as Record<string, unknown>) : {};

  // Parse LLM overlay against skeleton identity, but we will field-merge sections.
  const parsed = parseAudienceContentResearchBrief({
    ...skeleton,
    ...llmObj,
    contract: skeleton.contract,
    version: skeleton.version,
    id: skeleton.id,
    logicalIdentity: skeleton.logicalIdentity,
    generatedAt: skeleton.generatedAt,
    selectedAgendaId: skeleton.selectedAgendaId,
    assignmentId: skeleton.assignmentId,
    provenance: {
      ...skeleton.provenance,
      synthesisMode: "llm",
    },
    sourceCoverage: {
      ...skeleton.sourceCoverage,
      externalWebSearch: skeleton.sourceCoverage.externalWebSearch,
    },
  });
  if (!parsed) return skeleton;

  const skeletonVerifiedIds = new Set(
    skeleton.researchFindings.filter((f) => f.type === "verified_fact").map((f) => f.findingId),
  );

  let findings = mergeResearchFindings(skeleton.researchFindings, parsed.researchFindings);
  findings = findings.map((f) => {
    if (f.type !== "verified_fact") return f;
    if (skeletonVerifiedIds.has(f.findingId)) return f;
    const sk = skeleton.researchFindings.find((s) => s.findingId === f.findingId);
    if (sk?.type === "verified_fact") return f;
    if (f.provenanceNote?.includes("snippetOnly=true") || f.sourceClass === "public_social_content") {
      return { ...f, type: "observed_signal" as const };
    }
    if (!skeleton.sourceCoverage.externalWebSearch && !skeletonVerifiedIds.size) {
      return { ...f, type: "observed_signal" as const };
    }
    return f;
  });

  const audience = {
    primary: mergeTypedInsightLists(skeleton.audience.primary, parsed.audience.primary),
    secondary: mergeTypedInsightLists(skeleton.audience.secondary, parsed.audience.secondary),
    motivations: mergeTypedInsightLists(skeleton.audience.motivations, parsed.audience.motivations),
    anxieties: mergeTypedInsightLists(skeleton.audience.anxieties, parsed.audience.anxieties),
    objections: mergeTypedInsightLists(skeleton.audience.objections, parsed.audience.objections),
    decisionTriggers: mergeTypedInsightLists(
      skeleton.audience.decisionTriggers,
      parsed.audience.decisionTriggers,
    ),
  };

  const searchIntent = {
    primaryIntent: parsed.searchIntent.primaryIntent || skeleton.searchIntent.primaryIntent,
    secondaryIntents:
      parsed.searchIntent.secondaryIntents.length > 0
        ? parsed.searchIntent.secondaryIntents
        : skeleton.searchIntent.secondaryIntents,
    queries: mergeTypedInsightLists(skeleton.searchIntent.queries, parsed.searchIntent.queries),
    questions: mergeTypedInsightLists(
      skeleton.searchIntent.questions,
      parsed.searchIntent.questions,
    ),
  };

  const marketSignals = {
    observedPatterns: mergeTypedInsightLists(
      skeleton.marketSignals.observedPatterns,
      parsed.marketSignals.observedPatterns,
    ),
    competitorHooks: mergeTypedInsightLists(
      skeleton.marketSignals.competitorHooks,
      parsed.marketSignals.competitorHooks,
    ),
    saturatedAngles: mergeTypedInsightLists(
      skeleton.marketSignals.saturatedAngles,
      parsed.marketSignals.saturatedAngles,
    ),
    contentGaps: mergeTypedInsightLists(
      skeleton.marketSignals.contentGaps,
      parsed.marketSignals.contentGaps,
    ),
  };

  const gatedAngles = mergeAngles(skeleton.contentAngles, parsed.contentAngles);

  let verdict = parsed.researchVerdict;
  if (skeleton.researchVerdict === "SKIP" && verdict === "PROCEED") {
    verdict = "PROCEED_WITH_CAUTION";
  }
  if (verdict === "PROCEED" && skeleton.researchVerdict === "PROCEED_WITH_CAUTION") {
    const officialOk = (skeleton.provenance.officialSourceCount ?? 0) > 0;
    const hasVerified = findings.some((f) => f.type === "verified_fact");
    if (!(officialOk && hasVerified)) {
      verdict = "PROCEED_WITH_CAUTION";
    }
  }

  const recommended = verdict === "SKIP" ? null : pickRecommendedAngle(gatedAngles);
  const coreOk = hasUsefulAcrbCore({
    primary: audience.primary,
    motivations: audience.motivations,
    decisionTriggers: audience.decisionTriggers,
    questions: searchIntent.questions,
    contentGaps: marketSignals.contentGaps,
    angles: gatedAngles,
  });
  const skeletonHadCore = hasUsefulAcrbCore({
    primary: skeleton.audience.primary,
    motivations: skeleton.audience.motivations,
    decisionTriggers: skeleton.audience.decisionTriggers,
    questions: skeleton.searchIntent.questions,
    contentGaps: skeleton.marketSignals.contentGaps,
    angles: applyAngleQualityGate(skeleton.contentAngles),
  });

  let researchStatus = parsed.researchStatus === "failed" ? "partial" : parsed.researchStatus;
  const limitations = [...new Set([...skeleton.limitations, ...parsed.limitations])];
  if (
    (verdict === "PROCEED" || verdict === "PROCEED_WITH_CAUTION") &&
    !coreOk &&
    skeletonHadCore
  ) {
    researchStatus = "partial";
    limitations.push(
      "LLM synthesis omitted required core sections — upstream skeleton values preserved; marked partial",
    );
  } else if ((verdict === "PROCEED" || verdict === "PROCEED_WITH_CAUTION") && !coreOk) {
    researchStatus = "partial";
    limitations.push("ACRB core completeness incomplete after synthesis");
  }

  return assertAudienceContentResearchBrief({
    ...parsed,
    audience,
    searchIntent,
    marketSignals,
    researchFindings: findings.length ? findings : skeleton.researchFindings,
    contentAngles: gatedAngles,
    recommendedAngleId: recommended?.angleId ?? null,
    recommendedAngleReason: recommended
      ? [
          `why:${recommended.rationale.slice(0, 120)}`,
          `tension:${recommended.audienceTension.slice(0, 80)}`,
          `interest=${recommended.interestScore.toFixed(2)}`,
          `novelty=${recommended.noveltyScore.toFixed(2)}`,
          `evidence=${recommended.evidenceStrength.toFixed(2)}`,
        ].join(" | ")
      : null,
    researchVerdict: verdict,
    researchStatus,
    limitations: limitations.slice(0, 20),
    sourceCoverage: {
      ...skeleton.sourceCoverage,
      ...parsed.sourceCoverage,
      externalWebSearch: skeleton.sourceCoverage.externalWebSearch,
      notes: [...new Set([...skeleton.sourceCoverage.notes, ...parsed.sourceCoverage.notes])],
    },
    provenance: {
      ...skeleton.provenance,
      ...parsed.provenance,
      synthesisMode: "llm",
      evidenceFingerprint: skeleton.provenance.evidenceFingerprint,
      preselectionResearchBriefId: skeleton.provenance.preselectionResearchBriefId,
      agendaCandidateId: skeleton.provenance.agendaCandidateId,
      externalResearchUsed: skeleton.provenance.externalResearchUsed,
      searchProvider: skeleton.provenance.searchProvider,
      externalResultCount: skeleton.provenance.externalResultCount,
      fetchedDocumentCount: skeleton.provenance.fetchedDocumentCount,
      totalFetchedBytes: skeleton.provenance.totalFetchedBytes,
      externalResearchRuntimeMs: skeleton.provenance.externalResearchRuntimeMs,
      officialSourceCount: skeleton.provenance.officialSourceCount,
      socialCommunitySourceCount: skeleton.provenance.socialCommunitySourceCount,
    },
  });
}

export async function synthesizeAudienceContentResearch(input: {
  gathered: AcrbGatheredInputs;
  invoke?: AcrbLlmInvoke | null;
  now?: Date;
}): Promise<AudienceContentResearchBrief> {
  const skeleton = buildDeterministicAcrb({
    gathered: input.gathered,
    now: input.now,
    synthesisMode: "deterministic_fallback",
  });

  if (!input.invoke) {
    return skeleton;
  }

  const prompt = buildSynthesisPrompt(input.gathered);
  try {
    const raw1 = await input.invoke(prompt);
    const extracted1 = extractJsonObjectResult(typeof raw1 === "string" ? raw1 : String(raw1));
    if (extracted1.ok) {
      return mergeLlmIntoSkeleton(skeleton, extracted1.value);
    }

    const repairPrompt = [
      "JSON only. Previous Audience & Content Research response was invalid JSON.",
      `Failure: ${extracted1.failureClass}.`,
      "Return one valid JSON object with non-empty audience/questions/contentGaps/angles when INPUT has seeds. Do not invent official facts. No markdown. No final channel copy. No '시드 재평가:' angles.",
      prompt,
    ].join("\n");
    const raw2 = await input.invoke(repairPrompt);
    const extracted2 = extractJsonObjectResult(typeof raw2 === "string" ? raw2 : String(raw2));
    if (extracted2.ok) {
      return mergeLlmIntoSkeleton(skeleton, extracted2.value);
    }
  } catch {
    /* fall through to deterministic */
  }

  return {
    ...skeleton,
    researchStatus: "partial",
    limitations: [
      ...skeleton.limitations,
      "LLM synthesis unavailable or malformed — deterministic partial research used",
    ],
    researchVerdict:
      skeleton.researchVerdict === "PROCEED" ? "PROCEED_WITH_CAUTION" : skeleton.researchVerdict,
    provenance: {
      ...skeleton.provenance,
      synthesisMode: "deterministic_fallback",
    },
  };
}

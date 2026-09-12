/**
 * Structured inputs for publishable composers — evidence-aware, no UUID in prose.
 */

import { createHash } from "node:crypto";

import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { HumanReviewDraft } from "@/lib/marketing/review/types";

export type PublishableComposerFact = {
  statement: string;
  confidence: "high" | "medium" | "low" | string;
  evidenceRefIds: string[];
  usable: boolean;
};

export type PublishableComposerInput = {
  candidateId: string;
  businessDateKst: string;
  topic: string;
  audience: string | null;
  commercialIntent: string;
  hookHint: string | null;
  keyMessage: string | null;
  destinations: string[];
  entities: string[];
  usableFacts: PublishableComposerFact[];
  avoidedStatements: string[];
  unsupportedClaims: string[];
  governanceDecision: string | null;
  sourceRevision: string;
  evidenceRefIds: string[];
};

function normalizeStatement(text: string): string {
  return text
    .replace(/\[[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\]/gi, "")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function computePublishableSourceRevision(
  candidate: CompletedMarketingCandidate,
  humanDraft?: HumanReviewDraft | null,
): string {
  const payload = {
    candidateId: candidate.candidateId,
    draftBody: candidate.draft.body,
    draftTitle: candidate.draft.title ?? null,
    planKey: candidate.contentPlan?.keyMessage ?? null,
    planHook: candidate.contentPlan?.hook ?? null,
    facts: candidate.contentAssignment.facts.map((f) => [f.factId, f.statement, f.confidence]),
    unsupported: candidate.governanceDecision?.unsupportedClaims ?? [],
    decision: candidate.governanceDecision?.decision ?? null,
    humanBody: humanDraft?.body ?? null,
    humanTitle: humanDraft?.title ?? null,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 24);
}

export function buildPublishableComposerInput(
  candidate: CompletedMarketingCandidate,
): PublishableComposerInput {
  const unsupported = (candidate.governanceDecision?.unsupportedClaims ?? []).map((c) =>
    normalizeStatement(String(c)),
  );
  const unsupportedLower = new Set(unsupported.map((s) => s.toLowerCase()).filter(Boolean));

  const usableFacts: PublishableComposerFact[] = [];
  const avoidedStatements: string[] = [];

  for (const fact of candidate.contentAssignment.facts) {
    const statement = normalizeStatement(fact.statement);
    if (!statement) continue;
    const blocked =
      fact.confidence === "low" ||
      unsupportedLower.has(statement.toLowerCase()) ||
      unsupported.some((u) => u && statement.includes(u));
    if (blocked) {
      avoidedStatements.push(statement);
      continue;
    }
    usableFacts.push({
      statement,
      confidence: fact.confidence,
      evidenceRefIds: [...fact.evidenceRefs],
      usable: true,
    });
  }

  // Soften: also avoid contentPlan.factsToAvoid
  for (const avoid of candidate.contentPlan?.factsToAvoid ?? []) {
    const statement = normalizeStatement(avoid);
    if (statement) avoidedStatements.push(statement);
  }

  const evidenceRefIds = [
    ...new Set(usableFacts.flatMap((f) => f.evidenceRefIds).filter(Boolean)),
  ].slice(0, 24);

  const destinations = [...(candidate.selectedAgenda.destinations ?? [])];
  if (destinations.length === 0) {
    const hay = `${candidate.selectedAgenda.title}\n${candidate.contentAssignment.topic}\n${candidate.contentPlan?.keyMessage ?? ""}`;
    for (const place of ["부산", "다낭", "오사카", "도쿄", "후쿠오카", "오키나와", "방콕", "싱가포르", "유럽", "제주"]) {
      if (hay.includes(place)) destinations.push(place);
    }
  }

  return {
    candidateId: candidate.candidateId,
    businessDateKst: candidate.businessDateKst,
    topic: candidate.contentAssignment.topic || candidate.selectedAgenda.title,
    audience: candidate.contentPlan?.targetAudience ?? candidate.contentAssignment.audience ?? null,
    commercialIntent: candidate.contentAssignment.commercialIntent,
    hookHint: candidate.contentPlan?.hook ?? candidate.selectedAgenda.timelinessNote ?? null,
    keyMessage: candidate.contentPlan?.keyMessage ?? candidate.selectedAgenda.summary ?? null,
    destinations,
    entities: [...(candidate.selectedAgenda.entities ?? [])],
    usableFacts: usableFacts.slice(0, 8),
    avoidedStatements: [...new Set(avoidedStatements)].slice(0, 8),
    unsupportedClaims: unsupported.slice(0, 12),
    governanceDecision: candidate.governanceDecision?.decision ?? null,
    sourceRevision: computePublishableSourceRevision(candidate),
    evidenceRefIds,
  };
}

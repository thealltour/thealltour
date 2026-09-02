import type { AssignmentEvidenceRef, AssignmentFact, ContentPlan } from "@/lib/marketing/content/types";
import type { MorningReviewEvidenceClaim, MorningReviewEvidenceSupport } from "@/lib/marketing/review/morningReview/types";
import { safeExternalUrl, sanitizeTextForDisplay } from "@/lib/marketing/review/dto";

const MAX_EXCERPT = 500;

function sourceDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function toSupport(ref: AssignmentEvidenceRef): MorningReviewEvidenceSupport {
  const url = safeExternalUrl(ref.url);
  return {
    evidenceId: ref.evidenceId,
    sourceName: ref.sourceName,
    sourceDomain: sourceDomain(url),
    publishedAt: ref.publishedAt,
    observedAt: ref.observedAt,
    credibilityHint: ref.credibilityHint,
    excerpt: ref.excerpt ? sanitizeTextForDisplay(ref.excerpt, MAX_EXCERPT) : null,
    url,
    isOfficial: ref.isOfficial,
  };
}

function resolveSupports(
  fact: AssignmentFact | undefined,
  evidenceById: Map<string, AssignmentEvidenceRef>,
): MorningReviewEvidenceSupport[] {
  if (!fact) return [];
  const supports: MorningReviewEvidenceSupport[] = [];
  for (const evidenceId of fact.evidenceRefs) {
    const ref = evidenceById.get(evidenceId);
    if (ref) supports.push(toSupport(ref));
  }
  return supports;
}

export function buildMorningReviewEvidenceClaims(input: {
  facts: AssignmentFact[];
  evidenceRefs: AssignmentEvidenceRef[];
  factsToUse: string[];
}): MorningReviewEvidenceClaim[] {
  const evidenceById = new Map(input.evidenceRefs.map((ref) => [ref.evidenceId, ref]));
  const factByStatement = new Map(input.facts.map((fact) => [fact.statement, fact]));

  const claimTexts =
    input.factsToUse.length > 0
      ? input.factsToUse
      : input.facts.filter((fact) => fact.confidence !== "low").map((fact) => fact.statement);

  return claimTexts.map((claim) => {
    const matched = factByStatement.get(claim);
    const supports = resolveSupports(matched, evidenceById);
    return {
      claim: sanitizeTextForDisplay(claim, 1000),
      supports,
      linkage: matched && supports.length > 0 ? "assignment_fact" : "unlinked",
    };
  });
}

export function pickFactsToUse(plan: ContentPlan | null, facts: AssignmentFact[]): string[] {
  if (plan?.factsToUse?.length) return plan.factsToUse;
  return facts.filter((fact) => fact.confidence !== "low").map((fact) => fact.statement);
}

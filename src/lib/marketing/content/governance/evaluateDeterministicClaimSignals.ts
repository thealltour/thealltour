import type { AssignmentEvidenceRef, ContentAssignment, ContentPlan } from "@/lib/marketing/content/types";
import type { ContentStrategistOutput } from "@/lib/marketing/bot/organization/handoffs";
import {
  detectCsAddedClaims,
  extractGovernanceClaims,
  GUARANTEE_RE,
  PRICE_RE,
  VISA_RE,
} from "@/lib/marketing/content/governance/extractClaims";
import type {
  GovernanceClaim,
  GovernancePreflightSignals,
} from "@/lib/marketing/content/governance/types";

const STALE_MS = 1000 * 60 * 60 * 24 * 45;

function isStaleEvidence(ref: AssignmentEvidenceRef, now: Date): boolean {
  const anchor = ref.publishedAt ?? ref.observedAt;
  if (!anchor) return false;
  return now.getTime() - new Date(anchor).getTime() > STALE_MS;
}

function hasEvidenceForClaimType(
  claim: GovernanceClaim,
  evidenceRefs: AssignmentEvidenceRef[],
): boolean {
  if (claim.evidenceRefs.length > 0) return true;
  if (claim.claimType === "opinion") return true;
  if (claim.claimType === "price") {
    return evidenceRefs.some((ref) => /price|product|internal/i.test(ref.evidenceType ?? ""));
  }
  if (claim.claimType === "visa_entry" || claim.claimType === "safety") {
    return evidenceRefs.some((ref) => ref.isOfficial);
  }
  return evidenceRefs.some((ref) => ref.excerpt && claim.text.includes(ref.excerpt.slice(0, 40)));
}

export function evaluateDeterministicClaimSignals(input: {
  draft: ContentStrategistOutput;
  assignment?: ContentAssignment | null;
  contentPlan?: ContentPlan | null;
  now?: Date;
}): GovernancePreflightSignals {
  const now = input.now ?? new Date();
  const evidenceRefs = input.assignment?.evidenceRefs ?? input.contentPlan?.evidenceRefs ?? [];
  const allowedFactTexts = new Set<string>([
    ...(input.contentPlan?.factsToUse ?? []),
    ...(input.assignment?.facts?.map((fact) => fact.statement) ?? []),
  ]);

  const claims = extractGovernanceClaims({
    draft: input.draft,
    contentPlan: input.contentPlan,
    allowedEvidenceIds: new Set(evidenceRefs.map((ref) => ref.evidenceId)),
  });

  const unsupportedClaims: string[] = [];
  const factualRisks: string[] = [];
  const evidenceGaps: string[] = [];
  const commercialRisks: string[] = [];
  const staleEvidenceIds: string[] = [];
  const suggestedConcerns: string[] = [];

  for (const ref of evidenceRefs) {
    if (isStaleEvidence(ref, now)) staleEvidenceIds.push(ref.evidenceId);
  }

  for (const claim of claims) {
    if (!hasEvidenceForClaimType(claim, evidenceRefs)) {
      unsupportedClaims.push(claim.claimId);
      evidenceGaps.push(claim.text.slice(0, 120));
      if (claim.claimType === "price") {
        factualRisks.push("unsupported_exact_price");
        suggestedConcerns.push("Remove or source exact price claims.");
      }
      if (claim.claimType === "visa_entry") {
        factualRisks.push("unsupported_visa_entry_claim");
        suggestedConcerns.push("Visa/entry claims require official evidence.");
      }
      if (claim.claimType === "schedule") {
        factualRisks.push("unsupported_schedule_claim");
      }
    }
    if (claim.commercialClaim && GUARANTEE_RE.test(claim.text)) {
      commercialRisks.push("misleading_guarantee_wording");
    }
    if (PRICE_RE.test(claim.text) && !evidenceRefs.length) {
      commercialRisks.push("commercial_price_without_evidence");
    }
  }

  const csAdded = detectCsAddedClaims(claims, allowedFactTexts);
  for (const claim of csAdded) {
    if (VISA_RE.test(claim.text) || PRICE_RE.test(claim.text)) {
      factualRisks.push("cs_added_unverified_claim");
      suggestedConcerns.push("Draft adds facts absent from assignment evidence.");
    }
  }

  if (staleEvidenceIds.length > 0) {
    suggestedConcerns.push("Some evidence references may be stale.");
  }

  // Productless informational content is valid — no penalty for empty matchedProductIds.

  return {
    unsupportedClaims,
    factualRisks: [...new Set(factualRisks)],
    evidenceGaps: evidenceGaps.slice(0, 8),
    commercialRisks: [...new Set(commercialRisks)],
    staleEvidenceIds,
    suggestedConcerns: suggestedConcerns.slice(0, 8),
  };
}

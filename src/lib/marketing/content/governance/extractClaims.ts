import { createHash } from "node:crypto";

import type { ContentPlan } from "@/lib/marketing/content/types";
import type { ContentStrategistOutput } from "@/lib/marketing/bot/organization/handoffs";
import type { GovernanceClaim, GovernanceClaimType } from "@/lib/marketing/content/governance/types";

const PRICE_RE = /\d[\d,.]*\s*(원|만원|usd|\$|€|eur)/i;
const VISA_RE = /\b(비자|visa|입국|entry requirement|immigration)\b/i;
const SCHEDULE_RE = /\b(출발|일정|매일|매주|\d{1,2}월\s*\d{1,2}일|departure|itinerary)\b/i;
const GUARANTEE_RE = /\b(보장|확정|100%|무조건|guaranteed)\b/i;
const PROMO_RE = /\b(할인|특가|한정|세일|discount|limited offer)\b/i;
const SAFETY_RE = /\b(안전|위험|safety|warning|advisory)\b/i;

function classifyClaim(text: string): GovernanceClaimType {
  if (PRICE_RE.test(text)) return "price";
  if (VISA_RE.test(text)) return "visa_entry";
  if (SCHEDULE_RE.test(text)) return "schedule";
  if (GUARANTEE_RE.test(text)) return "promotional";
  if (PROMO_RE.test(text)) return "promotional";
  if (SAFETY_RE.test(text)) return "safety";
  return "factual";
}

function claimFromText(
  text: string,
  sourcedFrom: GovernanceClaim["sourcedFrom"],
  evidenceRefs: string[] = [],
): GovernanceClaim | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length < 8) return null;
  const claimType = classifyClaim(normalized);
  return {
    claimId: createHash("sha256").update(`${sourcedFrom}:${normalized}`).digest("hex").slice(0, 16),
    text: normalized.slice(0, 400),
    claimType,
    evidenceRefs,
    requiresVerification: claimType !== "opinion",
    commercialClaim: claimType === "price" || claimType === "promotional" || claimType === "product",
    timeSensitive: claimType === "visa_entry" || claimType === "schedule" || claimType === "safety",
    destination: null,
    entity: null,
    sourcedFrom,
  };
}

function scanDraftSentences(body: string): GovernanceClaim[] {
  const claims: GovernanceClaim[] = [];
  const seen = new Set<string>();
  for (const sentence of body.split(/[.!?\n]+/)) {
    const claim = claimFromText(sentence, "draft_scan");
    if (!claim || seen.has(claim.claimId)) continue;
    seen.add(claim.claimId);
    claims.push(claim);
  }
  return claims.slice(0, 12);
}

export function extractGovernanceClaims(input: {
  draft: ContentStrategistOutput;
  contentPlan?: ContentPlan | null;
  allowedEvidenceIds?: Set<string>;
}): GovernanceClaim[] {
  const claims: GovernanceClaim[] = [];
  const seen = new Set<string>();

  const add = (claim: GovernanceClaim | null) => {
    if (!claim || seen.has(claim.claimId)) return;
    seen.add(claim.claimId);
    claims.push(claim);
  };

  for (const fact of input.contentPlan?.factsToUse ?? []) {
    add(claimFromText(fact, "content_plan", input.contentPlan?.evidenceRefs.map((ref) => ref.evidenceId) ?? []));
  }

  for (const sentence of scanDraftSentences(input.draft.body)) {
    add(sentence);
  }

  return claims.slice(0, 16);
}

export function detectCsAddedClaims(
  claims: GovernanceClaim[],
  allowedFactTexts: Set<string>,
): GovernanceClaim[] {
  return claims.filter((claim) => {
    if (claim.sourcedFrom !== "draft_scan") return false;
    for (const allowed of allowedFactTexts) {
      if (allowed.includes(claim.text) || claim.text.includes(allowed)) return false;
    }
    return true;
  });
}

export { PRICE_RE, VISA_RE, SCHEDULE_RE, GUARANTEE_RE, PROMO_RE };

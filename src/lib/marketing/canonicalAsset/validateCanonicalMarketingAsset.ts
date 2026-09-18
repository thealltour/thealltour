/**
 * Deterministic Canonical Marketing Asset validation (fail-closed).
 */

import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import type {
  EvidenceBackedStoryBrief,
  StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";
import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { CANONICAL_MARKETING_ASSET_CONTRACT } from "@/lib/marketing/canonicalAsset/contracts";

export type CanonicalAssetValidationIssue = {
  code: string;
  messageKo: string;
};

const PRICE_ROUTE_PATTERNS =
  /(\d{1,3}(?:,\d{3})+\s*원|\d+\s*만원|항공권\s*\d+|매일\s*운항|확정\s*가격\s*(은|는|이|가|으로|로)?\s*\d|무조건\s*\d)/i;
const ENGLISH_PROSE =
  /\b(the|and|with|for|this|that|travelers?|should|because)\b/i;

function hangulRatio(text: string): number {
  const chars = text.replace(/\s+/g, "");
  if (!chars) return 0;
  const hangul = (chars.match(/[\uAC00-\uD7A3]/g) ?? []).length;
  return hangul / chars.length;
}

function fieldThin(text: string | null | undefined, min = 12): boolean {
  return !(text && text.trim().length >= min);
}

export function validateCanonicalMarketingAsset(input: {
  asset: CanonicalMarketingAsset | null | undefined;
  storyPoint: StoryContentPoint;
  storyPointHash: string;
  evidenceBrief: EvidenceBackedStoryBrief | null;
  proposition: ContentProposition;
  expectedSourceRevision: string;
}): { ok: boolean; issues: CanonicalAssetValidationIssue[] } {
  const issues: CanonicalAssetValidationIssue[] = [];
  const asset = input.asset;
  if (!asset) {
    return { ok: false, issues: [{ code: "missing_asset", messageKo: "Canonical Asset가 없습니다." }] };
  }
  if (asset.contract !== CANONICAL_MARKETING_ASSET_CONTRACT) {
    issues.push({ code: "contract_mismatch", messageKo: "asset contract가 올바르지 않습니다." });
  }
  if (asset.storyPointId !== input.storyPoint.pointId) {
    issues.push({ code: "story_id_drift", messageKo: "StoryPoint id가 일치하지 않습니다." });
  }
  if (asset.storyPointHash !== input.storyPointHash) {
    issues.push({ code: "story_hash_drift", messageKo: "StoryPoint hash가 일치하지 않습니다." });
  }
  if (asset.sourceRevision !== input.expectedSourceRevision) {
    issues.push({
      code: "source_revision_mismatch",
      messageKo: "sourceRevision이 Story/Evidence/Proposition 잠금과 맞지 않습니다.",
    });
  }

  if (fieldThin(asset.titleKo, 4)) {
    issues.push({ code: "title_empty", messageKo: "titleKo가 비어 있거나 너무 짧습니다." });
  }
  if (fieldThin(asset.openingHookKo, 10)) {
    issues.push({ code: "opening_empty", messageKo: "openingHookKo가 비어 있거나 너무 짧습니다." });
  }
  if (fieldThin(asset.bodyKo, 80)) {
    issues.push({ code: "body_too_thin", messageKo: "bodyKo가 완전한 원문으로 보기엔 너무 짧습니다." });
  }
  if (fieldThin(asset.decisionGuidanceKo, 8)) {
    issues.push({ code: "payoff_empty", messageKo: "decisionGuidanceKo가 비어 있습니다." });
  }
  if (!Array.isArray(asset.keyTakeawaysKo) || asset.keyTakeawaysKo.length < 1) {
    issues.push({ code: "takeaways_empty", messageKo: "keyTakeawaysKo가 비어 있습니다." });
  }

  const humanText = [
    asset.titleKo,
    asset.dekKo,
    asset.openingHookKo,
    asset.bodyKo,
    asset.decisionGuidanceKo,
    ...asset.keyTakeawaysKo,
  ]
    .filter(Boolean)
    .join("\n");
  if (hangulRatio(humanText) < 0.35) {
    issues.push({
      code: "not_korean",
      messageKo: "사람용 본문이 한국어 중심으로 작성되지 않았습니다.",
    });
  }
  const bodyLines = asset.bodyKo.split(/\n+/).filter((l) => l.trim().length > 40);
  const englishHeavy = bodyLines.filter(
    (l) => hangulRatio(l) < 0.2 && ENGLISH_PROSE.test(l),
  );
  if (englishHeavy.length >= 2) {
    issues.push({
      code: "english_editorial_prose",
      messageKo: "영어 편집 산문이 감지되었습니다. 한국어로 작성하세요.",
    });
  }

  const boundary =
    asset.supportedClaimBoundaryKo?.trim() ||
    input.evidenceBrief?.supportedClaimBoundary?.trim() ||
    input.proposition.supportedClaimBoundaryUsed?.trim() ||
    null;
  if (
    (input.evidenceBrief?.storySupportVerdict === "PARTIALLY_SUPPORTED" ||
      input.proposition.storySupportVerdict === "PARTIALLY_SUPPORTED") &&
    !boundary
  ) {
    issues.push({
      code: "missing_partial_boundary",
      messageKo: "PARTIALLY_SUPPORTED인데 supportedClaimBoundary가 없습니다.",
    });
  }

  const contradicted = [
    ...(input.evidenceBrief?.contradictedClaims ?? []),
    ...asset.forbiddenClaimsKo,
  ]
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  for (const claim of contradicted) {
    if (claim.length >= 6 && humanText.toLowerCase().includes(claim)) {
      issues.push({
        code: "contradicted_claim_revived",
        messageKo: `반박/금지 주장이 본문에 다시 등장합니다: ${claim.slice(0, 80)}`,
      });
    }
  }

  if (PRICE_ROUTE_PATTERNS.test(humanText)) {
    const evidenceBlob = [
      ...(input.evidenceBrief?.researchQuestionFindings ?? []).map((f) => f.finding),
      ...(input.evidenceBrief?.researchSupportedFraming ?? []),
    ].join("\n");
    if (!PRICE_ROUTE_PATTERNS.test(evidenceBlob)) {
      issues.push({
        code: "unsupported_price_or_route",
        messageKo: "증거에 없는 가격/운항·확정 수치 주장이 감지되었습니다.",
      });
    }
  }

  const originalClaim = (input.storyPoint.storyClaim ?? "").trim();
  if (
    boundary &&
    originalClaim.length >= 16 &&
    boundary.length >= 8 &&
    originalClaim !== boundary &&
    humanText.includes(originalClaim) &&
    !humanText.includes(boundary.slice(0, Math.min(20, boundary.length)))
  ) {
    issues.push({
      code: "boundary_violation",
      messageKo: "PARTIALLY_SUPPORTED 경계를 넘어 원래의 넓은 주장을 복원한 것으로 보입니다.",
    });
  }

  return { ok: issues.length === 0, issues };
}

export function isApprovedCanonicalAsset(
  asset: CanonicalMarketingAsset | null | undefined,
): asset is CanonicalMarketingAsset {
  return Boolean(
    asset &&
      asset.status === "approved" &&
      typeof asset.approvedVersion === "number" &&
      asset.approvedVersion === asset.version,
  );
}

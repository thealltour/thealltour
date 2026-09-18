/**
 * Generate + validate Canonical Marketing Asset (max 1 LLM repair, fail-closed).
 * Never fabricates deterministic fallback prose.
 */

import {
  ASSET_SOURCE_WRITER_ROLE,
  CANONICAL_MARKETING_ASSET_CONTRACT,
  type CanonicalMarketingAsset,
  type CanonicalAssetWriterInput,
} from "@/lib/marketing/canonicalAsset/contracts";
import { buildAssetSourceWriterPrompt } from "@/lib/marketing/canonicalAsset/prompt";
import { parseCanonicalMarketingAssetContent } from "@/lib/marketing/canonicalAsset/parseCanonicalMarketingAsset";
import {
  buildCanonicalAssetWriterInput,
  computeCanonicalAssetSourceRevision,
  createCanonicalAssetId,
} from "@/lib/marketing/canonicalAsset/revisions";
import {
  validateCanonicalMarketingAsset,
  type CanonicalAssetValidationIssue,
} from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import type {
  EvidenceBackedStoryBrief,
  StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";

export const CANONICAL_ASSET_MAX_REPAIRS = 1 as const;

export type AssetSourceWriterInvoke = (prompt: string) => Promise<string> | string;

export type EnsureCanonicalMarketingAssetInput = {
  agendaId: string;
  storyPoint: StoryContentPoint;
  storyPointHash: string;
  evidenceBrief: EvidenceBackedStoryBrief | null;
  proposition: ContentProposition;
  topicIdentitySummary: string;
  brandContextKo?: string | null;
  /** Existing durable asset — reuse when sourceRevision matches (0 LLM). */
  existing?: CanonicalMarketingAsset | null;
  /**
   * Skip reuse and always call Asset Source Writer (operator rewrite / prompt bump).
   * Does not change Story/Evidence/Proposition locks.
   */
  forceRegenerate?: boolean;
  invoke: AssetSourceWriterInvoke | null;
  now?: Date;
};

export type EnsureCanonicalMarketingAssetResult = {
  asset: CanonicalMarketingAsset | null;
  outcome: "reused" | "generated" | "repaired" | "validation_failed" | "invoke_missing" | "parse_failed";
  repairCount: number;
  llmCallCount: number;
  validationIssues: CanonicalAssetValidationIssue[];
  writerInput: CanonicalAssetWriterInput;
  sourceRevision: string;
};

function mergeParsed(
  parsed: NonNullable<ReturnType<typeof parseCanonicalMarketingAssetContent>>,
  writerInput: CanonicalAssetWriterInput,
  sourceRevision: string,
  nowIso: string,
  repairCount: number,
  validationIssues: string[],
  status: CanonicalMarketingAsset["status"],
): CanonicalMarketingAsset {
  const boundary =
    parsed.supportedClaimBoundaryKo ??
    writerInput.supportedClaimBoundary ??
    writerInput.proposition.supportedClaimBoundaryUsed;
  const forbidden = [
    ...new Set([
      ...parsed.forbiddenClaimsKo,
      ...writerInput.contradictedClaims,
    ]),
  ].slice(0, 16);
  const limitations = [
    ...new Set([
      ...parsed.limitationsKo,
      ...writerInput.evidenceLimitations,
      ...writerInput.proposition.limitations,
    ]),
  ].slice(0, 16);
  const unresolved = [
    ...new Set([
      ...parsed.unresolvedQuestionsKo,
      ...writerInput.unresolvedQuestions,
    ]),
  ].slice(0, 16);

  return {
    contract: CANONICAL_MARKETING_ASSET_CONTRACT,
    assetId: createCanonicalAssetId(sourceRevision),
    version: 1,
    status,
    agendaId: writerInput.agendaId,
    storyPointId: writerInput.storyPointId,
    storyPointHash: writerInput.storyPointHash,
    evidenceBriefRef: writerInput.evidenceBriefRef,
    evidenceRevision: writerInput.evidenceRevision,
    contentPropositionRef: writerInput.proposition.contentPropositionRef,
    propositionRevision: writerInput.proposition.propositionRevision,
    sourceRevision,
    titleKo: parsed.titleKo,
    dekKo: parsed.dekKo,
    openingHookKo: parsed.openingHookKo,
    bodyKo: parsed.bodyKo,
    keyTakeawaysKo: parsed.keyTakeawaysKo,
    decisionGuidanceKo: parsed.decisionGuidanceKo,
    optionalCtaIntentKo: parsed.optionalCtaIntentKo,
    evidenceRefs: parsed.evidenceRefs,
    limitationsKo: limitations,
    forbiddenClaimsKo: forbidden,
    supportedClaimBoundaryKo: boundary,
    unresolvedQuestionsKo: unresolved,
    storySupportVerdict: writerInput.storySupportVerdict,
    generatedAt: nowIso,
    editedAt: null,
    approvedAt: null,
    approvedVersion: null,
    humanEdited: false,
    approvalSource: null,
    approvedBy: null,
    generatedBy: ASSET_SOURCE_WRITER_ROLE,
    repairCount,
    validationIssues,
    editorialArchetype: writerInput.editorialArchetype?.trim() || null,
  };
}

export async function ensureCanonicalMarketingAsset(
  input: EnsureCanonicalMarketingAssetInput,
): Promise<EnsureCanonicalMarketingAssetResult> {
  const nowIso = (input.now ?? new Date()).toISOString();
  const writerInput = buildCanonicalAssetWriterInput({
    agendaId: input.agendaId,
    storyPoint: input.storyPoint,
    storyPointHash: input.storyPointHash,
    evidenceBrief: input.evidenceBrief,
    proposition: input.proposition,
    topicIdentitySummary: input.topicIdentitySummary,
    brandContextKo: input.brandContextKo,
  });
  const sourceRevision = computeCanonicalAssetSourceRevision({
    storyPointId: writerInput.storyPointId,
    storyPointHash: writerInput.storyPointHash,
    evidenceRevision: writerInput.evidenceRevision,
    propositionRevision: writerInput.proposition.propositionRevision,
    supportedClaimBoundary: writerInput.supportedClaimBoundary,
    editorialArchetype: writerInput.editorialArchetype,
  });

  // Preserve human edits / approvals when upstream lock unchanged.
  if (
    !input.forceRegenerate &&
    input.existing &&
    input.existing.sourceRevision === sourceRevision &&
    (input.existing.status === "approved" ||
      input.existing.status === "human_edited" ||
      input.existing.status === "draft") &&
    input.existing.bodyKo?.trim()
  ) {
    return {
      asset: input.existing,
      outcome: "reused",
      repairCount: input.existing.repairCount,
      llmCallCount: 0,
      validationIssues: [],
      writerInput,
      sourceRevision,
    };
  }

  if (!input.invoke) {
    return {
      asset: null,
      outcome: "invoke_missing",
      repairCount: 0,
      llmCallCount: 0,
      validationIssues: [
        { code: "invoke_missing", messageKo: "Asset Source Writer invoke가 없습니다." },
      ],
      writerInput,
      sourceRevision,
    };
  }

  let llmCallCount = 0;
  let repairCount = 0;
  let lastIssues: CanonicalAssetValidationIssue[] = [];

  const runOnce = async (repairReasonsKo: string[] | null) => {
    const prompt = buildAssetSourceWriterPrompt({ writerInput, repairReasonsKo });
    llmCallCount += 1;
    const raw = await input.invoke!(prompt);
    const parsed = parseCanonicalMarketingAssetContent(raw);
    if (!parsed) {
      return { asset: null as CanonicalMarketingAsset | null, issues: [
        { code: "parse_failed", messageKo: "Asset Source Writer JSON 파싱에 실패했습니다." },
      ] as CanonicalAssetValidationIssue[] };
    }
    const draft = mergeParsed(parsed, writerInput, sourceRevision, nowIso, repairCount, [], "draft");
    const check = validateCanonicalMarketingAsset({
      asset: draft,
      storyPoint: input.storyPoint,
      storyPointHash: input.storyPointHash,
      evidenceBrief: input.evidenceBrief,
      proposition: input.proposition,
      expectedSourceRevision: sourceRevision,
    });
    if (!check.ok) {
      return {
        asset: {
          ...draft,
          status: "validation_failed" as const,
          validationIssues: check.issues.map((i) => i.messageKo),
        },
        issues: check.issues,
      };
    }
    return { asset: draft, issues: [] as CanonicalAssetValidationIssue[] };
  };

  const first = await runOnce(null);
  lastIssues = first.issues;
  if (first.asset && first.issues.length === 0) {
    return {
      asset: first.asset,
      outcome: "generated",
      repairCount: 0,
      llmCallCount,
      validationIssues: [],
      writerInput,
      sourceRevision,
    };
  }

  if (repairCount < CANONICAL_ASSET_MAX_REPAIRS) {
    repairCount = 1;
    const second = await runOnce(lastIssues.map((i) => i.messageKo));
    lastIssues = second.issues;
    if (second.asset && second.issues.length === 0) {
      return {
        asset: { ...second.asset, repairCount: 1 },
        outcome: "repaired",
        repairCount: 1,
        llmCallCount,
        validationIssues: [],
        writerInput,
        sourceRevision,
      };
    }
    return {
      asset: second.asset
        ? { ...second.asset, repairCount: 1, status: "validation_failed" }
        : first.asset
          ? { ...first.asset, repairCount: 1, status: "validation_failed" }
          : null,
      outcome: second.asset ? "validation_failed" : "parse_failed",
      repairCount: 1,
      llmCallCount,
      validationIssues: lastIssues.length ? lastIssues : first.issues,
      writerInput,
      sourceRevision,
    };
  }

  return {
    asset: first.asset,
    outcome: first.asset ? "validation_failed" : "parse_failed",
    repairCount,
    llmCallCount,
    validationIssues: lastIssues,
    writerInput,
    sourceRevision,
  };
}

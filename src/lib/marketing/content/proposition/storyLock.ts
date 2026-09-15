/**
 * ED-3 — Deterministic ContentProposition lock against StoryPoint + EvidenceBrief.
 * CS may structure/express the approved Story; it may not invent a new one.
 */

import { createHash } from "node:crypto";

import type { AgendaTopicIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import { identityIsCruise } from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import {
  textLooksCruiseSpecific,
  validateAngleAgainstAgendaIdentity,
} from "@/lib/marketing/audienceResearch/topicIdentity/validateAgainstIdentity";
import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import type {
  EvidenceBackedStoryBrief,
  StoryContentPoint,
  StoryEvidenceSupportStatus,
} from "@/lib/marketing/storyPoint/contracts";
import { storyEvidenceAllowsContentStrategy } from "@/lib/marketing/storyPoint/evaluateStoryPointQuality";
import { validateStoryResearchLock } from "@/lib/marketing/storyPoint/researchLock";

export const PROPOSITION_LOCK_VERSION = "proposition-lock-v1" as const;

export const CONTENT_PROPOSITION_STORY_LOCK_REASONS = [
  "content_proposition_story_drift",
  "content_proposition_boundary_violation",
  "content_proposition_unsupported_takeaway",
  "content_proposition_generic_fallback",
  "content_proposition_evidence_mismatch",
  "content_proposition_validation_failed",
  "content_proposition_refuted_or_insufficient",
  "content_proposition_contradicted_claim_revival",
] as const;

export type ContentPropositionStoryLockReason =
  (typeof CONTENT_PROPOSITION_STORY_LOCK_REASONS)[number];

export type TakeawayEvidenceRef = {
  takeaway: string;
  evidenceRefs: string[];
};

export type ContentPropositionStoryLockInput = {
  proposition: ContentProposition;
  storyPoint: StoryContentPoint;
  evidenceBrief: EvidenceBackedStoryBrief;
  topicIdentity?: AgendaTopicIdentity | null;
};

export type ContentPropositionStoryLockIssue = {
  code: ContentPropositionStoryLockReason | string;
  field: string;
  message: string;
};

export type ContentPropositionStoryLockResult = {
  ok: boolean;
  issues: ContentPropositionStoryLockIssue[];
  evidenceBackedTakeawayCount: number;
  unsupportedTakeawayCount: number;
  boundaryUsed: boolean;
  driftReasons: string[];
};

const STRUCTURAL_GENERIC_FALLBACK =
  /(?:태국|방콕|나트랑|일본|여행)\s*(?:시|할\s*때)?\s*(?:알아둘\s*점|준비\s*팁|종합\s*가이드|여행\s*체크리스트)|여행\s*시\s*살펴볼\s*점|기본\s*여행\s*정보\s*소개/i;

const OVERBROAD_ABSOLUTE =
  /무조건|항상\s*더\s*중요|등급보다\s*위치가\s*더\s*중요하(다|며)|위치가\s*항상/i;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function significantOverlap(a: string, b: string, minHits = 1): boolean {
  const left = new Set(tokenize(a));
  let hits = 0;
  for (const t of tokenize(b)) {
    if (left.has(t)) hits += 1;
  }
  return hits >= minHits;
}

function storyCoreBlob(story: StoryContentPoint): string {
  return [
    story.storyQuestion ?? "",
    story.storyClaim ?? "",
    story.audienceTension,
    story.curiosityGap,
    story.readerPayoff,
    ...story.researchQuestions,
  ].join("\n");
}

function evidenceSupportBlob(brief: EvidenceBackedStoryBrief): string {
  return [
    brief.supportedClaimBoundary ?? "",
    ...brief.researchSupportedFraming,
    ...brief.researchQuestionFindings.map((f) => `${f.question}\n${f.finding}`),
    ...brief.usableFactIds,
  ].join("\n");
}

function collectEvidenceTokens(brief: EvidenceBackedStoryBrief): Set<string> {
  return new Set(
    tokenize(evidenceSupportBlob(brief)).filter((t) =>
      /방콕|나트랑|호텔|위치|등급|bts|mrt|부모|이동|접근|패키지|크루즈|부산|항공|교통|숙소/i.test(t),
    ),
  );
}

function takeawayHasEvidenceSupport(
  takeaway: string,
  brief: EvidenceBackedStoryBrief,
  explicitRefs?: TakeawayEvidenceRef[] | null,
): boolean {
  const mapped = explicitRefs?.find((r) => r.takeaway.trim() === takeaway.trim());
  if (mapped && mapped.evidenceRefs.length > 0) {
    return significantOverlap(evidenceSupportBlob(brief), takeaway, 1);
  }
  const evidenceTokens = collectEvidenceTokens(brief);
  if (tokenize(takeaway).some((t) => evidenceTokens.has(t))) return true;
  return brief.researchQuestionFindings.some(
    (f) =>
      (f.status === "answered" || f.status === "partially_answered") &&
      significantOverlap(`${f.finding} ${f.question}`, takeaway, 1),
  );
}

function issue(
  code: ContentPropositionStoryLockReason | string,
  field: string,
  message: string,
): ContentPropositionStoryLockIssue {
  return { code, field, message };
}

/** Fail closed before CS when story research is REFUTED / INSUFFICIENT_EVIDENCE. */
export function assertStoryVerdictAllowsContentStrategist(
  verdict: StoryEvidenceSupportStatus | null | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (!verdict) return { ok: true };
  if (!storyEvidenceAllowsContentStrategy(verdict)) {
    return { ok: false, reason: "content_proposition_refuted_or_insufficient" };
  }
  return { ok: true };
}

export function computePropositionSourceRevision(input: {
  storyPointHash: string;
  storySupportVerdict: StoryEvidenceSupportStatus;
  supportedClaimBoundary: string | null | undefined;
  evidenceBrief: Pick<
    EvidenceBackedStoryBrief,
    | "storyPointHash"
    | "storySupportVerdict"
    | "supportedClaimBoundary"
    | "researchQuestionFindings"
    | "researchSupportedFraming"
    | "contradictedClaims"
    | "unresolvedQuestions"
    | "limitations"
  >;
}): string {
  const payload = {
    lock: PROPOSITION_LOCK_VERSION,
    storyPointHash: input.storyPointHash,
    storySupportVerdict: input.storySupportVerdict,
    supportedClaimBoundary: input.supportedClaimBoundary ?? null,
    findings: input.evidenceBrief.researchQuestionFindings.map((f) => ({
      q: f.question,
      s: f.status,
      f: f.finding,
    })),
    framing: input.evidenceBrief.researchSupportedFraming,
    contradicted: input.evidenceBrief.contradictedClaims,
    unresolved: input.evidenceBrief.unresolvedQuestions,
    limitations: input.evidenceBrief.limitations,
  };
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex").slice(0, 24);
}

export function computeEvidenceBriefRevision(brief: EvidenceBackedStoryBrief): string {
  return computePropositionSourceRevision({
    storyPointHash: brief.storyPointHash,
    storySupportVerdict: brief.storySupportVerdict,
    supportedClaimBoundary: brief.supportedClaimBoundary,
    evidenceBrief: brief,
  });
}

/** Deterministic Story-lock validation for ContentProposition. */
export function validateContentPropositionAgainstStory(
  input: ContentPropositionStoryLockInput,
): ContentPropositionStoryLockResult {
  const { proposition, storyPoint, evidenceBrief, topicIdentity } = input;
  const issues: ContentPropositionStoryLockIssue[] = [];
  const driftReasons: string[] = [];
  const boundaryUsed = Boolean(
    evidenceBrief.storySupportVerdict === "PARTIALLY_SUPPORTED" &&
      evidenceBrief.supportedClaimBoundary?.trim(),
  );

  const verdictGate = assertStoryVerdictAllowsContentStrategist(evidenceBrief.storySupportVerdict);
  if (!verdictGate.ok) {
    issues.push(
      issue(
        "content_proposition_refuted_or_insufficient",
        "storySupportVerdict",
        verdictGate.reason,
      ),
    );
    return {
      ok: false,
      issues,
      evidenceBackedTakeawayCount: 0,
      unsupportedTakeawayCount: proposition.specificTakeaways.length,
      boundaryUsed,
      driftReasons: [verdictGate.reason],
    };
  }

  const propBlob = [
    proposition.primaryAudience,
    proposition.audienceProblem,
    proposition.audienceTension,
    proposition.contentPromise,
    proposition.readerGain,
    proposition.angle,
    proposition.keyMessage,
    ...proposition.specificTakeaways,
  ].join("\n");

  if (topicIdentity) {
    const idCheck = validateAngleAgainstAgendaIdentity(propBlob, topicIdentity);
    if (!idCheck.ok) {
      for (const iss of idCheck.issues) {
        issues.push(
          issue("content_proposition_story_drift", "identity", `${iss.dimension}:${iss.reason}`),
        );
        driftReasons.push(`identity:${iss.dimension}`);
      }
    }
    if (textLooksCruiseSpecific(propBlob) && !identityIsCruise(topicIdentity)) {
      issues.push(issue("content_proposition_story_drift", "angle", "cruise_contamination"));
      driftReasons.push("cruise_contamination");
    }

    const storyLock = validateStoryResearchLock({
      storyPoint,
      brief: {
        ...evidenceBrief,
        researchSupportedFraming: [
          proposition.contentPromise,
          proposition.angle,
          proposition.keyMessage,
          ...evidenceBrief.researchSupportedFraming,
        ],
      },
      topicIdentity,
    });
    if (!storyLock.ok) {
      for (const code of storyLock.issues) {
        issues.push(issue("content_proposition_story_drift", "storyCore", code));
        driftReasons.push(code);
      }
    }
  }

  if (
    proposition.audienceTension.trim() &&
    !significantOverlap(storyPoint.audienceTension, proposition.audienceTension, 1) &&
    !significantOverlap(storyCoreBlob(storyPoint), proposition.audienceTension, 2)
  ) {
    issues.push(
      issue(
        "content_proposition_story_drift",
        "audienceTension",
        "audienceTension unrelated to StoryPoint tension",
      ),
    );
    driftReasons.push("audience_tension_drift");
  }

  if (
    proposition.readerGain.trim() &&
    !significantOverlap(storyPoint.readerPayoff, proposition.readerGain, 1) &&
    !significantOverlap(storyCoreBlob(storyPoint), proposition.readerGain, 2)
  ) {
    issues.push(
      issue(
        "content_proposition_story_drift",
        "readerGain",
        "readerGain does not align with StoryPoint readerPayoff",
      ),
    );
    driftReasons.push("reader_payoff_drift");
  }

  const promiseAnchor =
    evidenceBrief.storySupportVerdict === "PARTIALLY_SUPPORTED" &&
    evidenceBrief.supportedClaimBoundary?.trim()
      ? evidenceBrief.supportedClaimBoundary
      : [storyPoint.storyQuestion ?? "", storyPoint.storyClaim ?? "", storyPoint.curiosityGap].join(
          " ",
        );

  if (
    proposition.contentPromise.trim() &&
    !significantOverlap(promiseAnchor, proposition.contentPromise, 1) &&
    !significantOverlap(storyCoreBlob(storyPoint), proposition.contentPromise, 2)
  ) {
    issues.push(
      issue(
        "content_proposition_boundary_violation",
        "contentPromise",
        "contentPromise not derivable from Story core / supportedClaimBoundary",
      ),
    );
  }

  if (
    evidenceBrief.storySupportVerdict === "PARTIALLY_SUPPORTED" &&
    evidenceBrief.supportedClaimBoundary?.trim() &&
    OVERBROAD_ABSOLUTE.test(`${proposition.contentPromise} ${proposition.keyMessage}`)
  ) {
    issues.push(
      issue(
        "content_proposition_boundary_violation",
        "contentPromise",
        "overbroad claim exceeds supportedClaimBoundary",
      ),
    );
  }

  if (STRUCTURAL_GENERIC_FALLBACK.test(propBlob)) {
    const keepsStory =
      significantOverlap(storyCoreBlob(storyPoint), propBlob, 2) ||
      significantOverlap(promiseAnchor, propBlob, 2);
    if (!keepsStory) {
      issues.push(
        issue(
          "content_proposition_generic_fallback",
          "contentPromise",
          "generic destination advice abandoned Story tension/payoff",
        ),
      );
    }
  }

  let evidenceBackedTakeawayCount = 0;
  let unsupportedTakeawayCount = 0;
  const explicitRefs = proposition.takeawayEvidenceRefs ?? null;
  for (const takeaway of proposition.specificTakeaways) {
    if (!takeaway.trim()) continue;
    if (takeawayHasEvidenceSupport(takeaway, evidenceBrief, explicitRefs)) {
      evidenceBackedTakeawayCount += 1;
    } else {
      unsupportedTakeawayCount += 1;
      issues.push(
        issue(
          "content_proposition_unsupported_takeaway",
          "specificTakeaways",
          `unsupported takeaway: ${takeaway.slice(0, 80)}`,
        ),
      );
    }
  }

  for (const contradicted of evidenceBrief.contradictedClaims) {
    if (!contradicted.trim()) continue;
    if (significantOverlap(propBlob, contradicted, 2)) {
      issues.push(
        issue(
          "content_proposition_contradicted_claim_revival",
          "contentPromise",
          `revives contradicted claim: ${contradicted.slice(0, 80)}`,
        ),
      );
    }
  }

  for (const unresolved of evidenceBrief.unresolvedQuestions) {
    if (!unresolved.trim()) continue;
    const unresolvedTokens = tokenize(unresolved).filter((t) => t.length >= 3);
    if (unresolvedTokens.length === 0) continue;
    const asFact = new RegExp(
      `(?:확인됨|입증|사실|확실|무조건).{0,24}${unresolvedTokens[0]}`,
      "i",
    );
    if (asFact.test(propBlob)) {
      issues.push(
        issue(
          "content_proposition_evidence_mismatch",
          "specificTakeaways",
          `unresolved question presented as fact: ${unresolved.slice(0, 80)}`,
        ),
      );
    }
  }

  if (
    evidenceBrief.limitations.length > 0 &&
    proposition.limitations.length === 0 &&
    proposition.propositionStrength !== "insufficient"
  ) {
    issues.push(
      issue(
        "content_proposition_evidence_mismatch",
        "limitations",
        "evidence limitations not reflected on proposition",
      ),
    );
  }

  return {
    ok: issues.length === 0,
    issues,
    evidenceBackedTakeawayCount,
    unsupportedTakeawayCount,
    boundaryUsed,
    driftReasons,
  };
}

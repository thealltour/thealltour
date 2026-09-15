import type {
  ContentProposition,
  PropositionStrength,
  ProofRequirement,
} from "@/lib/marketing/content/proposition/contracts";
import {
  CONTENT_PROPOSITION_CONTRACT,
  DESIRED_AUDIENCE_ACTIONS,
  ENGAGEMENT_MECHANISMS,
  PROPOSITION_STRENGTHS,
} from "@/lib/marketing/content/proposition/contracts";
import { coerceProofRequirementsList } from "@/lib/marketing/content/validation/contentPlanSchema";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter(Boolean)
    .slice(0, max);
}

function parseProofRequirements(value: unknown): ProofRequirement[] {
  return coerceProofRequirementsList(value);
}

function parseStrength(value: unknown): PropositionStrength {
  const s = asString(value);
  return (PROPOSITION_STRENGTHS as readonly string[]).includes(s)
    ? (s as PropositionStrength)
    : "weak";
}

function parseEngagement(value: unknown): string {
  const s = asString(value);
  if (!s) return "other";
  const normalized = s.toLowerCase().replace(/[\s-]+/g, "_");
  if ((ENGAGEMENT_MECHANISMS as readonly string[]).includes(normalized)) return normalized;
  return s.slice(0, 80);
}

function parseAction(value: unknown): string {
  const s = asString(value).toLowerCase();
  if ((DESIRED_AUDIENCE_ACTIONS as readonly string[]).includes(s)) return s;
  return asString(value).slice(0, 40) || "save";
}

/**
 * Parse provider/CS JSON into ContentProposition. Returns null if unusable object.
 */
export function parseContentProposition(raw: unknown): ContentProposition | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;

  const contentPromise = asString(row.contentPromise);
  const readerGain = asString(row.readerGain);
  const primaryAudience = asString(row.primaryAudience);
  const audienceProblem = asString(row.audienceProblem);
  // Allow empty shell only when explicitly insufficient.
  const strength = parseStrength(row.propositionStrength);
  if (
    strength !== "insufficient" &&
    (!contentPromise || !readerGain || !primaryAudience || !audienceProblem)
  ) {
    // Still parse if enough core fields for validation to explain failures.
  }

  const channelHintsRaw =
    row.channelIntentHints && typeof row.channelIntentHints === "object"
      ? (row.channelIntentHints as Record<string, unknown>)
      : null;
  const channelIntentHints = channelHintsRaw
    ? {
        threads: asString(channelHintsRaw.threads) || undefined,
        shortform: asString(channelHintsRaw.shortform) || undefined,
        naver_blog: asString(channelHintsRaw.naver_blog) || undefined,
        naver_band: asString(channelHintsRaw.naver_band) || undefined,
        kakao_channel: asString(channelHintsRaw.kakao_channel) || undefined,
      }
    : null;

  return {
    contract: CONTENT_PROPOSITION_CONTRACT,
    primaryAudience: primaryAudience.slice(0, 200),
    audienceProblem: audienceProblem.slice(0, 280),
    audienceTension: asString(row.audienceTension).slice(0, 320),
    whyNow: asString(row.whyNow) ? asString(row.whyNow).slice(0, 280) : null,
    contentPromise: contentPromise.slice(0, 400),
    readerGain: readerGain.slice(0, 400),
    specificTakeaways: asStringArray(row.specificTakeaways, 5).map((t) => t.slice(0, 200)),
    proofRequirements: parseProofRequirements(row.proofRequirements),
    contentGapUsed: asString(row.contentGapUsed).slice(0, 320),
    engagementMechanism: parseEngagement(row.engagementMechanism),
    desiredAudienceAction: parseAction(row.desiredAudienceAction),
    angle: asString(row.angle).slice(0, 280),
    keyMessage: asString(row.keyMessage).slice(0, 280),
    commercialIntent: asString(row.commercialIntent) || "informational",
    channelIntentHints,
    propositionStrength: strength,
    limitations: asStringArray(row.limitations, 12).map((t) => t.slice(0, 200)),
    storyPointRef: parseStoryPointRef(row.storyPointRef),
    storyPointHash: asString(row.storyPointHash) || null,
    storySupportVerdict: parseStorySupportVerdict(row.storySupportVerdict),
    supportedClaimBoundaryUsed: asString(row.supportedClaimBoundaryUsed) || null,
    evidenceBriefRevision: asString(row.evidenceBriefRevision) || null,
    propositionLockVersion: asString(row.propositionLockVersion) || null,
    propositionSourceRevision: asString(row.propositionSourceRevision) || null,
    takeawayEvidenceRefs: parseTakeawayEvidenceRefs(row.takeawayEvidenceRefs),
  };
}

function parseStorySupportVerdict(
  value: unknown,
): import("@/lib/marketing/storyPoint/contracts").StoryEvidenceSupportStatus | null {
  const s = asString(value);
  if (
    s === "SUPPORTED" ||
    s === "PARTIALLY_SUPPORTED" ||
    s === "REFUTED" ||
    s === "INSUFFICIENT_EVIDENCE"
  ) {
    return s;
  }
  return null;
}

function parseStoryPointRef(
  value: unknown,
): ContentProposition["storyPointRef"] {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const storyPointId = asString(row.storyPointId);
  const storyPointHash = asString(row.storyPointHash);
  if (!storyPointId || !storyPointHash) return null;
  return {
    storyPointId,
    storyPointHash,
    researchContractVersion: asString(row.researchContractVersion) || undefined,
  };
}

function parseTakeawayEvidenceRefs(
  value: unknown,
): ContentProposition["takeawayEvidenceRefs"] {
  if (!Array.isArray(value)) return null;
  const out: NonNullable<ContentProposition["takeawayEvidenceRefs"]> = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const takeaway = asString(row.takeaway);
    const evidenceRefs = asStringArray(row.evidenceRefs, 12);
    if (!takeaway || evidenceRefs.length === 0) continue;
    out.push({ takeaway: takeaway.slice(0, 200), evidenceRefs });
    if (out.length >= 8) break;
  }
  return out.length > 0 ? out : null;
}

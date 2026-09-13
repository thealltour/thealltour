import type { AcrbContentAngle } from "@/lib/marketing/audienceResearch/contracts";
import type {
  AgendaTopicIdentity,
  IdentityConflictDiagnostic,
} from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import { summarizeTopicIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import { validateAngleAgainstAgendaIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/validateAgainstIdentity";
import { pickRecommendedAngle } from "@/lib/marketing/audienceResearch/angleQuality";

export type IdentityAngleGuardResult = {
  angles: AcrbContentAngle[];
  rejected: AcrbContentAngle[];
  diagnostics: IdentityConflictDiagnostic[];
  recommended: AcrbContentAngle | null;
  /** When true, caller should not silently PROCEED. */
  noValidAngles: boolean;
};

function angleBlob(angle: AcrbContentAngle): string {
  // Validate user-facing angle fields only — rationale may mention rejected alternatives.
  return `${angle.angle} ${angle.hook} ${angle.audienceTension}`;
}

/**
 * Filter ACRB angles against AgendaTopicIdentity; re-pick recommended among survivors.
 */
export function guardAnglesAgainstTopicIdentity(input: {
  angles: AcrbContentAngle[];
  identity: AgendaTopicIdentity;
  stage: string;
  agendaId: string | null;
  candidateId?: string | null;
  allowedExtraEntities?: string[];
}): IdentityAngleGuardResult {
  const diagnostics: IdentityConflictDiagnostic[] = [];
  const kept: AcrbContentAngle[] = [];
  const rejected: AcrbContentAngle[] = [];

  for (const angle of input.angles) {
    const result = validateAngleAgainstAgendaIdentity(angleBlob(angle), input.identity, {
      allowedExtraEntities: input.allowedExtraEntities,
      stage: input.stage,
    });
    if (result.ok) {
      kept.push(angle);
      continue;
    }
    rejected.push(angle);
    for (const iss of result.issues) {
      diagnostics.push({
        stage: input.stage,
        agendaId: input.agendaId,
        candidateId: input.candidateId ?? null,
        conflictDimension: iss.dimension,
        rejectedText: iss.rejectedText,
        identitySummary: summarizeTopicIdentity(input.identity),
      });
    }
  }

  const recommended = kept.length ? pickRecommendedAngle(kept) : null;
  return {
    angles: kept,
    rejected,
    diagnostics,
    recommended,
    noValidAngles: kept.length === 0,
  };
}

export type HistoricalIdentityCompatibility = "compatible" | "adjacent" | "conflicting";

/**
 * Mark historical/semantic titles against agenda identity (no threshold changes).
 * Conflicting items must not drive recommended angles / verified expansions.
 */
export function classifyHistoricalAgainstIdentity(
  title: string,
  identity: AgendaTopicIdentity,
): HistoricalIdentityCompatibility {
  const result = validateAngleAgainstAgendaIdentity(title, identity);
  if (!result.ok) {
    if (result.issues.some((i) => i.dimension === "product_type" || i.dimension === "destination")) {
      return "conflicting";
    }
    return "adjacent";
  }
  const destHit = identity.destinationEntities.some((d) => title.includes(d));
  const productHit =
    (identity.productTypes.includes("cruise") && /크루즈|cruise/i.test(title)) ||
    (identity.productTypes.includes("package") && /패키지|package/i.test(title)) ||
    (identity.productTypes.includes("hotel") && /호텔|hotel/i.test(title)) ||
    (identity.productTypes.includes("flight") && /항공|flight/i.test(title));
  if (destHit || productHit) return "compatible";
  return "adjacent";
}

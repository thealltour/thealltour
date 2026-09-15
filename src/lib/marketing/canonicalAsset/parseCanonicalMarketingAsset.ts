import {
  ASSET_SOURCE_WRITER_ROLE,
  CANONICAL_ASSET_STATUSES,
  CANONICAL_MARKETING_ASSET_CONTRACT,
  type CanonicalAssetEvidenceRef,
  type CanonicalAssetStatus,
  type CanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/contracts";

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

function asEvidenceRefs(value: unknown): CanonicalAssetEvidenceRef[] {
  if (!Array.isArray(value)) return [];
  const out: CanonicalAssetEvidenceRef[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const evidenceId = asString(row.evidenceId);
    if (!evidenceId) continue;
    out.push({
      evidenceId: evidenceId.slice(0, 120),
      noteKo: asString(row.noteKo) ? asString(row.noteKo).slice(0, 240) : null,
    });
    if (out.length >= 24) break;
  }
  return out;
}

function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Parse LLM JSON into CanonicalMarketingAsset shell (identity fields filled by caller).
 */
export function parseCanonicalMarketingAssetContent(raw: unknown): {
  titleKo: string;
  dekKo: string | null;
  openingHookKo: string;
  bodyKo: string;
  keyTakeawaysKo: string[];
  decisionGuidanceKo: string;
  optionalCtaIntentKo: string | null;
  evidenceRefs: CanonicalAssetEvidenceRef[];
  limitationsKo: string[];
  forbiddenClaimsKo: string[];
  supportedClaimBoundaryKo: string | null;
  unresolvedQuestionsKo: string[];
} | null {
  const obj =
    typeof raw === "string" ? extractJsonObject(raw) : raw && typeof raw === "object" ? raw : null;
  if (!obj || typeof obj !== "object") return null;
  const row = obj as Record<string, unknown>;
  const titleKo = asString(row.titleKo);
  const openingHookKo = asString(row.openingHookKo);
  const bodyKo = asString(row.bodyKo);
  const decisionGuidanceKo = asString(row.decisionGuidanceKo);
  if (!titleKo || !openingHookKo || !bodyKo || !decisionGuidanceKo) return null;
  return {
    titleKo: titleKo.slice(0, 200),
    dekKo: asString(row.dekKo) ? asString(row.dekKo).slice(0, 280) : null,
    openingHookKo: openingHookKo.slice(0, 400),
    bodyKo: bodyKo.slice(0, 12000),
    keyTakeawaysKo: asStringArray(row.keyTakeawaysKo, 8).map((t) => t.slice(0, 240)),
    decisionGuidanceKo: decisionGuidanceKo.slice(0, 600),
    optionalCtaIntentKo: asString(row.optionalCtaIntentKo)
      ? asString(row.optionalCtaIntentKo).slice(0, 280)
      : null,
    evidenceRefs: asEvidenceRefs(row.evidenceRefs),
    limitationsKo: asStringArray(row.limitationsKo, 12).map((t) => t.slice(0, 280)),
    forbiddenClaimsKo: asStringArray(row.forbiddenClaimsKo, 12).map((t) => t.slice(0, 280)),
    supportedClaimBoundaryKo: asString(row.supportedClaimBoundaryKo)
      ? asString(row.supportedClaimBoundaryKo).slice(0, 400)
      : null,
    unresolvedQuestionsKo: asStringArray(row.unresolvedQuestionsKo, 12).map((t) => t.slice(0, 280)),
  };
}

export function parseDurableCanonicalMarketingAsset(
  raw: unknown,
): CanonicalMarketingAsset | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.contract !== CANONICAL_MARKETING_ASSET_CONTRACT) return null;
  if (typeof row.assetId !== "string" || !row.assetId.trim()) return null;
  if (typeof row.storyPointId !== "string" || !row.storyPointId.trim()) return null;
  if (typeof row.storyPointHash !== "string" || !row.storyPointHash.trim()) return null;
  if (typeof row.sourceRevision !== "string" || !row.sourceRevision.trim()) return null;
  const status = asString(row.status) as CanonicalAssetStatus;
  if (!(CANONICAL_ASSET_STATUSES as readonly string[]).includes(status)) return null;
  const content = parseCanonicalMarketingAssetContent(row);
  if (!content) return null;
  return {
    contract: CANONICAL_MARKETING_ASSET_CONTRACT,
    assetId: row.assetId.trim(),
    version: typeof row.version === "number" && row.version >= 1 ? Math.floor(row.version) : 1,
    status,
    agendaId: asString(row.agendaId),
    storyPointId: row.storyPointId.trim(),
    storyPointHash: row.storyPointHash.trim(),
    evidenceBriefRef: asString(row.evidenceBriefRef) || null,
    evidenceRevision: asString(row.evidenceRevision) || "unknown",
    contentPropositionRef: asString(row.contentPropositionRef) || null,
    propositionRevision: asString(row.propositionRevision) || "unknown",
    sourceRevision: row.sourceRevision.trim(),
    ...content,
    storySupportVerdict: asString(row.storySupportVerdict) || null,
    generatedAt: asString(row.generatedAt) || new Date(0).toISOString(),
    editedAt: asString(row.editedAt) || null,
    approvedAt: asString(row.approvedAt) || null,
    approvedVersion:
      typeof row.approvedVersion === "number" ? Math.floor(row.approvedVersion) : null,
    humanEdited: Boolean(row.humanEdited),
    approvalSource:
      row.approvalSource === "ai_original" || row.approvalSource === "human_edited"
        ? row.approvalSource
        : null,
    approvedBy: asString(row.approvedBy) || null,
    generatedBy: asString(row.generatedBy) || ASSET_SOURCE_WRITER_ROLE,
    repairCount: typeof row.repairCount === "number" ? Math.max(0, Math.floor(row.repairCount)) : 0,
    validationIssues: asStringArray(row.validationIssues, 24),
    downstreamChannelSourceVersions: Array.isArray(row.downstreamChannelSourceVersions)
      ? row.downstreamChannelSourceVersions.filter((n): n is number => typeof n === "number")
      : undefined,
  };
}

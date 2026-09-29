/**
 * External Editorial research → Canonical draft.
 * Only safety/evidence fields move automatically (lift forbidden claims, drop outdated list
 * items, cite verified findings). Body copy stays with the human editor; no LLM call.
 */

import type {
  CanonicalAssetEvidenceRef,
  CanonicalAssetResearchRevision,
  CanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/contracts";
import { isApprovedCanonicalAsset } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import {
  RESEARCH_FINDING_SUPPORT_LEVELS,
  RESEARCH_OUTPUT_STATUSES,
  type ResearchFindingSupportLevel,
  type ResearchOutputStatus,
} from "@/lib/marketing/editorialDirector/researchHandoff/contracts";
import type { ExternalEditorialCandidate } from "@/lib/marketing/publishable/channelSources/contracts";

const MAX_EVIDENCE_REFS = 24;
const EVIDENCE_NOTE_MAX = 240;

export type ExternalResearchConflictAction = "remove_forbidden" | "remove_item" | "manual" | "not_found";

const REMOVABLE_LIST_FIELDS = ["keyTakeawaysKo", "limitationsKo", "unresolvedQuestionsKo"] as const;
type RemovableListField = (typeof REMOVABLE_LIST_FIELDS)[number];

export type ExternalResearchFindingView = {
  findingId: string;
  claim: string;
  supportLevel: ResearchFindingSupportLevel | null;
  usableForEditorial: boolean;
  freshness: string | null;
  sources: Array<{ title: string; publisher: string; date: string; url: string; sourceTier: string }>;
};

export type ExternalResearchConflictView = {
  index: number;
  canonicalField: string;
  canonicalText: string;
  findingIds: string[];
  explanation: string;
  action: ExternalResearchConflictAction;
};

export type ExternalResearchSummary = {
  status: ResearchOutputStatus | null;
  findings: ExternalResearchFindingView[];
  unresolved: string[];
  conflicts: ExternalResearchConflictView[];
};

export class ExternalResearchDraftError extends Error {
  constructor(
    readonly code:
      | "canonical_not_approved"
      | "stale_identity"
      | "no_applicable_conflicts"
      | "invalid_conflict_selection"
      | "takeaways_would_be_empty",
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = "ExternalResearchDraftError";
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function isRemovableListField(field: string): field is RemovableListField {
  return (REMOVABLE_LIST_FIELDS as readonly string[]).includes(field);
}

export function classifyConflictAction(
  asset: CanonicalMarketingAsset,
  canonicalField: string,
  canonicalText: string,
): ExternalResearchConflictAction {
  const needle = canonicalText.trim();
  if (canonicalField === "forbiddenClaimsKo") {
    return asset.forbiddenClaimsKo.some((c) => c.trim() === needle) ? "remove_forbidden" : "not_found";
  }
  if (isRemovableListField(canonicalField)) {
    return asset[canonicalField].some((c) => c.trim() === needle) ? "remove_item" : "not_found";
  }
  return "manual";
}

export function readExternalResearchSummary(
  result: Record<string, unknown>,
  asset: CanonicalMarketingAsset | null,
): ExternalResearchSummary | null {
  const research = result.research;
  if (!research || typeof research !== "object") return null;
  const row = research as Record<string, unknown>;
  const status = (RESEARCH_OUTPUT_STATUSES as readonly string[]).includes(text(row.status))
    ? (text(row.status) as ResearchOutputStatus)
    : null;

  const findings: ExternalResearchFindingView[] = Array.isArray(row.findings)
    ? row.findings.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const f = item as Record<string, unknown>;
        const findingId = text(f.findingId);
        if (!findingId) return [];
        const level = text(f.supportLevel);
        return [
          {
            findingId,
            claim: text(f.claim),
            supportLevel: (RESEARCH_FINDING_SUPPORT_LEVELS as readonly string[]).includes(level)
              ? (level as ResearchFindingSupportLevel)
              : null,
            usableForEditorial: f.usableForEditorial === true,
            freshness: text(f.freshness) || null,
            sources: Array.isArray(f.sources)
              ? f.sources.flatMap((s) => {
                  if (!s || typeof s !== "object") return [];
                  const src = s as Record<string, unknown>;
                  return [
                    {
                      title: text(src.title),
                      publisher: text(src.publisher),
                      date: text(src.date),
                      url: text(src.url),
                      sourceTier: text(src.sourceTier),
                    },
                  ];
                })
              : [],
          },
        ];
      })
    : [];

  const conflicts: ExternalResearchConflictView[] = Array.isArray(row.canonicalConflicts)
    ? row.canonicalConflicts.flatMap((item, index) => {
        if (!item || typeof item !== "object") return [];
        const c = item as Record<string, unknown>;
        const canonicalField = text(c.canonicalField);
        const canonicalText = text(c.canonicalText);
        return [
          {
            index,
            canonicalField,
            canonicalText,
            findingIds: stringList(c.findingIds),
            explanation: text(c.explanation),
            action: asset ? classifyConflictAction(asset, canonicalField, canonicalText) : "manual",
          },
        ];
      })
    : [];

  return { status, findings, unresolved: stringList(row.unresolved), conflicts };
}

export function candidateMatchesCanonical(
  candidate: Pick<ExternalEditorialCandidate, "assetId" | "canonicalVersion" | "sourceRevision">,
  asset: CanonicalMarketingAsset,
): boolean {
  return (
    candidate.assetId === asset.assetId &&
    candidate.canonicalVersion === asset.version &&
    candidate.sourceRevision === asset.sourceRevision
  );
}

export function researchEvidenceId(importId: string, findingId: string): string {
  return `xr_${importId.slice(-10)}_${findingId}`.slice(0, 120);
}

function evidenceNote(finding: ExternalResearchFindingView): string {
  const source = finding.sources[0];
  const cite = source
    ? [source.publisher, source.date, source.url].filter(Boolean).join(" · ")
    : "";
  const note = cite ? `${finding.claim} — ${cite}` : finding.claim;
  return note.length > EVIDENCE_NOTE_MAX ? `${note.slice(0, EVIDENCE_NOTE_MAX - 1)}…` : note;
}

export function buildCanonicalDraftFromResearch(input: {
  asset: CanonicalMarketingAsset;
  candidate: ExternalEditorialCandidate;
  candidateId: string;
  conflictIndexes: number[];
  now: Date;
  appliedBy: string | null;
}): CanonicalMarketingAsset {
  const { asset, candidate } = input;
  if (!isApprovedCanonicalAsset(asset)) {
    throw new ExternalResearchDraftError(
      "canonical_not_approved",
      "현재 버전이 승인된 공통 원문에만 연구 결과를 반영할 수 있습니다.",
    );
  }
  const mismatches = [
    candidate.candidateId !== input.candidateId ? "candidateId" : null,
    candidate.assetId !== asset.assetId ? "assetId" : null,
    candidate.canonicalVersion !== asset.version ? "canonicalVersion" : null,
    candidate.sourceRevision !== asset.sourceRevision ? "sourceRevision" : null,
  ].filter((v): v is string => v !== null);
  if (mismatches.length > 0) {
    throw new ExternalResearchDraftError(
      "stale_identity",
      "이 외부 편집 결과는 이전 승인본 기준입니다. 최신 승인본으로 다시 받은 결과에서만 반영할 수 있습니다.",
      mismatches,
    );
  }

  const summary = readExternalResearchSummary(candidate.result, asset);
  const byIndex = new Map((summary?.conflicts ?? []).map((c) => [c.index, c]));
  const selected = [...new Set(input.conflictIndexes)].sort((a, b) => a - b);
  const invalid = selected.filter((i) => {
    const c = byIndex.get(i);
    return !c || (c.action !== "remove_forbidden" && c.action !== "remove_item");
  });
  if (invalid.length > 0) {
    throw new ExternalResearchDraftError(
      "invalid_conflict_selection",
      "자동 반영할 수 없는 충돌이 선택되었습니다.",
      invalid.map((i) => `conflict#${i}`),
    );
  }
  if (selected.length === 0) {
    throw new ExternalResearchDraftError("no_applicable_conflicts", "반영할 충돌을 하나 이상 선택하세요.");
  }

  const applied = selected.map((i) => byIndex.get(i)!);
  const removeForbidden = new Set(
    applied.filter((c) => c.action === "remove_forbidden").map((c) => c.canonicalText),
  );
  const removeByField = new Map<RemovableListField, Set<string>>();
  for (const c of applied) {
    if (c.action !== "remove_item" || !isRemovableListField(c.canonicalField)) continue;
    const set = removeByField.get(c.canonicalField) ?? new Set<string>();
    set.add(c.canonicalText);
    removeByField.set(c.canonicalField, set);
  }
  const keep = (field: RemovableListField) =>
    asset[field].filter((item) => !removeByField.get(field)?.has(item.trim()));

  const keyTakeawaysKo = keep("keyTakeawaysKo");
  if (keyTakeawaysKo.length === 0) {
    throw new ExternalResearchDraftError(
      "takeaways_would_be_empty",
      "핵심 요점이 모두 지워집니다. 공통 원문 편집에서 새 요점을 먼저 추가한 뒤 다시 시도하세요.",
    );
  }

  const findingsById = new Map((summary?.findings ?? []).map((f) => [f.findingId, f]));
  const existingIds = new Set(asset.evidenceRefs.map((e) => e.evidenceId));
  const evidenceRefs: CanonicalAssetEvidenceRef[] = [...asset.evidenceRefs];
  const addedEvidenceIds: string[] = [];
  for (const findingId of [...new Set(applied.flatMap((c) => c.findingIds))]) {
    const finding = findingsById.get(findingId);
    if (!finding || (finding.supportLevel !== "verified" && finding.supportLevel !== "corroborated")) {
      continue;
    }
    const evidenceId = researchEvidenceId(candidate.importId, findingId);
    if (existingIds.has(evidenceId) || evidenceRefs.length >= MAX_EVIDENCE_REFS) continue;
    evidenceRefs.push({ evidenceId, noteKo: evidenceNote(finding) });
    existingIds.add(evidenceId);
    addedEvidenceIds.push(evidenceId);
  }

  const nowIso = input.now.toISOString();
  const researchRevision: CanonicalAssetResearchRevision = {
    importId: candidate.importId,
    fromVersion: asset.version,
    appliedConflictIndexes: selected,
    removedForbiddenClaims: asset.forbiddenClaimsKo.filter((c) => removeForbidden.has(c.trim())),
    removedItems: [...removeByField.entries()].flatMap(([field, texts]) =>
      asset[field].filter((item) => texts.has(item.trim())).map((item) => ({ field, text: item })),
    ),
    addedEvidenceIds,
    appliedAt: nowIso,
    appliedBy: input.appliedBy,
  };

  return {
    ...asset,
    keyTakeawaysKo,
    limitationsKo: keep("limitationsKo"),
    unresolvedQuestionsKo: keep("unresolvedQuestionsKo"),
    forbiddenClaimsKo: asset.forbiddenClaimsKo.filter((c) => !removeForbidden.has(c.trim())),
    evidenceRefs,
    version: asset.version + 1,
    status: "human_edited",
    humanEdited: true,
    editedAt: nowIso,
    approvedAt: null,
    approvedVersion: null,
    approvalSource: null,
    approvedBy: null,
    researchRevision,
  };
}

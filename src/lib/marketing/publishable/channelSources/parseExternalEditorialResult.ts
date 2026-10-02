/**
 * Parser for editorial-research-bundle-chatgpt-result-v1 (ChatGPT/Astra return).
 * Only structural problems reject the import (JSON shape, wrong candidate, malformed research).
 * Blocked status, canonical version drift, and evidence-reference problems are warnings: the
 * operator accepts External results unconditionally and reviews them per channel.
 */

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { isApprovedCanonicalAsset } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import {
  EDITORIAL_RESEARCH_BUNDLE_CHATGPT_RESULT_CONTRACT,
  RESEARCH_FINDING_SUPPORT_LEVELS,
  RESEARCH_OUTPUT_STATUSES,
  RESEARCH_SOURCE_TIERS,
  type ResearchFindingSupportLevel,
  type ResearchOutputStatus,
} from "@/lib/marketing/editorialDirector/researchHandoff/contracts";
import { EDITORIAL_RESEARCH_RESULT_ACCEPTED_KEYS } from "@/lib/marketing/editorialDirector/researchHandoff/outputContract";
import { CHANNEL_SOURCE_MESSAGES_KO } from "@/lib/marketing/publishable/channelSources/contracts";

export type ExternalResearchFinding = {
  findingId: string;
  claim: string;
  supportLevel: ResearchFindingSupportLevel;
  usableForEditorial: boolean;
};

export type ExternalEditorialParseErrorCode =
  | "invalid_json"
  | "contract_mismatch"
  | "canonical_missing"
  | "canonical_not_approved"
  | "stale_identity"
  | "unknown_top_level_key"
  | "research_missing"
  | "research_invalid"
  | "duplicate_finding_id"
  | "ambiguous_reference";

export type ParsedExternalEditorialResult = {
  result: Record<string, unknown>;
  researchStatus: ResearchOutputStatus;
  findings: ExternalResearchFinding[];
  canonicalEvidenceIds: string[];
  warnings: string[];
};

export type ParseExternalEditorialResult =
  | { ok: true; value: ParsedExternalEditorialResult }
  | { ok: false; code: ExternalEditorialParseErrorCode; messageKo: string; details: string[] };

const CHANNEL_ARTIFACT_KEYS = [
  "narrative",
  "threads",
  "instagram",
  "naverBlog",
  "naverBand",
  "kakao",
  "shortform",
] as const;

const SURFACE_BLOCKED_SUPPORT: readonly ResearchFindingSupportLevel[] = ["weak", "conflicting"];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function fail(
  code: ExternalEditorialParseErrorCode,
  messageKo: string,
  details: string[] = [],
): ParseExternalEditorialResult {
  return { ok: false, code, messageKo, details };
}

/** Accepts one JSON object, optionally wrapped in a single ```json fence. */
export function extractSingleJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("empty");
  const fences = [...trimmed.matchAll(/^```(?:json)?\s*([\s\S]*?)\s*```$/gi)];
  const body = fences.length === 1 && fences[0]?.[1] !== undefined ? fences[0][1].trim() : trimmed;
  if (!body.startsWith("{") || !body.endsWith("}")) throw new Error("not_object");
  return JSON.parse(body);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
}

type RefUse = { location: string; ref: string };

function collectRefs(result: Record<string, unknown>): RefUse[] {
  const uses: RefUse[] = [];
  const push = (location: string, value: unknown) => {
    for (const ref of stringArray(value)) uses.push({ location, ref });
  };
  const narrative = asRecord(result.narrative);
  if (narrative && Array.isArray(narrative.beats)) {
    narrative.beats.forEach((beat, i) => push(`narrative.beats[${i}].evidenceRefs`, asRecord(beat)?.evidenceRefs));
  }
  push("threads.evidenceRefs", asRecord(result.threads)?.evidenceRefs);
  const cardCopy = asRecord(asRecord(result.instagram)?.cardCopy);
  if (cardCopy && Array.isArray(cardCopy.cards)) {
    cardCopy.cards.forEach((card, i) =>
      push(`instagram.cardCopy.cards[${i}].evidenceRefs`, asRecord(card)?.evidenceRefs),
    );
  }
  const blog = asRecord(result.naverBlog);
  const structure = asRecord(blog?.structure);
  if (structure && Array.isArray(structure.sectionPlan)) {
    structure.sectionPlan.forEach((section, i) =>
      push(`naverBlog.structure.sectionPlan[${i}].evidenceRefs`, asRecord(section)?.evidenceRefs),
    );
  }
  push("naverBlog.copy.evidenceRefs", asRecord(blog?.copy)?.evidenceRefs);
  push("naverBand.evidenceRefs", asRecord(result.naverBand)?.evidenceRefs);
  return uses;
}

function parseFindings(
  research: Record<string, unknown>,
): { ok: true; findings: ExternalResearchFinding[] } | ParseExternalEditorialResult {
  if (!Array.isArray(research.findings)) {
    return fail("research_invalid", CHANNEL_SOURCE_MESSAGES_KO.researchInvalid, ["research.findings[] 필요"]);
  }
  const findings: ExternalResearchFinding[] = [];
  const seen = new Set<string>();
  const duplicates: string[] = [];
  const problems: string[] = [];
  research.findings.forEach((raw, i) => {
    const row = asRecord(raw);
    if (!row) {
      problems.push(`research.findings[${i}] 객체 아님`);
      return;
    }
    const findingId = typeof row.findingId === "string" ? row.findingId.trim() : "";
    if (!findingId) problems.push(`research.findings[${i}].findingId 없음`);
    if (typeof row.claim !== "string" || !row.claim.trim()) problems.push(`research.findings[${i}].claim 없음`);
    if (
      typeof row.supportLevel !== "string" ||
      !(RESEARCH_FINDING_SUPPORT_LEVELS as readonly string[]).includes(row.supportLevel)
    ) {
      problems.push(`research.findings[${i}].supportLevel 허용값 아님`);
    }
    if (typeof row.usableForEditorial !== "boolean") {
      problems.push(`research.findings[${i}].usableForEditorial boolean 아님`);
    }
    if (row.freshness !== undefined && row.freshness !== null && typeof row.freshness !== "string") {
      problems.push(`research.findings[${i}].freshness 형식 오류`);
    }
    if (!Array.isArray(row.sources)) {
      problems.push(`research.findings[${i}].sources[] 없음`);
    } else {
      row.sources.forEach((src, j) => {
        const s = asRecord(src);
        const at = `research.findings[${i}].sources[${j}]`;
        if (!s) {
          problems.push(`${at} 객체 아님`);
          return;
        }
        for (const key of ["title", "publisher", "url"] as const) {
          if (typeof s[key] !== "string" || !(s[key] as string).trim()) problems.push(`${at}.${key} 없음`);
        }
        if (s.date !== null && s.date !== undefined && typeof s.date !== "string") {
          problems.push(`${at}.date 형식 오류`);
        }
        if (typeof s.sourceTier !== "string" || !(RESEARCH_SOURCE_TIERS as readonly string[]).includes(s.sourceTier)) {
          problems.push(`${at}.sourceTier 허용값 아님`);
        }
      });
    }
    if (findingId) {
      if (seen.has(findingId)) duplicates.push(findingId);
      seen.add(findingId);
    }
    if (findingId && typeof row.usableForEditorial === "boolean" && typeof row.supportLevel === "string") {
      findings.push({
        findingId,
        claim: typeof row.claim === "string" ? row.claim : "",
        supportLevel: row.supportLevel as ResearchFindingSupportLevel,
        usableForEditorial: row.usableForEditorial,
      });
    }
  });
  if (duplicates.length > 0) {
    return fail("duplicate_finding_id", CHANNEL_SOURCE_MESSAGES_KO.duplicateFinding, [
      ...new Set(duplicates),
    ]);
  }
  if (problems.length > 0) {
    return fail("research_invalid", CHANNEL_SOURCE_MESSAGES_KO.researchInvalid, problems.slice(0, 20));
  }
  return { ok: true, findings };
}

export function parseExternalEditorialResult(input: {
  raw: string;
  candidateId: string;
  approvedCanonical: CanonicalMarketingAsset | null;
}): ParseExternalEditorialResult {
  let parsed: unknown;
  try {
    parsed = extractSingleJsonObject(input.raw);
  } catch {
    return fail("invalid_json", CHANNEL_SOURCE_MESSAGES_KO.invalidJson);
  }
  const result = asRecord(parsed);
  if (!result) return fail("invalid_json", CHANNEL_SOURCE_MESSAGES_KO.invalidJson);

  if (result.contract !== EDITORIAL_RESEARCH_BUNDLE_CHATGPT_RESULT_CONTRACT) {
    return fail("contract_mismatch", CHANNEL_SOURCE_MESSAGES_KO.contractMismatch, [
      `contract=${String(result.contract)}`,
    ]);
  }

  const asset = input.approvedCanonical;
  if (!asset) return fail("canonical_missing", CHANNEL_SOURCE_MESSAGES_KO.canonicalMissing);
  if (!isApprovedCanonicalAsset(asset)) {
    return fail("canonical_not_approved", CHANNEL_SOURCE_MESSAGES_KO.canonicalNotApproved);
  }

  if (result.candidateId !== input.candidateId) {
    return fail("stale_identity", CHANNEL_SOURCE_MESSAGES_KO.staleIdentity, ["candidateId"]);
  }
  const warnings: string[] = [];
  const versionMismatches: string[] = [];
  if (result.assetId !== asset.assetId) versionMismatches.push("assetId");
  if (result.canonicalVersion !== asset.version) versionMismatches.push("canonicalVersion");
  if (result.sourceRevision !== asset.sourceRevision) versionMismatches.push("sourceRevision");
  if (versionMismatches.length > 0) {
    warnings.push(
      `현재 승인본(v${asset.version})과 다른 승인본 기준 결과입니다 (${versionMismatches.join(", ")}). 현재 승인본 기준으로 적용합니다.`,
    );
  }

  const allowedKeys = new Set<string>(EDITORIAL_RESEARCH_RESULT_ACCEPTED_KEYS);
  const unknownKeys = Object.keys(result).filter((k) => !allowedKeys.has(k));
  if (unknownKeys.length > 0) {
    return fail("unknown_top_level_key", CHANNEL_SOURCE_MESSAGES_KO.unknownTopLevelKey, unknownKeys);
  }

  const research = asRecord(result.research);
  if (!research) return fail("research_missing", CHANNEL_SOURCE_MESSAGES_KO.researchMissing);
  if (
    typeof research.status !== "string" ||
    !(RESEARCH_OUTPUT_STATUSES as readonly string[]).includes(research.status)
  ) {
    return fail("research_invalid", CHANNEL_SOURCE_MESSAGES_KO.researchInvalid, ["research.status 허용값 아님"]);
  }
  const researchStatus = research.status as ResearchOutputStatus;

  const findingsResult = parseFindings(research);
  if (!("findings" in findingsResult)) return findingsResult;
  const findings = findingsResult.findings;
  const findingById = new Map(findings.map((f) => [f.findingId, f]));

  const canonicalEvidenceIds = asset.evidenceRefs.map((e) => e.evidenceId);
  const canonicalSet = new Set(canonicalEvidenceIds);
  const collisions = findings.filter((f) => canonicalSet.has(f.findingId)).map((f) => f.findingId);
  if (collisions.length > 0) {
    return fail("ambiguous_reference", CHANNEL_SOURCE_MESSAGES_KO.ambiguousReference, collisions);
  }

  if (researchStatus === "blocked") {
    const present = CHANNEL_ARTIFACT_KEYS.filter((k) => result[k] !== null && result[k] !== undefined);
    warnings.push(
      present.length > 0
        ? "research.status가 blocked이지만 채널 결과를 그대로 가져옵니다."
        : "research.status가 blocked이고 채널 결과가 없습니다.",
    );
  }

  const conflictProblems: string[] = [];
  if (research.canonicalConflicts !== undefined && !Array.isArray(research.canonicalConflicts)) {
    return fail("research_invalid", CHANNEL_SOURCE_MESSAGES_KO.researchInvalid, ["research.canonicalConflicts[] 형식 오류"]);
  }
  (Array.isArray(research.canonicalConflicts) ? research.canonicalConflicts : []).forEach((raw, i) => {
    for (const id of stringArray(asRecord(raw)?.findingIds)) {
      if (!findingById.has(id)) conflictProblems.push(`research.canonicalConflicts[${i}].findingIds: ${id}`);
    }
  });

  const unknown: string[] = [...conflictProblems];
  const unusable: string[] = [];
  for (const use of collectRefs(result)) {
    const finding = findingById.get(use.ref);
    if (finding) {
      if (!finding.usableForEditorial || SURFACE_BLOCKED_SUPPORT.includes(finding.supportLevel)) {
        unusable.push(
          `${use.location}: ${use.ref} (${finding.supportLevel}, usableForEditorial=${finding.usableForEditorial})`,
        );
      } else if (finding.supportLevel === "qualified") {
        warnings.push(`${use.location}: ${use.ref}는 qualified finding입니다 — 한정 표현으로만 쓰였는지 확인하세요.`);
      }
      continue;
    }
    if (!canonicalSet.has(use.ref)) unknown.push(`${use.location}: ${use.ref}`);
  }
  for (const item of unknown.slice(0, 20)) warnings.push(`${CHANNEL_SOURCE_MESSAGES_KO.unknownReference} ${item}`);
  for (const item of unusable.slice(0, 20)) warnings.push(`${CHANNEL_SOURCE_MESSAGES_KO.unusableFinding} ${item}`);

  return {
    ok: true,
    value: { result, researchStatus, findings, canonicalEvidenceIds, warnings },
  };
}

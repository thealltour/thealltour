/**
 * Import for instagram-cardnews-chatgpt-result-v1: strict parse → Instagram dry-run
 * materialization → immutable External Editorial candidate write. Unlike the research bundle,
 * the result carries a single channel, so a non-materializable Instagram artifact rejects the
 * import instead of being stored as a non-selectable candidate.
 */

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { isApprovedCanonicalAsset } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import {
  INSTAGRAM_CARDNEWS_CHATGPT_RESULT_CONTRACT,
  INSTAGRAM_CARDNEWS_HANDOFF_CARD_RANGE,
  INSTAGRAM_CARDNEWS_RESULT_INSTAGRAM_KEYS,
  INSTAGRAM_CARDNEWS_RESULT_TOP_LEVEL_KEYS,
} from "@/lib/marketing/editorialDirector/instagramCardnewsHandoff/contracts";
import {
  CHANNEL_SOURCE_MESSAGES_KO,
  EXTERNAL_EDITORIAL_CANDIDATE_CONTRACT,
  EXTERNAL_EDITORIAL_PROVIDER,
  type ExternalEditorialCandidate,
} from "@/lib/marketing/publishable/channelSources/contracts";
import {
  buildExternalImportId,
  persistExternalEditorialCandidate,
  readExternalEditorialCandidateByRef,
} from "@/lib/marketing/publishable/channelSources/externalCandidateStore";
import { buildExternalNarrativeFingerprint } from "@/lib/marketing/publishable/channelSources/externalNarrative";
import { computeExternalChannelReadiness } from "@/lib/marketing/publishable/channelSources/importExternalEditorial";
import { extractSingleJsonObject } from "@/lib/marketing/publishable/channelSources/parseExternalEditorialResult";
import { externalEditorialCandidateRelativePath } from "@/lib/marketing/publishable/channelSources/paths";
import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import {
  INSTAGRAM_CARD_COPY_FIELD_LIMITS,
  INSTAGRAM_COVER_TITLE_MAX_LENGTH,
} from "@/lib/marketing/publishable/instagramEditorial/cardCopyReview";

export const INSTAGRAM_CARDNEWS_IMPORT_MESSAGES_KO = {
  contractMismatch: `contract가 ${INSTAGRAM_CARDNEWS_CHATGPT_RESULT_CONTRACT}이 아닙니다. Instagram 카드뉴스 JSON 결과인지 확인하세요.`,
  staleIdentity: "결과의 candidateId가 이 후보와 다릅니다. 이 후보의 Instagram 카드뉴스 JSON 결과인지 확인하세요.",
  narrativeMissing: "narrative 객체가 없습니다. 카드 구성을 연결할 narrative가 필요합니다.",
  instagramMissing: "instagram 객체(carouselPlan, cardCopy, caption)가 없습니다.",
  unknownInstagramKey: "instagram 안에 허용되지 않은 키가 있습니다.",
  cardCountOutOfRange: `카드 수가 ${INSTAGRAM_CARDNEWS_HANDOFF_CARD_RANGE.min}–${INSTAGRAM_CARDNEWS_HANDOFF_CARD_RANGE.max}장 범위를 벗어났습니다. 카드뉴스 렌더에는 ${INSTAGRAM_CARDNEWS_HANDOFF_CARD_RANGE.min}장 이상 필요합니다.`,
  instagramNotMaterializable: "Instagram 결과 형식이 맞지 않아 가져올 수 없습니다.",
} as const;

export type InstagramCardnewsImportErrorCode =
  | "invalid_json"
  | "contract_mismatch"
  | "canonical_missing"
  | "canonical_not_approved"
  | "stale_identity"
  | "unknown_top_level_key"
  | "narrative_missing"
  | "instagram_missing"
  | "unknown_instagram_key"
  | "card_count_out_of_range"
  | "instagram_not_materializable";

export type ImportInstagramCardnewsResult =
  | {
      ok: true;
      candidate: ExternalEditorialCandidate;
      candidateRef: string;
      coverTitleKo: string | null;
    }
  | { ok: false; code: InstagramCardnewsImportErrorCode; messageKo: string; details: string[] };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function fail(
  code: InstagramCardnewsImportErrorCode,
  messageKo: string,
  details: string[] = [],
): ImportInstagramCardnewsResult {
  return { ok: false, code, messageKo, details };
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
}

function cardsOf(value: unknown): unknown[] | null {
  const cards = asRecord(value)?.cards;
  return Array.isArray(cards) ? cards : null;
}

function fieldLengthWarnings(cardCopy: unknown): string[] {
  const warnings: string[] = [];
  (cardsOf(cardCopy) ?? []).forEach((raw, i) => {
    const card = asRecord(raw);
    if (!card) return;
    for (const [field, max] of Object.entries(INSTAGRAM_CARD_COPY_FIELD_LIMITS)) {
      const value = card[field];
      if (typeof value === "string" && value.trim().length > max) {
        warnings.push(
          `instagram.cardCopy.cards[${i}].${field} ${value.trim().length}자 — 검수 화면 한도 ${max}자를 넘습니다. 검수에서 줄이세요.`,
        );
      }
    }
  });
  return warnings;
}

function unknownEvidenceRefWarnings(result: Record<string, unknown>, canonicalIds: Set<string>): string[] {
  const unknown: string[] = [];
  const check = (location: string, value: unknown) => {
    for (const ref of stringArray(value)) if (!canonicalIds.has(ref)) unknown.push(`${location}: ${ref}`);
  };
  const beats = asRecord(result.narrative)?.beats;
  if (Array.isArray(beats)) beats.forEach((b, i) => check(`narrative.beats[${i}].evidenceRefs`, asRecord(b)?.evidenceRefs));
  (cardsOf(asRecord(result.instagram)?.cardCopy) ?? []).forEach((c, i) =>
    check(`instagram.cardCopy.cards[${i}].evidenceRefs`, asRecord(c)?.evidenceRefs),
  );
  return unknown.slice(0, 20).map((item) => `${CHANNEL_SOURCE_MESSAGES_KO.unknownReference} ${item}`);
}

export function importInstagramCardnewsResult(input: {
  packageRoot: string;
  candidateId: string;
  approvedCanonical: CanonicalMarketingAsset | null;
  raw: string;
  importedBy: string | null;
  now?: Date;
}): ImportInstagramCardnewsResult {
  let parsed: unknown;
  try {
    parsed = extractSingleJsonObject(input.raw);
  } catch {
    return fail("invalid_json", CHANNEL_SOURCE_MESSAGES_KO.invalidJson);
  }
  const result = asRecord(parsed);
  if (!result) return fail("invalid_json", CHANNEL_SOURCE_MESSAGES_KO.invalidJson);
  if (result.contract !== INSTAGRAM_CARDNEWS_CHATGPT_RESULT_CONTRACT) {
    return fail("contract_mismatch", INSTAGRAM_CARDNEWS_IMPORT_MESSAGES_KO.contractMismatch, [
      `contract=${String(result.contract)}`,
    ]);
  }

  const asset = input.approvedCanonical;
  if (!asset) return fail("canonical_missing", CHANNEL_SOURCE_MESSAGES_KO.canonicalMissing);
  if (!isApprovedCanonicalAsset(asset)) {
    return fail("canonical_not_approved", CHANNEL_SOURCE_MESSAGES_KO.canonicalNotApproved);
  }
  if (result.candidateId !== input.candidateId) {
    return fail("stale_identity", INSTAGRAM_CARDNEWS_IMPORT_MESSAGES_KO.staleIdentity, ["candidateId"]);
  }

  const warnings: string[] = [];
  const versionMismatches = [
    result.assetId !== asset.assetId ? "assetId" : null,
    result.canonicalVersion !== asset.version ? "canonicalVersion" : null,
    result.sourceRevision !== asset.sourceRevision ? "sourceRevision" : null,
  ].filter((v): v is string => v !== null);
  if (versionMismatches.length > 0) {
    warnings.push(
      `현재 승인본(v${asset.version})과 다른 승인본 기준 결과입니다 (${versionMismatches.join(", ")}). 현재 승인본 기준으로 적용합니다.`,
    );
  }

  const allowedTop = new Set<string>(INSTAGRAM_CARDNEWS_RESULT_TOP_LEVEL_KEYS);
  const unknownTop = Object.keys(result).filter((k) => !allowedTop.has(k));
  if (unknownTop.length > 0) {
    return fail("unknown_top_level_key", CHANNEL_SOURCE_MESSAGES_KO.unknownTopLevelKey, unknownTop);
  }
  if (!asRecord(result.narrative)) return fail("narrative_missing", INSTAGRAM_CARDNEWS_IMPORT_MESSAGES_KO.narrativeMissing);
  const instagram = asRecord(result.instagram);
  if (!instagram || !asRecord(instagram.carouselPlan) || !asRecord(instagram.cardCopy) || !asRecord(instagram.caption)) {
    return fail("instagram_missing", INSTAGRAM_CARDNEWS_IMPORT_MESSAGES_KO.instagramMissing);
  }
  const allowedInstagram = new Set<string>(INSTAGRAM_CARDNEWS_RESULT_INSTAGRAM_KEYS);
  const unknownInstagram = Object.keys(instagram).filter((k) => !allowedInstagram.has(k));
  if (unknownInstagram.length > 0) {
    return fail("unknown_instagram_key", INSTAGRAM_CARDNEWS_IMPORT_MESSAGES_KO.unknownInstagramKey, unknownInstagram);
  }

  const cardCount = cardsOf(instagram.carouselPlan)?.length ?? 0;
  const range = INSTAGRAM_CARDNEWS_HANDOFF_CARD_RANGE;
  if (cardCount < range.min || cardCount > range.max) {
    return fail("card_count_out_of_range", INSTAGRAM_CARDNEWS_IMPORT_MESSAGES_KO.cardCountOutOfRange, [
      `carouselPlan.cards ${cardCount}장`,
    ]);
  }

  let coverTitleKo: string | null = null;
  if (instagram.coverTitleKo !== undefined && instagram.coverTitleKo !== null) {
    if (typeof instagram.coverTitleKo !== "string") {
      warnings.push("instagram.coverTitleKo가 문자열이 아니어서 썸네일 제목 제안을 무시했습니다.");
    } else {
      coverTitleKo = instagram.coverTitleKo.trim() || null;
      if (coverTitleKo && coverTitleKo.length > INSTAGRAM_COVER_TITLE_MAX_LENGTH) {
        warnings.push(
          `instagram.coverTitleKo ${coverTitleKo.length}자 — 썸네일 제목 한도 ${INSTAGRAM_COVER_TITLE_MAX_LENGTH}자를 넘습니다. 검수에서 줄이세요.`,
        );
      }
    }
  }

  const canonicalEvidenceIds = asset.evidenceRefs.map((e) => e.evidenceId);
  warnings.push(...fieldLengthWarnings(instagram.cardCopy));
  warnings.push(...unknownEvidenceRefWarnings(result, new Set(canonicalEvidenceIds)));

  const now = input.now ?? new Date();
  const importedAt = now.toISOString();
  const importId = buildExternalImportId(input.raw, now);
  const candidateRef = externalEditorialCandidateRelativePath(importId);
  const externalNarrativeFingerprint = buildExternalNarrativeFingerprint({
    candidateId: input.candidateId,
    assetId: asset.assetId,
    canonicalVersion: asset.version,
    sourceRevision: asset.sourceRevision,
    narrative: result.narrative,
  });
  const { readiness, warnings: materializeWarnings } = computeExternalChannelReadiness({
    candidateId: input.candidateId,
    asset,
    result,
    externalNarrativeFingerprint,
    externalCandidateRef: candidateRef,
    canonicalEvidenceIds,
    nowIso: importedAt,
  });
  if (!readiness.instagram.materializable) {
    return fail(
      "instagram_not_materializable",
      INSTAGRAM_CARDNEWS_IMPORT_MESSAGES_KO.instagramNotMaterializable,
      readiness.instagram.issues,
    );
  }

  const candidate: ExternalEditorialCandidate = {
    contract: EXTERNAL_EDITORIAL_CANDIDATE_CONTRACT,
    importId,
    provider: EXTERNAL_EDITORIAL_PROVIDER,
    importedAt,
    importedBy: input.importedBy,
    resultContract: INSTAGRAM_CARDNEWS_CHATGPT_RESULT_CONTRACT,
    candidateId: input.candidateId,
    assetId: asset.assetId,
    canonicalVersion: asset.version,
    sourceRevision: asset.sourceRevision,
    externalNarrativeFingerprint,
    warnings: [...warnings, ...materializeWarnings],
    channelReadiness: readiness,
    result,
  };
  const writtenRef = persistExternalEditorialCandidate({ packageRoot: input.packageRoot, candidate });
  return { ok: true, candidate, candidateRef: writtenRef, coverTitleKo };
}

/** Thumbnail title the External candidate behind the current Instagram slot proposed, if any. */
export function resolveExternalInstagramCoverTitleSuggestion(
  packageRoot: string,
  bundle: PublishableContentBundle | null,
): string | null {
  const ref = bundle?.instagram?.provenance.externalCandidateRef;
  if (!ref) return null;
  const candidate = readExternalEditorialCandidateByRef(packageRoot, ref);
  const value = asRecord(candidate?.result.instagram)?.coverTitleKo;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, INSTAGRAM_COVER_TITLE_MAX_LENGTH) : null;
}

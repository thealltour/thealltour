/**
 * ChatGPT clipboard transfer for Canonical Marketing Asset (공통 원문).
 * Export = JSON only. Import → strict contract + stale protection + editable-only.
 */

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import {
  applyHumanCanonicalAssetEdit,
  type CanonicalAssetEditFields,
} from "@/lib/marketing/canonicalAsset/humanAssetApproval";
import {
  validateCanonicalMarketingAsset,
  type CanonicalAssetValidationIssue,
} from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import { CANONICAL_SURFACE_LANGUAGE_NOTES_KO } from "@/lib/marketing/canonicalAsset/surfaceLanguageContract";
import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import type {
  EvidenceBackedStoryBrief,
  StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";

export const CANONICAL_ASSET_CHATGPT_EDIT_CONTRACT =
  "canonical-marketing-asset-chatgpt-edit-v1" as const;

export const STALE_ASSET_MESSAGE_KO =
  "원문이 변경되었습니다. 최신 원문을 다시 복사한 뒤 ChatGPT에서 다시 수정해 주세요." as const;

export type CanonicalAssetChatGptEditable = {
  titleKo: string;
  openingHookKo: string;
  bodyKo: string;
  keyTakeawaysKo: string[];
  decisionGuidanceKo: string;
};

export type CanonicalAssetChatGptContextReadOnly = {
  storyTitleKo: string | null;
  storyQuestionKo: string | null;
  audienceProblemKo: string | null;
  decisionAtStakeKo: string | null;
  readerPayoffKo: string | null;
  storySupportVerdict: string | null;
  supportedClaimBoundaryKo: string | null;
  keyEvidenceKo: string[];
  limitationsKo: string[];
  forbiddenClaimsKo: string[];
  contentPromiseKo: string | null;
  ctaIntentKo: string | null;
};

export type CanonicalAssetChatGptExportPayload = {
  contract: typeof CANONICAL_ASSET_CHATGPT_EDIT_CONTRACT;
  candidateId: string;
  assetId: string;
  version: number;
  sourceRevision: string;
  editable: CanonicalAssetChatGptEditable;
  contextReadOnly: CanonicalAssetChatGptContextReadOnly;
  notesKo: string[];
};

export type CanonicalAssetChatGptImportPreview = {
  titleKo: string;
  openingHookKo: string;
  bodyPreview: string;
  takeawayCount: number;
  returnedVersion: number | null;
  currentVersion: number;
};

export type CanonicalAssetChatGptImportOk = {
  ok: true;
  edits: CanonicalAssetEditFields;
  preview: CanonicalAssetChatGptImportPreview;
  expectedAssetId: string;
  expectedVersion: number;
  expectedSourceRevision: string;
};

export type CanonicalAssetChatGptImportFail = {
  ok: false;
  code: string;
  messageKo: string;
  issues?: CanonicalAssetValidationIssue[];
};

export type BuildCanonicalAssetChatGptExportInput = {
  candidateId: string;
  assetId: string;
  version: number;
  sourceRevision: string;
  editable: CanonicalAssetChatGptEditable;
  contextReadOnly: CanonicalAssetChatGptContextReadOnly;
};

const DEFAULT_NOTES_KO = [
  "editable 필드만 수정하고 동일 contract JSON으로 반환하세요.",
  "새로운 사실·숫자·가격·교통·규정·인과관계를 추가하지 마세요.",
  "supportedClaimBoundaryKo를 넘지 마세요.",
  "forbiddenClaimsKo의 내용을 사실처럼 재도입하지 마세요.",
  "limitationsKo를 숨기거나 확정 사실로 바꾸지 마세요.",
  "keyEvidenceKo 안의 검증된 근거를 우선 활용하세요.",
  ...CANONICAL_SURFACE_LANGUAGE_NOTES_KO,
  "관광청·보도자료 문체보다 사람이 실제로 쓴 자연스러운 한국어 마케팅 원문으로 다듬으세요.",
  "Story의 핵심 질문과 decisionAtStake를 바꾸지 마세요.",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Normalize takeaways: array or newline string; strip bullets/numbers/empties. */
export function normalizeKeyTakeawaysKo(value: unknown): string[] {
  const lines: string[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") lines.push(item);
    }
  } else if (typeof value === "string") {
    lines.push(...value.split("\n"));
  } else {
    return [];
  }
  const out: string[] = [];
  for (const raw of lines) {
    let t = raw.trim();
    if (!t) continue;
    t = t.replace(/^[-•*]\s+/, "");
    t = t.replace(/^\d+[.)]\s+/, "");
    t = t.trim();
    if (t) out.push(t);
  }
  return out;
}

function countTopLevelJsonObjects(raw: string): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  let count = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]!;
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) count += 1;
      depth += 1;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
    }
  }
  return count;
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("empty");

  const fenceMatches = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  if (fenceMatches.length > 1) {
    throw new Error("ambiguous_json");
  }
  if (fenceMatches.length === 1 && fenceMatches[0]?.[1]) {
    const inner = fenceMatches[0][1].trim();
    if (countTopLevelJsonObjects(inner) > 1) throw new Error("ambiguous_json");
    return JSON.parse(inner);
  }

  try {
    if (countTopLevelJsonObjects(trimmed) > 1) throw new Error("ambiguous_json");
    return JSON.parse(trimmed);
  } catch (error) {
    if (error instanceof Error && error.message === "ambiguous_json") throw error;
  }

  if (countTopLevelJsonObjects(trimmed) > 1) throw new Error("ambiguous_json");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("no_json");
}

/** Compact evidence lines from brief + asset notes — never invent. */
export function buildKeyEvidenceKo(input: {
  asset?: Pick<CanonicalMarketingAsset, "evidenceRefs"> | null;
  evidenceBrief?: EvidenceBackedStoryBrief | null;
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | null | undefined) => {
    const t = (raw ?? "").trim();
    if (!t || t.length < 8) return;
    if (/부분 답변|관련·신뢰 가능한 증거가 부족|미확인|unresolved/i.test(t)) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t.slice(0, 220));
  };

  for (const f of input.evidenceBrief?.researchQuestionFindings ?? []) {
    if (f.status !== "answered" && f.status !== "partially_answered") continue;
    push(f.finding);
  }
  for (const framing of input.evidenceBrief?.researchSupportedFraming ?? []) {
    push(framing);
  }
  for (const ref of input.asset?.evidenceRefs ?? []) {
    push(ref.noteKo);
  }
  return out.slice(0, 8);
}

export function buildCanonicalAssetChatGptExportPayload(
  input: BuildCanonicalAssetChatGptExportInput,
): CanonicalAssetChatGptExportPayload {
  return {
    contract: CANONICAL_ASSET_CHATGPT_EDIT_CONTRACT,
    candidateId: input.candidateId,
    assetId: input.assetId,
    version: input.version,
    sourceRevision: input.sourceRevision,
    editable: {
      titleKo: input.editable.titleKo,
      openingHookKo: input.editable.openingHookKo,
      bodyKo: input.editable.bodyKo,
      keyTakeawaysKo: [...input.editable.keyTakeawaysKo],
      decisionGuidanceKo: input.editable.decisionGuidanceKo,
    },
    contextReadOnly: {
      storyTitleKo: input.contextReadOnly.storyTitleKo,
      storyQuestionKo: input.contextReadOnly.storyQuestionKo,
      audienceProblemKo: input.contextReadOnly.audienceProblemKo,
      decisionAtStakeKo: input.contextReadOnly.decisionAtStakeKo,
      readerPayoffKo: input.contextReadOnly.readerPayoffKo,
      storySupportVerdict: input.contextReadOnly.storySupportVerdict,
      supportedClaimBoundaryKo: input.contextReadOnly.supportedClaimBoundaryKo,
      keyEvidenceKo: [...input.contextReadOnly.keyEvidenceKo],
      limitationsKo: [...input.contextReadOnly.limitationsKo],
      forbiddenClaimsKo: [...input.contextReadOnly.forbiddenClaimsKo],
      contentPromiseKo: input.contextReadOnly.contentPromiseKo,
      ctaIntentKo: input.contextReadOnly.ctaIntentKo,
    },
    notesKo: [...DEFAULT_NOTES_KO],
  };
}

/** Clipboard text = JSON only (no giant prompt prefix). */
export function buildCanonicalAssetChatGptClipboardText(
  input: BuildCanonicalAssetChatGptExportInput,
): string {
  return JSON.stringify(buildCanonicalAssetChatGptExportPayload(input), null, 2);
}

function pickEditable(row: Record<string, unknown>): CanonicalAssetChatGptEditable | null {
  const nested = asRecord(row.editable);
  if (!nested) return null;
  const titleKo = asString(nested.titleKo);
  const openingHookKo = asString(nested.openingHookKo);
  const bodyKo = asString(nested.bodyKo);
  const decisionGuidanceKo = asString(nested.decisionGuidanceKo);
  const keyTakeawaysKo = normalizeKeyTakeawaysKo(nested.keyTakeawaysKo);
  if (!titleKo || !openingHookKo || !bodyKo || !decisionGuidanceKo) return null;
  if (keyTakeawaysKo.length < 1) return null;
  return { titleKo, openingHookKo, bodyKo, keyTakeawaysKo, decisionGuidanceKo };
}

/**
 * Strict parse for canonical-marketing-asset-chatgpt-edit-v1.
 * Rejects stale / mismatched identity tokens and non-editable overwrites.
 */
export function parseCanonicalAssetChatGptImport(input: {
  raw: string;
  expectedCandidateId: string;
  expectedAssetId: string;
  expectedVersion: number;
  expectedSourceRevision: string;
}): CanonicalAssetChatGptImportOk | CanonicalAssetChatGptImportFail {
  let parsed: unknown;
  try {
    parsed = extractJsonObject(input.raw);
  } catch (error) {
    if (error instanceof Error && error.message === "ambiguous_json") {
      return {
        ok: false,
        code: "ambiguous_json",
        messageKo: "JSON 객체가 여러 개입니다. 하나의 JSON만 붙여넣으세요.",
      };
    }
    return {
      ok: false,
      code: "invalid_json",
      messageKo: "JSON을 파싱할 수 없습니다. ChatGPT가 돌려준 JSON 전체를 붙여넣으세요.",
    };
  }

  const row = asRecord(parsed);
  if (!row) {
    return { ok: false, code: "not_object", messageKo: "JSON 객체가 필요합니다." };
  }

  const contract = asString(row.contract);
  if (contract !== CANONICAL_ASSET_CHATGPT_EDIT_CONTRACT) {
    return {
      ok: false,
      code: "contract_mismatch",
      messageKo:
        contract
          ? `지원하지 않는 contract입니다: ${contract}`
          : "contract가 없습니다. canonical-marketing-asset-chatgpt-edit-v1 JSON이 필요합니다.",
    };
  }

  const candidateId = asString(row.candidateId);
  const assetId = asString(row.assetId);
  const version = asNumberOrNull(row.version);
  const sourceRevision = asString(row.sourceRevision);

  if (!candidateId || candidateId !== input.expectedCandidateId) {
    return {
      ok: false,
      code: "candidate_mismatch",
      messageKo: STALE_ASSET_MESSAGE_KO,
    };
  }
  if (!assetId || assetId !== input.expectedAssetId) {
    return {
      ok: false,
      code: "asset_mismatch",
      messageKo: STALE_ASSET_MESSAGE_KO,
    };
  }
  if (version === null || version !== input.expectedVersion) {
    return {
      ok: false,
      code: "version_mismatch",
      messageKo: STALE_ASSET_MESSAGE_KO,
    };
  }
  if (!sourceRevision) {
    return {
      ok: false,
      code: "missing_source_revision",
      messageKo: "sourceRevision이 없습니다. 최신 원문을 다시 복사한 뒤 수정해 주세요.",
    };
  }
  if (sourceRevision !== input.expectedSourceRevision) {
    return {
      ok: false,
      code: "source_revision_mismatch",
      messageKo: STALE_ASSET_MESSAGE_KO,
    };
  }

  const editable = pickEditable(row);
  if (!editable) {
    return {
      ok: false,
      code: "missing_fields",
      messageKo:
        "editable.titleKo, openingHookKo, bodyKo, decisionGuidanceKo, keyTakeawaysKo가 모두 필요합니다.",
    };
  }

  const edits: CanonicalAssetEditFields = {
    titleKo: editable.titleKo,
    openingHookKo: editable.openingHookKo,
    bodyKo: editable.bodyKo,
    keyTakeawaysKo: editable.keyTakeawaysKo,
    decisionGuidanceKo: editable.decisionGuidanceKo,
    // limitationsKo / forbiddenClaimsKo / approval / provenance are read-only — never applied.
  };

  return {
    ok: true,
    edits,
    expectedAssetId: input.expectedAssetId,
    expectedVersion: input.expectedVersion,
    expectedSourceRevision: input.expectedSourceRevision,
    preview: {
      titleKo: editable.titleKo,
      openingHookKo: editable.openingHookKo,
      bodyPreview: editable.bodyKo.slice(0, 160),
      takeawayCount: editable.keyTakeawaysKo.length,
      returnedVersion: version,
      currentVersion: input.expectedVersion,
    },
  };
}

/** Apply edits virtually and run existing deterministic Canonical Asset validation. */
export function validateCanonicalAssetChatGptEdits(input: {
  currentAsset: CanonicalMarketingAsset;
  edits: CanonicalAssetEditFields;
  storyPoint: StoryContentPoint;
  storyPointHash: string;
  evidenceBrief: EvidenceBackedStoryBrief | null;
  proposition: ContentProposition;
  now?: Date;
}): { ok: true; proposed: CanonicalMarketingAsset } | { ok: false; issues: CanonicalAssetValidationIssue[] } {
  const proposed = applyHumanCanonicalAssetEdit({
    asset: input.currentAsset,
    edits: input.edits,
    now: input.now,
  });
  const check = validateCanonicalMarketingAsset({
    asset: proposed,
    storyPoint: input.storyPoint,
    storyPointHash: input.storyPointHash,
    evidenceBrief: input.evidenceBrief,
    proposition: input.proposition,
    expectedSourceRevision: input.currentAsset.sourceRevision,
  });
  if (!check.ok) {
    return { ok: false, issues: check.issues };
  }
  return { ok: true, proposed };
}

export function formatCanonicalAssetValidationIssuesKo(
  issues: CanonicalAssetValidationIssue[],
): string {
  if (issues.length === 0) return "ChatGPT 수정본 검증에 실패했습니다.";
  const mapped = issues.slice(0, 6).map((i) => {
    if (i.code === "unsupported_price_or_route") {
      return "근거에 없는 숫자가 추가되었습니다.";
    }
    if (i.code === "boundary_violation") {
      return "지원 범위를 넘어선 주장이 포함되어 있습니다.";
    }
    if (i.code === "contradicted_claim_revived") {
      return "금지된 주장이 다시 포함되었습니다.";
    }
    if (i.code === "story_id_drift" || i.code === "story_hash_drift") {
      return "선택된 Story와 다른 방향으로 변경되었습니다.";
    }
    return i.messageKo;
  });
  return `ChatGPT 수정본 검증에 실패했습니다. ${mapped.join(" · ")}`;
}

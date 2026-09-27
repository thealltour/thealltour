/**
 * Channel source candidates — Hermes Auto vs External Editorial (ChatGPT research-editorial result).
 * publishable-content.json stays the materialized selected state; candidates live beside it.
 */

import type { PublishableChannel } from "@/lib/marketing/publishable/contracts";

export const CHANNEL_GENERATION_SOURCES = ["hermes_auto", "external_editorial"] as const;
export type ChannelGenerationSource = (typeof CHANNEL_GENERATION_SOURCES)[number];

export const EXTERNAL_EDITORIAL_CANDIDATE_CONTRACT = "external-editorial-candidate-v1" as const;
export const HERMES_AUTO_SNAPSHOT_CONTRACT = "hermes-auto-channel-snapshot-v1" as const;
export const CHANNEL_SOURCE_SELECTION_CONTRACT = "channel-source-selection-v1" as const;

export const EXTERNAL_EDITORIAL_PROVIDER = "chatgpt_manual" as const;
/** Sidecar/slot modelProfile for externally authored artifacts (sidecar schemas require a string). */
export const EXTERNAL_EDITORIAL_MODEL_PROFILE = "external_editorial:chatgpt_manual" as const;

export type ExternalEditorialChannelReadiness = {
  /** Result JSON carried an artifact for this channel. */
  present: boolean;
  /** Deterministic materialization + publishable validation passed at import time. */
  materializable: boolean;
  issues: string[];
};

export type ExternalEditorialCandidate = {
  contract: typeof EXTERNAL_EDITORIAL_CANDIDATE_CONTRACT;
  importId: string;
  provider: typeof EXTERNAL_EDITORIAL_PROVIDER;
  importedAt: string;
  importedBy: string | null;
  resultContract: string;
  candidateId: string;
  assetId: string;
  canonicalVersion: number;
  sourceRevision: string;
  /** Deterministic fingerprint used as sourceNarrativeFingerprint by external sidecars. */
  externalNarrativeFingerprint: string;
  warnings: string[];
  channelReadiness: Record<PublishableChannel, ExternalEditorialChannelReadiness>;
  /** Parsed result JSON exactly as returned (lossless; narrative lives only here). */
  result: Record<string, unknown>;
};

export type HermesAutoSnapshot = {
  contract: typeof HERMES_AUTO_SNAPSHOT_CONTRACT;
  channel: PublishableChannel;
  snapshotId: string;
  createdAt: string;
  /** "human" when the slot was an operator edit on top of Hermes output. */
  slotOrigin: "hermes_auto" | "human";
  /** Null when the optional slot did not exist before the switch. */
  slot: import("@/lib/marketing/publishable/contracts").PublishableChannelContent | null;
  /** Package-relative sidecar path → JSON (null ⇒ file was absent and must be removed on restore). */
  sidecars: Record<string, unknown | null>;
};

export type ChannelSourceSelectionRecord = {
  selectedSource: ChannelGenerationSource;
  /** External candidate path, or the Hermes snapshot path restored (null when Hermes was never switched). */
  candidateRef: string | null;
  assetId: string;
  assetVersion: number;
  selectedAt: string;
  selectedBy: string | null;
  /** Slot generatedAt when this record was last aligned with the slot (selection or reconcile). */
  materializedGeneratedAt: string | null;
  /** Latest Hermes snapshot for this channel (kept across switches). */
  hermesSnapshotRef: string | null;
};

export type ChannelSourceSelectionFile = {
  contract: typeof CHANNEL_SOURCE_SELECTION_CONTRACT;
  candidateId: string;
  updatedAt: string;
  channels: Partial<Record<PublishableChannel, ChannelSourceSelectionRecord>>;
};

export type ChannelEffectiveSource = ChannelGenerationSource | "human_edited";

export type ChannelSourceView = {
  channel: PublishableChannel;
  /** Always derived from the materialized slot; a human-edited slot reports the source it was edited from. */
  selectedSource: ChannelGenerationSource;
  effectiveSource: ChannelEffectiveSource;
  externalCandidateRef: string | null;
  /** False only when the selection file disagrees with the slot (e.g. an interrupted write). */
  selectionInSync: boolean;
  /** The review's effective draft for this channel is a humanDraft, not the slot's aiDraft. */
  humanDraftActive: boolean;
  hermesSnapshotAvailable: boolean;
};

export const CHANNEL_SOURCE_MESSAGES_KO = {
  invalidJson: "JSON을 해석할 수 없습니다. ChatGPT가 반환한 JSON 객체 하나만 붙여넣으세요.",
  contractMismatch: "contract가 editorial-research-bundle-chatgpt-result-v1이 아닙니다.",
  canonicalMissing: "공통 마케팅 원문이 없어 외부 결과를 가져올 수 없습니다.",
  canonicalNotApproved: "현재 버전이 승인된 공통 원문에만 외부 결과를 가져올 수 있습니다.",
  staleIdentity:
    "결과의 candidateId/assetId/canonicalVersion/sourceRevision이 현재 승인 원문과 다릅니다. 최신 Research Editorial JSON으로 다시 요청하세요.",
  researchMissing: "research 객체가 없습니다. research가 없는 결과는 무효입니다.",
  researchInvalid: "research 형식이 올바르지 않습니다.",
  duplicateFinding: "research.findings의 findingId가 중복됩니다.",
  unknownReference: "알 수 없는 evidenceRefs/findingIds 참조가 있습니다.",
  unusableFinding: "usableForEditorial=false이거나 weak/conflicting인 finding을 채널/내러티브가 참조합니다.",
  ambiguousReference: "findingId와 Canonical evidenceId가 겹쳐 참조를 구분할 수 없습니다.",
  blockedWithArtifacts: "research.status가 blocked이면 narrative와 모든 채널 결과가 null이어야 합니다.",
  unknownTopLevelKey: "허용되지 않은 최상위 키가 있습니다.",
  bundleMissing: "publishable-content.json이 없어 채널 source를 전환할 수 없습니다.",
  candidateMissing: "외부 편집 candidate를 찾을 수 없습니다.",
  channelNotMaterializable: "이 채널의 외부 결과는 검증을 통과하지 못해 선택할 수 없습니다.",
  hermesSnapshotMissing: "복원할 Hermes Auto snapshot이 없습니다.",
  humanDraftConflict:
    "이 채널에 사람 수정본이 있습니다. 덮어쓰려면 확인(allowOverwriteHuman) 후 다시 시도하세요.",
} as const;

/**
 * Human Canonical Asset edit / approval boundary.
 * Channel editors may consume ONLY status=approved && approvedVersion===version.
 */

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { isApprovedCanonicalAsset } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";

export type CanonicalAssetEditFields = {
  titleKo?: string;
  dekKo?: string | null;
  openingHookKo?: string;
  bodyKo?: string;
  keyTakeawaysKo?: string[];
  decisionGuidanceKo?: string;
  optionalCtaIntentKo?: string | null;
  limitationsKo?: string[];
};

function meaningfulEdit(
  before: CanonicalMarketingAsset,
  after: CanonicalAssetEditFields,
): boolean {
  const pick = (v: string | null | undefined) => (v ?? "").trim();
  if (after.titleKo !== undefined && pick(after.titleKo) !== pick(before.titleKo)) return true;
  if (after.dekKo !== undefined && pick(after.dekKo) !== pick(before.dekKo)) return true;
  if (after.openingHookKo !== undefined && pick(after.openingHookKo) !== pick(before.openingHookKo))
    return true;
  if (after.bodyKo !== undefined && pick(after.bodyKo) !== pick(before.bodyKo)) return true;
  if (after.decisionGuidanceKo !== undefined && pick(after.decisionGuidanceKo) !== pick(before.decisionGuidanceKo))
    return true;
  if (
    after.optionalCtaIntentKo !== undefined &&
    pick(after.optionalCtaIntentKo) !== pick(before.optionalCtaIntentKo)
  )
    return true;
  if (after.keyTakeawaysKo !== undefined) {
    const a = after.keyTakeawaysKo.map((t) => t.trim()).join("\n");
    const b = before.keyTakeawaysKo.map((t) => t.trim()).join("\n");
    if (a !== b) return true;
  }
  if (after.limitationsKo !== undefined) {
    const a = after.limitationsKo.map((t) => t.trim()).join("\n");
    const b = before.limitationsKo.map((t) => t.trim()).join("\n");
    if (a !== b) return true;
  }
  return false;
}

/** Save human edits → human_edited, bump semantic version, clear approval. */
export function applyHumanCanonicalAssetEdit(input: {
  asset: CanonicalMarketingAsset;
  edits: CanonicalAssetEditFields;
  now?: Date;
}): CanonicalMarketingAsset {
  const nowIso = (input.now ?? new Date()).toISOString();
  if (!meaningfulEdit(input.asset, input.edits)) {
    return input.asset;
  }
  const nextVersion = input.asset.version + 1;
  return {
    ...input.asset,
    titleKo: input.edits.titleKo?.trim() ?? input.asset.titleKo,
    dekKo:
      input.edits.dekKo !== undefined
        ? input.edits.dekKo?.trim() || null
        : input.asset.dekKo,
    openingHookKo: input.edits.openingHookKo?.trim() ?? input.asset.openingHookKo,
    bodyKo: input.edits.bodyKo?.trim() ?? input.asset.bodyKo,
    keyTakeawaysKo: input.edits.keyTakeawaysKo ?? input.asset.keyTakeawaysKo,
    decisionGuidanceKo:
      input.edits.decisionGuidanceKo?.trim() ?? input.asset.decisionGuidanceKo,
    optionalCtaIntentKo:
      input.edits.optionalCtaIntentKo !== undefined
        ? input.edits.optionalCtaIntentKo?.trim() || null
        : input.asset.optionalCtaIntentKo,
    limitationsKo: input.edits.limitationsKo ?? input.asset.limitationsKo,
    version: nextVersion,
    status: "human_edited",
    humanEdited: true,
    editedAt: nowIso,
    approvedAt: null,
    approvedVersion: null,
    approvalSource: null,
    approvedBy: null,
  };
}

export function approveCanonicalMarketingAsset(input: {
  asset: CanonicalMarketingAsset;
  mode: "ai_original" | "human_edited";
  approvedBy?: string | null;
  now?: Date;
}): CanonicalMarketingAsset {
  if (input.asset.status === "validation_failed") {
    throw new Error("validation_failed_asset_cannot_approve");
  }
  if (input.mode === "human_edited" && !input.asset.humanEdited) {
    throw new Error("human_edited_approval_requires_edit");
  }
  if (input.mode === "ai_original" && input.asset.humanEdited && input.asset.status === "human_edited") {
    // Approving AI original after edits is not allowed — use approve edited.
    throw new Error("use_approve_edited_for_human_edited_asset");
  }
  const nowIso = (input.now ?? new Date()).toISOString();
  return {
    ...input.asset,
    status: "approved",
    approvedAt: nowIso,
    approvedVersion: input.asset.version,
    approvalSource: input.mode,
    approvedBy: input.approvedBy ?? "human",
  };
}

export function markCanonicalAssetStale(asset: CanonicalMarketingAsset): CanonicalMarketingAsset {
  return {
    ...asset,
    status: "stale",
    approvedAt: null,
    approvedVersion: null,
    approvalSource: null,
  };
}

export function canFeedChannelsFromCanonicalAsset(
  asset: CanonicalMarketingAsset | null | undefined,
): boolean {
  return isApprovedCanonicalAsset(asset);
}

export function rejectCanonicalAsset(input: {
  asset: CanonicalMarketingAsset;
  reasonKo?: string | null;
  now?: Date;
}): CanonicalMarketingAsset {
  const nowIso = (input.now ?? new Date()).toISOString();
  return {
    ...input.asset,
    status: "draft",
    approvedAt: null,
    approvedVersion: null,
    approvalSource: null,
    approvedBy: null,
    editedAt: nowIso,
    validationIssues: input.reasonKo
      ? [...input.asset.validationIssues, input.reasonKo].slice(0, 24)
      : input.asset.validationIssues,
  };
}

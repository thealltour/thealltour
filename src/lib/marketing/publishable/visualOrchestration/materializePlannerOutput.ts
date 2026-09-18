/**
 * Validate + materialize LLM Shared Visual Planner output into SharedVisualPlan.
 *
 * Governance only: schema, supported usages, enum modes, evidence floor, master IDs.
 * Does NOT enforce Worker imageCount / generatedVisualNeeded / reusable* / visualId / mode.
 */

import { SOCIAL_VISUAL_ASSET_FAMILY, stableSocialVisualId } from "@/lib/marketing/publishable/socialVisualPlan";
import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import {
  SHARED_VISUAL_PLAN_CONTRACT,
  type SharedVisual,
  type SharedVisualMode,
  type SharedVisualPlan,
  type SharedVisualUsage,
} from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import { normalizeSharedVisualMode } from "@/lib/marketing/publishable/sharedVisualPlan/normalize";
import {
  buildSourceChannelSnapshot,
  computeSourceChannelSnapshotFingerprint,
} from "@/lib/marketing/publishable/sharedVisualPlan/sourceChannelSnapshot";

export class SharedVisualPlannerValidationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SharedVisualPlannerValidationError";
    this.code = code;
  }
}

const GENERIC_INTENT_RE =
  /^(representational|travel\s*image|nice\s*scenery|cultural\s*visual|destination\s*photo|travel\s*photo|generic\s*visual|atmosphere|atmosphere\s*shot)$/i;

/** Current Threads delivery supports a single shared-static attach slot (index 0). */
export const THREADS_SUPPORTED_VISUAL_SLOT_COUNT = 1;

export function isGenericVisualIntent(intent: string): boolean {
  const t = intent.trim();
  if (t.length < 24) return true;
  if (GENERIC_INTENT_RE.test(t)) return true;
  if (/^(representational|travel|scenery|문화|풍경|분위기)\s*$/i.test(t)) return true;
  return false;
}

function resolveSourceMeta(bundle: PublishableContentBundle): {
  sourceAssetId: string;
  sourceAssetVersion: number;
} {
  const id =
    bundle.sourceAssetId?.trim() ||
    bundle.threads?.sourceAssetId?.trim() ||
    bundle.instagram?.sourceAssetId?.trim() ||
    bundle.candidateId ||
    "unknown_asset";
  const version =
    bundle.sourceAssetVersion ??
    bundle.threads?.sourceAssetVersion ??
    bundle.instagram?.sourceAssetVersion ??
    0;
  return {
    sourceAssetId: id,
    sourceAssetVersion: typeof version === "number" && Number.isFinite(version) ? version : 0,
  };
}

/**
 * Threads usage governance — independent of Worker recommended / imageCount / visuals[].
 * If Threads channel content exists, slot 0 is a valid attach destination.
 */
export function allowedThreadsSlotMax(bundle: PublishableContentBundle): number {
  const slot = bundle.threads;
  if (!slot) return -1;
  if (slot.status === "not_generated") return -1;
  if (!slot.body?.trim()) return -1;
  return THREADS_SUPPORTED_VISUAL_SLOT_COUNT - 1;
}

function allowedInstagramCardIds(bundle: PublishableContentBundle): Set<string> {
  const ids = new Set<string>();
  for (const card of bundle.instagram?.instagramMeta?.cardPlan ?? []) {
    if (card.cardId?.trim()) ids.add(card.cardId.trim());
  }
  return ids;
}

export function validateAndNormalizeUsage(
  raw: unknown,
  bundle: PublishableContentBundle,
): SharedVisualUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.channel === "threads") {
    const slotIndex =
      typeof row.slotIndex === "number" && Number.isFinite(row.slotIndex)
        ? Math.max(0, Math.floor(row.slotIndex))
        : null;
    if (slotIndex == null) return null;
    const max = allowedThreadsSlotMax(bundle);
    if (max < 0 || slotIndex > max) return null;
    return { channel: "threads", slotIndex };
  }
  if (row.channel === "instagram") {
    const cardId = typeof row.cardId === "string" ? row.cardId.trim() : "";
    if (!cardId) return null;
    if (!allowedInstagramCardIds(bundle).has(cardId)) return null;
    return { channel: "instagram", cardId };
  }
  return null;
}

/** Soft evidence floor: reject intents that echo forbidden claim phrases. */
export function findForbiddenClaimHit(
  visualIntent: string,
  forbiddenClaimsKo: string[] | null | undefined,
): string | null {
  const intent = visualIntent.toLowerCase();
  for (const claim of forbiddenClaimsKo ?? []) {
    const c = claim.trim();
    if (c.length < 2) continue;
    if (intent.includes(c.toLowerCase())) return c;
  }
  return null;
}

type LlmVisualDraft = {
  role: string;
  visualMode?: SharedVisualMode;
  generatedVisualNeeded: boolean;
  visualIntent: string;
  usages: SharedVisualUsage[];
};

export function parseLlmPlannerVisuals(
  raw: unknown,
  bundle: PublishableContentBundle,
  evidence?: { forbiddenClaimsKo?: string[] | null },
): { strategySummary: string; drafts: LlmVisualDraft[]; warnings: string[] } {
  if (!raw || typeof raw !== "object") {
    throw new SharedVisualPlannerValidationError("invalid_planner_root", "planner root must be object");
  }
  const row = raw as Record<string, unknown>;
  const strategySummary =
    typeof row.strategySummary === "string" ? row.strategySummary.trim() : "";
  const visualsRaw = Array.isArray(row.visuals) ? row.visuals : null;
  if (!visualsRaw) {
    throw new SharedVisualPlannerValidationError("missing_visuals", "visuals array required");
  }

  const warnings: string[] = [];
  const drafts: LlmVisualDraft[] = [];

  for (let i = 0; i < visualsRaw.length; i++) {
    const v = visualsRaw[i];
    if (!v || typeof v !== "object") {
      warnings.push(`visual_${i}_skipped_invalid`);
      continue;
    }
    const vr = v as Record<string, unknown>;
    // Ignore any LLM-supplied visualId — master IDs assigned deterministically.
    const role =
      typeof vr.role === "string" && vr.role.trim() ? vr.role.trim() : "context_cover";
    const visualIntent =
      typeof vr.visualIntent === "string" ? vr.visualIntent.trim() : "";
    if (!visualIntent || isGenericVisualIntent(visualIntent)) {
      throw new SharedVisualPlannerValidationError(
        "generic_visual_intent",
        `visual[${i}] visualIntent too generic or empty: ${visualIntent || "(empty)"}`,
      );
    }
    const forbiddenHit = findForbiddenClaimHit(visualIntent, evidence?.forbiddenClaimsKo);
    if (forbiddenHit) {
      throw new SharedVisualPlannerValidationError(
        "evidence_forbidden_claim",
        `visual[${i}] visualIntent echoes forbidden claim: ${forbiddenHit}`,
      );
    }
    const visualMode = normalizeSharedVisualMode(
      typeof vr.visualMode === "string" ? vr.visualMode : undefined,
    );
    // Planner final authority — do not compare to Worker generatedVisualNeeded.
    const generatedVisualNeeded = Boolean(vr.generatedVisualNeeded);
    const usages: SharedVisualUsage[] = [];
    const seen = new Set<string>();
    for (const u of Array.isArray(vr.usages) ? vr.usages : []) {
      const parsed = validateAndNormalizeUsage(u, bundle);
      if (!parsed) {
        warnings.push(`visual_${i}_usage_dropped`);
        continue;
      }
      const key =
        parsed.channel === "threads"
          ? `threads:${parsed.slotIndex}`
          : `instagram:${parsed.cardId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      usages.push(parsed);
    }
    if (usages.length === 0) {
      warnings.push(`visual_${i}_no_valid_usages`);
      continue;
    }
    drafts.push({
      role,
      ...(visualMode ? { visualMode } : {}),
      generatedVisualNeeded,
      visualIntent,
      usages,
    });
  }

  if (drafts.length === 0) {
    throw new SharedVisualPlannerValidationError(
      "no_valid_visuals",
      "planner produced no valid visuals with supported usages",
    );
  }

  // Explicitly do NOT validate drafts.length against Threads imageCount.
  return { strategySummary, drafts, warnings };
}

export function materializeSharedVisualPlanFromLlm(input: {
  bundle: PublishableContentBundle;
  llmRaw: unknown;
  now?: Date;
  forbiddenClaimsKo?: string[] | null;
}): { plan: SharedVisualPlan; warnings: string[] } {
  const { strategySummary, drafts, warnings } = parseLlmPlannerVisuals(
    input.llmRaw,
    input.bundle,
    { forbiddenClaimsKo: input.forbiddenClaimsKo },
  );
  const { sourceAssetId, sourceAssetVersion } = resolveSourceMeta(input.bundle);
  const sourceChannelSnapshot = buildSourceChannelSnapshot(input.bundle);
  const fingerprint = computeSourceChannelSnapshotFingerprint(sourceChannelSnapshot);
  const nowIso = (input.now ?? new Date()).toISOString();

  const visuals: SharedVisual[] = drafts.map((d, i) => ({
    visualId: stableSocialVisualId(i + 1),
    assetFamily: SOCIAL_VISUAL_ASSET_FAMILY,
    role: d.role,
    visualIntent: d.visualIntent,
    ...(d.visualMode ? { visualMode: d.visualMode } : {}),
    generatedVisualNeeded: d.generatedVisualNeeded,
    usages: d.usages,
  }));

  const claimed = new Set<string>();
  const deduped: SharedVisual[] = [];
  for (const v of visuals) {
    const keptUsages = v.usages.filter((u) => {
      const key =
        u.channel === "threads" ? `threads:${u.slotIndex}` : `instagram:${u.cardId}`;
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    });
    if (keptUsages.length === 0) {
      warnings.push(`${v.visualId}_dropped_duplicate_usages`);
      continue;
    }
    deduped.push({ ...v, usages: keptUsages });
  }
  const finalVisuals = deduped.map((v, i) => ({
    ...v,
    visualId: stableSocialVisualId(i + 1),
  }));

  if (finalVisuals.length === 0) {
    throw new SharedVisualPlannerValidationError(
      "no_valid_visuals_after_dedupe",
      "all visuals dropped after usage validation",
    );
  }

  return {
    plan: {
      contract: SHARED_VISUAL_PLAN_CONTRACT,
      sourceAssetId,
      sourceAssetVersion,
      generatedAt: nowIso,
      sourceVisualPlanFingerprint: fingerprint,
      sourceChannelSnapshot,
      strategySummary: strategySummary || null,
      planningMode: "llm",
      visuals: finalVisuals,
    },
    warnings,
  };
}

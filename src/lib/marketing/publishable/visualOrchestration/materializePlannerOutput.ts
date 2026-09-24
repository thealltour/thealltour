/**
 * Validate + materialize LLM Shared Visual Planner output into SharedVisualPlan.
 *
 * Governance: schema, supported usages, enum modes, evidence floor, master IDs.
 * SVP v2: when Instagram Visual Role Plan is present — full card coverage,
 * fail-closed duplicate usage, and required override traces for material
 * VRA divergences. Does NOT invent visual meaning (that is VRA).
 */

import { SOCIAL_VISUAL_ASSET_FAMILY, stableSocialVisualId } from "@/lib/marketing/publishable/socialVisualPlan";
import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import type { InstagramVisualRolePlan } from "@/lib/marketing/publishable/instagramVisualRole/contracts";
import {
  SHARED_VISUAL_PLAN_CONTRACT,
  type SharedVisual,
  type SharedVisualDecisionTrace,
  type SharedVisualMode,
  type SharedVisualPlan,
  type SharedVisualUsage,
} from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import {
  hasOverrideFor,
  parseSharedVisualDecisionTrace,
} from "@/lib/marketing/publishable/sharedVisualPlan/decisionTrace";
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

const STRATEGY_SUMMARY_MIN_LEN_WITH_VRA = 48;

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

function allowedInstagramCardIds(
  bundle: PublishableContentBundle,
  vra?: InstagramVisualRolePlan | null,
): Set<string> {
  const ids = new Set<string>();
  for (const card of bundle.instagram?.instagramMeta?.cardPlan ?? []) {
    if (card.cardId?.trim()) ids.add(card.cardId.trim());
  }
  for (const card of vra?.cards ?? []) {
    if (card.cardId?.trim()) ids.add(card.cardId.trim());
  }
  return ids;
}

export function validateAndNormalizeUsage(
  raw: unknown,
  bundle: PublishableContentBundle,
  vra?: InstagramVisualRolePlan | null,
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
    if (!allowedInstagramCardIds(bundle, vra).has(cardId)) return null;
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

/**
 * Map VRA visualModePreference to a comparable SharedVisualMode bucket.
 * typography/atmosphere → local_treatment (not a master photo mode).
 * Enum naming / alias normalization differences are not material overrides.
 */
export function comparableModeFromPreference(
  pref: string | null | undefined,
): SharedVisualMode | "local_treatment" | undefined {
  const raw = (pref ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) return undefined;
  if (raw === "typography" || raw === "atmosphere") return "local_treatment";
  return normalizeSharedVisualMode(raw);
}

export function modesMateriallyDiverge(
  requestedPref: string | null | undefined,
  finalMode: SharedVisualMode | undefined,
): boolean {
  const req = comparableModeFromPreference(requestedPref);
  if (!req) return false;
  if (req === "local_treatment") {
    if (!finalMode) return false;
    if (
      finalMode === "minimal_closing" ||
      finalMode === "fact_card" ||
      finalMode === "evidence_boundary" ||
      finalMode === "icon_infographic" ||
      finalMode === "contrast_diagram"
    ) {
      return false;
    }
    // Photo/detail modes for typography/atmosphere preference = material divergence.
    return true;
  }
  if (!finalMode) return false; // omitted mode with concrete pref — soft; generation path may still be local
  return finalMode !== req;
}

export function parseLlmPlannerVisuals(
  raw: unknown,
  bundle: PublishableContentBundle,
  evidence?: { forbiddenClaimsKo?: string[] | null },
  options?: {
    failClosedDuplicateUsages?: boolean;
    instagramVisualRolePlan?: InstagramVisualRolePlan | null;
  },
): {
  strategySummary: string;
  drafts: LlmVisualDraft[];
  warnings: string[];
  decisionTrace: SharedVisualDecisionTrace | null;
} {
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
  const decisionTrace = parseSharedVisualDecisionTrace(row.decisionTrace);
  const vra = options?.instagramVisualRolePlan ?? null;

  const warnings: string[] = [];
  const drafts: LlmVisualDraft[] = [];
  const claimed = new Set<string>();
  const failClosedDup = Boolean(options?.failClosedDuplicateUsages);

  for (let i = 0; i < visualsRaw.length; i++) {
    const v = visualsRaw[i];
    if (!v || typeof v !== "object") {
      warnings.push(`visual_${i}_skipped_invalid`);
      continue;
    }
    const vr = v as Record<string, unknown>;
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
    const generatedVisualNeeded = Boolean(vr.generatedVisualNeeded);
    const usages: SharedVisualUsage[] = [];
    for (const u of Array.isArray(vr.usages) ? vr.usages : []) {
      const parsed = validateAndNormalizeUsage(u, bundle, vra);
      if (!parsed) {
        warnings.push(`visual_${i}_usage_dropped`);
        continue;
      }
      const key =
        parsed.channel === "threads"
          ? `threads:${parsed.slotIndex}`
          : `instagram:${parsed.cardId}`;
      if (claimed.has(key)) {
        if (failClosedDup) {
          throw new SharedVisualPlannerValidationError(
            "duplicate_usage_claim",
            `usage ${key} claimed by multiple masters — fail-closed`,
          );
        }
        warnings.push(`visual_${i}_usage_duplicate_${key}`);
        continue;
      }
      claimed.add(key);
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

  return { strategySummary, drafts, warnings, decisionTrace };
}

/**
 * When VRA is present: every VRA cardId must appear in exactly one Instagram usage;
 * material preference overrides require decisionTrace entries.
 */
export function assertVraAwarePlannerInvariants(input: {
  vra: InstagramVisualRolePlan;
  drafts: LlmVisualDraft[];
  decisionTrace: SharedVisualDecisionTrace | null;
  strategySummary: string;
}): void {
  const expectedIds = input.vra.cards.map((c) => c.cardId);
  const coverage = new Map<string, { generated: boolean; mode?: SharedVisualMode; igPeers: string[] }>();

  for (const d of input.drafts) {
    const igCards = d.usages
      .filter((u): u is { channel: "instagram"; cardId: string } => u.channel === "instagram")
      .map((u) => u.cardId);
    for (const cardId of igCards) {
      if (coverage.has(cardId)) {
        throw new SharedVisualPlannerValidationError(
          "duplicate_card_coverage",
          `card ${cardId} covered more than once`,
        );
      }
      coverage.set(cardId, {
        generated: d.generatedVisualNeeded,
        mode: d.visualMode,
        igPeers: igCards,
      });
    }
  }

  for (const cardId of expectedIds) {
    if (!coverage.has(cardId)) {
      throw new SharedVisualPlannerValidationError(
        "incomplete_card_coverage",
        `VRA card ${cardId} has no Shared Visual Plan usage`,
      );
    }
  }

  // Extra IG usages not in VRA — fail (planner must not invent orphan cards beyond VRA set when VRA present)
  for (const cardId of coverage.keys()) {
    if (!expectedIds.includes(cardId)) {
      throw new SharedVisualPlannerValidationError(
        "unexpected_card_usage",
        `usage for ${cardId} not in Visual Role Plan`,
      );
    }
  }

  if (input.strategySummary.trim().length < STRATEGY_SUMMARY_MIN_LEN_WITH_VRA) {
    throw new SharedVisualPlannerValidationError(
      "weak_strategy_summary",
      `strategySummary too short when VRA present (min ${STRATEGY_SUMMARY_MIN_LEN_WITH_VRA})`,
    );
  }

  for (const card of input.vra.cards) {
    const cov = coverage.get(card.cardId)!;

    if (card.generationPreference === "required" && !cov.generated) {
      if (
        !hasOverrideFor({
          trace: input.decisionTrace,
          cardId: card.cardId,
          field: "generationPreference",
        })
      ) {
        throw new SharedVisualPlannerValidationError(
          "required_generation_override_missing",
          `card ${card.cardId}: generationPreference=required but generatedVisualNeeded=false without decisionTrace override`,
        );
      }
    }

    if (modesMateriallyDiverge(card.visualModePreference, cov.mode)) {
      if (
        !hasOverrideFor({
          trace: input.decisionTrace,
          cardId: card.cardId,
          field: "visualModePreference",
        })
      ) {
        throw new SharedVisualPlannerValidationError(
          "visual_mode_override_missing",
          `card ${card.cardId}: visualModePreference=${card.visualModePreference} diverges from final ${cov.mode ?? "(omit)"} without decisionTrace override`,
        );
      }
    }

    if (card.reusePreference === "exclusive_preferred" && cov.igPeers.length > 1) {
      if (
        !hasOverrideFor({
          trace: input.decisionTrace,
          cardId: card.cardId,
          field: "reusePreference",
        })
      ) {
        throw new SharedVisualPlannerValidationError(
          "exclusive_merge_override_missing",
          `card ${card.cardId}: exclusive_preferred but merged with ${cov.igPeers.join(",")} without decisionTrace override`,
        );
      }
    }
  }
}

export function materializeSharedVisualPlanFromLlm(input: {
  bundle: PublishableContentBundle;
  llmRaw: unknown;
  now?: Date;
  forbiddenClaimsKo?: string[] | null;
  /** When SVP ran with VRA present — recorded for stale detection + invariants. */
  sourceInstagramVisualRoleFingerprint?: string | null;
  /** Instagram Visual Role Plan — enables v2 coverage/override validation. */
  instagramVisualRolePlan?: InstagramVisualRolePlan | null;
}): { plan: SharedVisualPlan; warnings: string[] } {
  const vra = input.instagramVisualRolePlan ?? null;
  const { strategySummary, drafts, warnings, decisionTrace } = parseLlmPlannerVisuals(
    input.llmRaw,
    input.bundle,
    { forbiddenClaimsKo: input.forbiddenClaimsKo },
    {
      failClosedDuplicateUsages: Boolean(vra),
      instagramVisualRolePlan: vra,
    },
  );

  if (vra) {
    assertVraAwarePlannerInvariants({
      vra,
      drafts,
      decisionTrace,
      strategySummary,
    });
  }

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

  // Legacy path: second-pass usage claim dedupe (v2 fail-closed already applied above).
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
      ...(input.sourceInstagramVisualRoleFingerprint
        ? {
            sourceInstagramVisualRoleFingerprint:
              input.sourceInstagramVisualRoleFingerprint,
          }
        : {}),
      sourceChannelSnapshot,
      strategySummary: strategySummary || null,
      ...(decisionTrace ? { decisionTrace } : {}),
      planningMode: "llm",
      visuals: finalVisuals,
    },
    warnings,
  };
}

/**
 * Persist / read SharedVisualPlan package artifact.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { overwritePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import {
  SHARED_VISUAL_PLAN_CONTRACT,
  type SharedVisualPlan,
  type SharedVisual,
  type SharedVisualMode,
  type SharedVisualPlanningMode,
  type SharedVisualUsage,
} from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import { SHARED_VISUAL_MODES } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import {
  SHARED_VISUAL_PLAN_MEDIA_TYPE,
  SHARED_VISUAL_PLAN_RELATIVE_PATH,
} from "@/lib/marketing/publishable/sharedVisualPlan/paths";
import { parseSourceChannelSnapshot } from "@/lib/marketing/publishable/sharedVisualPlan/sourceChannelSnapshot";
import { SOCIAL_VISUAL_ASSET_FAMILY } from "@/lib/marketing/publishable/socialVisualPlan";
import { isStableSocialVisualId } from "@/lib/marketing/publishable/socialVisualPlan";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseUsage(raw: unknown): SharedVisualUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.channel === "threads" && typeof row.slotIndex === "number" && Number.isFinite(row.slotIndex)) {
    return { channel: "threads", slotIndex: Math.max(0, Math.floor(row.slotIndex)) };
  }
  if (row.channel === "instagram" && typeof row.cardId === "string" && row.cardId.trim()) {
    return { channel: "instagram", cardId: row.cardId.trim() };
  }
  return null;
}

function parseVisual(raw: unknown): SharedVisual | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const visualId = asString(row.visualId);
  if (!isStableSocialVisualId(visualId)) return null;
  const role = asString(row.role) || "cover_context";
  const visualIntent = asString(row.visualIntent);
  const modeRaw = asString(row.visualMode);
  const visualMode =
    modeRaw && (SHARED_VISUAL_MODES as readonly string[]).includes(modeRaw)
      ? (modeRaw as SharedVisualMode)
      : undefined;
  const usagesRaw = Array.isArray(row.usages) ? row.usages : [];
  const usages: SharedVisualUsage[] = [];
  for (const u of usagesRaw) {
    const parsed = parseUsage(u);
    if (parsed) usages.push(parsed);
  }
  return {
    visualId,
    assetFamily: SOCIAL_VISUAL_ASSET_FAMILY,
    role,
    visualIntent,
    ...(visualMode ? { visualMode } : {}),
    generatedVisualNeeded: Boolean(row.generatedVisualNeeded),
    usages,
  };
}

export function parseSharedVisualPlan(raw: unknown): SharedVisualPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.contract !== SHARED_VISUAL_PLAN_CONTRACT) return null;
  const sourceAssetId = asString(row.sourceAssetId);
  if (!sourceAssetId) return null;
  const sourceAssetVersion =
    typeof row.sourceAssetVersion === "number" && Number.isFinite(row.sourceAssetVersion)
      ? Math.floor(row.sourceAssetVersion)
      : 0;
  const visualsRaw = Array.isArray(row.visuals) ? row.visuals : [];
  const visuals: SharedVisual[] = [];
  for (const v of visualsRaw) {
    const parsed = parseVisual(v);
    if (parsed) visuals.push(parsed);
  }
  const sourceChannelSnapshot = parseSourceChannelSnapshot(row.sourceChannelSnapshot) ?? undefined;
  const planningModeRaw = asString(row.planningMode);
  const planningMode: SharedVisualPlanningMode | undefined =
    planningModeRaw === "llm" || planningModeRaw === "deterministic_fallback"
      ? planningModeRaw
      : undefined;
  const strategySummary =
    typeof row.strategySummary === "string"
      ? row.strategySummary.trim() || null
      : row.strategySummary === null
        ? null
        : undefined;
  return {
    contract: SHARED_VISUAL_PLAN_CONTRACT,
    sourceAssetId,
    sourceAssetVersion,
    generatedAt: asString(row.generatedAt) || new Date(0).toISOString(),
    sourceVisualPlanFingerprint: asString(row.sourceVisualPlanFingerprint),
    ...(sourceChannelSnapshot ? { sourceChannelSnapshot } : {}),
    ...(strategySummary !== undefined ? { strategySummary } : {}),
    ...(planningMode ? { planningMode } : {}),
    visuals,
  };
}

export function readSharedVisualPlan(packageRoot: string): SharedVisualPlan | null {
  const path = join(packageRoot, SHARED_VISUAL_PLAN_RELATIVE_PATH);
  if (!existsSync(path)) return null;
  try {
    return parseSharedVisualPlan(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return null;
  }
}

export function persistSharedVisualPlan(input: {
  packageRoot: string;
  plan: SharedVisualPlan;
  createdAt?: string;
}): void {
  overwritePackageArtifact({
    packageRoot: input.packageRoot,
    planned: {
      relativePath: SHARED_VISUAL_PLAN_RELATIVE_PATH,
      content: stableJsonBytes(input.plan),
      kind: "context",
      origin: "pipeline_export",
      mediaType: SHARED_VISUAL_PLAN_MEDIA_TYPE,
    },
    createdAt: input.createdAt ?? input.plan.generatedAt,
  });
}

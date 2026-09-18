/**
 * Persist / read Manual Astra Handoff package artifact.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { overwritePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import {
  MANUAL_ASTRA_HANDOFF_CONTRACT,
  type ManualAstraAspectRatio,
  type ManualAstraHandoff,
  type ManualAstraVisualRequest,
} from "@/lib/marketing/publishable/manualAstraHandoff/contracts";
import {
  MANUAL_ASTRA_HANDOFF_MEDIA_TYPE,
  MANUAL_ASTRA_HANDOFF_RELATIVE_PATH,
} from "@/lib/marketing/publishable/manualAstraHandoff/paths";
import { SHARED_VISUAL_MODES } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import type { SharedVisualMode, SharedVisualUsage } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";

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

function parseVisual(raw: unknown): ManualAstraVisualRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const visualId = asString(row.visualId);
  if (!visualId) return null;
  const aspectRaw = asString(row.aspectRatio);
  const aspectRatio: ManualAstraAspectRatio =
    aspectRaw === "1:1" || aspectRaw === "9:16" || aspectRaw === "4:5" ? aspectRaw : "4:5";
  const modeRaw = asString(row.visualMode);
  const visualMode =
    modeRaw && (SHARED_VISUAL_MODES as readonly string[]).includes(modeRaw)
      ? (modeRaw as SharedVisualMode)
      : undefined;
  const usages: SharedVisualUsage[] = [];
  for (const u of Array.isArray(row.usages) ? row.usages : []) {
    const parsed = parseUsage(u);
    if (parsed) usages.push(parsed);
  }
  const evidenceGuidance = Array.isArray(row.evidenceGuidance)
    ? row.evidenceGuidance.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean)
    : [];
  return {
    visualId,
    role: asString(row.role) || "cover_context",
    visualIntent: asString(row.visualIntent),
    ...(visualMode ? { visualMode } : {}),
    usages,
    aspectRatio,
    compositionGuidance: asString(row.compositionGuidance),
    textSafeArea: asString(row.textSafeArea),
    generatedTextAllowed: false,
    logoAllowed: false,
    readableSignageAllowed: false,
    evidenceGuidance,
    expectedFilename: asString(row.expectedFilename) || `${visualId}.png`,
  };
}

export function parseManualAstraHandoff(raw: unknown): ManualAstraHandoff | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.contract !== MANUAL_ASTRA_HANDOFF_CONTRACT) return null;
  const sourceAssetId = asString(row.sourceAssetId);
  if (!sourceAssetId) return null;
  const visualsRaw = Array.isArray(row.visuals) ? row.visuals : [];
  const visuals: ManualAstraVisualRequest[] = [];
  for (const v of visualsRaw) {
    const parsed = parseVisual(v);
    if (parsed) visuals.push(parsed);
  }
  const batch = row.batchInstructions && typeof row.batchInstructions === "object"
    ? (row.batchInstructions as Record<string, unknown>)
    : {};
  return {
    contract: MANUAL_ASTRA_HANDOFF_CONTRACT,
    sourceAssetId,
    sourceAssetVersion:
      typeof row.sourceAssetVersion === "number" && Number.isFinite(row.sourceAssetVersion)
        ? Math.floor(row.sourceAssetVersion)
        : 0,
    sourceSharedVisualPlanFingerprint: asString(row.sourceSharedVisualPlanFingerprint),
    generatedAt: asString(row.generatedAt) || new Date(0).toISOString(),
    generationMode: "manual_human_in_the_loop",
    providerIntent: "astra",
    visualCount:
      typeof row.visualCount === "number" && Number.isFinite(row.visualCount)
        ? Math.floor(row.visualCount)
        : visuals.length,
    contentTitleKo: asString(row.contentTitleKo) || null,
    editorialArchetype: asString(row.editorialArchetype) || null,
    batchInstructions: {
      consistencyIntent: asString(batch.consistencyIntent) || "travel editorial consistency",
      textPolicy: "no_generated_text",
      brandingPolicy: "no_generated_branding",
    },
    visuals,
    copyText: typeof row.copyText === "string" ? row.copyText : "",
  };
}

export function readManualAstraHandoff(packageRoot: string): ManualAstraHandoff | null {
  const path = join(packageRoot, MANUAL_ASTRA_HANDOFF_RELATIVE_PATH);
  if (!existsSync(path)) return null;
  try {
    return parseManualAstraHandoff(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return null;
  }
}

export function persistManualAstraHandoff(input: {
  packageRoot: string;
  handoff: ManualAstraHandoff;
  createdAt?: string;
}): void {
  overwritePackageArtifact({
    packageRoot: input.packageRoot,
    planned: {
      relativePath: MANUAL_ASTRA_HANDOFF_RELATIVE_PATH,
      content: stableJsonBytes(input.handoff),
      kind: "context",
      origin: "pipeline_export",
      mediaType: MANUAL_ASTRA_HANDOFF_MEDIA_TYPE,
    },
    createdAt: input.createdAt ?? input.handoff.generatedAt,
  });
}

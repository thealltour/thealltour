/**
 * LLM Astra Handoff Writer + deterministic safety governance.
 * Plan decides visuals/usages/ids; writer only enriches briefs.
 */

import type { SharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import {
  MANUAL_ASTRA_HANDOFF_CONTRACT,
  type ManualAstraApprovedAssetContext,
  type ManualAstraHandoff,
  type ManualAstraVisualRequest,
} from "@/lib/marketing/publishable/manualAstraHandoff/contracts";
import {
  batchConsistencyIntent,
  buildCompositionGuidance,
  buildTextSafeArea,
  resolveAspectRatio,
} from "@/lib/marketing/publishable/manualAstraHandoff/compositionGuidance";
import { buildEvidenceGuidance } from "@/lib/marketing/publishable/manualAstraHandoff/evidenceGuidance";
import { formatManualAstraCopyText } from "@/lib/marketing/publishable/manualAstraHandoff/formatCopyText";
import {
  expectedFilenameForVisualId,
  ManualAstraHandoffValidationError,
} from "@/lib/marketing/publishable/manualAstraHandoff/buildManualAstraHandoff";
import {
  persistManualAstraHandoff,
  readManualAstraHandoff,
} from "@/lib/marketing/publishable/manualAstraHandoff/persist";
import { extractJsonObject } from "@/lib/marketing/publishable/visualOrchestration/extractJson";

export type AstraHandoffWriterInvoke = (prompt: string) => Promise<string> | string;

export class AstraHandoffWriterValidationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AstraHandoffWriterValidationError";
    this.code = code;
  }
}

export function buildAstraHandoffWriterInput(input: {
  plan: SharedVisualPlan;
  approvedAssetContext: ManualAstraApprovedAssetContext | null;
}): Record<string, unknown> {
  const needed = input.plan.visuals.filter((v) => v.generatedVisualNeeded);
  return {
    task: "astra_handoff_brief",
    authority:
      "SharedVisualPlan is fixed. Do not add/remove visuals, change visualId, usages, or generatedVisualNeeded.",
    evidence: {
      titleKo: input.approvedAssetContext?.titleKo ?? null,
      editorialArchetype: input.approvedAssetContext?.editorialArchetype ?? null,
      supportedClaimBoundaryKo: input.approvedAssetContext?.supportedClaimBoundaryKo ?? null,
      limitationsKo: input.approvedAssetContext?.limitationsKo ?? null,
      forbiddenClaimsKo: input.approvedAssetContext?.forbiddenClaimsKo ?? null,
      storySupportVerdict: input.approvedAssetContext?.storySupportVerdict ?? null,
    },
    visuals: needed.map((v) => ({
      visualId: v.visualId,
      role: v.role,
      visualMode: v.visualMode ?? null,
      visualIntent: v.visualIntent,
      usages: v.usages,
      generatedVisualNeeded: true,
    })),
    outputSchema: {
      visuals: [
        {
          visualId: "must match input exactly",
          refinedVisualIntent: "enriched brief — subject, context, purpose, composition, evidence limits",
          compositionGuidance: "optional enrichment",
          textSafeArea: "optional enrichment",
          atmosphereLighting: "optional",
          evidenceSafeConstraints: ["optional string array"],
        },
      ],
    },
  };
}

export function formatAstraHandoffWriterPrompt(
  writerInput: Record<string, unknown>,
): string {
  return [
    "TASK: Enrich each Shared Visual into an Astra image-generation brief.",
    "Return ONLY JSON: { visuals: [...] }",
    "Every input visualId MUST appear exactly once. No extras. No omissions.",
    "Do not change usages. Keep evidence-safe. No text/logo/signage in images.",
    "",
    "INPUT_JSON:",
    JSON.stringify(writerInput, null, 2),
  ].join("\n");
}

type LlmEnrichment = {
  refinedVisualIntent?: string;
  compositionGuidance?: string;
  textSafeArea?: string;
  atmosphereLighting?: string;
  evidenceSafeConstraints?: string[];
};

function parseEnrichments(raw: unknown, expectedIds: string[]): Map<string, LlmEnrichment> {
  if (!raw || typeof raw !== "object") {
    throw new AstraHandoffWriterValidationError("invalid_writer_root", "writer root must be object");
  }
  const visualsRaw = Array.isArray((raw as { visuals?: unknown }).visuals)
    ? ((raw as { visuals: unknown[] }).visuals)
    : null;
  if (!visualsRaw) {
    throw new AstraHandoffWriterValidationError("missing_visuals", "visuals array required");
  }
  if (visualsRaw.length !== expectedIds.length) {
    throw new AstraHandoffWriterValidationError(
      "visual_count_mismatch",
      `writer returned ${visualsRaw.length} visuals; expected ${expectedIds.length}`,
    );
  }
  const map = new Map<string, LlmEnrichment>();
  for (const v of visualsRaw) {
    if (!v || typeof v !== "object") {
      throw new AstraHandoffWriterValidationError("invalid_visual_row", "visual row invalid");
    }
    const row = v as Record<string, unknown>;
    const visualId = typeof row.visualId === "string" ? row.visualId.trim() : "";
    if (!visualId || !expectedIds.includes(visualId)) {
      throw new AstraHandoffWriterValidationError(
        "unknown_or_missing_visual_id",
        `unexpected visualId: ${visualId || "(empty)"}`,
      );
    }
    if (map.has(visualId)) {
      throw new AstraHandoffWriterValidationError("duplicate_visual_id", visualId);
    }
    const evidenceSafeConstraints = Array.isArray(row.evidenceSafeConstraints)
      ? row.evidenceSafeConstraints
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.trim())
          .filter(Boolean)
      : undefined;
    map.set(visualId, {
      refinedVisualIntent:
        typeof row.refinedVisualIntent === "string" ? row.refinedVisualIntent.trim() : undefined,
      compositionGuidance:
        typeof row.compositionGuidance === "string" ? row.compositionGuidance.trim() : undefined,
      textSafeArea: typeof row.textSafeArea === "string" ? row.textSafeArea.trim() : undefined,
      atmosphereLighting:
        typeof row.atmosphereLighting === "string" ? row.atmosphereLighting.trim() : undefined,
      evidenceSafeConstraints,
    });
  }
  for (const id of expectedIds) {
    if (!map.has(id)) {
      throw new AstraHandoffWriterValidationError("missing_visual_id", `missing enrichment for ${id}`);
    }
  }
  return map;
}

function validateHandoff(handoff: ManualAstraHandoff): void {
  if (handoff.visualCount !== handoff.visuals.length) {
    throw new ManualAstraHandoffValidationError(
      "visual_count_mismatch",
      `visualCount ${handoff.visualCount} !== visuals.length ${handoff.visuals.length}`,
    );
  }
  for (const v of handoff.visuals) {
    if (v.generatedTextAllowed !== false || v.logoAllowed !== false || v.readableSignageAllowed !== false) {
      throw new ManualAstraHandoffValidationError(
        "unsafe_text_policy",
        `visual ${v.visualId} must disallow text/logo/signage`,
      );
    }
    if (v.expectedFilename !== expectedFilenameForVisualId(v.visualId)) {
      throw new ManualAstraHandoffValidationError(
        "filename_mismatch",
        `${v.expectedFilename} !== ${expectedFilenameForVisualId(v.visualId)}`,
      );
    }
  }
}

export function materializeManualAstraHandoffFromLlm(input: {
  plan: SharedVisualPlan;
  approvedAssetContext?: ManualAstraApprovedAssetContext | null;
  llmRaw: unknown;
  now?: Date;
}): ManualAstraHandoff {
  const plan = input.plan;
  const asset = input.approvedAssetContext ?? null;
  const selected = plan.visuals.filter((v) => v.generatedVisualNeeded === true);
  const expectedIds = selected.map((v) => v.visualId);
  const enrichments = parseEnrichments(input.llmRaw, expectedIds);
  const nowIso = (input.now ?? new Date()).toISOString();

  const visuals: ManualAstraVisualRequest[] = selected.map((visual) => {
    const enrichment = enrichments.get(visual.visualId)!;
    const baseEvidence = buildEvidenceGuidance({ visual, asset });
    const evidenceGuidance = [
      ...baseEvidence,
      ...(enrichment.evidenceSafeConstraints ?? []),
    ];
    // Dedupe evidence lines
    const seen = new Set<string>();
    const uniqueEvidence = evidenceGuidance.filter((line) => {
      const k = line.trim();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    let visualIntent = enrichment.refinedVisualIntent?.trim() || visual.visualIntent;
    if (enrichment.atmosphereLighting?.trim()) {
      visualIntent = `${visualIntent} Atmosphere/lighting: ${enrichment.atmosphereLighting.trim()}`;
    }

    return {
      visualId: visual.visualId,
      role: visual.role,
      visualIntent,
      ...(visual.visualMode ? { visualMode: visual.visualMode } : {}),
      usages: [...visual.usages],
      aspectRatio: resolveAspectRatio(visual.usages),
      compositionGuidance:
        enrichment.compositionGuidance?.trim() || buildCompositionGuidance(visual),
      textSafeArea: enrichment.textSafeArea?.trim() || buildTextSafeArea(visual),
      generatedTextAllowed: false as const,
      logoAllowed: false as const,
      readableSignageAllowed: false as const,
      evidenceGuidance: uniqueEvidence,
      expectedFilename: expectedFilenameForVisualId(visual.visualId),
    };
  });

  const withoutCopy: Omit<ManualAstraHandoff, "copyText"> = {
    contract: MANUAL_ASTRA_HANDOFF_CONTRACT,
    sourceAssetId: plan.sourceAssetId,
    sourceAssetVersion: plan.sourceAssetVersion,
    sourceSharedVisualPlanFingerprint: plan.sourceVisualPlanFingerprint,
    generatedAt: nowIso,
    generationMode: "manual_human_in_the_loop",
    providerIntent: "astra",
    visualCount: visuals.length,
    contentTitleKo: asset?.titleKo?.trim() || null,
    editorialArchetype: asset?.editorialArchetype?.trim() || null,
    batchInstructions: {
      consistencyIntent: batchConsistencyIntent(asset?.editorialArchetype),
      textPolicy: "no_generated_text",
      brandingPolicy: "no_generated_branding",
    },
    visuals,
  };

  const handoff: ManualAstraHandoff = {
    ...withoutCopy,
    copyText: formatManualAstraCopyText({ handoff: withoutCopy }),
  };
  validateHandoff(handoff);
  return handoff;
}

export type GenerateManualAstraHandoffResult =
  | {
      ok: true;
      handoff: ManualAstraHandoff;
      previousHandoffPreserved: false;
    }
  | {
      ok: false;
      error: { code: string; message: string };
      previousHandoff: ManualAstraHandoff | null;
      previousHandoffPreserved: true;
    };

export async function generateManualAstraHandoffWithLlm(input: {
  packageRoot: string;
  plan: SharedVisualPlan;
  /** Caller must ensure plan is fresh before calling. */
  planFresh: boolean;
  approvedAssetContext?: ManualAstraApprovedAssetContext | null;
  invoke: AstraHandoffWriterInvoke;
  now?: Date;
}): Promise<GenerateManualAstraHandoffResult> {
  const previousHandoff = readManualAstraHandoff(input.packageRoot);
  if (!input.planFresh) {
    return {
      ok: false,
      error: {
        code: "shared_visual_plan_stale",
        message: "Shared Visual Plan이 stale입니다. Plan을 먼저 재생성하세요.",
      },
      previousHandoff,
      previousHandoffPreserved: true,
    };
  }
  try {
    const writerInput = buildAstraHandoffWriterInput({
      plan: input.plan,
      approvedAssetContext: input.approvedAssetContext ?? null,
    });
    const prompt = formatAstraHandoffWriterPrompt(writerInput);
    const rawText = await input.invoke(prompt);
    const llmRaw = extractJsonObject(rawText);
    const handoff = materializeManualAstraHandoffFromLlm({
      plan: input.plan,
      approvedAssetContext: input.approvedAssetContext,
      llmRaw,
      now: input.now,
    });
    persistManualAstraHandoff({
      packageRoot: input.packageRoot,
      handoff,
      createdAt: handoff.generatedAt,
    });
    return { ok: true, handoff, previousHandoffPreserved: false };
  } catch (error) {
    const code =
      error instanceof AstraHandoffWriterValidationError ||
      error instanceof ManualAstraHandoffValidationError
        ? error.code
        : error instanceof Error && error.message
          ? error.message.split(":")[0] || "astra_handoff_writer_failed"
          : "astra_handoff_writer_failed";
    const message = error instanceof Error ? error.message : "astra_handoff_writer_failed";
    console.error("[astra-handoff] generate failed; previous handoff preserved", {
      code,
      message,
    });
    return {
      ok: false,
      error: { code, message },
      previousHandoff,
      previousHandoffPreserved: true,
    };
  }
}

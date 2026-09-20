/**
 * Shared Editorial Narrative Plan ensure — channel-agnostic SoT.
 * Reuses disk plan when source fingerprint matches; generates once when invoke is available.
 */

import { createHash } from "node:crypto";

import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import { EDITORIAL_NARRATIVE_PLANNER_HERMES_PROFILE } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import { buildCanonicalFingerprintForNarrative } from "@/lib/marketing/publishable/editorialNarrative/canonicalFingerprint";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import type { ChannelComposerPromptParts } from "@/lib/marketing/publishable/channelEditorIdentity";
import {
  buildEditorialNarrativeSourceFingerprint,
} from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import { ensureEditorialNarrativePlannerHermesReady } from "@/lib/marketing/publishable/instagramEditorial/hermesIdentity";
import {
  InstagramEditorialMaterializeError,
  materializeEditorialNarrativePlan,
} from "@/lib/marketing/publishable/instagramEditorial/materialize";
import {
  persistEditorialNarrativePlan,
  readEditorialNarrativePlanFromPackage,
} from "@/lib/marketing/publishable/instagramEditorial/persist";
import type { PublishableLlmInvoke } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";

export type EnsureEditorialNarrativePlanStatus =
  | "reused"
  | "generated"
  | "skipped_no_canonical"
  | "failed"
  | "stale_unavailable";

export type EnsureEditorialNarrativePlanResult = {
  plan: EditorialNarrativePlan | null;
  status: EnsureEditorialNarrativePlanStatus;
};

function clip(text: string | null | undefined, max: number): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new InstagramEditorialMaterializeError("invalid_json", "No JSON object in LLM output");
  }
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new InstagramEditorialMaterializeError("invalid_json", "JSON parse failed");
  }
}

function promptParts(profile: string, userPayload: Record<string, unknown>): ChannelComposerPromptParts {
  const user = [
    "Return ONLY valid JSON matching the schema described in your SOUL.",
    "=== INPUT_JSON ===",
    JSON.stringify(userPayload),
  ].join("\n");
  return {
    channel: "instagram",
    system: "",
    user,
    text: user,
    hermesProfile: profile,
  };
}

async function invokeNarrativeJson(input: {
  invoke: PublishableLlmInvoke;
  payload: Record<string, unknown>;
}): Promise<unknown> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const repair =
      attempt === 2 && lastError
        ? {
            REPAIR: `Previous output failed: ${lastError.message}. Return valid JSON only.`,
          }
        : {};
    try {
      const raw = await input.invoke(
        promptParts(EDITORIAL_NARRATIVE_PLANNER_HERMES_PROFILE, {
          ...input.payload,
          ...repair,
        }),
      );
      return extractJsonObject(typeof raw === "string" ? raw : String(raw));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error("editorial_narrative_invoke_failed");
}

export function expectedEditorialNarrativeSourceFingerprint(
  composerInput: PublishableComposerInput,
): string | null {
  const asset = composerInput.approvedCanonicalAsset;
  if (!asset) return null;
  const canonicalFp = buildCanonicalFingerprintForNarrative(asset);
  return buildEditorialNarrativeSourceFingerprint({
    assetId: asset.assetId,
    assetVersion: asset.version,
    canonicalFingerprint: canonicalFp,
    editorialArchetype: asset.editorialArchetype ?? composerInput.storyLock?.editorialArchetype,
    storyLockFingerprint: composerInput.storyLock
      ? createHash("sha256")
          .update(JSON.stringify(composerInput.storyLock), "utf8")
          .digest("hex")
      : null,
  });
}

export async function ensureEditorialNarrativePlan(input: {
  composerInput: PublishableComposerInput;
  invoke?: PublishableLlmInvoke | null;
  packageRoot?: string | null;
  now?: Date;
  hermesHome?: string;
  forceRegenerate?: boolean;
}): Promise<EnsureEditorialNarrativePlanResult> {
  const asset = input.composerInput.approvedCanonicalAsset;
  if (!asset) {
    return { plan: null, status: "skipped_no_canonical" };
  }

  const sourceFp = expectedEditorialNarrativeSourceFingerprint(input.composerInput);
  if (!sourceFp) {
    return { plan: null, status: "skipped_no_canonical" };
  }

  const existing =
    input.packageRoot != null && input.packageRoot !== ""
      ? readEditorialNarrativePlanFromPackage(input.packageRoot)
      : null;

  if (
    existing &&
    existing.sourceCanonicalFingerprint === sourceFp &&
    !input.forceRegenerate
  ) {
    return { plan: existing, status: "reused" };
  }

  if (!input.invoke) {
    if (existing) {
      return { plan: existing, status: "stale_unavailable" };
    }
    return { plan: null, status: "stale_unavailable" };
  }

  const nowIso = (input.now ?? new Date()).toISOString();

  try {
    ensureEditorialNarrativePlannerHermesReady(input.hermesHome);
    const llm = await invokeNarrativeJson({
      invoke: input.invoke,
      payload: {
        task: "editorial_narrative_plan",
        canonicalAsset: {
          assetId: asset.assetId,
          assetVersion: asset.version,
          titleKo: asset.titleKo,
          openingHookKo: asset.openingHookKo,
          bodyKo: clip(asset.bodyKo, 4000),
          keyTakeawaysKo: asset.keyTakeawaysKo,
          decisionGuidanceKo: asset.decisionGuidanceKo,
          supportedClaimBoundaryKo: asset.supportedClaimBoundaryKo,
          limitationsKo: asset.limitationsKo,
          forbiddenClaimsKo: asset.forbiddenClaimsKo,
          editorialArchetype: asset.editorialArchetype ?? null,
        },
        editorialArchetype:
          asset.editorialArchetype ?? input.composerInput.storyLock?.editorialArchetype ?? null,
        evidenceContext: {
          usableFacts: (input.composerInput.usableFacts ?? []).slice(0, 24),
          avoidedStatements: input.composerInput.avoidedStatements ?? [],
          unsupportedClaims: input.composerInput.unsupportedClaims ?? [],
        },
        storyLock: input.composerInput.storyLock ?? null,
      },
    });

    const plan = materializeEditorialNarrativePlan({
      assetId: asset.assetId,
      assetVersion: asset.version,
      sourceCanonicalFingerprint: sourceFp,
      modelProfile: EDITORIAL_NARRATIVE_PLANNER_HERMES_PROFILE,
      generatedAt: nowIso,
      editorialArchetype:
        asset.editorialArchetype ?? input.composerInput.storyLock?.editorialArchetype ?? null,
      llm,
    });

    if (input.packageRoot) {
      persistEditorialNarrativePlan({
        packageRoot: input.packageRoot,
        plan,
        createdAt: nowIso,
      });
    }

    return { plan, status: "generated" };
  } catch {
    return { plan: existing ?? null, status: "failed" };
  }
}

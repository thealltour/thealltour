/**
 * Threads Copy Specialist pipeline — Narrative → threads-copy-writer → publishable.
 */

import type { ChannelComposerPromptParts } from "@/lib/marketing/publishable/channelEditorIdentity";
import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  type PublishableChannelContent,
} from "@/lib/marketing/publishable/contracts";
import {
  CHANNEL_INPUT_AUTHORITY_VERSION,
  buildPropositionProvenance,
  propositionBlocksPolishedGeneration,
  resolveFailureStatus,
} from "@/lib/marketing/publishable/composerRuntime";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import {
  buildEditorialNarrativeContentFingerprint,
} from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import type { PublishableLlmInvoke } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import { assemblePublishableThreadsFromCopy } from "@/lib/marketing/publishable/threadsCopy/assemblePublishable";
import {
  THREADS_COPY_WRITER_HERMES_PROFILE,
  type ThreadsCopyArtifact,
} from "@/lib/marketing/publishable/threadsCopy/contracts";
import {
  ensureThreadsCopyWriterHermesReady,
} from "@/lib/marketing/publishable/threadsCopy/hermesIdentity";
import {
  ThreadsCopyMaterializeError,
  materializeThreadsCopy,
} from "@/lib/marketing/publishable/threadsCopy/materialize";
import {
  persistThreadsCopy,
  readThreadsCopyFromPackage,
} from "@/lib/marketing/publishable/threadsCopy/persist";
import {
  THREADS_BODY_MAX_CHARS,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";

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
    throw new ThreadsCopyMaterializeError("invalid_json", "No JSON object in LLM output");
  }
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new ThreadsCopyMaterializeError("invalid_json", "JSON parse failed");
  }
}

function promptParts(userPayload: Record<string, unknown>): ChannelComposerPromptParts {
  const user = [
    "Return ONLY valid JSON matching the schema described in your SOUL.",
    "=== INPUT_JSON ===",
    JSON.stringify(userPayload),
  ].join("\n");
  return {
    channel: "threads",
    system: "",
    user,
    text: user,
    hermesProfile: THREADS_COPY_WRITER_HERMES_PROFILE,
  };
}

async function invokeThreadsCopyJson(input: {
  invoke: PublishableLlmInvoke;
  payload: Record<string, unknown>;
}): Promise<{ llm: unknown; attemptCount: number }> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const repair =
      attempt === 2 && lastError
        ? {
            REPAIR: `Previous output failed: ${lastError.message}. Return valid JSON only. body <= ${THREADS_BODY_MAX_CHARS} chars. No forced CTA.`,
          }
        : {};
    try {
      const raw = await input.invoke(promptParts({ ...input.payload, ...repair }));
      return {
        llm: extractJsonObject(typeof raw === "string" ? raw : String(raw)),
        attemptCount: attempt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error("threads_copy_invoke_failed");
}

function failedContent(input: {
  composerInput: PublishableComposerInput;
  nowIso: string;
  attemptCount: number;
  latencyMs: number;
  failureCategory: PublishableChannelContent["provenance"]["failureCategory"];
  failureMessage: string;
  modelProfile?: string | null;
}): PublishableChannelContent {
  const validation = validatePublishableText("", { channel: "threads" });
  const compositionMode =
    input.composerInput.compositionMode ??
    (input.composerInput.approvedCanonicalAsset ? "approved_asset_adapter" : "legacy_proposition_driven");
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "threads",
    format: "threads_text",
    title: null,
    body: "[generation failed]",
    status: resolveFailureStatus({
      llmAttempted: true,
      category: input.failureCategory ?? "unknown",
    }),
    generatedAt: input.nowIso,
    sourceCandidateId: input.composerInput.candidateId,
    sourceRevision: input.composerInput.sourceRevision,
    selectedAngleRef: input.composerInput.research?.selectedAngleId ?? null,
    researchBriefRef: input.composerInput.research?.researchBriefId ?? null,
    provenance: {
      composer: "llm",
      evidenceRefIds: input.composerInput.evidenceRefIds,
      commercialIntent: input.composerInput.commercialIntent,
      generationMode: "llm",
      modelProfile: input.modelProfile ?? THREADS_COPY_WRITER_HERMES_PROFILE,
      attemptCount: input.attemptCount,
      latencyMs: input.latencyMs,
      failureCategory: input.failureCategory ?? "unknown",
      failureMessage: input.failureMessage,
      propositionStrength: input.composerInput.contentProposition?.propositionStrength ?? null,
      proposition: buildPropositionProvenance(input.composerInput),
      compositionMode,
      inputAuthorityVersion: input.composerInput.approvedCanonicalAsset
        ? CHANNEL_INPUT_AUTHORITY_VERSION
        : null,
    },
    validation,
    publishableSuccess: false,
    needsRegeneration: true,
    mediaPlan: null,
  };
}

export type RunThreadsCopySpecialistResult = {
  content: PublishableChannelContent;
  copy: ThreadsCopyArtifact | null;
  status: "generated" | "reused" | "failed";
};

export async function runThreadsCopySpecialist(input: {
  composerInput: PublishableComposerInput;
  invoke: PublishableLlmInvoke;
  now?: Date;
  packageRoot?: string | null;
  hermesHome?: string;
  forceRegenerate?: boolean;
  modelProfile?: string | null;
}): Promise<RunThreadsCopySpecialistResult> {
  const nowIso = (input.now ?? new Date()).toISOString();
  const started = Date.now();
  let attemptCount = 0;

  if (propositionBlocksPolishedGeneration(input.composerInput.contentProposition)) {
    return {
      content: failedContent({
        composerInput: input.composerInput,
        nowIso,
        attemptCount: 0,
        latencyMs: Date.now() - started,
        failureCategory: "insufficient_proposition",
        failureMessage: "propositionStrength=insufficient",
        modelProfile: input.modelProfile,
      }),
      copy: null,
      status: "failed",
    };
  }

  const asset = input.composerInput.approvedCanonicalAsset;
  const narrative = input.composerInput.editorialNarrativePlan;
  if (!asset) {
    return {
      content: failedContent({
        composerInput: input.composerInput,
        nowIso,
        attemptCount: 0,
        latencyMs: Date.now() - started,
        failureCategory: "schema_validation",
        failureMessage: "approved_canonical_required_for_threads_copy_specialist",
        modelProfile: input.modelProfile,
      }),
      copy: null,
      status: "failed",
    };
  }
  if (!narrative) {
    return {
      content: failedContent({
        composerInput: input.composerInput,
        nowIso,
        attemptCount: 0,
        latencyMs: Date.now() - started,
        failureCategory: "schema_validation",
        failureMessage: "editorial_narrative_plan_required_for_threads_copy_specialist",
        modelProfile: input.modelProfile,
      }),
      copy: null,
      status: "failed",
    };
  }

  const narrativeFp = buildEditorialNarrativeContentFingerprint(narrative);

  const existing =
    input.packageRoot && !input.forceRegenerate
      ? readThreadsCopyFromPackage(input.packageRoot)
      : null;
  if (
    existing &&
    existing.sourceNarrativeFingerprint === narrativeFp &&
    existing.assetId === asset.assetId &&
    existing.assetVersion === asset.version
  ) {
    return {
      content: assemblePublishableThreadsFromCopy({
        composerInput: input.composerInput,
        copy: existing,
        nowIso,
        attemptCount: 0,
        latencyMs: Date.now() - started,
        modelProfile: existing.provenance.modelProfile,
      }),
      copy: existing,
      status: "reused",
    };
  }

  try {
    ensureThreadsCopyWriterHermesReady(input.hermesHome);
    const inv = await invokeThreadsCopyJson({
      invoke: input.invoke,
      payload: {
        task: "threads_copy",
        editorialAuthority: {
          factualBoundary: "approved_canonical",
          narrativeSequence: "editorial_narrative_plan",
          channelStructure: "threads_copy_writer",
          wording: "threads_copy_writer",
        },
        channelConstraints: {
          channel: "threads",
          bodyMaxChars: THREADS_BODY_MAX_CHARS,
          title: null,
          hashtagsDefault: false,
          noForcedCta: true,
          noLinkClickCtaWithoutLink: true,
        },
        canonicalAsset: {
          assetId: asset.assetId,
          assetVersion: asset.version,
          titleKo: asset.titleKo,
          openingHookKo: clip(asset.openingHookKo, 400),
          bodyKo: clip(asset.bodyKo, 2400),
          keyTakeawaysKo: asset.keyTakeawaysKo,
          decisionGuidanceKo: asset.decisionGuidanceKo,
          supportedClaimBoundaryKo: asset.supportedClaimBoundaryKo,
          limitationsKo: asset.limitationsKo,
          forbiddenClaimsKo: asset.forbiddenClaimsKo,
          editorialArchetype: asset.editorialArchetype ?? null,
        },
        editorialNarrativePlan: {
          narrativePromise: narrative.narrativePromise,
          audienceTakeaway: narrative.audienceTakeaway,
          beats: narrative.beats,
        },
        evidenceBoundary: {
          evidenceRefIds: input.composerInput.evidenceRefIds,
          avoidedStatements: input.composerInput.avoidedStatements,
          unsupportedClaims: input.composerInput.unsupportedClaims,
        },
        // Advisory only — must not become literal copy.
        engagementIntentAdvisory: {
          desiredAudienceAction:
            input.composerInput.corePack?.desiredAudienceAction ?? null,
          engagementMechanism:
            input.composerInput.corePack?.engagementMechanism ?? null,
          note: "Advisory only. Do not emit save/compare/checklist CTA phrasing.",
        },
      },
    });
    attemptCount = inv.attemptCount;

    const copy = materializeThreadsCopy({
      assetId: asset.assetId,
      assetVersion: asset.version,
      sourceNarrativeFingerprint: narrativeFp,
      narrative,
      modelProfile: THREADS_COPY_WRITER_HERMES_PROFILE,
      generatedAt: nowIso,
      llm: inv.llm,
    });

    if (input.packageRoot) {
      persistThreadsCopy({
        packageRoot: input.packageRoot,
        copy,
        createdAt: nowIso,
      });
    }

    return {
      content: assemblePublishableThreadsFromCopy({
        composerInput: input.composerInput,
        copy,
        nowIso,
        attemptCount,
        latencyMs: Date.now() - started,
        modelProfile: THREADS_COPY_WRITER_HERMES_PROFILE,
      }),
      copy,
      status: "generated",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "threads_copy_failed");
    const category =
      error instanceof ThreadsCopyMaterializeError
        ? error.code === "too_long" || error.code === "forced_cta"
          ? "publishability_validation"
          : error.code === "invalid_json"
            ? "invalid_json"
            : "schema_validation"
        : "unknown";
    return {
      content: failedContent({
        composerInput: input.composerInput,
        nowIso,
        attemptCount: Math.max(1, attemptCount),
        latencyMs: Date.now() - started,
        failureCategory: category,
        failureMessage: message,
        modelProfile: input.modelProfile,
      }),
      copy: null,
      status: "failed",
    };
  }
}

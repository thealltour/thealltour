/**
 * Naver Band Copy Specialist pipeline — Narrative → naver-band-copy-writer → publishable.
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
import { buildEditorialNarrativeContentFingerprint } from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import { assemblePublishableNaverBandFromCopy } from "@/lib/marketing/publishable/naverBandCopy/assemblePublishable";
import {
  NAVER_BAND_COPY_CONTRACT,
  NAVER_BAND_COPY_PREFERRED_MAX_CHARS,
  NAVER_BAND_COPY_PREFERRED_MIN_CHARS,
  NAVER_BAND_COPY_SPECIALIST_MAX_CHARS,
  NAVER_BAND_COPY_WRITER_HERMES_PROFILE,
  type NaverBandCopyArtifact,
} from "@/lib/marketing/publishable/naverBandCopy/contracts";
import { CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_NOTE } from "@/lib/marketing/agentContracts/crossChannelNaturalKoreanSyntaxContract";
import { ensureNaverBandCopyWriterHermesReady } from "@/lib/marketing/publishable/naverBandCopy/hermesIdentity";
import {
  NaverBandCopyMaterializeError,
  materializeNaverBandCopy,
} from "@/lib/marketing/publishable/naverBandCopy/materialize";
import {
  persistNaverBandCopy,
  readNaverBandCopyFromPackage,
} from "@/lib/marketing/publishable/naverBandCopy/persist";
import type { PublishableLlmInvoke } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import { validatePublishableText } from "@/lib/marketing/publishable/validate";
import {
  assertArtifactDependsOn,
  assertFingerprintSourcesInclude,
  getArtifactRepairAttemptBudget,
  requireMaterializeInRepairLoop,
  requireOnGenerateFail,
} from "@/lib/marketing/agentContracts/lifecycleHelpers";
import { EDITORIAL_NARRATIVE_PLAN_CONTRACT } from "@/lib/marketing/publishable/editorialNarrative/contracts";

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
    throw new NaverBandCopyMaterializeError("invalid_json", "No JSON object in LLM output");
  }
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new NaverBandCopyMaterializeError("invalid_json", "JSON parse failed");
  }
}

function promptParts(userPayload: Record<string, unknown>): ChannelComposerPromptParts {
  const user = [
    "Return ONLY valid JSON matching the schema described in your SOUL.",
    "=== INPUT_JSON ===",
    JSON.stringify(userPayload),
  ].join("\n");
  return {
    channel: "naver_band",
    system: "",
    user,
    text: user,
    hermesProfile: NAVER_BAND_COPY_WRITER_HERMES_PROFILE,
  };
}

async function invokeBandCopyJson(input: {
  invoke: PublishableLlmInvoke;
  payload: Record<string, unknown>;
  maxAttempts: number;
}): Promise<{ llm: unknown; attemptCount: number }> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= input.maxAttempts; attempt++) {
    const repair =
      attempt > 1 && lastError
        ? {
            REPAIR: `Previous output failed: ${lastError.message}. Return valid JSON only. Prefer ${NAVER_BAND_COPY_PREFERRED_MIN_CHARS}–${NAVER_BAND_COPY_PREFERRED_MAX_CHARS} chars; max ${NAVER_BAND_COPY_SPECIALIST_MAX_CHARS}. No forced comment/save CTA. Do not reprint Canonical.`,
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
  throw lastError ?? new Error("naver_band_copy_invoke_failed");
}

/**
 * Phase 3D: Band artifact contract parity (behavior preserved; no forced CTA).
 */
export function assertNaverBandCopyArtifactContractParity(): void {
  assertArtifactDependsOn(NAVER_BAND_COPY_CONTRACT, EDITORIAL_NARRATIVE_PLAN_CONTRACT);
  assertFingerprintSourcesInclude(NAVER_BAND_COPY_CONTRACT, ["sourceNarrativeFingerprint"]);
  requireOnGenerateFail(NAVER_BAND_COPY_CONTRACT, "fail_closed");
  requireMaterializeInRepairLoop(NAVER_BAND_COPY_CONTRACT, false);
}

export function resolveNaverBandCopyRepairAttemptBudget(): number {
  return getArtifactRepairAttemptBudget(NAVER_BAND_COPY_CONTRACT);
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
  const validation = validatePublishableText("", { channel: "naver_band" });
  const compositionMode =
    input.composerInput.compositionMode ??
    (input.composerInput.approvedCanonicalAsset ? "approved_asset_adapter" : "legacy_proposition_driven");
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "naver_band",
    format: "naver_band_post",
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
      modelProfile: input.modelProfile ?? NAVER_BAND_COPY_WRITER_HERMES_PROFILE,
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
  };
}

export type RunNaverBandCopySpecialistResult = {
  content: PublishableChannelContent;
  copy: NaverBandCopyArtifact | null;
  status: "generated" | "reused" | "failed";
};

export async function runNaverBandCopySpecialist(input: {
  composerInput: PublishableComposerInput;
  invoke: PublishableLlmInvoke;
  now?: Date;
  packageRoot?: string | null;
  hermesHome?: string;
  forceRegenerate?: boolean;
  modelProfile?: string | null;
}): Promise<RunNaverBandCopySpecialistResult> {
  const nowIso = (input.now ?? new Date()).toISOString();
  const started = Date.now();
  let attemptCount = 0;

  // Phase 3D: contract-driven lifecycle/failure metadata (behavior preserved).
  assertNaverBandCopyArtifactContractParity();
  const maxAttempts = resolveNaverBandCopyRepairAttemptBudget();

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
        failureMessage: "approved_canonical_required_for_naver_band_copy_specialist",
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
        failureMessage: "editorial_narrative_plan_required_for_naver_band_copy_specialist",
        modelProfile: input.modelProfile,
      }),
      copy: null,
      status: "failed",
    };
  }

  const narrativeFp = buildEditorialNarrativeContentFingerprint(narrative);

  const existing =
    input.packageRoot && !input.forceRegenerate
      ? readNaverBandCopyFromPackage(input.packageRoot)
      : null;
  if (
    existing &&
    existing.sourceNarrativeFingerprint === narrativeFp &&
    existing.assetId === asset.assetId &&
    existing.assetVersion === asset.version
  ) {
    return {
      content: assemblePublishableNaverBandFromCopy({
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
    ensureNaverBandCopyWriterHermesReady(input.hermesHome);
    const inv = await invokeBandCopyJson({
      invoke: input.invoke,
      maxAttempts,
      payload: {
        task: "naver_band_copy",
        naturalKoreanSyntaxNote: CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_NOTE,
        editorialAuthority: {
          factualBoundary: "approved_canonical",
          narrativeSequence: "editorial_narrative_plan",
          channelStructure: "naver_band_copy_writer",
          wording: "naver_band_copy_writer",
        },
        channelConstraints: {
          channel: "naver_band",
          preferredMinChars: NAVER_BAND_COPY_PREFERRED_MIN_CHARS,
          preferredMaxChars: NAVER_BAND_COPY_PREFERRED_MAX_CHARS,
          specialistMaxChars: NAVER_BAND_COPY_SPECIALIST_MAX_CHARS,
          noForcedCommentCta: true,
          noCanonicalReprint: true,
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
        engagementIntentAdvisory: {
          desiredAudienceAction:
            input.composerInput.corePack?.desiredAudienceAction ?? null,
          engagementMechanism:
            input.composerInput.corePack?.engagementMechanism ?? null,
          note: "Advisory only. Do not emit comment/save/share forced CTA phrasing.",
        },
        commercialIntent: input.composerInput.commercialIntent,
      },
    });
    attemptCount = inv.attemptCount;

    // materializeInRepairLoop=false: materialize after JSON repair loop.
    const copy = materializeNaverBandCopy({
      assetId: asset.assetId,
      assetVersion: asset.version,
      sourceNarrativeFingerprint: narrativeFp,
      narrative,
      canonicalBodyKo: asset.bodyKo,
      modelProfile: NAVER_BAND_COPY_WRITER_HERMES_PROFILE,
      generatedAt: nowIso,
      llm: inv.llm,
    });

    if (input.packageRoot) {
      persistNaverBandCopy({
        packageRoot: input.packageRoot,
        copy,
        createdAt: nowIso,
      });
    }

    return {
      content: assemblePublishableNaverBandFromCopy({
        composerInput: input.composerInput,
        copy,
        nowIso,
        attemptCount,
        latencyMs: Date.now() - started,
        modelProfile: NAVER_BAND_COPY_WRITER_HERMES_PROFILE,
      }),
      copy,
      status: "generated",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "naver_band_copy_failed");
    const category =
      error instanceof NaverBandCopyMaterializeError
        ? error.code === "too_long" ||
            error.code === "forced_cta" ||
            error.code === "unsafe_generalization" ||
            error.code === "canonical_reprint"
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

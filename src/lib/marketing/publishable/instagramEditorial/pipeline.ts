/**
 * Instagram Editorial Split pipeline — 4 LLM workers, fail-closed.
 * No quiet heuristic downgrade on production path.
 */

import type { PublishableChannelContent } from "@/lib/marketing/publishable/contracts";
import type { ChannelComposerPromptParts } from "@/lib/marketing/publishable/channelEditorIdentity";
import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import { buildCanonicalFingerprintForNarrative } from "@/lib/marketing/publishable/editorialNarrative/canonicalFingerprint";
import {
  ensureEditorialNarrativePlan,
  expectedEditorialNarrativeSourceFingerprint,
} from "@/lib/marketing/publishable/editorialNarrative/ensureEditorialNarrativePlan";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import {
  DEFAULT_INSTAGRAM_CHANNEL_CONSTRAINTS,
  type InstagramChannelConstraints,
} from "@/lib/marketing/publishable/instagramEditorial/channelConstraints";
import {
  INSTAGRAM_CAPTION_CONTRACT,
  INSTAGRAM_CAPTION_WRITER_HERMES_PROFILE,
  INSTAGRAM_CARD_COPY_CONTRACT,
  INSTAGRAM_CARD_COPY_WRITER_HERMES_PROFILE,
  INSTAGRAM_CAROUSEL_PLAN_CONTRACT,
  INSTAGRAM_CAROUSEL_PLANNER_HERMES_PROFILE,
  type InstagramCaption,
  type InstagramCardCopy,
  type InstagramCarouselPlan,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";
import { assemblePublishableInstagramFromEditorial } from "@/lib/marketing/publishable/instagramEditorial/assemblePublishable";
import {
  buildInstagramCardCopyWriterPayload,
  buildInstagramCardCopyWriterUserPrompt,
} from "@/lib/marketing/publishable/instagramEditorial/cardCopyPrompt";
import {
  buildEditorialNarrativeContentFingerprint,
  buildInstagramCardCopyContentFingerprint,
  buildInstagramCarouselContentFingerprint,
} from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import { ensureInstagramEditorialHermesProfilesReady } from "@/lib/marketing/publishable/instagramEditorial/hermesIdentity";
import {
  InstagramEditorialMaterializeError,
  materializeInstagramCaption,
  materializeInstagramCardCopy,
  materializeInstagramCarouselPlan,
} from "@/lib/marketing/publishable/instagramEditorial/materialize";
import { persistInstagramEditorialArtifacts } from "@/lib/marketing/publishable/instagramEditorial/persist";
import type { PublishableLlmInvoke } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import {
  CHANNEL_INPUT_AUTHORITY_VERSION,
  buildPropositionProvenance,
  propositionBlocksPolishedGeneration,
  resolveFailureStatus,
} from "@/lib/marketing/publishable/composerRuntime";
import { PUBLISHABLE_CHANNEL_CONTENT_CONTRACT } from "@/lib/marketing/publishable/contracts";
import { validatePublishableText } from "@/lib/marketing/publishable/validate";
import {
  assertArtifactDependsOn,
  assertFingerprintSourcesInclude,
  getArtifactDependencies,
  getArtifactRepairAttemptBudget,
  requireMaterializeInRepairLoop,
  requireOnGenerateFail,
} from "@/lib/marketing/agentContracts/lifecycleHelpers";

export type InstagramEditorialPipelineResult = {
  content: PublishableChannelContent;
  narrative: EditorialNarrativePlan | null;
  carousel: InstagramCarouselPlan | null;
  cardCopy: InstagramCardCopy | null;
  caption: InstagramCaption | null;
};

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

function clip(text: string | null | undefined, max: number): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export { buildCanonicalFingerprintForNarrative };

function promptParts(
  profile: string,
  userPayload: Record<string, unknown>,
  options?: { structuredUserPrompt?: string },
): ChannelComposerPromptParts {
  const user =
    options?.structuredUserPrompt ??
    [
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

async function invokeJson(input: {
  invoke: PublishableLlmInvoke;
  profile: string;
  payload: Record<string, unknown>;
  maxAttempts: number;
  /** Card Copy: wrap payload with A–D semantic/surface sections. */
  useCardCopyStructuredPrompt?: boolean;
}): Promise<{ llm: unknown; attemptCount: number }> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= input.maxAttempts; attempt++) {
    const repair =
      attempt > 1 && lastError
        ? {
            REPAIR: `Previous output failed: ${lastError.message}. Return valid JSON only.`,
          }
        : {};
    try {
      const payload = { ...input.payload, ...repair };
      const structured = input.useCardCopyStructuredPrompt
        ? buildInstagramCardCopyWriterUserPrompt(payload)
        : undefined;
      const raw = await input.invoke(
        promptParts(input.profile, payload, { structuredUserPrompt: structured }),
      );
      return { llm: extractJsonObject(typeof raw === "string" ? raw : String(raw)), attemptCount: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error("instagram_editorial_invoke_failed");
}

/**
 * Phase 3C: assert Carousel / Card Copy / Caption artifact contract parity.
 * Caption must stay independent of the VRA/SVP visual chain.
 */
export function assertInstagramEditorialArtifactContractParity(): void {
  assertArtifactDependsOn(INSTAGRAM_CAROUSEL_PLAN_CONTRACT, "editorial-narrative-plan-v1");
  assertFingerprintSourcesInclude(INSTAGRAM_CAROUSEL_PLAN_CONTRACT, [
    "sourceNarrativeFingerprint",
  ]);
  requireOnGenerateFail(INSTAGRAM_CAROUSEL_PLAN_CONTRACT, "fail_closed");
  requireMaterializeInRepairLoop(INSTAGRAM_CAROUSEL_PLAN_CONTRACT, false);

  assertArtifactDependsOn(INSTAGRAM_CARD_COPY_CONTRACT, INSTAGRAM_CAROUSEL_PLAN_CONTRACT);
  assertFingerprintSourcesInclude(INSTAGRAM_CARD_COPY_CONTRACT, [
    "sourceCarouselFingerprint",
  ]);
  requireOnGenerateFail(INSTAGRAM_CARD_COPY_CONTRACT, "fail_closed");
  requireMaterializeInRepairLoop(INSTAGRAM_CARD_COPY_CONTRACT, false);

  assertArtifactDependsOn(INSTAGRAM_CAPTION_CONTRACT, INSTAGRAM_CARD_COPY_CONTRACT);
  assertFingerprintSourcesInclude(INSTAGRAM_CAPTION_CONTRACT, [
    "sourceCardCopyFingerprint",
  ]);
  requireOnGenerateFail(INSTAGRAM_CAPTION_CONTRACT, "fail_closed");
  requireMaterializeInRepairLoop(INSTAGRAM_CAPTION_CONTRACT, false);

  // Caption stays off the visual chain (no VRA/SVP dependency).
  const deps = getArtifactDependencies(INSTAGRAM_CAPTION_CONTRACT);
  if (deps.includes("instagram-visual-role-plan-v1") || deps.includes("shared-visual-plan-v1")) {
    throw new Error(
      "Artifact contract drift: instagram-caption-v1 must not depend on VRA/SVP",
    );
  }
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
  const validation = validatePublishableText("", { channel: "instagram" });
  const compositionMode =
    input.composerInput.compositionMode ??
    (input.composerInput.approvedCanonicalAsset ? "approved_asset_adapter" : "legacy_proposition_driven");
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "instagram",
    format: "instagram_caption",
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
      modelProfile: input.modelProfile ?? "instagram-editorial-split",
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
    instagramMeta: undefined,
  };
}

/**
 * Run narrative → carousel → card-copy → caption. Fail-closed on any step.
 * Persist artifacts when packageRoot is provided.
 */
export async function runInstagramEditorialPipeline(input: {
  composerInput: PublishableComposerInput;
  invoke: PublishableLlmInvoke;
  now?: Date;
  modelProfile?: string | null;
  packageRoot?: string | null;
  constraints?: InstagramChannelConstraints;
  hermesHome?: string;
  /** Prebuilt Narrative Plan — skips narrative LLM when fingerprint matches. */
  narrativePlan?: EditorialNarrativePlan | null;
}): Promise<InstagramEditorialPipelineResult> {
  const nowIso = (input.now ?? new Date()).toISOString();
  const started = Date.now();
  const constraints = input.constraints ?? DEFAULT_INSTAGRAM_CHANNEL_CONSTRAINTS;
  let attemptCount = 0;

  ensureInstagramEditorialHermesProfilesReady(input.hermesHome);
  // Phase 3C: contract-driven lifecycle/failure metadata (behavior preserved).
  assertInstagramEditorialArtifactContractParity();
  const carouselAttempts = getArtifactRepairAttemptBudget(INSTAGRAM_CAROUSEL_PLAN_CONTRACT);
  const cardCopyAttempts = getArtifactRepairAttemptBudget(INSTAGRAM_CARD_COPY_CONTRACT);
  const captionAttempts = getArtifactRepairAttemptBudget(INSTAGRAM_CAPTION_CONTRACT);

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
      narrative: null,
      carousel: null,
      cardCopy: null,
      caption: null,
    };
  }

  const asset = input.composerInput.approvedCanonicalAsset;
  if (!asset) {
    return {
      content: failedContent({
        composerInput: input.composerInput,
        nowIso,
        attemptCount: 0,
        latencyMs: Date.now() - started,
        failureCategory: "schema_validation",
        failureMessage: "approved_canonical_required_for_editorial_split",
        modelProfile: input.modelProfile,
      }),
      narrative: null,
      carousel: null,
      cardCopy: null,
      caption: null,
    };
  }

  try {
    const sourceFp = expectedEditorialNarrativeSourceFingerprint(input.composerInput);
    if (!sourceFp) {
      throw new InstagramEditorialMaterializeError(
        "missing_source_fp",
        "editorial_narrative_source_fingerprint_unavailable",
      );
    }

    const preferred =
      input.narrativePlan ?? input.composerInput.editorialNarrativePlan ?? null;
    let narrative: EditorialNarrativePlan;
    if (preferred && preferred.sourceCanonicalFingerprint === sourceFp) {
      narrative = preferred;
    } else {
      const ensured = await ensureEditorialNarrativePlan({
        composerInput: input.composerInput,
        invoke: input.invoke,
        packageRoot: input.packageRoot,
        now: input.now,
        hermesHome: input.hermesHome,
      });
      if (!ensured.plan) {
        throw new InstagramEditorialMaterializeError(
          "narrative_unavailable",
          `ensureEditorialNarrativePlan:${ensured.status}`,
        );
      }
      narrative = ensured.plan;
      if (ensured.status === "generated") {
        attemptCount += 1;
      }
    }
    const narrativeContentFp = buildEditorialNarrativeContentFingerprint(narrative);

    const carouselInv = await invokeJson({
      invoke: input.invoke,
      profile: INSTAGRAM_CAROUSEL_PLANNER_HERMES_PROFILE,
      maxAttempts: carouselAttempts,
      payload: {
        task: "instagram_carousel_plan",
        editorialNarrativePlan: narrative,
        instagramChannelConstraints: constraints,
        canonicalAsset: {
          assetId: asset.assetId,
          titleKo: asset.titleKo,
          openingHookKo: clip(asset.openingHookKo, 400),
          keyTakeawaysKo: asset.keyTakeawaysKo,
        },
      },
    });
    attemptCount += carouselInv.attemptCount;
    // materializeInRepairLoop=false: materialize after JSON repair loop (do not move inside).
    const carousel = materializeInstagramCarouselPlan({
      assetId: asset.assetId,
      assetVersion: asset.version,
      sourceNarrativeFingerprint: narrativeContentFp,
      modelProfile: INSTAGRAM_CAROUSEL_PLANNER_HERMES_PROFILE,
      generatedAt: nowIso,
      validBeatIds: new Set(narrative.beats.map((b) => b.beatId)),
      minCards: constraints.minCards,
      maxCards: constraints.maxCards,
      llm: carouselInv.llm,
    });
    const carouselFp = buildInstagramCarouselContentFingerprint(carousel);

    const copyInv = await invokeJson({
      invoke: input.invoke,
      profile: INSTAGRAM_CARD_COPY_WRITER_HERMES_PROFILE,
      maxAttempts: cardCopyAttempts,
      useCardCopyStructuredPrompt: true,
      payload: buildInstagramCardCopyWriterPayload({
        narrative,
        carousel,
        canonicalAsset: {
          assetId: asset.assetId,
          titleKo: asset.titleKo,
          openingHookKo: clip(asset.openingHookKo, 400),
          bodyKo: clip(asset.bodyKo, 2400),
          keyTakeawaysKo: asset.keyTakeawaysKo,
          supportedClaimBoundaryKo: asset.supportedClaimBoundaryKo,
          forbiddenClaimsKo: asset.forbiddenClaimsKo,
        },
      }),
    });
    attemptCount += copyInv.attemptCount;
    const cardCopy = materializeInstagramCardCopy({
      assetId: asset.assetId,
      assetVersion: asset.version,
      sourceCarouselFingerprint: carouselFp,
      modelProfile: INSTAGRAM_CARD_COPY_WRITER_HERMES_PROFILE,
      generatedAt: nowIso,
      expectedCardIds: carousel.cards.map((c) => c.cardId),
      llm: copyInv.llm,
    });
    const cardCopyFp = buildInstagramCardCopyContentFingerprint(cardCopy);

    const captionInv = await invokeJson({
      invoke: input.invoke,
      profile: INSTAGRAM_CAPTION_WRITER_HERMES_PROFILE,
      maxAttempts: captionAttempts,
      payload: {
        task: "instagram_caption",
        editorialNarrativePlan: {
          narrativePromise: narrative.narrativePromise,
          audienceTakeaway: narrative.audienceTakeaway,
        },
        instagramCarouselPlan: carousel,
        instagramCardCopy: cardCopy,
        canonicalAsset: {
          assetId: asset.assetId,
          limitationsKo: asset.limitationsKo,
          supportedClaimBoundaryKo: asset.supportedClaimBoundaryKo,
          optionalCtaIntentKo: asset.optionalCtaIntentKo ?? null,
        },
        hashtagMax: constraints.hashtagMax,
      },
    });
    attemptCount += captionInv.attemptCount;
    const caption = materializeInstagramCaption({
      assetId: asset.assetId,
      assetVersion: asset.version,
      sourceCardCopyFingerprint: cardCopyFp,
      modelProfile: INSTAGRAM_CAPTION_WRITER_HERMES_PROFILE,
      generatedAt: nowIso,
      hashtagMax: constraints.hashtagMax,
      llm: captionInv.llm,
    });

    if (input.packageRoot) {
      persistInstagramEditorialArtifacts({
        packageRoot: input.packageRoot,
        narrative,
        carousel,
        cardCopy,
        caption,
        createdAt: nowIso,
      });
    }

    const content = assemblePublishableInstagramFromEditorial({
      composerInput: input.composerInput,
      narrative,
      carousel,
      cardCopy,
      caption,
      nowIso,
      modelProfile: input.modelProfile ?? "instagram-editorial-split",
      attemptCount,
      latencyMs: Date.now() - started,
    });

    return { content, narrative, carousel, cardCopy, caption };
  } catch (error) {
    const message =
      error instanceof InstagramEditorialMaterializeError
        ? `${error.code}:${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    return {
      content: failedContent({
        composerInput: input.composerInput,
        nowIso,
        attemptCount: Math.max(1, attemptCount),
        latencyMs: Date.now() - started,
        failureCategory: "schema_validation",
        failureMessage: message,
        modelProfile: input.modelProfile,
      }),
      narrative: null,
      carousel: null,
      cardCopy: null,
      caption: null,
    };
  }
}

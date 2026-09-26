/**
 * Naver Blog editorial pipeline: Narrative → Structure → Copy → publishable.
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
import { assemblePublishableNaverBlogFromEditorial } from "@/lib/marketing/publishable/naverBlogEditorial/assemblePublishable";
import {
  NAVER_BLOG_COPY_CONTRACT,
  NAVER_BLOG_COPY_WRITER_HERMES_PROFILE,
  NAVER_BLOG_SECTION_PURPOSES,
  NAVER_BLOG_STRUCTURE_PLAN_CONTRACT,
  NAVER_BLOG_STRUCTURE_PLANNER_HERMES_PROFILE,
  type NaverBlogCopy,
  type NaverBlogStructurePlan,
} from "@/lib/marketing/publishable/naverBlogEditorial/contracts";
import { buildNaverBlogStructureContentFingerprint } from "@/lib/marketing/publishable/naverBlogEditorial/fingerprint";
import {
  ensureNaverBlogEditorialHermesProfilesReady,
} from "@/lib/marketing/publishable/naverBlogEditorial/hermesIdentity";
import {
  NaverBlogEditorialMaterializeError,
  materializeNaverBlogCopy,
  materializeNaverBlogStructurePlan,
} from "@/lib/marketing/publishable/naverBlogEditorial/materialize";
import {
  persistNaverBlogCopy,
  persistNaverBlogStructurePlan,
  readNaverBlogCopyFromPackage,
  readNaverBlogStructurePlanFromPackage,
} from "@/lib/marketing/publishable/naverBlogEditorial/persist";
import {
  NAVER_BLOG_SECTION_PURPOSE_ENUM_LINE,
  NAVER_BLOG_STRUCTURE_PURPOSE_REPAIR_MAX,
  buildNaverBlogStructurePurposeRepairHint,
  listInvalidSectionPurposes,
  structureLlmHasInvalidPurposes,
} from "@/lib/marketing/publishable/naverBlogEditorial/purposeRepair";
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
    throw new NaverBlogEditorialMaterializeError("invalid_json", "No JSON object in LLM output");
  }
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new NaverBlogEditorialMaterializeError("invalid_json", "JSON parse failed");
  }
}

function promptParts(
  profile: string,
  userPayload: Record<string, unknown>,
): ChannelComposerPromptParts {
  const user = [
    "Return ONLY valid JSON matching the schema described in your SOUL.",
    "=== INPUT_JSON ===",
    JSON.stringify(userPayload),
  ].join("\n");
  return {
    channel: "naver_blog",
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
      const raw = await input.invoke(
        promptParts(input.profile, { ...input.payload, ...repair }),
      );
      return {
        llm: extractJsonObject(typeof raw === "string" ? raw : String(raw)),
        attemptCount: attempt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error("naver_blog_editorial_invoke_failed");
}

/**
 * Phase 3D: Blog Structure + Blog Copy artifact contract parity.
 */
export function assertNaverBlogEditorialArtifactContractParity(): void {
  assertArtifactDependsOn(NAVER_BLOG_STRUCTURE_PLAN_CONTRACT, EDITORIAL_NARRATIVE_PLAN_CONTRACT);
  assertFingerprintSourcesInclude(NAVER_BLOG_STRUCTURE_PLAN_CONTRACT, [
    "sourceNarrativeFingerprint",
  ]);
  requireOnGenerateFail(NAVER_BLOG_STRUCTURE_PLAN_CONTRACT, "fail_closed");
  requireMaterializeInRepairLoop(NAVER_BLOG_STRUCTURE_PLAN_CONTRACT, false);

  assertArtifactDependsOn(NAVER_BLOG_COPY_CONTRACT, NAVER_BLOG_STRUCTURE_PLAN_CONTRACT);
  assertFingerprintSourcesInclude(NAVER_BLOG_COPY_CONTRACT, ["sourceStructureFingerprint"]);
  requireOnGenerateFail(NAVER_BLOG_COPY_CONTRACT, "fail_closed");
  requireMaterializeInRepairLoop(NAVER_BLOG_COPY_CONTRACT, false);
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
  const validation = validatePublishableText("", { channel: "naver_blog" });
  const compositionMode =
    input.composerInput.compositionMode ??
    (input.composerInput.approvedCanonicalAsset ? "approved_asset_adapter" : "legacy_proposition_driven");
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "naver_blog",
    format: "naver_blog_article",
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
      modelProfile: input.modelProfile ?? "naver-blog-editorial-split",
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

export type RunNaverBlogEditorialResult = {
  content: PublishableChannelContent;
  structure: NaverBlogStructurePlan | null;
  copy: NaverBlogCopy | null;
  status: "generated" | "reused" | "failed";
};

export async function runNaverBlogEditorialPipeline(input: {
  composerInput: PublishableComposerInput;
  invoke: PublishableLlmInvoke;
  now?: Date;
  packageRoot?: string | null;
  hermesHome?: string;
  forceRegenerate?: boolean;
  modelProfile?: string | null;
}): Promise<RunNaverBlogEditorialResult> {
  const nowIso = (input.now ?? new Date()).toISOString();
  const started = Date.now();
  let attemptCount = 0;

  // Phase 3D: contract-driven lifecycle/failure metadata (behavior preserved).
  assertNaverBlogEditorialArtifactContractParity();
  const structureAttempts = getArtifactRepairAttemptBudget(NAVER_BLOG_STRUCTURE_PLAN_CONTRACT);
  const copyAttempts = getArtifactRepairAttemptBudget(NAVER_BLOG_COPY_CONTRACT);

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
      structure: null,
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
        failureMessage: "approved_canonical_required_for_naver_blog_editorial",
        modelProfile: input.modelProfile,
      }),
      structure: null,
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
        failureMessage: "editorial_narrative_plan_required_for_naver_blog_editorial",
        modelProfile: input.modelProfile,
      }),
      structure: null,
      copy: null,
      status: "failed",
    };
  }

  const narrativeFp = buildEditorialNarrativeContentFingerprint(narrative);
  const existingStructure =
    input.packageRoot && !input.forceRegenerate
      ? readNaverBlogStructurePlanFromPackage(input.packageRoot)
      : null;
  const existingCopy =
    input.packageRoot && !input.forceRegenerate
      ? readNaverBlogCopyFromPackage(input.packageRoot)
      : null;

  let structure: NaverBlogStructurePlan;
  let structureStatus: "reused" | "generated" = "generated";

  if (
    existingStructure &&
    existingStructure.sourceNarrativeFingerprint === narrativeFp &&
    existingStructure.assetId === asset.assetId &&
    existingStructure.assetVersion === asset.version
  ) {
    structure = existingStructure;
    structureStatus = "reused";
  } else {
    try {
      ensureNaverBlogEditorialHermesProfilesReady(input.hermesHome);
      const structurePayload: Record<string, unknown> = {
        task: "naver_blog_structure_plan",
        editorialAuthority: {
          factualBoundary: "approved_canonical",
          narrativeSequence: "editorial_narrative_plan",
          blogStructure: "naver_blog_structure_planner",
          wording: "naver_blog_copy_writer",
        },
        canonicalAsset: {
          assetId: asset.assetId,
          assetVersion: asset.version,
          titleKo: asset.titleKo,
          openingHookKo: clip(asset.openingHookKo, 600),
          bodyKo: clip(asset.bodyKo, 3200),
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
        searchIntentAdvisory: {
          note: "Advisory only — do not distort story for SEO",
          researchSearchIntent: input.composerInput.research?.searchIntentPrimary ?? null,
        },
        commercialIntent: input.composerInput.commercialIntent,
        sectionPurposeEnum: {
          allowed: [...NAVER_BLOG_SECTION_PURPOSES],
          note: `Each sectionPlan[].purpose MUST be exactly one of: ${NAVER_BLOG_SECTION_PURPOSE_ENUM_LINE}. Free-form labels forbidden.`,
        },
      };
      const inv = await invokeJson({
        invoke: input.invoke,
        profile: NAVER_BLOG_STRUCTURE_PLANNER_HERMES_PROFILE,
        maxAttempts: structureAttempts,
        payload: structurePayload,
      });
      attemptCount += inv.attemptCount;
      let structureLlm: unknown = inv.llm;

      // Purpose-only bounded repair BEFORE fail-closed materialize (no alias map).
      for (
        let purposeRepair = 0;
        purposeRepair < NAVER_BLOG_STRUCTURE_PURPOSE_REPAIR_MAX &&
        structureLlmHasInvalidPurposes(structureLlm);
        purposeRepair += 1
      ) {
        const invalid = listInvalidSectionPurposes(structureLlm);
        const repaired = await invokeJson({
          invoke: input.invoke,
          profile: NAVER_BLOG_STRUCTURE_PLANNER_HERMES_PROFILE,
          maxAttempts: 1,
          payload: {
            ...structurePayload,
            task: "naver_blog_structure_plan_purpose_repair",
            previousStructureOutput: structureLlm,
            PURPOSE_REPAIR: buildNaverBlogStructurePurposeRepairHint(invalid),
          },
        });
        attemptCount += repaired.attemptCount;
        structureLlm = repaired.llm;
      }

      // materializeInRepairLoop=false: materialize after JSON + purpose repair loops.
      structure = materializeNaverBlogStructurePlan({
        assetId: asset.assetId,
        assetVersion: asset.version,
        sourceNarrativeFingerprint: narrativeFp,
        narrative,
        modelProfile: NAVER_BLOG_STRUCTURE_PLANNER_HERMES_PROFILE,
        generatedAt: nowIso,
        llm: structureLlm,
      });
      if (input.packageRoot) {
        persistNaverBlogStructurePlan({
          packageRoot: input.packageRoot,
          plan: structure,
          createdAt: nowIso,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: failedContent({
          composerInput: input.composerInput,
          nowIso,
          attemptCount: Math.max(1, attemptCount),
          latencyMs: Date.now() - started,
          failureCategory:
            error instanceof NaverBlogEditorialMaterializeError
              ? error.code === "invalid_json"
                ? "invalid_json"
                : "schema_validation"
              : "unknown",
          failureMessage: message,
          modelProfile: input.modelProfile,
        }),
        structure: null,
        copy: null,
        status: "failed",
      };
    }
  }

  const structureFp = buildNaverBlogStructureContentFingerprint(structure);

  if (
    existingCopy &&
    existingCopy.sourceStructureFingerprint === structureFp &&
    structureStatus === "reused"
  ) {
    return {
      content: assemblePublishableNaverBlogFromEditorial({
        composerInput: input.composerInput,
        structure,
        copy: existingCopy,
        nowIso,
        attemptCount,
        latencyMs: Date.now() - started,
        modelProfile: existingCopy.provenance.modelProfile,
      }),
      structure,
      copy: existingCopy,
      status: "reused",
    };
  }

  try {
    ensureNaverBlogEditorialHermesProfilesReady(input.hermesHome);
    const inv = await invokeJson({
      invoke: input.invoke,
      profile: NAVER_BLOG_COPY_WRITER_HERMES_PROFILE,
      maxAttempts: copyAttempts,
      payload: {
        task: "naver_blog_copy",
        editorialAuthority: {
          factualBoundary: "approved_canonical",
          narrativeSequence: "editorial_narrative_plan",
          blogStructure: "naver_blog_structure_plan",
          wording: "naver_blog_copy_writer",
        },
        canonicalAsset: {
          assetId: asset.assetId,
          titleKo: asset.titleKo,
          bodyKo: clip(asset.bodyKo, 3200),
          keyTakeawaysKo: asset.keyTakeawaysKo,
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
        naverBlogStructurePlan: structure,
      },
    });
    attemptCount += inv.attemptCount;
    // materializeInRepairLoop=false: materialize after JSON repair loop.
    const copy = materializeNaverBlogCopy({
      assetId: asset.assetId,
      assetVersion: asset.version,
      sourceStructureFingerprint: structureFp,
      structure,
      modelProfile: NAVER_BLOG_COPY_WRITER_HERMES_PROFILE,
      generatedAt: nowIso,
      llm: inv.llm,
    });
    if (input.packageRoot) {
      persistNaverBlogCopy({
        packageRoot: input.packageRoot,
        copy,
        createdAt: nowIso,
      });
    }
    return {
      content: assemblePublishableNaverBlogFromEditorial({
        composerInput: input.composerInput,
        structure,
        copy,
        nowIso,
        attemptCount,
        latencyMs: Date.now() - started,
        modelProfile: NAVER_BLOG_COPY_WRITER_HERMES_PROFILE,
      }),
      structure,
      copy,
      status: "generated",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: failedContent({
        composerInput: input.composerInput,
        nowIso,
        attemptCount: Math.max(1, attemptCount),
        latencyMs: Date.now() - started,
        failureCategory:
          error instanceof NaverBlogEditorialMaterializeError
            ? error.code === "invalid_json"
              ? "invalid_json"
              : error.code === "forced_cta" || error.code === "unsafe_generalization"
                ? "publishability_validation"
                : "schema_validation"
            : "unknown",
        failureMessage: message,
        modelProfile: input.modelProfile,
      }),
      structure,
      copy: null,
      status: "failed",
    };
  }
}

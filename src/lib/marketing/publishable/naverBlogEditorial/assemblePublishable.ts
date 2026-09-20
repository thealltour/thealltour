/**
 * Assemble publishable.naver_blog from Structure + Copy artifacts.
 */

import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  type PublishableBlogMeta,
  type PublishableChannelContent,
} from "@/lib/marketing/publishable/contracts";
import {
  CHANNEL_INPUT_AUTHORITY_VERSION,
  buildPropositionProvenance,
} from "@/lib/marketing/publishable/composerRuntime";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import type {
  NaverBlogCopy,
  NaverBlogStructurePlan,
} from "@/lib/marketing/publishable/naverBlogEditorial/contracts";
import { NAVER_BLOG_COPY_WRITER_HERMES_PROFILE } from "@/lib/marketing/publishable/naverBlogEditorial/contracts";
import { validatePublishableText } from "@/lib/marketing/publishable/validate";

export function assembleBlogMetaFromEditorial(input: {
  structure: NaverBlogStructurePlan;
  copy: NaverBlogCopy;
}): PublishableBlogMeta {
  return {
    selectedTitle: input.copy.title || input.structure.selectedTitle,
    titleCandidates:
      input.structure.titleCandidates.length >= 3
        ? input.structure.titleCandidates
        : [
            input.copy.title,
            ...input.structure.titleCandidates.filter((t) => t !== input.copy.title),
          ].slice(0, 5),
    primaryTopic: input.structure.primaryTopic,
    searchIntent: input.structure.searchIntent,
    sectionPlan: input.structure.sectionPlan.map((s) => s.heading),
    faq: input.copy.faq,
    cta: input.copy.cta,
  };
}

export function assemblePublishableNaverBlogFromEditorial(input: {
  composerInput: PublishableComposerInput;
  structure: NaverBlogStructurePlan;
  copy: NaverBlogCopy;
  nowIso: string;
  attemptCount: number;
  latencyMs: number;
  modelProfile?: string | null;
}): PublishableChannelContent {
  const blogMeta = assembleBlogMetaFromEditorial({
    structure: input.structure,
    copy: input.copy,
  });
  const validation = validatePublishableText(input.copy.bodyMarkdown, {
    channel: "naver_blog",
    title: input.copy.title,
    primaryTopic: blogMeta.primaryTopic,
    allowHeadings: true,
  });
  const compositionMode =
    input.composerInput.compositionMode ??
    (input.composerInput.approvedCanonicalAsset ? "approved_asset_adapter" : "legacy_proposition_driven");
  const publishableSuccess = validation.ok;

  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "naver_blog",
    format: "naver_blog_article",
    title: input.copy.title,
    body: input.copy.bodyMarkdown,
    status: publishableSuccess ? "generated" : "validation_failed",
    generatedAt: input.nowIso,
    sourceCandidateId: input.composerInput.candidateId,
    sourceRevision: input.composerInput.sourceRevision,
    selectedAngleRef: input.composerInput.research?.selectedAngleId ?? null,
    researchBriefRef: input.composerInput.research?.researchBriefId ?? null,
    provenance: {
      composer: "llm",
      evidenceRefIds: [
        ...new Set([
          ...input.composerInput.evidenceRefIds,
          ...input.copy.evidenceRefs,
        ]),
      ].slice(0, 24),
      commercialIntent: input.composerInput.commercialIntent,
      generationMode: "llm",
      modelProfile: input.modelProfile ?? NAVER_BLOG_COPY_WRITER_HERMES_PROFILE,
      attemptCount: input.attemptCount,
      latencyMs: input.latencyMs,
      failureCategory: publishableSuccess ? null : "publishability_validation",
      failureMessage: publishableSuccess
        ? null
        : validation.issues.map((i) => i.code).join(",") || "validation_failed",
      propositionStrength: input.composerInput.contentProposition?.propositionStrength ?? null,
      proposition: buildPropositionProvenance(input.composerInput),
      compositionMode,
      inputAuthorityVersion: input.composerInput.approvedCanonicalAsset
        ? CHANNEL_INPUT_AUTHORITY_VERSION
        : null,
    },
    validation,
    publishableSuccess,
    needsRegeneration: !publishableSuccess,
    blogMeta,
  };
}

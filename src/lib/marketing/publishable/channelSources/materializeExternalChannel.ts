/**
 * Deterministic External Editorial → sidecar + publishable slot materializers.
 * Reuses the Hermes specialist materializers/validators; never invokes an LLM.
 * External results are accepted unconditionally: copy-policy / publishable-validation failures and
 * count caps become warnings (validation stays on the slot for the channel review). Only a shape
 * the sidecars cannot represent (missing fields, unknown beats, card mismatches) is rejected.
 */

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { EXTERNAL_EDITORIAL_MODEL_PROFILE } from "@/lib/marketing/publishable/channelSources/contracts";
import { materializeExternalNarrativePlan } from "@/lib/marketing/publishable/channelSources/externalNarrative";
import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  formatForChannel,
  type PublishableChannel,
  type PublishableChannelContent,
  type PublishableNarrationSegment,
  type PublishableValidationResult,
} from "@/lib/marketing/publishable/contracts";
import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import { mergeInstagramHashtagsIntoBody } from "@/lib/marketing/publishable/instagram/hashtagMerge";
import { assembleInstagramMetaFromEditorial } from "@/lib/marketing/publishable/instagramEditorial/assemblePublishable";
import { DEFAULT_INSTAGRAM_CHANNEL_CONSTRAINTS } from "@/lib/marketing/publishable/instagramEditorial/channelConstraints";
import {
  buildInstagramCardCopyContentFingerprint,
  buildInstagramCarouselContentFingerprint,
} from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import {
  materializeInstagramCaption,
  materializeInstagramCardCopy,
  materializeInstagramCarouselPlan,
} from "@/lib/marketing/publishable/instagramEditorial/materialize";
import {
  INSTAGRAM_CAPTION_RELATIVE_PATH,
  INSTAGRAM_CARD_COPY_RELATIVE_PATH,
  INSTAGRAM_CAROUSEL_PLAN_RELATIVE_PATH,
} from "@/lib/marketing/publishable/instagramEditorial/paths";
import { materializeNaverBandCopy } from "@/lib/marketing/publishable/naverBandCopy/materialize";
import { NAVER_BAND_COPY_RELATIVE_PATH } from "@/lib/marketing/publishable/naverBandCopy/paths";
import { assembleBlogMetaFromEditorial } from "@/lib/marketing/publishable/naverBlogEditorial/assemblePublishable";
import { buildNaverBlogStructureContentFingerprint } from "@/lib/marketing/publishable/naverBlogEditorial/fingerprint";
import {
  materializeNaverBlogCopy,
  materializeNaverBlogStructurePlan,
} from "@/lib/marketing/publishable/naverBlogEditorial/materialize";
import {
  NAVER_BLOG_COPY_RELATIVE_PATH,
  NAVER_BLOG_STRUCTURE_PLAN_RELATIVE_PATH,
} from "@/lib/marketing/publishable/naverBlogEditorial/paths";
import { materializeThreadsCopy } from "@/lib/marketing/publishable/threadsCopy/materialize";
import { THREADS_COPY_RELATIVE_PATH } from "@/lib/marketing/publishable/threadsCopy/paths";
import {
  INSTAGRAM_HASHTAG_MAX,
  extractInstagramHashtags,
  stripEvidenceIdsFromText,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";

/** Hermes clamps (keyPoints / titleCandidates / segments) — external input beyond these is rejected. */
export const EXTERNAL_NAVER_BAND_KEY_POINTS_MAX = 4;
export const EXTERNAL_NAVER_BLOG_TITLE_CANDIDATES_MAX = 5;
export const EXTERNAL_SHORTFORM_SEGMENTS_MAX = 8;
const SHORTFORM_NARRATION_MAX_CHARS = 2000;
const SHORTFORM_PURPOSE_MAX_CHARS = 64;
const SHORTFORM_VISUAL_INTENT_MAX_CHARS = 400;

export const EXTERNAL_RESULT_KEY_BY_CHANNEL: Record<PublishableChannel, string> = {
  threads: "threads",
  instagram: "instagram",
  naver_blog: "naverBlog",
  naver_band: "naverBand",
  kakao_channel: "kakao",
  shortform: "shortform",
};

export class ExternalChannelMaterializeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ExternalChannelMaterializeError";
    this.code = code;
  }
}

export type ExternalMaterializeContext = {
  candidateId: string;
  asset: CanonicalMarketingAsset;
  result: Record<string, unknown>;
  externalNarrativeFingerprint: string;
  externalCandidateRef: string;
  canonicalEvidenceIds: readonly string[];
  bundleSourceRevision: string;
  priorSlot: PublishableChannelContent | null | undefined;
  nowIso: string;
  narrativeGeneratedAt: string;
};

export type ExternalChannelMaterialization = {
  slot: PublishableChannelContent;
  /** Package-relative sidecar path → artifact JSON to write. */
  sidecars: Record<string, unknown>;
  warnings: string[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
}

export function externalChannelArtifact(
  result: Record<string, unknown>,
  channel: PublishableChannel,
): unknown {
  const value = result[EXTERNAL_RESULT_KEY_BY_CHANNEL[channel]];
  return value === undefined ? null : value;
}

function guard<T>(label: string, fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof ExternalChannelMaterializeError) throw error;
    const code =
      error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : "materialize_failed";
    const message = error instanceof Error ? error.message : String(error);
    throw new ExternalChannelMaterializeError(code, `${label}: ${message}`);
  }
}

function noteValidation(label: string, validation: PublishableValidationResult, warnings: string[]): void {
  if (!validation.ok) {
    warnings.push(
      `${label} 검증 경고: ${validation.issues.map((i) => `${i.code}(${i.message})`).join(", ")}`,
    );
  }
}

function policyCollector(label: string, warnings: string[]) {
  return (code: string, message: string) => {
    warnings.push(`${label} 정책 경고: ${code}(${message})`);
  };
}

function requireNarrative(ctx: ExternalMaterializeContext): EditorialNarrativePlan {
  if (ctx.result.narrative === null || ctx.result.narrative === undefined) {
    throw new ExternalChannelMaterializeError("narrative_required", "narrative가 없어 이 채널을 materialize할 수 없습니다.");
  }
  return guard("narrative", () =>
    materializeExternalNarrativePlan({
      narrative: ctx.result.narrative,
      asset: ctx.asset,
      externalNarrativeFingerprint: ctx.externalNarrativeFingerprint,
      generatedAt: ctx.narrativeGeneratedAt,
    }),
  );
}

function canonicalRefsOnly(ctx: ExternalMaterializeContext, refs: string[]): string[] {
  const canonical = new Set(ctx.canonicalEvidenceIds);
  return [...new Set(refs.filter((r) => canonical.has(r)))];
}

function buildSlot(
  ctx: ExternalMaterializeContext,
  channel: PublishableChannel,
  fields: {
    title: string | null;
    body: string;
    validation: PublishableValidationResult;
    evidenceRefs: string[];
  },
): PublishableChannelContent {
  const prior = ctx.priorSlot ?? null;
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel,
    format: formatForChannel(channel),
    title: fields.title,
    body: fields.body,
    status: "generated",
    generatedAt: ctx.nowIso,
    sourceCandidateId: ctx.candidateId,
    sourceRevision: ctx.bundleSourceRevision,
    selectedAngleRef: prior?.selectedAngleRef ?? null,
    researchBriefRef: prior?.researchBriefRef ?? null,
    provenance: {
      composer: "llm",
      evidenceRefIds: canonicalRefsOnly(ctx, fields.evidenceRefs),
      commercialIntent: prior?.provenance.commercialIntent ?? null,
      generationMode: "llm",
      modelProfile: EXTERNAL_EDITORIAL_MODEL_PROFILE,
      attemptCount: 1,
      latencyMs: null,
      failureCategory: null,
      failureMessage: null,
      generationSource: "external_editorial",
      externalCandidateRef: ctx.externalCandidateRef,
    },
    validation: fields.validation,
    publishableSuccess: true,
    needsRegeneration: false,
    marketingValue: null,
    sourceAssetId: ctx.asset.assetId,
    sourceAssetVersion: ctx.asset.approvedVersion ?? ctx.asset.version,
    stale: false,
  };
}

function materializeThreads(ctx: ExternalMaterializeContext, raw: unknown): ExternalChannelMaterialization {
  const warnings: string[] = [];
  const narrative = requireNarrative(ctx);
  const copy = guard("threads", () =>
    materializeThreadsCopy({
      assetId: ctx.asset.assetId,
      assetVersion: ctx.asset.version,
      sourceNarrativeFingerprint: ctx.externalNarrativeFingerprint,
      narrative,
      modelProfile: EXTERNAL_EDITORIAL_MODEL_PROFILE,
      generatedAt: ctx.nowIso,
      llm: raw,
      onPolicyViolation: policyCollector("threads", warnings),
    }),
  );
  const validation = validatePublishableText(copy.body, { channel: "threads" });
  noteValidation("threads", validation, warnings);
  const slot = buildSlot(ctx, "threads", {
    title: null,
    body: copy.body,
    validation,
    evidenceRefs: copy.evidenceRefs,
  });
  slot.mediaPlan = null;
  return { slot, sidecars: { [THREADS_COPY_RELATIVE_PATH]: copy }, warnings };
}

function materializeInstagram(ctx: ExternalMaterializeContext, raw: unknown): ExternalChannelMaterialization {
  const root = asRecord(raw);
  if (!root) throw new ExternalChannelMaterializeError("invalid_artifact", "instagram 객체가 아닙니다.");
  for (const key of ["carouselPlan", "cardCopy", "caption"] as const) {
    if (!asRecord(root[key])) {
      throw new ExternalChannelMaterializeError("missing_artifact", `instagram.${key}가 없습니다.`);
    }
  }
  const warnings: string[] = [];
  const narrative = requireNarrative(ctx);
  const constraints = DEFAULT_INSTAGRAM_CHANNEL_CONSTRAINTS;

  let captionRaw = asRecord(root.caption)!;
  const declared = Array.isArray(captionRaw.hashtags) ? captionRaw.hashtags : [];
  if (declared.length > constraints.hashtagMax) {
    warnings.push(
      `instagram.caption.hashtags ${declared.length}개 — 최대 ${constraints.hashtagMax}개까지만 적용했습니다.`,
    );
    captionRaw = { ...captionRaw, hashtags: declared.slice(0, constraints.hashtagMax) };
  }

  const carousel = guard("instagram.carouselPlan", () =>
    materializeInstagramCarouselPlan({
      assetId: ctx.asset.assetId,
      assetVersion: ctx.asset.version,
      sourceNarrativeFingerprint: ctx.externalNarrativeFingerprint,
      modelProfile: EXTERNAL_EDITORIAL_MODEL_PROFILE,
      generatedAt: ctx.nowIso,
      validBeatIds: new Set(narrative.beats.map((b) => b.beatId)),
      minCards: constraints.minCards,
      maxCards: constraints.maxCards,
      llm: root.carouselPlan,
    }),
  );
  const cardCopy = guard("instagram.cardCopy", () =>
    materializeInstagramCardCopy({
      assetId: ctx.asset.assetId,
      assetVersion: ctx.asset.version,
      sourceCarouselFingerprint: buildInstagramCarouselContentFingerprint(carousel),
      modelProfile: EXTERNAL_EDITORIAL_MODEL_PROFILE,
      generatedAt: ctx.nowIso,
      expectedCardIds: carousel.cards.map((c) => c.cardId),
      llm: root.cardCopy,
    }),
  );
  const caption = guard("instagram.caption", () =>
    materializeInstagramCaption({
      assetId: ctx.asset.assetId,
      assetVersion: ctx.asset.version,
      sourceCardCopyFingerprint: buildInstagramCardCopyContentFingerprint(cardCopy),
      modelProfile: EXTERNAL_EDITORIAL_MODEL_PROFILE,
      generatedAt: ctx.nowIso,
      hashtagMax: constraints.hashtagMax,
      llm: captionRaw,
    }),
  );

  const opening = stripEvidenceIdsFromText(caption.opening);
  const bodyCore = stripEvidenceIdsFromText(caption.body);
  const cta = caption.cta?.trim() ? stripEvidenceIdsFromText(caption.cta) : null;
  const captionText = [opening, bodyCore, cta].filter(Boolean).join("\n\n");
  const uniqueTags = new Set(
    [...extractInstagramHashtags(captionText), ...caption.hashtags].map((t) => t.toLowerCase()),
  );
  if (uniqueTags.size > INSTAGRAM_HASHTAG_MAX) {
    warnings.push(`본문+hashtags 고유 해시태그 ${uniqueTags.size}개 — 최대 ${INSTAGRAM_HASHTAG_MAX}개를 넘습니다.`);
  }
  const merged = mergeInstagramHashtagsIntoBody(captionText, caption.hashtags);
  const validation = validatePublishableText(merged.body, { channel: "instagram" });
  noteValidation("instagram", validation, warnings);

  const slot = buildSlot(ctx, "instagram", {
    title: null,
    body: merged.body,
    validation,
    evidenceRefs: cardCopy.cards.flatMap((c) => c.evidenceRefs ?? []),
  });
  slot.instagramMeta = assembleInstagramMetaFromEditorial({ caption, carousel, cardCopy });
  return {
    slot,
    sidecars: {
      [INSTAGRAM_CAROUSEL_PLAN_RELATIVE_PATH]: carousel,
      [INSTAGRAM_CARD_COPY_RELATIVE_PATH]: cardCopy,
      [INSTAGRAM_CAPTION_RELATIVE_PATH]: caption,
    },
    warnings,
  };
}

function materializeNaverBlog(ctx: ExternalMaterializeContext, raw: unknown): ExternalChannelMaterialization {
  const root = asRecord(raw);
  if (!root) throw new ExternalChannelMaterializeError("invalid_artifact", "naverBlog 객체가 아닙니다.");
  const structureRaw = asRecord(root.structure);
  const copyRaw = asRecord(root.copy);
  if (!structureRaw) throw new ExternalChannelMaterializeError("missing_artifact", "naverBlog.structure가 없습니다.");
  if (!copyRaw) throw new ExternalChannelMaterializeError("missing_artifact", "naverBlog.copy가 없습니다.");

  const warnings: string[] = [];
  const titleCandidates = stringList(structureRaw.titleCandidates);
  if (titleCandidates.length > EXTERNAL_NAVER_BLOG_TITLE_CANDIDATES_MAX) {
    warnings.push(
      `naverBlog.structure.titleCandidates ${titleCandidates.length}개 — 앞의 ${EXTERNAL_NAVER_BLOG_TITLE_CANDIDATES_MAX}개만 적용했습니다.`,
    );
  }
  const unsupportedFaq = (Array.isArray(structureRaw.faqPlan) ? structureRaw.faqPlan : []).filter(
    (item) => asRecord(item)?.answerability === "unsupported",
  ).length;
  if (unsupportedFaq > 0) {
    warnings.push(
      `naverBlog.structure.faqPlan의 unsupported 질문 ${unsupportedFaq}개는 sidecar에서 제외됩니다 (candidate에는 원본 보존).`,
    );
  }

  const narrative = requireNarrative(ctx);
  const structure = guard("naverBlog.structure", () =>
    materializeNaverBlogStructurePlan({
      assetId: ctx.asset.assetId,
      assetVersion: ctx.asset.version,
      sourceNarrativeFingerprint: ctx.externalNarrativeFingerprint,
      narrative,
      modelProfile: EXTERNAL_EDITORIAL_MODEL_PROFILE,
      generatedAt: ctx.nowIso,
      llm: structureRaw,
      onPolicyViolation: policyCollector("naverBlog.structure", warnings),
    }),
  );
  const copy = guard("naverBlog.copy", () =>
    materializeNaverBlogCopy({
      assetId: ctx.asset.assetId,
      assetVersion: ctx.asset.version,
      sourceStructureFingerprint: buildNaverBlogStructureContentFingerprint(structure),
      structure,
      modelProfile: EXTERNAL_EDITORIAL_MODEL_PROFILE,
      generatedAt: ctx.nowIso,
      llm: copyRaw,
      onPolicyViolation: policyCollector("naverBlog.copy", warnings),
    }),
  );
  const blogMeta = assembleBlogMetaFromEditorial({ structure, copy });
  const validation = validatePublishableText(copy.bodyMarkdown, {
    channel: "naver_blog",
    title: copy.title,
    primaryTopic: blogMeta.primaryTopic,
    allowHeadings: true,
  });
  noteValidation("naverBlog", validation, warnings);

  const slot = buildSlot(ctx, "naver_blog", {
    title: copy.title,
    body: copy.bodyMarkdown,
    validation,
    evidenceRefs: [...structure.sectionPlan.flatMap((s) => s.evidenceRefs), ...copy.evidenceRefs],
  });
  slot.blogMeta = blogMeta;
  return {
    slot,
    sidecars: {
      [NAVER_BLOG_STRUCTURE_PLAN_RELATIVE_PATH]: structure,
      [NAVER_BLOG_COPY_RELATIVE_PATH]: copy,
    },
    warnings,
  };
}

function materializeNaverBand(ctx: ExternalMaterializeContext, raw: unknown): ExternalChannelMaterialization {
  const root = asRecord(raw);
  if (!root) throw new ExternalChannelMaterializeError("invalid_artifact", "naverBand 객체가 아닙니다.");
  const warnings: string[] = [];
  const keyPoints = stringList(root.keyPoints);
  if (keyPoints.length > EXTERNAL_NAVER_BAND_KEY_POINTS_MAX) {
    warnings.push(
      `naverBand.keyPoints ${keyPoints.length}개 — 앞의 ${EXTERNAL_NAVER_BAND_KEY_POINTS_MAX}개만 적용했습니다.`,
    );
  }
  const narrative = requireNarrative(ctx);
  const copy = guard("naverBand", () =>
    materializeNaverBandCopy({
      assetId: ctx.asset.assetId,
      assetVersion: ctx.asset.version,
      sourceNarrativeFingerprint: ctx.externalNarrativeFingerprint,
      narrative,
      canonicalBodyKo: ctx.asset.bodyKo,
      modelProfile: EXTERNAL_EDITORIAL_MODEL_PROFILE,
      generatedAt: ctx.nowIso,
      llm: root,
      onPolicyViolation: policyCollector("naverBand", warnings),
    }),
  );
  const validation = validatePublishableText(copy.body, { channel: "naver_band" });
  noteValidation("naverBand", validation, warnings);
  const slot = buildSlot(ctx, "naver_band", {
    title: copy.title,
    body: copy.body,
    validation,
    evidenceRefs: copy.evidenceRefs,
  });
  return { slot, sidecars: { [NAVER_BAND_COPY_RELATIVE_PATH]: copy }, warnings };
}

function materializeKakao(ctx: ExternalMaterializeContext, raw: unknown): ExternalChannelMaterialization {
  const root = asRecord(raw);
  if (!root) throw new ExternalChannelMaterializeError("invalid_artifact", "kakao 객체가 아닙니다.");
  if (typeof root.body !== "string" || !root.body.trim()) {
    throw new ExternalChannelMaterializeError("missing_field", "kakao.body가 없습니다.");
  }
  if (root.title !== null && root.title !== undefined && typeof root.title !== "string") {
    throw new ExternalChannelMaterializeError("invalid_field", "kakao.title은 string 또는 null이어야 합니다.");
  }
  const body = stripEvidenceIdsFromText(root.body);
  const title =
    typeof root.title === "string" && root.title.trim() ? stripEvidenceIdsFromText(root.title) : null;
  const warnings: string[] = [];
  const validation = validatePublishableText(body, { channel: "kakao_channel" });
  noteValidation("kakao", validation, warnings);
  return {
    slot: buildSlot(ctx, "kakao_channel", { title, body, validation, evidenceRefs: [] }),
    sidecars: {},
    warnings,
  };
}

function materializeShortform(ctx: ExternalMaterializeContext, raw: unknown): ExternalChannelMaterialization {
  const root = asRecord(raw);
  if (!root) throw new ExternalChannelMaterializeError("invalid_artifact", "shortform 객체가 아닙니다.");
  if (typeof root.body !== "string" || !root.body.trim()) {
    throw new ExternalChannelMaterializeError("missing_field", "shortform.body가 없습니다.");
  }
  if (!Array.isArray(root.segments) || root.segments.length < 1) {
    throw new ExternalChannelMaterializeError("segments_required", "shortform.segments가 1개 이상 필요합니다.");
  }
  const warnings: string[] = [];
  if (root.segments.length > EXTERNAL_SHORTFORM_SEGMENTS_MAX) {
    warnings.push(
      `shortform.segments ${root.segments.length}개 — 앞의 ${EXTERNAL_SHORTFORM_SEGMENTS_MAX}개만 적용했습니다.`,
    );
  }
  const clip = (value: string, max: number, at: string) => {
    if (value.length <= max) return value;
    warnings.push(`${at}: ${max}자를 넘어 잘랐습니다.`);
    return value.slice(0, max);
  };
  const segments: PublishableNarrationSegment[] = root.segments.slice(0, EXTERNAL_SHORTFORM_SEGMENTS_MAX).map((item, index) => {
    const row = asRecord(item);
    const at = `shortform.segments[${index}]`;
    if (!row) throw new ExternalChannelMaterializeError("invalid_segment", `${at} 객체가 아닙니다.`);
    const narrationText =
      typeof row.narrationText === "string" ? stripEvidenceIdsFromText(row.narrationText) : "";
    const purpose = typeof row.purpose === "string" ? row.purpose.trim() : "";
    const visualIntent =
      typeof row.visualIntent === "string" ? stripEvidenceIdsFromText(row.visualIntent) : "";
    if (!narrationText || !purpose || !visualIntent) {
      throw new ExternalChannelMaterializeError(
        "invalid_segment",
        `${at}: narrationText/purpose/visualIntent가 모두 필요합니다.`,
      );
    }
    const narration = clip(narrationText, SHORTFORM_NARRATION_MAX_CHARS, `${at}.narrationText`);
    return {
      segmentId: `narr-${String(index + 1).padStart(2, "0")}`,
      narrationText: narration,
      subtitleText: narration,
      purpose: clip(purpose, SHORTFORM_PURPOSE_MAX_CHARS, `${at}.purpose`),
      visualIntent: clip(visualIntent, SHORTFORM_VISUAL_INTENT_MAX_CHARS, `${at}.visualIntent`),
      evidenceRefs: [],
    };
  });
  const body = stripEvidenceIdsFromText(root.body);
  const validation = validatePublishableText(body);
  noteValidation("shortform", validation, warnings);
  const slot = buildSlot(ctx, "shortform", { title: null, body, validation, evidenceRefs: [] });
  slot.narrationSegments = segments;
  return { slot, sidecars: {}, warnings };
}

export function materializeExternalChannel(
  ctx: ExternalMaterializeContext,
  channel: PublishableChannel,
): ExternalChannelMaterialization {
  const raw = externalChannelArtifact(ctx.result, channel);
  if (raw === null) {
    throw new ExternalChannelMaterializeError("artifact_missing", `외부 결과에 ${channel} 결과가 없습니다.`);
  }
  switch (channel) {
    case "threads":
      return materializeThreads(ctx, raw);
    case "instagram":
      return materializeInstagram(ctx, raw);
    case "naver_blog":
      return materializeNaverBlog(ctx, raw);
    case "naver_band":
      return materializeNaverBand(ctx, raw);
    case "kakao_channel":
      return materializeKakao(ctx, raw);
    case "shortform":
      return materializeShortform(ctx, raw);
  }
}

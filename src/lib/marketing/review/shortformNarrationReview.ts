/**
 * Shortform narration segment review — package side.
 * media-brief `formats.shortform.narrationSegments` is what the Mini-PC render reads, so edits go
 * there (plus manifest sha so transport integrity holds). The publishable bundle slot is marked
 * `human_edited` so draft rebuilds / "다시 검색" keep the edited segments.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { MediaBrief, ShortformNarrationSegment } from "@/lib/marketing/assets/contracts";
import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { upsertPackageManifestArtifact } from "@/lib/marketing/assets/manifestUpsert";
import { parseMediaBrief } from "@/lib/marketing/assets/parse";
import type {
  ShortformRenderReadyEvaluation,
  ShortformRenderUiStatus,
} from "@/lib/marketing/assets/shortform/renderReady";
import type { ShortformVideoRenderJob } from "@/lib/marketing/assets/shortform/renderJob/contracts";
import { buildShortformNarrationFingerprint } from "@/lib/marketing/assets/shortform/renderJob/logicalRunKey";
import { SHORT_VIDEO_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/shortVideoBrief/paths";
import { MEDIA_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/video/paths";
import { overwritePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import {
  readPackageJson,
  readPublishableBundle,
  writePublishableBundle,
} from "@/lib/marketing/publishable/channelSources/packageIo";
import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  formatForChannel,
  type PublishableChannelContent,
  type PublishableNarrationSegment,
} from "@/lib/marketing/publishable/contracts";
import { validatePublishableText } from "@/lib/marketing/publishable/validate";
import { humanEditedRelativePath } from "@/lib/marketing/review/channelReviews";
import type { MarketingValueAssessment } from "@/lib/marketing/value/contracts";
import { evaluateMarketingValue } from "@/lib/marketing/value/evaluateMarketingValue";
import {
  buildMarketingValueBundle,
  persistMarketingValueBundle,
  tryReadMarketingValueBundle,
} from "@/lib/marketing/value/persist";

export const SHORTFORM_NARRATION_MAX_LENGTH = 2000;
export const SHORTFORM_NARRATION_MAX_SEGMENTS = 16;

export type ShortformNarrationEditErrorCode =
  | "not_applicable"
  | "bundle_missing"
  | "segments_mismatch"
  | "text_required"
  | "text_too_long"
  | "text_invalid";

export class ShortformNarrationEditError extends Error {
  constructor(
    readonly code: ShortformNarrationEditErrorCode,
    readonly messageKo: string,
  ) {
    super(`shortform_narration_${code}`);
    this.name = "ShortformNarrationEditError";
  }
}

export type ShortformNarrationSegmentView = {
  segmentId: string;
  sceneId: string | null;
  purpose: string;
  aiText: string;
  text: string;
  edited: boolean;
};

export type ShortformNarrationPackageView = {
  applicable: boolean;
  segments: ShortformNarrationSegmentView[];
  humanEdited: boolean;
  maxLength: number;
};

export type ShortformNarrationRenderSummary = {
  uiStatus: ShortformRenderUiStatus;
  reason: string;
  requiredSceneCount: number;
  pickedSceneCount: number;
  jobStatus: ShortformVideoRenderJob["status"] | null;
  /** A job rendered from an earlier narration exists but none for the current text. */
  narrationStale: boolean;
};

export type ShortformNarrationView = ShortformNarrationPackageView & {
  candidateId: string;
  editable: boolean;
  blockedReason: string | null;
  render: ShortformNarrationRenderSummary | null;
};

export type ShortformNarrationSaveResult = ShortformNarrationView & {
  changed: boolean;
  rerender: { enqueued: boolean; created: boolean; skippedReason: string | null };
};

export function summarizeShortformRender(
  evaluation: ShortformRenderReadyEvaluation,
  job: ShortformVideoRenderJob | null = evaluation.job,
): ShortformNarrationRenderSummary {
  return {
    uiStatus: job ? (job.status.toLowerCase() as ShortformRenderUiStatus) : evaluation.uiStatus,
    reason: evaluation.reason,
    requiredSceneCount: evaluation.requiredSceneCount,
    pickedSceneCount: evaluation.pickedSceneCount,
    jobStatus: job?.status ?? null,
    narrationStale: !job && Boolean(evaluation.staleJob),
  };
}

type ShortVideoBriefSceneRefs = { scenes?: Array<{ sceneId?: unknown; narrationSegmentRefs?: unknown }> };

function readMediaBrief(packageRoot: string): MediaBrief | null {
  const raw = readPackageJson(packageRoot, MEDIA_BRIEF_RELATIVE_PATH);
  if (!raw) return null;
  try {
    return parseMediaBrief(raw);
  } catch {
    return null;
  }
}

function sceneIdsBySegment(packageRoot: string): Map<string, string> {
  const raw = readPackageJson<ShortVideoBriefSceneRefs>(packageRoot, SHORT_VIDEO_BRIEF_RELATIVE_PATH);
  const map = new Map<string, string>();
  for (const scene of raw?.scenes ?? []) {
    if (typeof scene?.sceneId !== "string" || !Array.isArray(scene.narrationSegmentRefs)) continue;
    for (const ref of scene.narrationSegmentRefs) {
      if (typeof ref === "string" && !map.has(ref)) map.set(ref, scene.sceneId);
    }
  }
  return map;
}

function narrationSegments(mediaBrief: MediaBrief | null): ShortformNarrationSegment[] {
  return mediaBrief?.formats.shortform.narrationSegments ?? [];
}

export function buildShortformNarrationPackageView(packageRoot: string): ShortformNarrationPackageView {
  const segments = narrationSegments(readMediaBrief(packageRoot));
  const slot = readPublishableBundle(packageRoot)?.shortform ?? null;
  const aiById = new Map((slot?.aiNarrationSegments ?? []).map((s) => [s.segmentId, s.narrationText]));
  const scenes = sceneIdsBySegment(packageRoot);
  return {
    applicable: segments.length > 0,
    humanEdited: slot?.status === "human_edited",
    maxLength: SHORTFORM_NARRATION_MAX_LENGTH,
    segments: segments.map((segment) => {
      const aiText = aiById.get(segment.segmentId) ?? segment.narrationText;
      return {
        segmentId: segment.segmentId,
        sceneId: scenes.get(segment.segmentId) ?? null,
        purpose: segment.purpose,
        aiText,
        text: segment.narrationText,
        edited: segment.narrationText !== aiText,
      };
    }),
  };
}

/** Fingerprint of what the render would speak right now; null when the package has no narration. */
export function currentShortformNarrationSha256(packageRoot: string): string | null {
  const segments = narrationSegments(readMediaBrief(packageRoot));
  return segments.length > 0 ? buildShortformNarrationFingerprint(segments) : null;
}

const FORBIDDEN_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

function normalizeSegmentText(segmentId: string, raw: string): string {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!text) {
    throw new ShortformNarrationEditError("text_required", `${segmentId} 내레이션이 비어 있습니다.`);
  }
  if (text.length > SHORTFORM_NARRATION_MAX_LENGTH) {
    throw new ShortformNarrationEditError(
      "text_too_long",
      `${segmentId} 내레이션은 ${SHORTFORM_NARRATION_MAX_LENGTH}자 이하여야 합니다.`,
    );
  }
  if (FORBIDDEN_CONTROL.test(text)) {
    throw new ShortformNarrationEditError("text_invalid", `${segmentId} 내레이션에 허용되지 않는 제어 문자가 있습니다.`);
  }
  return text;
}

function toPublishableSegment(segment: ShortformNarrationSegment): PublishableNarrationSegment {
  return {
    segmentId: segment.segmentId,
    narrationText: segment.narrationText,
    subtitleText: segment.subtitleText,
    purpose: segment.purpose,
    visualIntent: segment.visualIntent,
    evidenceRefs: [...segment.evidenceRefs],
  };
}

export type ShortformNarrationEditResult = {
  body: string;
  narrationSha256: string;
  changed: boolean;
  marketingValue: MarketingValueAssessment | null;
};

/**
 * Text-only edit: the segment set (ids, order, count) is fixed; subtitle mirrors narration.
 * Writes publishable bundle → marketing value → media-brief (+manifest) → human-edited export.
 */
export function applyShortformNarrationEdit(input: {
  packageRoot: string;
  candidate: CompletedMarketingCandidate;
  segments: ReadonlyArray<{ segmentId: string; text: string }>;
  now: Date;
}): ShortformNarrationEditResult {
  const { packageRoot } = input;
  const mediaBrief = readMediaBrief(packageRoot);
  const current = narrationSegments(mediaBrief);
  if (!mediaBrief || current.length === 0) {
    throw new ShortformNarrationEditError("not_applicable", "편집할 숏폼 내레이션이 없습니다.");
  }
  const bundle = readPublishableBundle(packageRoot);
  if (!bundle) {
    throw new ShortformNarrationEditError("bundle_missing", "게시용 콘텐츠 번들이 없어 내레이션을 저장할 수 없습니다.");
  }

  const edits = new Map<string, string>();
  for (const edit of input.segments) {
    if (edits.has(edit.segmentId)) {
      throw new ShortformNarrationEditError("segments_mismatch", "같은 세그먼트가 중복되었습니다. 새로고침 후 다시 시도하세요.");
    }
    edits.set(edit.segmentId, edit.text);
  }
  if (edits.size !== current.length || current.some((segment) => !edits.has(segment.segmentId))) {
    throw new ShortformNarrationEditError(
      "segments_mismatch",
      "세그먼트 구성이 현재 패키지와 다릅니다. 새로고침 후 다시 시도하세요.",
    );
  }

  const nextSegments: ShortformNarrationSegment[] = current.map((segment) => {
    const text = normalizeSegmentText(segment.segmentId, edits.get(segment.segmentId)!);
    return { ...segment, narrationText: text, subtitleText: text };
  });
  const changed = nextSegments.some(
    (segment, index) =>
      segment.narrationText !== current[index]!.narrationText ||
      segment.subtitleText !== current[index]!.subtitleText,
  );

  const nowIso = input.now.toISOString();
  const body = nextSegments.map((segment) => segment.narrationText).join("\n\n");
  const prev = bundle.shortform;
  const validation = validatePublishableText(body, { channel: "shortform", title: prev?.title ?? null });
  const nextContent: PublishableChannelContent = {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "shortform",
    format: formatForChannel("shortform"),
    title: prev?.title ?? null,
    body,
    status: "human_edited",
    generatedAt: nowIso,
    sourceCandidateId: input.candidate.candidateId,
    sourceRevision: bundle.sourceRevision,
    selectedAngleRef: prev?.selectedAngleRef ?? null,
    researchBriefRef: prev?.researchBriefRef ?? null,
    provenance: {
      composer: "human",
      evidenceRefIds: prev?.provenance.evidenceRefIds ?? [],
      commercialIntent: prev?.provenance.commercialIntent ?? input.candidate.contentAssignment.commercialIntent,
      generationMode: "human",
    },
    validation,
    // The operator owns the spoken text; applyPublishableContentToMediaBrief only copies success slots.
    publishableSuccess: true,
    needsRegeneration: false,
    narrationSegments: nextSegments.map(toPublishableSegment),
    aiNarrationSegments: prev?.aiNarrationSegments ?? current.map(toPublishableSegment),
    marketingValue: null,
  };
  nextContent.marketingValue = evaluateMarketingValue({
    channel: "shortform",
    body,
    title: nextContent.title,
    content: nextContent,
    proposition: input.candidate.contentPlan?.proposition ?? null,
    usableFacts: (input.candidate.contentAssignment?.facts ?? []).map((fact) => fact.statement),
    now: input.now,
  });

  writePublishableBundle(packageRoot, { ...bundle, generatedAt: nowIso, shortform: nextContent }, nowIso);

  const existingValue = tryReadMarketingValueBundle(packageRoot);
  persistMarketingValueBundle({
    packageRoot,
    bundle: buildMarketingValueBundle({
      candidateId: input.candidate.candidateId,
      sourceRevision: bundle.sourceRevision,
      channels: { ...(existingValue?.channels ?? {}), shortform: nextContent.marketingValue },
      now: input.now,
    }),
    createdAt: nowIso,
  });

  const nextMediaBrief = parseMediaBrief({
    ...mediaBrief,
    formats: {
      ...mediaBrief.formats,
      shortform: { ...mediaBrief.formats.shortform, narrationSegments: nextSegments },
    },
  });
  const writtenBrief = overwritePackageArtifact({
    packageRoot,
    planned: {
      relativePath: MEDIA_BRIEF_RELATIVE_PATH,
      content: stableJsonBytes(nextMediaBrief),
      kind: "media_brief",
      origin: "media_brief",
      mediaType: "application/json",
    },
    createdAt: nowIso,
  });
  upsertPackageManifestArtifact({
    packageRoot,
    artifact: writtenBrief.artifact,
    createdAt: nowIso,
    mediaBrief: nextMediaBrief,
  });

  const exportPath = join(packageRoot, humanEditedRelativePath("shortform"));
  mkdirSync(dirname(exportPath), { recursive: true });
  writeFileSync(exportPath, `${body}\n`, "utf8");

  return {
    body,
    narrationSha256: buildShortformNarrationFingerprint(nextSegments),
    changed,
    marketingValue: nextContent.marketingValue ?? null,
  };
}

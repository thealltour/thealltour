/**
 * Pure ShortVideoBrief builder — no DB/filesystem/provider calls.
 */

import type { MediaBrief, ShortformNarrationSegment } from "@/lib/marketing/assets/contracts";
import { MarketingAssetContractError } from "@/lib/marketing/assets/errors";
import type { AiVideoShot, AiVideoShotList } from "@/lib/marketing/assets/video/contracts";
import {
  SHORT_VIDEO_BRIEF_ASPECT_RATIO,
  SHORT_VIDEO_BRIEF_CONTRACT,
  type ShortVideoBrief,
  type ShortVideoDurationPreset,
  type ShortVideoMediaPreference,
  type ShortVideoSceneRequirement,
  type ShortVideoSceneVisual,
} from "@/lib/marketing/assets/shortVideoBrief/contracts";
import {
  durationPresetMs,
  nearestDurationPreset,
  selectDurationPreset,
  splitDurationAcrossScenes,
} from "@/lib/marketing/assets/shortVideoBrief/duration";
import {
  assertDurationPresetFitsRange,
  parseShortVideoBrief,
} from "@/lib/marketing/assets/shortVideoBrief/validate";
import {
  AI_VIDEO_SHOT_LIST_RELATIVE_PATH,
  MEDIA_BRIEF_RELATIVE_PATH,
} from "@/lib/marketing/assets/video/paths";

export type BuildShortVideoBriefInput = {
  mediaBrief: MediaBrief;
  /** Optional A-8 shot list — preferred timing/scene mapping when present. */
  shotList?: AiVideoShotList | null;
  durationPreset?: ShortVideoDurationPreset | null;
  /** Existing destinations/entities only — never invent place names. */
  destinations?: string[] | null;
  entities?: string[] | null;
  hook?: string | null;
};

function stableSceneId(order: number): string {
  return `scene-${String(order).padStart(3, "0")}`;
}

function uniqueBoundedQueries(values: Array<string | null | undefined>, max = 3): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(trimmed.slice(0, 200));
    if (output.length >= max) break;
  }
  return output;
}

function textMentionsKnownEntity(text: string, entities: string[]): boolean {
  if (!text.trim() || entities.length === 0) return false;
  const haystack = text.toLowerCase();
  return entities.some((entity) => {
    const needle = entity.trim().toLowerCase();
    return needle.length >= 2 && haystack.includes(needle);
  });
}

/**
 * Deterministic factual visual gate — no LLM.
 * true when evidence refs exist or known destination/entity appears in visual/narration text.
 */
export function inferFactualVisualRequired(input: {
  segment: ShortformNarrationSegment;
  destinations: string[];
  entities: string[];
}): boolean {
  if (input.segment.evidenceRefs.length > 0) return true;
  const known = [...input.destinations, ...input.entities];
  if (textMentionsKnownEntity(input.segment.visualIntent, known)) return true;
  if (textMentionsKnownEntity(input.segment.narrationText, known)) return true;
  if (textMentionsKnownEntity(input.segment.purpose, known)) return true;
  return false;
}

function narrationSubjectFallback(segment: ShortformNarrationSegment, destinations: string[]): string {
  const narration = segment.narrationText.trim();
  if (narration) {
    const sentence = narration.split(/[.!?。！？\n]/)[0]?.trim() || narration;
    const clipped = sentence.slice(0, 120).trim();
    if (clipped && clipped.toLowerCase() !== "narration") return clipped;
  }
  if (destinations[0]) return `${destinations[0]} travel lifestyle`;
  return "generic lifestyle visual";
}

/**
 * Subject for stock search — never use purpose labels like "narration" / "hook".
 */
function resolveSubject(segment: ShortformNarrationSegment, destinations: string[]): string {
  const visual = segment.visualIntent.trim();
  if (visual && visual.toLowerCase() !== "narration") return visual.slice(0, 400);
  return narrationSubjectFallback(segment, destinations).slice(0, 400);
}

function buildSearchQueries(input: {
  segment: ShortformNarrationSegment;
  subject: string;
  destinations: string[];
}): string[] {
  const mentionedDestinations = input.destinations.filter((destination) =>
    textMentionsKnownEntity(
      `${input.segment.visualIntent}\n${input.segment.narrationText}`,
      [destination],
    ),
  );
  const primaryDestination = mentionedDestinations[0] ?? input.destinations[0] ?? null;
  const subject = input.subject.trim();
  const skipSubject =
    !subject ||
    subject === "generic lifestyle visual" ||
    subject.toLowerCase() === "narration" ||
    subject.toLowerCase() === input.segment.purpose.trim().toLowerCase();

  return uniqueBoundedQueries([
    input.segment.visualIntent && input.segment.visualIntent.toLowerCase() !== "narration"
      ? input.segment.visualIntent
      : null,
    primaryDestination,
    skipSubject ? null : subject,
  ]);
}

function buildVisual(input: {
  segment: ShortformNarrationSegment;
  destinations: string[];
  entities: string[];
  mediaPreference?: ShortVideoMediaPreference;
}): ShortVideoSceneVisual {
  const factualVisualRequired = inferFactualVisualRequired(input);
  const subject = resolveSubject(input.segment, input.destinations);
  return {
    subject,
    searchQueries: buildSearchQueries({
      segment: input.segment,
      subject,
      destinations: input.destinations,
    }),
    factualVisualRequired,
    mediaPreference: input.mediaPreference ?? "either",
    photoMotionAllowed: true,
    generatedVideoAllowed: !factualVisualRequired,
    sourcePreference: {
      internalFirst: true,
      stockAllowed: true,
    },
  };
}

function indexSegments(mediaBrief: MediaBrief): Map<string, ShortformNarrationSegment> {
  const map = new Map<string, ShortformNarrationSegment>();
  for (const segment of mediaBrief.formats.shortform.narrationSegments) {
    map.set(segment.segmentId, segment);
  }
  return map;
}

function buildSceneFromSegment(input: {
  order: number;
  segment: ShortformNarrationSegment;
  targetDurationMs: number;
  destinations: string[];
  entities: string[];
}): ShortVideoSceneRequirement {
  return {
    sceneId: stableSceneId(input.order),
    order: input.order,
    targetDurationMs: input.targetDurationMs,
    narrationSegmentRefs: [input.segment.segmentId],
    purpose: input.segment.purpose || "narration",
    visual: buildVisual({
      segment: input.segment,
      destinations: input.destinations,
      entities: input.entities,
    }),
  };
}

function buildSceneFromShot(input: {
  order: number;
  shot: AiVideoShot;
  segment: ShortformNarrationSegment;
  destinations: string[];
  entities: string[];
}): ShortVideoSceneRequirement {
  return {
    sceneId: stableSceneId(input.order),
    order: input.order,
    targetDurationMs: input.shot.durationMs,
    narrationSegmentRefs: [input.shot.narrationSegmentId],
    purpose: input.shot.purpose || input.segment.purpose || "narration",
    visual: buildVisual({
      segment: {
        ...input.segment,
        purpose: input.shot.purpose || input.segment.purpose,
        visualIntent: input.shot.visualIntent || input.segment.visualIntent,
      },
      destinations: input.destinations,
      entities: input.entities,
    }),
  };
}

/**
 * Build a normalized short-video-brief-v1 for SV-4 Source Resolver input.
 * Explicit caller only — does not touch production queues.
 */
export function buildShortVideoBrief(input: BuildShortVideoBriefInput): ShortVideoBrief {
  const { mediaBrief } = input;
  if (!mediaBrief.formats.shortform.enabled) {
    throw new MarketingAssetContractError("MediaBrief shortform must be enabled to build ShortVideoBrief");
  }
  const segments = mediaBrief.formats.shortform.narrationSegments;
  if (segments.length < 1) {
    throw new MarketingAssetContractError("MediaBrief shortform narrationSegments must be non-empty");
  }

  const destinations = (input.destinations ?? []).map((d) => d.trim()).filter(Boolean);
  const entities = (input.entities ?? []).map((e) => e.trim()).filter(Boolean);
  const hook =
    (input.hook ?? mediaBrief.coreMessage ?? mediaBrief.formats.text.title ?? segments[0]?.narrationText ?? "")
      .trim()
      .slice(0, 400);

  const shotList = input.shotList ?? null;
  if (shotList && shotList.candidateId !== mediaBrief.candidateId) {
    throw new MarketingAssetContractError("shotList.candidateId must match mediaBrief.candidateId");
  }

  let scenes: ShortVideoSceneRequirement[];
  let targetDurationMs: number;
  let durationPreset: ShortVideoDurationPreset;
  let durationPresetSource: ShortVideoBrief["provenance"]["durationPresetSource"];

  if (shotList) {
    const byId = indexSegments(mediaBrief);
    scenes = shotList.shots.map((shot, index) => {
      const segment = byId.get(shot.narrationSegmentId);
      if (!segment) {
        throw new MarketingAssetContractError(
          `shot ${shot.shotId} narrationSegmentId ${shot.narrationSegmentId} missing from MediaBrief`,
        );
      }
      return buildSceneFromShot({
        order: index + 1,
        shot,
        segment,
        destinations,
        entities,
      });
    });
    targetDurationMs = scenes.reduce((sum, scene) => sum + scene.targetDurationMs, 0);
    const nearest = nearestDurationPreset(targetDurationMs);
    if (input.durationPreset) {
      assertDurationPresetFitsRange(
        input.durationPreset,
        mediaBrief.formats.shortform.targetDurationRange,
      );
      const explicitMs = durationPresetMs(input.durationPreset);
      durationPreset =
        Math.abs(explicitMs - targetDurationMs) <= 3000 ? input.durationPreset : nearest;
    } else {
      durationPreset = nearest;
    }
    durationPresetSource = "shot_list_nearest";
  } else {
    const selected = selectDurationPreset({
      explicit: input.durationPreset,
      range: mediaBrief.formats.shortform.targetDurationRange,
    });
    durationPreset = selected.preset;
    durationPresetSource = selected.source;
    targetDurationMs = durationPresetMs(durationPreset);
    const durations = splitDurationAcrossScenes(targetDurationMs, segments.length);
    scenes = segments.map((segment, index) =>
      buildSceneFromSegment({
        order: index + 1,
        segment,
        targetDurationMs: durations[index]!,
        destinations,
        entities,
      }),
    );
  }

  const brief: ShortVideoBrief = {
    contract: SHORT_VIDEO_BRIEF_CONTRACT,
    candidateId: mediaBrief.candidateId,
    businessDateKst: mediaBrief.businessDateKst,
    durationPreset,
    targetDurationMs,
    aspectRatio: SHORT_VIDEO_BRIEF_ASPECT_RATIO,
    hook: hook || "shortform",
    scenes,
    narration: {
      segmentRefs: segments.map((segment) => segment.segmentId),
      voiceProfileId: mediaBrief.formats.shortform.voiceProfileId,
      cta: mediaBrief.formats.shortform.cta ?? mediaBrief.cta,
    },
    provenance: {
      builtFromCandidateId: mediaBrief.candidateId,
      mediaBriefArtifact: MEDIA_BRIEF_RELATIVE_PATH,
      shotListArtifact: shotList ? AI_VIDEO_SHOT_LIST_RELATIVE_PATH : null,
      durationPresetSource,
    },
  };

  return parseShortVideoBrief(brief);
}

import type { MediaBrief, ShortformNarrationSegment } from "@/lib/marketing/assets/contracts";
import { VideoShotError } from "@/lib/marketing/assets/errors";
import {
  AI_VIDEO_ASPECT_RATIO,
  AI_VIDEO_CONTINUITY_GROUP,
  AI_VIDEO_SHOT_LIST_CONTRACT,
  AI_VIDEO_TIMING_SOURCE,
  AI_VIDEO_TRANSITION_HINT,
  aiVideoShotListSchema,
  type AiVideoShot,
  type AiVideoShotList,
} from "@/lib/marketing/assets/video/contracts";
import { aiVideoShotPromptRelativePath, aiVideoShotStem } from "@/lib/marketing/assets/video/paths";
import { composeAiVideoShotPrompt } from "@/lib/marketing/assets/video/prompts";
import { normalizeNarrationForTts } from "@/lib/marketing/tts/normalize";
import { assertTimelineReadyForSubtitles } from "@/lib/marketing/tts/subtitles/validate";
import type { AudioMasterTimeline, AudioMasterTimelineSegment } from "@/lib/marketing/tts/timeline/contracts";

export type MappedVideoShot = {
  shot: AiVideoShot;
  prompt: string;
};

export function matchNarrationToTimeline(input: {
  mediaBrief: MediaBrief;
  timeline: AudioMasterTimeline;
}): Array<{ briefSegment: ShortformNarrationSegment; timelineSegment: AudioMasterTimelineSegment }> {
  assertTimelineReadyForSubtitles(input.timeline);
  if (input.mediaBrief.candidateId !== input.timeline.candidateId) {
    throw new VideoShotError("narration_mismatch", "MediaBrief candidateId must match the timeline candidateId");
  }
  if (!input.mediaBrief.formats.shortform.enabled) {
    throw new VideoShotError("narration_mismatch", "MediaBrief shortform must be enabled before planning video shots");
  }

  const briefSegments = input.mediaBrief.formats.shortform.narrationSegments;
  const timelineSegments = input.timeline.segments;
  if (briefSegments.length !== timelineSegments.length) {
    throw new VideoShotError(
      "narration_mismatch",
      "MediaBrief narration segment count must match the timeline segment count",
    );
  }

  return timelineSegments.map((timelineSegment, index) => {
    const briefSegment = briefSegments[index];
    if (!briefSegment) {
      throw new VideoShotError("narration_mismatch", "MediaBrief narration segment is missing for a timeline segment");
    }
    if (briefSegment.segmentId !== timelineSegment.segmentId) {
      throw new VideoShotError("narration_mismatch", "Narration segmentId must match the timeline segmentId in order");
    }
    if (timelineSegment.ordinal !== index + 1) {
      throw new VideoShotError("narration_mismatch", "Timeline ordinals must match narration order");
    }
    if (normalizeNarrationForTts(briefSegment.narrationText) !== normalizeNarrationForTts(timelineSegment.text)) {
      throw new VideoShotError("narration_mismatch", "Narration text must match the timeline text for each segment");
    }
    return { briefSegment, timelineSegment };
  });
}

export function buildAiVideoShotList(input: {
  mediaBrief: MediaBrief;
  timeline: AudioMasterTimeline;
}): { shotList: AiVideoShotList; prompts: MappedVideoShot[] } {
  const matched = matchNarrationToTimeline(input);
  const audience = input.mediaBrief.audience;
  const prompts: MappedVideoShot[] = matched.map(({ briefSegment, timelineSegment }, index) => {
    const ordinal = index + 1;
    const shot: AiVideoShot = {
      shotId: aiVideoShotStem(ordinal),
      ordinal,
      narrationSegmentId: timelineSegment.segmentId,
      narrationText: timelineSegment.text,
      purpose: briefSegment.purpose,
      visualIntent: briefSegment.visualIntent,
      startMs: timelineSegment.startMs,
      durationMs: timelineSegment.durationMs,
      endMs: timelineSegment.endMs,
      promptRelativePath: aiVideoShotPromptRelativePath(ordinal),
      transitionHint: AI_VIDEO_TRANSITION_HINT,
      continuityGroup: AI_VIDEO_CONTINUITY_GROUP,
    };
    return {
      shot,
      prompt: composeAiVideoShotPrompt({
        narrationText: timelineSegment.text,
        visualIntent: briefSegment.visualIntent,
        audience,
      }),
    };
  });

  const shotList = parseAiVideoShotList({
    contract: AI_VIDEO_SHOT_LIST_CONTRACT,
    candidateId: input.timeline.candidateId,
    aspectRatio: AI_VIDEO_ASPECT_RATIO,
    timingSource: AI_VIDEO_TIMING_SOURCE,
    authoritativeClock: input.timeline.authoritativeClock,
    pauseMs: input.timeline.pauseMs,
    shots: prompts.map((item) => item.shot),
  });
  assertShotListMatchesTimeline(shotList, input.timeline);
  return { shotList, prompts };
}

export function parseAiVideoShotList(value: unknown): AiVideoShotList {
  const parsed = aiVideoShotListSchema.safeParse(value);
  if (!parsed.success) {
    throw new VideoShotError("invalid_shot_list", "ai-video-shot-list-v1 is malformed");
  }
  assertShotIdentity(parsed.data);
  return parsed.data;
}

function assertShotIdentity(shotList: AiVideoShotList): void {
  const shotIds = new Set<string>();
  const promptPaths = new Set<string>();
  for (const [index, shot] of shotList.shots.entries()) {
    const expectedOrdinal = index + 1;
    if (shot.ordinal !== expectedOrdinal) {
      throw new VideoShotError("invalid_shot_list", "Shot ordinals must match shot order");
    }
    if (shot.shotId !== aiVideoShotStem(expectedOrdinal)) {
      throw new VideoShotError("invalid_shot_list", "Shot IDs must follow shot-NNNN order");
    }
    if (shot.promptRelativePath !== aiVideoShotPromptRelativePath(expectedOrdinal)) {
      throw new VideoShotError("invalid_shot_list", "Shot prompt path must match shot-NNNN order");
    }
    if (shotIds.has(shot.shotId) || promptPaths.has(shot.promptRelativePath)) {
      throw new VideoShotError("invalid_shot_list", "Shot IDs and prompt paths must be unique");
    }
    if (shot.endMs !== shot.startMs + shot.durationMs) {
      throw new VideoShotError("invalid_shot_list", "Shot endMs must equal startMs + durationMs");
    }
    if (index > 0 && shot.startMs < shotList.shots[index - 1].endMs) {
      throw new VideoShotError("invalid_shot_list", "Shots must not overlap");
    }
    shotIds.add(shot.shotId);
    promptPaths.add(shot.promptRelativePath);
  }
}

function assertShotListMatchesTimeline(shotList: AiVideoShotList, timeline: AudioMasterTimeline): void {
  if (shotList.shots.length !== timeline.segments.length) {
    throw new VideoShotError("invalid_shot_list", "Shot count must match the timeline segment count");
  }
  for (const [index, shot] of shotList.shots.entries()) {
    const segment = timeline.segments[index];
    if (!segment) {
      throw new VideoShotError("invalid_shot_list", "Shot list is longer than the timeline");
    }
    if (shot.startMs !== segment.startMs || shot.endMs !== segment.endMs || shot.durationMs !== segment.durationMs) {
      throw new VideoShotError("invalid_shot_list", "Shot timing must copy the matched timeline segment");
    }
  }
}

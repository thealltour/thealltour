import { existsSync, readFileSync } from "node:fs";

import { MarketingAssetConflictError } from "@/lib/marketing/assets/errors";
import { sha256Buffer } from "@/lib/marketing/assets/hashing";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import type { TtsProfile } from "@/lib/marketing/tts/contracts";
import type { AudioDurationProbe } from "@/lib/marketing/tts/duration/probe";
import { TtsError, isTtsError } from "@/lib/marketing/tts/errors";
import { normalizeNarrationForTts } from "@/lib/marketing/tts/normalize";
import { parsePersistedTtsGeneration, persistTtsGeneration } from "@/lib/marketing/tts/persist";
import type { TtsProvider } from "@/lib/marketing/tts/provider";
import { buildAudioMasterTimeline } from "@/lib/marketing/tts/timeline/build";
import {
  TTS_MAX_NARRATION_SEGMENTS,
  TTS_TIMELINE_RELATIVE_PATH,
  type AudioMasterTimeline,
} from "@/lib/marketing/tts/timeline/contracts";
import { persistAudioMasterTimeline } from "@/lib/marketing/tts/timeline/persist";
import {
  ttsOrderedSegmentAudioRelativePath,
  ttsOrderedSegmentGenerationRelativePath,
  ttsOrderedSegmentStem,
} from "@/lib/marketing/tts/timeline/paths";

export type NarrationSegmentInput = {
  segmentId: string;
  narrationText: string;
};

export type CompletedNarrationSegment = {
  ordinal: number;
  segmentId: string;
  text: string;
  relativeAudioPath: string;
  relativeGenerationPath: string;
  audioSha256: string;
  durationMs: number;
  reused: boolean;
};

export type FailedNarrationSegment = {
  ordinal: number;
  segmentId: string;
  code: string;
  message: string;
};

export type GenerateNarrationMasterTimelineResult =
  | {
      status: "completed";
      timeline: AudioMasterTimeline;
      timelineRelativePath: typeof TTS_TIMELINE_RELATIVE_PATH;
      timelineStatus: "created" | "reused";
      segments: CompletedNarrationSegment[];
    }
  | {
      status: "partial_failure";
      timeline: null;
      timelineRelativePath: null;
      timelineWritten: false;
      segments: CompletedNarrationSegment[];
      failed: FailedNarrationSegment;
      remaining: Array<{ ordinal: number; segmentId: string }>;
    };

export async function generateNarrationMasterTimeline(input: {
  packageRoot: string;
  candidateId: string;
  segments: NarrationSegmentInput[];
  profile: TtsProfile;
  provider: TtsProvider;
  durationProbe: AudioDurationProbe;
  now?: Date;
}): Promise<GenerateNarrationMasterTimelineResult> {
  const candidateId = input.candidateId.trim();
  if (!candidateId) {
    throw new TtsError("invalid_request", "candidateId is required");
  }
  if (input.segments.length === 0) {
    throw new TtsError("invalid_request", "At least one narration segment is required");
  }
  if (input.segments.length > TTS_MAX_NARRATION_SEGMENTS) {
    throw new TtsError("invalid_request", `Narration is limited to ${TTS_MAX_NARRATION_SEGMENTS} segments`);
  }

  const seen = new Set<string>();
  const prepared = input.segments.map((segment, index) => {
    const segmentId = segment.segmentId.trim();
    if (!segmentId) {
      throw new TtsError("invalid_request", "Each narration segment needs a segmentId");
    }
    if (seen.has(segmentId)) {
      throw new TtsError("invalid_request", `Duplicate narration segmentId: ${segmentId}`);
    }
    seen.add(segmentId);
    return {
      ordinal: index + 1,
      segmentId,
      text: normalizeNarrationForTts(segment.narrationText),
    };
  });

  const generatedAt = (input.now ?? new Date()).toISOString();
  const completed: CompletedNarrationSegment[] = [];

  for (const segment of prepared) {
    try {
      const measured = await generateOrReuseSegment({
        packageRoot: input.packageRoot,
        profile: input.profile,
        provider: input.provider,
        durationProbe: input.durationProbe,
        generatedAt,
        segment,
      });
      completed.push(measured);
    } catch (error) {
      if (error instanceof MarketingAssetConflictError) throw error;
      return {
        status: "partial_failure",
        timeline: null,
        timelineRelativePath: null,
        timelineWritten: false,
        segments: completed,
        failed: {
          ordinal: segment.ordinal,
          segmentId: segment.segmentId,
          code: isTtsError(error) ? error.code : "generation_failed",
          message: error instanceof Error ? error.message : "Narration segment generation failed",
        },
        remaining: prepared.slice(segment.ordinal).map((item) => ({
          ordinal: item.ordinal,
          segmentId: item.segmentId,
        })),
      };
    }
  }

  const timeline = buildAudioMasterTimeline({
    candidateId,
    profileId: input.profile.profileId,
    generatedAt,
    segments: completed,
  });
  const persisted = persistAudioMasterTimeline({
    packageRoot: input.packageRoot,
    timeline,
    createdAt: generatedAt,
  });

  return {
    status: "completed",
    timeline,
    timelineRelativePath: TTS_TIMELINE_RELATIVE_PATH,
    timelineStatus: persisted.status,
    segments: completed,
  };
}

async function generateOrReuseSegment(input: {
  packageRoot: string;
  profile: TtsProfile;
  provider: TtsProvider;
  durationProbe: AudioDurationProbe;
  generatedAt: string;
  segment: { ordinal: number; segmentId: string; text: string };
}): Promise<CompletedNarrationSegment> {
  const relativeAudioPath = ttsOrderedSegmentAudioRelativePath(input.segment.ordinal);
  const relativeGenerationPath = ttsOrderedSegmentGenerationRelativePath(input.segment.ordinal);
  const absoluteAudioPath = resolvePackageArtifactPath({
    packageRoot: input.packageRoot,
    relativePath: relativeAudioPath,
  });

  const reusable = readReusableSegment({
    packageRoot: input.packageRoot,
    relativeAudioPath,
    relativeGenerationPath,
    profile: input.profile,
    segmentId: input.segment.segmentId,
    text: input.segment.text,
  });

  if (!reusable) {
    const result = await input.provider.generate({
      requestId: `tts_${ttsOrderedSegmentStem(input.segment.ordinal)}`,
      profile: input.profile,
      text: input.segment.text,
      segmentId: input.segment.segmentId,
    });
    persistTtsGeneration({
      packageRoot: input.packageRoot,
      result,
      relativeAudioPath,
      relativeMetadataPath: relativeGenerationPath,
      createdAt: input.generatedAt,
      text: input.segment.text,
    });
  }

  const probed = await input.durationProbe.probePersistedWav(absoluteAudioPath);
  const audioBytes = readFileSync(absoluteAudioPath);
  return {
    ordinal: input.segment.ordinal,
    segmentId: input.segment.segmentId,
    text: input.segment.text,
    relativeAudioPath,
    relativeGenerationPath,
    audioSha256: sha256Buffer(audioBytes),
    durationMs: probed.durationMs,
    reused: Boolean(reusable),
  };
}

function readReusableSegment(input: {
  packageRoot: string;
  relativeAudioPath: string;
  relativeGenerationPath: string;
  profile: TtsProfile;
  segmentId: string;
  text: string;
}): { sha256: string } | null {
  const audioPath = resolvePackageArtifactPath({
    packageRoot: input.packageRoot,
    relativePath: input.relativeAudioPath,
  });
  const metaPath = resolvePackageArtifactPath({
    packageRoot: input.packageRoot,
    relativePath: input.relativeGenerationPath,
  });
  if (!existsSync(audioPath) || !existsSync(metaPath)) return null;

  const audioSha256 = sha256Buffer(readFileSync(audioPath));
  const parsed = parsePersistedTtsGeneration(readFileSync(metaPath));
  if (!parsed) return null;
  if (parsed.sha256 !== audioSha256) return null;
  if (parsed.text !== input.text) return null;
  if (parsed.segmentId !== input.segmentId) return null;
  if (parsed.provider !== input.profile.provider) return null;
  if (parsed.profileId !== input.profile.profileId) return null;
  if (parsed.modelRef !== input.profile.modelRef) return null;
  if (parsed.voiceRef !== input.profile.voiceRef) return null;
  if (parsed.format !== "wav") return null;
  return { sha256: audioSha256 };
}

import { existsSync, readFileSync } from "node:fs";

import { sha256Buffer, stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { describePlannedArtifact, writePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import type { TtsAudioResult } from "@/lib/marketing/tts/contracts";
import { TtsError } from "@/lib/marketing/tts/errors";

export const TTS_GENERATION_ARTIFACT_CONTRACT = "tts-generation-artifact-v1" as const;
export const TTS_NARRATION_WAV_RELATIVE_PATH = "reel/audio/narration.wav";
export const TTS_GENERATION_JSON_RELATIVE_PATH = "reel/audio/generation.json";

export function ttsSegmentAudioRelativePath(segmentId: string): string {
  const safe = segmentId.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(safe)) {
    throw new TtsError("invalid_request", "TTS segmentId is not a safe artifact name");
  }
  return `reel/audio/segments/${safe}.wav`;
}

export type TtsGenerationArtifact = {
  contract: typeof TTS_GENERATION_ARTIFACT_CONTRACT;
  profileId: string;
  provider: string;
  modelRef: string | null;
  voiceRef: string | null;
  sha256: string;
  byteSize: number;
  generatedAt: string;
  requestId: string;
  segmentId: string | null;
  format: "wav";
  mediaType: "audio/wav";
  sampleRate: number | null;
  channels: number | null;
  providerReportedDurationMs: number | null;
  containerDurationMs: number | null;
  timelineAuthoritative: false;
};

export function buildTtsGenerationArtifact(result: TtsAudioResult): TtsGenerationArtifact {
  const artifact: TtsGenerationArtifact = {
    contract: TTS_GENERATION_ARTIFACT_CONTRACT,
    profileId: result.profileId,
    provider: result.provider,
    modelRef: result.metadata.modelRef,
    voiceRef: result.metadata.voiceRef,
    sha256: result.sha256,
    byteSize: result.byteSize,
    generatedAt: result.generatedAt,
    requestId: result.requestId,
    segmentId: result.segmentId,
    format: "wav",
    mediaType: "audio/wav",
    sampleRate: result.sampleRate,
    channels: result.channels,
    providerReportedDurationMs: result.providerReportedDurationMs,
    containerDurationMs: result.containerDurationMs,
    timelineAuthoritative: false,
  };
  if (jsonContainsForbiddenBotLeak(artifact)) {
    throw new TtsError("invalid_request", "TTS generation metadata contains a forbidden field");
  }
  return artifact;
}

export function persistTtsGeneration(input: {
  packageRoot: string;
  result: TtsAudioResult;
  relativeAudioPath?: string;
  relativeMetadataPath?: string;
  createdAt?: string;
}): {
  audio: ReturnType<typeof writePackageArtifact>;
  metadata: ReturnType<typeof writePackageArtifact>;
} {
  const createdAt = input.createdAt ?? input.result.generatedAt;
  const relativeAudioPath = input.relativeAudioPath ?? TTS_NARRATION_WAV_RELATIVE_PATH;
  const relativeMetadataPath = input.relativeMetadataPath ?? TTS_GENERATION_JSON_RELATIVE_PATH;
  const generation = buildTtsGenerationArtifact(input.result);

  const audio = writePackageArtifact({
    packageRoot: input.packageRoot,
    createdAt,
    planned: {
      relativePath: relativeAudioPath,
      content: input.result.audio,
      kind: "reel_audio",
      origin: "tts_generation",
      mediaType: "audio/wav",
    },
  });
  const metadata = persistGenerationMetadata({
    packageRoot: input.packageRoot,
    createdAt,
    relativePath: relativeMetadataPath,
    generation,
    audioSha256: input.result.sha256,
  });
  return { audio, metadata };
}

function persistGenerationMetadata(input: {
  packageRoot: string;
  createdAt: string;
  relativePath: string;
  generation: TtsGenerationArtifact;
  audioSha256: string;
}): ReturnType<typeof writePackageArtifact> {
  const planned = {
    relativePath: input.relativePath,
    content: stableJsonBytes(input.generation),
    kind: "context" as const,
    origin: "tts_generation" as const,
    mediaType: "application/json",
  };
  const absolutePath = resolvePackageArtifactPath({
    packageRoot: input.packageRoot,
    relativePath: input.relativePath,
  });

  if (existsSync(absolutePath)) {
    const existingBytes = readFileSync(absolutePath);
    if (sha256Buffer(existingBytes) === sha256Buffer(planned.content)) {
      return {
        status: "reused",
        artifact: describePlannedArtifact(planned, input.createdAt),
      };
    }
    const existing = readPersistedGeneration(existingBytes);
    if (
      existing &&
      existing.sha256 === input.audioSha256 &&
      sameStableGenerationIdentity(existing, input.generation)
    ) {
      return {
        status: "reused",
        artifact: describePlannedArtifact({ ...planned, content: existingBytes }, input.createdAt),
      };
    }
  }

  return writePackageArtifact({
    packageRoot: input.packageRoot,
    planned,
    createdAt: input.createdAt,
  });
}

function readPersistedGeneration(bytes: Buffer): {
  sha256: string;
  provider: string;
  profileId: string;
  modelRef: string | null;
  voiceRef: string | null;
  format: string;
  segmentId: string | null;
} | null {
  try {
    const parsed: unknown = JSON.parse(bytes.toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.sha256 !== "string" || record.sha256.length !== 64) return null;
    if (typeof record.provider !== "string" || typeof record.profileId !== "string") return null;
    if (typeof record.format !== "string") return null;
    return {
      sha256: record.sha256,
      provider: record.provider,
      profileId: record.profileId,
      modelRef: nullableString(record.modelRef),
      voiceRef: nullableString(record.voiceRef),
      format: record.format,
      segmentId: nullableString(record.segmentId),
    };
  } catch {
    return null;
  }
}

function nullableString(value: unknown): string | null {
  if (value == null) return null;
  return typeof value === "string" ? value : null;
}

function sameStableGenerationIdentity(
  existing: {
    provider: string;
    profileId: string;
    modelRef: string | null;
    voiceRef: string | null;
    format: string;
    segmentId: string | null;
  },
  incoming: TtsGenerationArtifact,
): boolean {
  return (
    existing.provider === incoming.provider &&
    existing.profileId === incoming.profileId &&
    existing.modelRef === incoming.modelRef &&
    existing.voiceRef === incoming.voiceRef &&
    existing.format === incoming.format &&
    existing.segmentId === incoming.segmentId
  );
}

import { existsSync, readFileSync } from "node:fs";

import { sha256Buffer, stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { describePlannedArtifact, writePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import { TtsError } from "@/lib/marketing/tts/errors";
import {
  TTS_TIMELINE_RELATIVE_PATH,
  audioMasterTimelineSchema,
  type AudioMasterTimeline,
} from "@/lib/marketing/tts/timeline/contracts";

export function persistAudioMasterTimeline(input: {
  packageRoot: string;
  timeline: AudioMasterTimeline;
  createdAt?: string;
}): ReturnType<typeof writePackageArtifact> {
  const parsed = audioMasterTimelineSchema.safeParse(input.timeline);
  if (!parsed.success) {
    throw new TtsError("invalid_request", "audio-master-timeline-v1 contract is invalid");
  }
  if (jsonContainsForbiddenBotLeak(parsed.data)) {
    throw new TtsError("invalid_request", "audio master timeline contains a forbidden field");
  }

  const planned = {
    relativePath: TTS_TIMELINE_RELATIVE_PATH,
    content: stableJsonBytes(parsed.data),
    kind: "context" as const,
    origin: "tts_generation" as const,
    mediaType: "application/json",
  };
  const createdAt = input.createdAt ?? parsed.data.generatedAt;
  const absolutePath = resolvePackageArtifactPath({
    packageRoot: input.packageRoot,
    relativePath: TTS_TIMELINE_RELATIVE_PATH,
  });

  if (existsSync(absolutePath)) {
    const existingBytes = readFileSync(absolutePath);
    if (sha256Buffer(existingBytes) === sha256Buffer(planned.content)) {
      return { status: "reused", artifact: describePlannedArtifact(planned, createdAt) };
    }
    const existing = parsePersistedTimeline(existingBytes);
    if (existing && sameStableTimelineIdentity(existing, parsed.data)) {
      return {
        status: "reused",
        artifact: describePlannedArtifact({ ...planned, content: existingBytes }, createdAt),
      };
    }
  }

  return writePackageArtifact({
    packageRoot: input.packageRoot,
    planned,
    createdAt,
  });
}

function parsePersistedTimeline(bytes: Buffer): AudioMasterTimeline | null {
  try {
    const parsed = audioMasterTimelineSchema.safeParse(JSON.parse(bytes.toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function sameStableTimelineIdentity(existing: AudioMasterTimeline, incoming: AudioMasterTimeline): boolean {
  const { generatedAt: _existingGeneratedAt, ...existingStable } = existing;
  const { generatedAt: _incomingGeneratedAt, ...incomingStable } = incoming;
  return JSON.stringify(existingStable) === JSON.stringify(incomingStable);
}

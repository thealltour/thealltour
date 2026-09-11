import "server-only";

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { TtsProfile } from "@/lib/marketing/tts/contracts";
import type { TtsProvider } from "@/lib/marketing/tts/provider";
import { ShortformProductionError } from "@/lib/marketing/assets/shortform/production/errors";
import type { ShortformJobWorkspace } from "@/lib/marketing/assets/shortform/worker/workspace";

export type ShortformNarrationSegmentInput = {
  segmentId: string;
  /** Scene that owns this narration ref (ShortVideoBrief sceneId). */
  sceneId: string;
  /** MediaBrief.narrationText — TTS SoT (no placeholders). */
  text: string;
  /** MediaBrief.subtitleText (fallback narrationText) — baked Remotion captions. */
  subtitleText: string;
  /** Canonical TtsProfile — must preserve enabled so generation safety gates still work. */
  profile: TtsProfile;
};

export type PreparedNarration = {
  absoluteWavPath: string;
  segments: Array<{
    segmentId: string;
    sceneId: string;
    text: string;
    subtitleText: string;
  }>;
  subtitlesBySceneId: Record<string, string[]>;
  cta: string | null;
};

/**
 * Reuses VoiceStudioTtsProvider (injected). Live :3900 not called in SV-8A tests.
 */
export async function prepareShortformNarration(input: {
  workspace: ShortformJobWorkspace;
  tts: TtsProvider;
  segments: ShortformNarrationSegmentInput[];
  requestIdPrefix: string;
  subtitlesBySceneId?: Record<string, string[]>;
  cta?: string | null;
  signal?: AbortSignal;
}): Promise<PreparedNarration> {
  if (input.signal?.aborted) {
    throw new ShortformProductionError("narration aborted", "NARRATION_ABORTED");
  }
  const subtitlesBySceneId = input.subtitlesBySceneId ?? {};
  const cta = input.cta ?? null;
  if (input.segments.length === 0) {
    const emptyPath = join(input.workspace.audioDir, "narration-empty.wav");
    writeFileSync(emptyPath, Buffer.alloc(0));
    return { absoluteWavPath: emptyPath, segments: [], subtitlesBySceneId, cta };
  }

  // Concatenate segment audio buffers in declared order (simple SV-8A policy).
  const parts: Buffer[] = [];
  const outSegments: PreparedNarration["segments"] = [];
  for (const [index, segment] of input.segments.entries()) {
    if (input.signal?.aborted) {
      throw new ShortformProductionError("narration aborted", "NARRATION_ABORTED");
    }
    const result = await input.tts.generate({
      requestId: `${input.requestIdPrefix}:${segment.segmentId}:${index}`,
      profile: segment.profile,
      text: segment.text,
      segmentId: segment.segmentId,
    });
    parts.push(result.audio);
    outSegments.push({
      segmentId: segment.segmentId,
      sceneId: segment.sceneId,
      text: segment.text,
      subtitleText: segment.subtitleText,
    });
  }

  const absoluteWavPath = join(input.workspace.audioDir, "narration.wav");
  writeFileSync(absoluteWavPath, Buffer.concat(parts));
  return { absoluteWavPath, segments: outSegments, subtitlesBySceneId, cta };
}

/** Fake TTS for SV-8A tests — never hits VoiceStudio. */
export function createFakeShortformTtsProvider(): TtsProvider {
  return {
    providerId: "voicestudio",
    async generate(input) {
      const audio = Buffer.from(`WAVFAKE:${input.text.slice(0, 32)}`);
      return {
        contract: "tts-generation-result-v1",
        requestId: input.requestId,
        provider: "voicestudio",
        profileId: input.profile.profileId,
        mediaType: "audio/wav",
        format: "wav",
        sampleRate: 24000,
        channels: 1,
        byteSize: audio.byteLength,
        sha256: "0".repeat(64),
        providerGenerationId: null,
        providerReportedDurationMs: null,
        containerDurationMs: 500,
        timelineAuthoritative: false,
        generatedAt: new Date().toISOString(),
        segmentId: input.segmentId ?? null,
        metadata: {},
        audio,
      } as never;
    },
  };
}

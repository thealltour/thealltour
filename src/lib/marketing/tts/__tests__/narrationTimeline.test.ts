import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MarketingAssetConflictError } from "@/lib/marketing/assets/errors";
import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import { hashTtsAudio } from "@/lib/marketing/tts/audioIntegrity";
import type { TtsAudioResult } from "@/lib/marketing/tts/contracts";
import type { AudioDurationProbe } from "@/lib/marketing/tts/duration/probe";
import { TTS_AUTHORITATIVE_CLOCK } from "@/lib/marketing/tts/duration/probe";
import { TtsError } from "@/lib/marketing/tts/errors";
import { resolveTtsProfile } from "@/lib/marketing/tts/profiles";
import type { TtsProvider } from "@/lib/marketing/tts/provider";
import { buildAudioMasterTimeline } from "@/lib/marketing/tts/timeline/build";
import {
  TTS_INTER_SEGMENT_PAUSE_MS,
  TTS_TIMELINE_RELATIVE_PATH,
  TTS_TRAILING_PAUSE_MS,
} from "@/lib/marketing/tts/timeline/contracts";
import { generateNarrationMasterTimeline } from "@/lib/marketing/tts/timeline/orchestrate";
import {
  parseGenerateNarrationTimelineArgs,
  runGenerateNarrationTimelineCommand,
} from "@/lib/marketing/tts/timeline/cli";
import {
  ttsOrderedSegmentAudioRelativePath,
  ttsOrderedSegmentGenerationRelativePath,
} from "@/lib/marketing/tts/timeline/paths";

const tempDirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "narration-timeline-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function pcmWav(fill = 1): Buffer {
  const samples = 240;
  const sampleRate = 24_000;
  const dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  buf.fill(fill, 44);
  return buf;
}

function audioResult(input: { text: string; wav: Buffer; segmentId: string }): TtsAudioResult {
  const hashed = hashTtsAudio(input.wav);
  return {
    contract: "tts-generation-result-v1",
    requestId: `req_${input.segmentId}`,
    provider: "voicestudio",
    profileId: "standard-ko-development",
    mediaType: "audio/wav",
    format: "wav",
    sampleRate: 24_000,
    channels: 1,
    byteSize: hashed.byteSize,
    sha256: hashed.sha256,
    providerGenerationId: null,
    providerReportedDurationMs: 99_999,
    containerDurationMs: 10,
    timelineAuthoritative: false,
    generatedAt: "2026-09-03T00:00:00.000Z",
    segmentId: input.segmentId,
    metadata: { modelRef: "tts-1", voiceRef: "default", httpStatus: 200 },
    audio: input.wav,
  };
}

class FakeTtsProvider implements TtsProvider {
  readonly providerId = "voicestudio" as const;
  readonly calls: string[] = [];
  failOnText: string | null = null;
  readonly wavByText: Record<string, Buffer>;

  constructor(wavByText: Record<string, Buffer>) {
    this.wavByText = wavByText;
  }

  async generate(input: { text: string; segmentId?: string | null }): Promise<TtsAudioResult> {
    this.calls.push(input.text);
    if (this.failOnText === input.text) {
      throw new TtsError("generation_failed", "synthetic TTS failure");
    }
    const wav = this.wavByText[input.text];
    if (!wav) throw new TtsError("generation_failed", `no fixture for ${input.text}`);
    return audioResult({ text: input.text, wav, segmentId: input.segmentId ?? "seg" });
  }
}

function createProbe(durations: Record<string, number>): AudioDurationProbe & { probed: string[] } {
  const probed: string[] = [];
  return {
    probed,
    async probePersistedWav(absolutePath: string) {
      if (!existsSync(absolutePath)) {
        throw new TtsError("invalid_request", "probe ran before persist");
      }
      probed.push(absolutePath);
      const stem = absolutePath.includes("segment-0002") ? "segment-0002" : "segment-0001";
      const durationMs = durations[stem] ?? durations[absolutePath];
      if (!durationMs) throw new TtsError("invalid_duration", "missing fake duration");
      return { durationMs, source: TTS_AUTHORITATIVE_CLOCK, absolutePath };
    },
  };
}

const SEGMENTS = [
  { segmentId: "hook", narrationText: "  다낭 효도여행은 일정이 여유롭습니다.  " },
  { segmentId: "close", narrationText: "출발 전에 공식 안내를 다시 확인하세요." },
];

describe("audio-master-timeline-v1 math", () => {
  it("uses a 250ms pause, no trailing pause, and ffprobe durations", () => {
    const timeline = buildAudioMasterTimeline({
      candidateId: "dev-tts-a6-verification",
      profileId: "standard-ko-development",
      generatedAt: "2026-09-03T00:00:00.000Z",
      segments: [
        {
          segmentId: "hook",
          ordinal: 1,
          text: "하나",
          relativeAudioPath: ttsOrderedSegmentAudioRelativePath(1),
          relativeGenerationPath: ttsOrderedSegmentGenerationRelativePath(1),
          audioSha256: "a".repeat(64),
          durationMs: 1000,
        },
        {
          segmentId: "close",
          ordinal: 2,
          text: "둘",
          relativeAudioPath: ttsOrderedSegmentAudioRelativePath(2),
          relativeGenerationPath: ttsOrderedSegmentGenerationRelativePath(2),
          audioSha256: "b".repeat(64),
          durationMs: 2000,
        },
      ],
    });
    expect(timeline.contract).toBe("audio-master-timeline-v1");
    expect(timeline.authoritativeClock).toBe(TTS_AUTHORITATIVE_CLOCK);
    expect(timeline.pauseMs).toBe(TTS_INTER_SEGMENT_PAUSE_MS);
    expect(timeline.trailingPauseMs).toBe(TTS_TRAILING_PAUSE_MS);
    expect(timeline.segments[0]).toMatchObject({ startMs: 0, durationMs: 1000, endMs: 1000 });
    expect(timeline.segments[1]).toMatchObject({ startMs: 1250, durationMs: 2000, endMs: 3250 });
    expect(timeline.totalDurationMs).toBe(3250);
  });
});

describe("narration segment orchestration", () => {
  it("generates ordered segments, persists before probing, and writes a complete timeline", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    mkdirSync(packageRoot, { recursive: true });
    const wav1 = pcmWav(1);
    const wav2 = pcmWav(2);
    const provider = new FakeTtsProvider({
      "다낭 효도여행은 일정이 여유롭습니다.": wav1,
      "출발 전에 공식 안내를 다시 확인하세요.": wav2,
    });
    const probe = createProbe({ "segment-0001": 1000, "segment-0002": 2000 });

    const result = await generateNarrationMasterTimeline({
      packageRoot,
      candidateId: "dev-tts-a6-verification",
      segments: SEGMENTS,
      profile: resolveTtsProfile("standard-ko-development"),
      provider,
      durationProbe: probe,
      now: new Date("2026-09-03T00:00:00.000Z"),
    });

    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;
    expect(provider.calls).toEqual([
      "다낭 효도여행은 일정이 여유롭습니다.",
      "출발 전에 공식 안내를 다시 확인하세요.",
    ]);
    expect(result.timeline.segments[0].text).toBe("다낭 효도여행은 일정이 여유롭습니다.");
    expect(result.timeline.totalDurationMs).toBe(3250);
    expect(result.timeline.authoritativeClock).toBe("persisted_wav_ffprobe");
    expect(result.timelineRelativePath).toBe(TTS_TIMELINE_RELATIVE_PATH);

    const firstAbs = probe.probed[0];
    expect(firstAbs.endsWith("reel/audio/segment-0001.wav")).toBe(true);
    expect(readFileSync(firstAbs).equals(wav1)).toBe(true);
    expect(existsSync(join(packageRoot, ttsOrderedSegmentGenerationRelativePath(1)))).toBe(true);
    expect(existsSync(join(packageRoot, TTS_TIMELINE_RELATIVE_PATH))).toBe(true);
    expect(jsonContainsForbiddenBotLeak(result.timeline)).toBe(false);
    expect(JSON.stringify(result.timeline)).not.toMatch(/OMNIVOICE|Bearer |apiKey/i);
    expect(result.timeline.segments[0].durationMs).toBe(1000);
    expect(result.timeline.segments[0].durationMs).not.toBe(99_999);
  });

  it("keeps successful WAVs and does not write a complete timeline on partial failure", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    mkdirSync(packageRoot, { recursive: true });
    const wav1 = pcmWav(1);
    const provider = new FakeTtsProvider({
      "다낭 효도여행은 일정이 여유롭습니다.": wav1,
      "출발 전에 공식 안내를 다시 확인하세요.": pcmWav(2),
    });
    provider.failOnText = "출발 전에 공식 안내를 다시 확인하세요.";
    const probe = createProbe({ "segment-0001": 1000, "segment-0002": 2000 });

    const result = await generateNarrationMasterTimeline({
      packageRoot,
      candidateId: "dev-tts-a6-verification",
      segments: SEGMENTS,
      profile: resolveTtsProfile("standard-ko-development"),
      provider,
      durationProbe: probe,
    });

    expect(result.status).toBe("partial_failure");
    if (result.status !== "partial_failure") return;
    expect(result.timeline).toBeNull();
    expect(result.timelineWritten).toBe(false);
    expect(existsSync(join(packageRoot, TTS_TIMELINE_RELATIVE_PATH))).toBe(false);
    expect(existsSync(join(packageRoot, ttsOrderedSegmentAudioRelativePath(1)))).toBe(true);
    expect(existsSync(join(packageRoot, ttsOrderedSegmentAudioRelativePath(2)))).toBe(false);
    expect(result.failed.ordinal).toBe(2);
    expect(result.remaining).toEqual([]);
    expect(result.segments).toHaveLength(1);
  });

  it("retries by reusing successful segments instead of regenerating them", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    mkdirSync(packageRoot, { recursive: true });
    const wav1 = pcmWav(1);
    const wav2 = pcmWav(2);
    const provider = new FakeTtsProvider({
      "다낭 효도여행은 일정이 여유롭습니다.": wav1,
      "출발 전에 공식 안내를 다시 확인하세요.": wav2,
    });
    provider.failOnText = "출발 전에 공식 안내를 다시 확인하세요.";
    const probe = createProbe({ "segment-0001": 1000, "segment-0002": 2000 });
    const profile = resolveTtsProfile("standard-ko-development");
    const input = { packageRoot, candidateId: "dev-tts-a6-verification", segments: SEGMENTS, profile, durationProbe: probe };

    const first = await generateNarrationMasterTimeline({ ...input, provider });
    expect(first.status).toBe("partial_failure");
    expect(provider.calls).toHaveLength(2);

    provider.failOnText = null;
    const second = await generateNarrationMasterTimeline({ ...input, provider });
    expect(second.status).toBe("completed");
    expect(provider.calls).toHaveLength(3);
    expect(provider.calls[2]).toBe("출발 전에 공식 안내를 다시 확인하세요.");
    if (second.status !== "completed") return;
    expect(second.segments[0].reused).toBe(true);
    expect(second.segments[1].reused).toBe(false);
    expect(second.timelineStatus).toBe("created");
  });

  it("reuses identical generation including volatile provenance and conflicts on different WAV", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    mkdirSync(packageRoot, { recursive: true });
    const wav1 = pcmWav(1);
    const wav2 = pcmWav(2);
    const provider = new FakeTtsProvider({
      "다낭 효도여행은 일정이 여유롭습니다.": wav1,
      "출발 전에 공식 안내를 다시 확인하세요.": wav2,
    });
    const probe = createProbe({ "segment-0001": 1000, "segment-0002": 2000 });
    const profile = resolveTtsProfile("standard-ko-development");
    const input = {
      packageRoot,
      candidateId: "dev-tts-a6-verification",
      segments: SEGMENTS,
      profile,
      durationProbe: probe,
      provider,
    };

    const first = await generateNarrationMasterTimeline({
      ...input,
      now: new Date("2026-09-03T00:00:00.000Z"),
    });
    const second = await generateNarrationMasterTimeline({
      ...input,
      now: new Date("2026-09-03T00:05:00.000Z"),
    });
    expect(first.status).toBe("completed");
    expect(second.status).toBe("completed");
    if (first.status !== "completed" || second.status !== "completed") return;
    expect(provider.calls).toHaveLength(2);
    expect(second.segments.every((segment) => segment.reused)).toBe(true);
    expect(second.timelineStatus).toBe("reused");
    const persisted = JSON.parse(readFileSync(join(packageRoot, TTS_TIMELINE_RELATIVE_PATH), "utf8"));
    expect(persisted.generatedAt).toBe("2026-09-03T00:00:00.000Z");

    const other = new FakeTtsProvider({
      "다른 나레이션입니다.": pcmWav(9),
      "출발 전에 공식 안내를 다시 확인하세요.": wav2,
    });
    await expect(
      generateNarrationMasterTimeline({
        ...input,
        provider: other,
        segments: [
          { segmentId: "hook", narrationText: "다른 나레이션입니다." },
          SEGMENTS[1],
        ],
      }),
    ).rejects.toBeInstanceOf(MarketingAssetConflictError);
    expect(readFileSync(join(packageRoot, ttsOrderedSegmentAudioRelativePath(1))).equals(wav1)).toBe(true);
  });

  it("CLI dry-run plans ordered Korean segments without network or files", async () => {
    const options = parseGenerateNarrationTimelineArgs(["--fixture", "--dry-run"]);
    const result = await runGenerateNarrationTimelineCommand({ options });
    expect(result.dryRun).toBe(true);
    expect(result.network).toBe(false);
    expect(result.filesystem).toBe(false);
    expect(result.authoritativeClock).toBe("persisted_wav_ffprobe");
    expect(result.segments).toEqual([
      { ordinal: 1, segmentId: "hook", text: "다낭 효도여행은 일정이 여유롭습니다." },
      { ordinal: 2, segmentId: "close", text: "출발 전에 공식 안내를 다시 확인하세요." },
    ]);
  });
});

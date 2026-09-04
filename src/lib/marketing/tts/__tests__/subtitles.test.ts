import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { MarketingAssetConflictError } from "@/lib/marketing/assets/errors";
import { sha256Buffer } from "@/lib/marketing/assets/hashing";
import { TtsError } from "@/lib/marketing/tts/errors";
import { formatSrtTimestamp } from "@/lib/marketing/tts/subtitles/format";
import {
  parseGenerateMarketingSubtitlesArgs,
  runGenerateMarketingSubtitlesCommand,
} from "@/lib/marketing/tts/subtitles/cli";
import {
  generateSubtitlesFromTimelinePackage,
  readAudioMasterTimelineFromPackage,
} from "@/lib/marketing/tts/subtitles/orchestrate";
import { persistSubtitlesSrt } from "@/lib/marketing/tts/subtitles/persist";
import { normalizeSrtText, renderSrtFromTimeline, TTS_SUBTITLES_RELATIVE_PATH } from "@/lib/marketing/tts/subtitles/render";
import { parseAudioMasterTimeline } from "@/lib/marketing/tts/subtitles/validate";
import type { AudioMasterTimeline } from "@/lib/marketing/tts/timeline/contracts";
import { TTS_TIMELINE_RELATIVE_PATH } from "@/lib/marketing/tts/timeline/contracts";
import { persistAudioMasterTimeline } from "@/lib/marketing/tts/timeline/persist";

const tempDirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "subtitles-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const SHA = "a".repeat(64);

function makeTimeline(overrides: Partial<AudioMasterTimeline> = {}): AudioMasterTimeline {
  return {
    contract: "audio-master-timeline-v1",
    candidateId: "dev-tts-a6-verification",
    profileId: "standard-ko-development",
    authoritativeClock: "persisted_wav_ffprobe",
    pauseMs: 250,
    trailingPauseMs: 0,
    totalDurationMs: 7216,
    generatedAt: "2026-09-03T08:44:27.448Z",
    segments: [
      {
        segmentId: "hook",
        ordinal: 1,
        text: "다낭 효도여행은 일정이 여유롭습니다.",
        relativeAudioPath: "reel/audio/segment-0001.wav",
        relativeGenerationPath: "reel/audio/segment-0001.generation.json",
        audioSha256: SHA,
        startMs: 0,
        durationMs: 3204,
        endMs: 3204,
      },
      {
        segmentId: "close",
        ordinal: 2,
        text: "출발 전에 공식 안내를 다시 확인하세요.",
        relativeAudioPath: "reel/audio/segment-0002.wav",
        relativeGenerationPath: "reel/audio/segment-0002.generation.json",
        audioSha256: "b".repeat(64),
        startMs: 3454,
        durationMs: 3762,
        endMs: 7216,
      },
    ],
    ...overrides,
  };
}

describe("SRT timestamp formatter", () => {
  it("converts integer milliseconds with integer arithmetic", () => {
    expect(formatSrtTimestamp(0)).toBe("00:00:00,000");
    expect(formatSrtTimestamp(3204)).toBe("00:00:03,204");
    expect(formatSrtTimestamp(3454)).toBe("00:00:03,454");
    expect(formatSrtTimestamp(7216)).toBe("00:00:07,216");
    expect(formatSrtTimestamp(3_600_000)).toBe("01:00:00,000");
    expect(formatSrtTimestamp(25 * 3_600_000)).toBe("25:00:00,000");
  });

  it("rejects negative and non-integer millisecond values", () => {
    expect(() => formatSrtTimestamp(-1)).toThrow(TtsError);
    expect(() => formatSrtTimestamp(1.5)).toThrow(TtsError);
    expect(() => formatSrtTimestamp(Number.NaN)).toThrow(TtsError);
  });
});

describe("SRT rendering from timeline", () => {
  it("renders one cue from startMs/endMs only", () => {
    const timeline = makeTimeline({
      totalDurationMs: 3204,
      segments: [makeTimeline().segments[0]],
    });
    const srt = renderSrtFromTimeline(timeline);
    expect(srt).toBe("1\n00:00:00,000 --> 00:00:03,204\n다낭 효도여행은 일정이 여유롭습니다.\n\n");
    expect(srt).not.toContain("00:00:03,454");
  });

  it("renders two cues with the 250ms natural gap and no trailing cue", () => {
    const srt = renderSrtFromTimeline(makeTimeline());
    expect(srt).toBe(
      [
        "1",
        "00:00:00,000 --> 00:00:03,204",
        "다낭 효도여행은 일정이 여유롭습니다.",
        "",
        "2",
        "00:00:03,454 --> 00:00:07,216",
        "출발 전에 공식 안내를 다시 확인하세요.",
        "",
        "",
      ].join("\n"),
    );
    expect(srt.endsWith("\n")).toBe(true);
    expect(srt.startsWith("1\n")).toBe(true);
    expect(srt).toContain("\n2\n");
    expect(srt).not.toContain("\n3\n");
  });

  it("preserves Korean text and punctuation, and normalizes CRLF", () => {
    const timeline = makeTimeline({
      totalDurationMs: 1000,
      segments: [
        {
          ...makeTimeline().segments[0],
          text: "  다낭, 효도여행!\r\n확인하세요.  ",
          durationMs: 1000,
          endMs: 1000,
        },
      ],
    });
    const srt = renderSrtFromTimeline(timeline);
    expect(srt).toContain("다낭, 효도여행!\n확인하세요.");
    expect(srt).not.toContain("\r");
    expect(normalizeSrtText("  a \r\n b  ")).toBe("a \n b");
  });

  it("uses timeline start/end and does not rebuild starts from durationMs", () => {
    const timeline = makeTimeline({
      totalDurationMs: 5000,
      segments: [
        { ...makeTimeline().segments[0], startMs: 100, durationMs: 400, endMs: 500 },
        { ...makeTimeline().segments[1], ordinal: 2, startMs: 900, durationMs: 4100, endMs: 5000 },
      ],
    });
    const srt = renderSrtFromTimeline(timeline);
    expect(srt).toContain("00:00:00,100 --> 00:00:00,500");
    expect(srt).toContain("00:00:00,900 --> 00:00:05,000");
    expect(srt).not.toContain("00:00:00,000 -->");
    expect(srt).not.toContain("00:00:00,650");
  });
});

describe("timeline validation for SRT", () => {
  it("rejects zero duration, endMs mismatch, overlap, and unsupported contracts", () => {
    const zero = makeTimeline({
      totalDurationMs: 3204,
      segments: [{ ...makeTimeline().segments[0], durationMs: 0, endMs: 0 }],
    });
    expect(() => renderSrtFromTimeline(zero)).toThrow(/malformed|durationMs|invalid_timeline/);

    const mismatch = makeTimeline({
      segments: [
        { ...makeTimeline().segments[0], startMs: 0, durationMs: 3204, endMs: 3000 },
        makeTimeline().segments[1],
      ],
    });
    expect(() => renderSrtFromTimeline(mismatch)).toThrow(TtsError);

    const overlap = makeTimeline({
      totalDurationMs: 5000,
      segments: [
        { ...makeTimeline().segments[0], startMs: 0, durationMs: 2000, endMs: 2000 },
        { ...makeTimeline().segments[1], startMs: 1500, durationMs: 3500, endMs: 5000 },
      ],
    });
    expect(() => renderSrtFromTimeline(overlap)).toThrow(/overlap/);

    try {
      parseAudioMasterTimeline({ ...makeTimeline(), contract: "audio-master-timeline-v0" });
      throw new Error("expected unsupported_timeline");
    } catch (error) {
      expect((error as TtsError).code).toBe("unsupported_timeline");
    }
  });

  it("rejects negative start times at the formatter/render boundary", () => {
    const negative = makeTimeline({
      totalDurationMs: 1000,
      segments: [{ ...makeTimeline().segments[0], startMs: -1, durationMs: 1001, endMs: 1000 }],
    });
    expect(() => renderSrtFromTimeline(negative)).toThrow(TtsError);
  });
});

describe("subtitle persistence", () => {
  it("writes reel/subtitles.srt, reuses identical bytes, and conflicts on different SRT", () => {
    const packageRoot = join(tempRoot(), "pkg");
    mkdirSync(packageRoot, { recursive: true });
    persistAudioMasterTimeline({
      packageRoot,
      timeline: makeTimeline(),
      createdAt: "2026-09-03T00:00:00.000Z",
    });

    const first = generateSubtitlesFromTimelinePackage({
      packageRoot,
      createdAt: "2026-09-03T00:00:00.000Z",
    });
    const second = generateSubtitlesFromTimelinePackage({
      packageRoot,
      createdAt: "2026-09-03T00:05:00.000Z",
    });
    expect(first.status).toBe("created");
    expect(second.status).toBe("reused");
    expect(first.sha256).toBe(second.sha256);
    expect(first.srt).toBe(second.srt);
    expect(first.relativePath).toBe(TTS_SUBTITLES_RELATIVE_PATH);

    const absolute = join(packageRoot, TTS_SUBTITLES_RELATIVE_PATH);
    expect(readFileSync(absolute, "utf8")).toBe(first.srt);
    expect(sha256Buffer(first.srt)).toBe(first.sha256);

    expect(() =>
      persistSubtitlesSrt({
        packageRoot,
        srt: "1\n00:00:00,000 --> 00:00:01,000\n다른 자막\n\n",
        createdAt: "2026-09-03T00:00:00.000Z",
      }),
    ).toThrow(MarketingAssetConflictError);
    expect(readFileSync(absolute, "utf8")).toBe(first.srt);
  });

  it("fails cleanly when timeline.json is missing and does not write SRT", () => {
    const packageRoot = join(tempRoot(), "pkg");
    mkdirSync(join(packageRoot, "reel"), { recursive: true });
    expect(() => generateSubtitlesFromTimelinePackage({ packageRoot })).toThrow(TtsError);
    try {
      generateSubtitlesFromTimelinePackage({ packageRoot });
    } catch (error) {
      expect((error as TtsError).code).toBe("timeline_missing");
    }
    expect(() => readFileSync(join(packageRoot, TTS_SUBTITLES_RELATIVE_PATH))).toThrow();
  });

  it("rejects an unsupported timeline contract without writing SRT", () => {
    const packageRoot = join(tempRoot(), "pkg");
    mkdirSync(join(packageRoot, "reel"), { recursive: true });
    writeFileSync(
      join(packageRoot, TTS_TIMELINE_RELATIVE_PATH),
      `${JSON.stringify({ contract: "not-a-timeline", segments: [] }, null, 2)}\n`,
    );
    try {
      readAudioMasterTimelineFromPackage(packageRoot);
      throw new Error("expected unsupported_timeline");
    } catch (error) {
      expect((error as TtsError).code).toBe("unsupported_timeline");
    }
    expect(() => generateSubtitlesFromTimelinePackage({ packageRoot })).toThrow(TtsError);
    expect(() => readFileSync(join(packageRoot, TTS_SUBTITLES_RELATIVE_PATH))).toThrow();
  });
});

describe("subtitle CLI", () => {
  it("parses gated flags and dry-runs without writing SRT", () => {
    const parsed = parseGenerateMarketingSubtitlesArgs([
      "--package-root",
      "/tmp/pkg",
      "--dry-run",
      "--confirm-dev",
    ]);
    expect(parsed).toEqual({
      packageRoot: "/tmp/pkg",
      dryRun: true,
      confirmDev: true,
    });

    const packageRoot = join(tempRoot(), "pkg");
    mkdirSync(packageRoot, { recursive: true });
    persistAudioMasterTimeline({
      packageRoot,
      timeline: makeTimeline(),
      createdAt: "2026-09-03T00:00:00.000Z",
    });

    const dry = runGenerateMarketingSubtitlesCommand({
      options: { packageRoot, dryRun: true, confirmDev: true },
    });
    expect(dry.dryRun).toBe(true);
    expect(dry.network).toBe(false);
    expect(dry.filesystem).toBe(false);
    expect(() => readFileSync(join(packageRoot, TTS_SUBTITLES_RELATIVE_PATH))).toThrow();
  });
});

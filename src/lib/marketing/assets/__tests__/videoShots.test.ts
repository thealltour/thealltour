import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { MarketingAssetConflictError, VideoShotError } from "@/lib/marketing/assets/errors";
import { sha256Buffer, stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { writePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import type { MediaBrief } from "@/lib/marketing/assets/contracts";
import {
  parseGenerateMarketingVideoShotsArgs,
  runGenerateMarketingVideoShotsCommand,
} from "@/lib/marketing/assets/video/cli";
import { createA8VerificationBrief } from "@/lib/marketing/assets/video/fixture";
import { buildAiVideoShotList, parseAiVideoShotList } from "@/lib/marketing/assets/video/map";
import { generateAiVideoShotPack } from "@/lib/marketing/assets/video/orchestrate";
import {
  AI_VIDEO_PROMPT_PACK_RELATIVE_PATH,
  AI_VIDEO_SHOT_LIST_RELATIVE_PATH,
  MEDIA_BRIEF_RELATIVE_PATH,
  aiVideoShotPromptRelativePath,
} from "@/lib/marketing/assets/video/paths";
import { persistAiVideoShotPack } from "@/lib/marketing/assets/video/persist";
import { AI_VIDEO_NEGATIVE_CONSTRAINTS } from "@/lib/marketing/assets/video/prompts";
import { TtsError } from "@/lib/marketing/tts/errors";
import type { AudioMasterTimeline } from "@/lib/marketing/tts/timeline/contracts";
import { TTS_TIMELINE_RELATIVE_PATH } from "@/lib/marketing/tts/timeline/contracts";
import { persistAudioMasterTimeline } from "@/lib/marketing/tts/timeline/persist";

const tempDirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "video-shots-"));
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

function persistBrief(packageRoot: string, brief: MediaBrief): void {
  writePackageArtifact({
    packageRoot,
    createdAt: "2026-09-03T00:00:00.000Z",
    planned: {
      relativePath: MEDIA_BRIEF_RELATIVE_PATH,
      content: stableJsonBytes(brief),
      kind: "media_brief",
      origin: "media_brief",
      mediaType: "application/json",
    },
  });
}

function persistPackage(brief: MediaBrief = createA8VerificationBrief(), timeline: AudioMasterTimeline = makeTimeline()) {
  const packageRoot = join(tempRoot(), "pkg");
  mkdirSync(packageRoot, { recursive: true });
  persistBrief(packageRoot, brief);
  persistAudioMasterTimeline({
    packageRoot,
    timeline,
    createdAt: "2026-09-03T00:00:00.000Z",
  });
  return packageRoot;
}

function a8Files(packageRoot: string): string[] {
  return [
    join(packageRoot, AI_VIDEO_SHOT_LIST_RELATIVE_PATH),
    join(packageRoot, AI_VIDEO_PROMPT_PACK_RELATIVE_PATH),
    join(packageRoot, aiVideoShotPromptRelativePath(1)),
    join(packageRoot, aiVideoShotPromptRelativePath(2)),
  ];
}

describe("AI video shot mapping", () => {
  it("maps one narration segment to one shot with timeline timing", () => {
    const brief = createA8VerificationBrief();
    brief.formats.shortform.narrationSegments = [brief.formats.shortform.narrationSegments[0]];
    const timeline = makeTimeline({
      totalDurationMs: 3204,
      segments: [makeTimeline().segments[0]],
    });
    const { shotList, prompts } = buildAiVideoShotList({ mediaBrief: brief, timeline });
    expect(shotList.shots).toHaveLength(1);
    expect(shotList.aspectRatio).toBe("9:16");
    expect(shotList.timingSource).toBe("reel/timeline.json");
    expect(shotList.shots[0]).toMatchObject({
      shotId: "shot-0001",
      ordinal: 1,
      narrationSegmentId: "hook",
      startMs: 0,
      durationMs: 3204,
      endMs: 3204,
      promptRelativePath: "reel/prompts/shot-0001.txt",
    });
    expect(prompts).toHaveLength(1);
  });

  it("maps two segments in order and keeps the 250ms natural gap", () => {
    const { shotList } = buildAiVideoShotList({
      mediaBrief: createA8VerificationBrief(),
      timeline: makeTimeline(),
    });
    expect(shotList.shots.map((shot) => shot.shotId)).toEqual(["shot-0001", "shot-0002"]);
    expect(shotList.shots[0]).toMatchObject({ startMs: 0, durationMs: 3204, endMs: 3204 });
    expect(shotList.shots[1]).toMatchObject({ startMs: 3454, durationMs: 3762, endMs: 7216 });
    expect(shotList.shots[1].startMs - shotList.shots[0].endMs).toBe(250);
    expect(shotList.shots[1].startMs).not.toBe(shotList.shots[0].endMs);
  });

  it("copies timing from the timeline and does not rebuild starts from durationMs", () => {
    const timeline = makeTimeline({
      totalDurationMs: 5000,
      segments: [
        { ...makeTimeline().segments[0], startMs: 100, durationMs: 400, endMs: 500 },
        { ...makeTimeline().segments[1], startMs: 900, durationMs: 4100, endMs: 5000 },
      ],
    });
    const { shotList } = buildAiVideoShotList({ mediaBrief: createA8VerificationBrief(), timeline });
    expect(shotList.shots[0].startMs).toBe(100);
    expect(shotList.shots[1].startMs).toBe(900);
    expect(shotList.shots[1].startMs).not.toBe(100 + 400);
    expect(shotList.shots[1].startMs).not.toBe(500);
  });

  it("preserves Korean narration and mandatory visual constraints", () => {
    const { prompts, shotList } = buildAiVideoShotList({
      mediaBrief: createA8VerificationBrief(),
      timeline: makeTimeline(),
    });
    expect(shotList.shots[0].narrationText).toBe("다낭 효도여행은 일정이 여유롭습니다.");
    const prompt = prompts[0].prompt;
    expect(prompt).toContain("다낭 효도여행은 일정이 여유롭습니다.");
    expect(prompt).toContain("9:16");
    for (const constraint of AI_VIDEO_NEGATIVE_CONSTRAINTS) {
      expect(prompt).toContain(constraint);
    }
    expect(prompt).not.toMatch(/\/home\/|\/mnt\/|OMNIVOICE|API_KEY/);
  });
});

describe("AI video shot validation", () => {
  it("rejects unsupported and missing timelines without writing a pack", () => {
    const packageRoot = join(tempRoot(), "pkg");
    mkdirSync(join(packageRoot, "reel"), { recursive: true });
    persistBrief(packageRoot, createA8VerificationBrief());
    try {
      generateAiVideoShotPack({ packageRoot });
      throw new Error("expected timeline_missing");
    } catch (error) {
      expect((error as TtsError).code).toBe("timeline_missing");
    }
    expect(a8Files(packageRoot).some((path) => existsSync(path))).toBe(false);

    writeFileSync(join(packageRoot, TTS_TIMELINE_RELATIVE_PATH), `${JSON.stringify({ contract: "not-a-timeline" })}\n`);
    try {
      generateAiVideoShotPack({ packageRoot });
      throw new Error("expected unsupported_timeline");
    } catch (error) {
      expect((error as TtsError).code).toBe("unsupported_timeline");
    }
    expect(a8Files(packageRoot).some((path) => existsSync(path))).toBe(false);
  });

  it("rejects a missing MediaBrief without writing a pack", () => {
    const packageRoot = persistPackage();
    rmSync(join(packageRoot, MEDIA_BRIEF_RELATIVE_PATH));
    try {
      generateAiVideoShotPack({ packageRoot });
      throw new Error("expected media_brief_missing");
    } catch (error) {
      expect((error as VideoShotError).code).toBe("media_brief_missing");
    }
    expect(a8Files(packageRoot).some((path) => existsSync(path))).toBe(false);
  });

  it("rejects narration/timeline mismatch without writing a pack", () => {
    const brief = createA8VerificationBrief();
    brief.formats.shortform.narrationSegments[1].narrationText = "다른 나레이션";
    const packageRoot = persistPackage(brief);
    try {
      generateAiVideoShotPack({ packageRoot });
      throw new Error("expected narration_mismatch");
    } catch (error) {
      expect((error as VideoShotError).code).toBe("narration_mismatch");
    }
    expect(a8Files(packageRoot).some((path) => existsSync(path))).toBe(false);
  });

  it("rejects duplicate or invalid shot identity", () => {
    const { shotList } = buildAiVideoShotList({
      mediaBrief: createA8VerificationBrief(),
      timeline: makeTimeline(),
    });
    expect(() =>
      parseAiVideoShotList({
        ...shotList,
        shots: [shotList.shots[0], { ...shotList.shots[1], shotId: "shot-0001", ordinal: 2 }],
      }),
    ).toThrow(VideoShotError);
    expect(() =>
      parseAiVideoShotList({
        ...shotList,
        shots: [shotList.shots[0], { ...shotList.shots[0], ordinal: 2, shotId: "shot-0002" }],
      }),
    ).toThrow(VideoShotError);
  });
});

describe("AI video shot persistence", () => {
  it("writes a complete pack, reuses identical bytes, and ignores volatile createdAt", () => {
    const packageRoot = persistPackage();
    const first = generateAiVideoShotPack({
      packageRoot,
      createdAt: "2026-09-03T00:00:00.000Z",
    });
    const second = generateAiVideoShotPack({
      packageRoot,
      createdAt: "2026-09-03T00:05:00.000Z",
    });
    expect(first.status).toBe("created");
    expect(second.status).toBe("reused");
    expect(first.sha256ByPath).toEqual(second.sha256ByPath);
    expect(first.shotCount).toBe(2);

    const shotList = JSON.parse(readFileSync(join(packageRoot, AI_VIDEO_SHOT_LIST_RELATIVE_PATH), "utf8"));
    expect(shotList.generatedAt).toBeUndefined();
    expect(JSON.stringify(shotList)).not.toMatch(/\/home\/|\/mnt\//);
    expect(sha256Buffer(readFileSync(join(packageRoot, AI_VIDEO_SHOT_LIST_RELATIVE_PATH)))).toBe(
      first.sha256ByPath[AI_VIDEO_SHOT_LIST_RELATIVE_PATH],
    );
  });

  it("conflicts on a different existing shot-list without rewriting prompts", () => {
    const packageRoot = persistPackage();
    const created = generateAiVideoShotPack({ packageRoot });
    const prompt1 = readFileSync(join(packageRoot, aiVideoShotPromptRelativePath(1)));
    writeFileSync(join(packageRoot, AI_VIDEO_SHOT_LIST_RELATIVE_PATH), `${JSON.stringify({ contract: "other" }, null, 2)}\n`);
    expect(() => generateAiVideoShotPack({ packageRoot })).toThrow(MarketingAssetConflictError);
    expect(readFileSync(join(packageRoot, aiVideoShotPromptRelativePath(1)))).toEqual(prompt1);
    expect(created.status).toBe("created");
  });

  it("conflicts on a different existing prompt without writing a new shot-list first", () => {
    const packageRoot = persistPackage();
    const { shotList, prompts } = buildAiVideoShotList({
      mediaBrief: createA8VerificationBrief(),
      timeline: makeTimeline(),
    });
    persistAiVideoShotPack({
      packageRoot,
      shotList,
      prompts,
      createdAt: "2026-09-03T00:00:00.000Z",
    });
    writeFileSync(join(packageRoot, aiVideoShotPromptRelativePath(1)), "different prompt\n");
    const beforeList = readFileSync(join(packageRoot, AI_VIDEO_SHOT_LIST_RELATIVE_PATH));
    expect(() => generateAiVideoShotPack({ packageRoot })).toThrow(MarketingAssetConflictError);
    expect(readFileSync(join(packageRoot, AI_VIDEO_SHOT_LIST_RELATIVE_PATH))).toEqual(beforeList);
  });
});

describe("AI video shot CLI", () => {
  it("parses gated flags and dry-runs without writing files or calling a network", () => {
    const parsed = parseGenerateMarketingVideoShotsArgs([
      "--package-root",
      "/tmp/pkg",
      "--dry-run",
      "--fixture",
      "--confirm-dev",
    ]);
    expect(parsed).toEqual({
      packageRoot: "/tmp/pkg",
      dryRun: true,
      fixture: true,
      confirmDev: true,
    });

    const packageRoot = persistPackage();
    rmSync(join(packageRoot, MEDIA_BRIEF_RELATIVE_PATH));
    const dry = runGenerateMarketingVideoShotsCommand({
      options: { packageRoot, dryRun: true, confirmDev: true, fixture: true },
    });
    expect(dry.dryRun).toBe(true);
    expect(dry.network).toBe(false);
    expect(dry.filesystem).toBe(false);
    expect(dry.mediaGeneration).toBe(false);
    expect(a8Files(packageRoot).some((path) => existsSync(path))).toBe(false);
  });
});

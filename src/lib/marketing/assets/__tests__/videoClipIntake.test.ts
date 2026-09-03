import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { MarketingAssetConflictError, VideoClipError } from "@/lib/marketing/assets/errors";
import { sha256Buffer, stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { writePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import type { AiVideoShotList } from "@/lib/marketing/assets/video/contracts";
import { AI_VIDEO_SHOT_LIST_RELATIVE_PATH } from "@/lib/marketing/assets/video/paths";
import {
  AI_VIDEO_ASPECT_RATIO_MAX_RELATIVE_ERROR_PERCENT,
  isPortraitNearNineSixteen,
} from "@/lib/marketing/assets/video/intake/aspect";
import {
  parseIntakeMarketingVideoClipsArgs,
  runIntakeMarketingVideoClipsCommand,
} from "@/lib/marketing/assets/video/intake/cli";
import { VIDEO_CLIP_INTAKE_RELATIVE_PATH } from "@/lib/marketing/assets/video/intake/contracts";
import {
  assertSafeIncomingFileName,
  parseIncomingShotFileName,
  resolveIncomingClipAbsolutePath,
} from "@/lib/marketing/assets/video/intake/incoming";
import { buildCompleteClipIntake, inspectVideoClipIntake } from "@/lib/marketing/assets/video/intake/inspect";
import { intakeVideoClipsFromPackage } from "@/lib/marketing/assets/video/intake/orchestrate";
import { persistVideoClipIntake } from "@/lib/marketing/assets/video/intake/persist";
import {
  createFfprobeIncomingVideoProbe,
  parseFfprobeVideoJson,
  type IncomingVideoMetadata,
  type IncomingVideoProbe,
} from "@/lib/marketing/assets/video/intake/probe";

const tempDirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "clip-intake-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function makeShotList(overrides: Partial<AiVideoShotList> = {}): AiVideoShotList {
  return {
    contract: "ai-video-shot-list-v1",
    candidateId: "dev-tts-a6-verification",
    aspectRatio: "9:16",
    timingSource: "reel/timeline.json",
    authoritativeClock: "persisted_wav_ffprobe",
    pauseMs: 250,
    shots: [
      {
        shotId: "shot-0001",
        ordinal: 1,
        narrationSegmentId: "hook",
        narrationText: "다낭 효도여행은 일정이 여유롭습니다.",
        purpose: "hook",
        visualIntent: "",
        startMs: 0,
        durationMs: 3204,
        endMs: 3204,
        promptRelativePath: "reel/prompts/shot-0001.txt",
        transitionHint: "cut",
        continuityGroup: "primary",
      },
      {
        shotId: "shot-0002",
        ordinal: 2,
        narrationSegmentId: "close",
        narrationText: "출발 전에 공식 안내를 다시 확인하세요.",
        purpose: "close",
        visualIntent: "",
        startMs: 3454,
        durationMs: 3762,
        endMs: 7216,
        promptRelativePath: "reel/prompts/shot-0002.txt",
        transitionHint: "cut",
        continuityGroup: "primary",
      },
    ],
    ...overrides,
  };
}

function persistShotList(packageRoot: string, shotList: AiVideoShotList = makeShotList()): void {
  mkdirSync(packageRoot, { recursive: true });
  writePackageArtifact({
    packageRoot,
    createdAt: "2026-09-03T00:00:00.000Z",
    planned: {
      relativePath: AI_VIDEO_SHOT_LIST_RELATIVE_PATH,
      content: stableJsonBytes(shotList),
      kind: "context",
      origin: "video_shot_planning",
      mediaType: "application/json",
    },
  });
}

function writeIncoming(packageRoot: string, fileName: string, contents = `${fileName}-bytes`): string {
  const absolute = join(packageRoot, "reel", "incoming", fileName);
  mkdirSync(join(packageRoot, "reel", "incoming"), { recursive: true });
  writeFileSync(absolute, contents);
  return absolute;
}

function metadata(overrides: Partial<IncomingVideoMetadata> = {}): IncomingVideoMetadata {
  return {
    sourceDurationMs: 5000,
    codecName: "h264",
    width: 1080,
    height: 1920,
    frameRate: "30/1",
    hasAudio: false,
    ...overrides,
  };
}

function probeWith(byPath: Record<string, IncomingVideoMetadata>): IncomingVideoProbe {
  return {
    async probeIncomingVideo(absolutePath: string) {
      const key = Object.keys(byPath).find((item) => absolutePath.endsWith(item));
      const value = key ? byPath[key] : undefined;
      if (!value) throw new Error(`missing fake probe for ${absolutePath}`);
      return value;
    },
  };
}

function defaultProbe(): IncomingVideoProbe {
  return {
    async probeIncomingVideo(absolutePath: string) {
      if (absolutePath.endsWith("shot-0001.mp4")) {
        return metadata({ sourceDurationMs: 5000, hasAudio: true });
      }
      if (absolutePath.endsWith("shot-0002.mp4")) {
        return metadata({ sourceDurationMs: 3762, width: 720, height: 1280 });
      }
      return metadata();
    },
  };
}

describe("incoming filename mapping", () => {
  it("maps stem to shotId exactly", () => {
    expect(parseIncomingShotFileName("shot-0001.mp4")).toEqual({ shotId: "shot-0001", extension: "mp4" });
    expect(parseIncomingShotFileName("shot-0002.mov")).toEqual({ shotId: "shot-0002", extension: "mov" });
    expect(parseIncomingShotFileName("shot-0001.webm")?.shotId).toBe("shot-0001");
    expect(parseIncomingShotFileName("shot-0001.mkv")?.shotId).toBe("shot-0001");
    expect(parseIncomingShotFileName("clip-0001.mp4")).toBeNull();
  });

  it("rejects path escape names", () => {
    expect(() => assertSafeIncomingFileName("../shot-0001.mp4")).toThrow(VideoClipError);
    expect(() =>
      resolveIncomingClipAbsolutePath({ packageRoot: "/tmp/pkg", fileName: "../audio/shot-0001.mp4" }),
    ).toThrow(VideoClipError);
  });
});

describe("aspect ratio tolerance", () => {
  it("accepts 1080x1920, 720x1280, and the 3% boundary", () => {
    expect(isPortraitNearNineSixteen(1080, 1920)).toBe(true);
    expect(isPortraitNearNineSixteen(720, 1280)).toBe(true);
    expect(AI_VIDEO_ASPECT_RATIO_MAX_RELATIVE_ERROR_PERCENT).toBe(3);
    expect(isPortraitNearNineSixteen(1080, 1865)).toBe(true);
    expect(isPortraitNearNineSixteen(1080, 1860)).toBe(false);
    expect(isPortraitNearNineSixteen(1920, 1080)).toBe(false);
    expect(isPortraitNearNineSixteen(1080, 1440)).toBe(false);
  });
});

describe("ffprobe video JSON parsing", () => {
  it("parses duration, codec, dimensions, frame rate, and audio presence", () => {
    const parsed = parseFfprobeVideoJson(
      JSON.stringify({
        streams: [
          { codec_type: "video", codec_name: "h264", width: 1080, height: 1920, avg_frame_rate: "30/1" },
          { codec_type: "audio", codec_name: "aac" },
        ],
        format: { duration: "3.204" },
      }),
    );
    expect(parsed).toEqual({
      sourceDurationMs: 3204,
      codecName: "h264",
      width: 1080,
      height: 1920,
      frameRate: "30/1",
      hasAudio: true,
    });
  });

  it("rejects malformed JSON, missing video, multiple video streams, and invalid duration", () => {
    expect(() => parseFfprobeVideoJson("not-json")).toThrow(VideoClipError);
    expect(() =>
      parseFfprobeVideoJson(JSON.stringify({ streams: [{ codec_type: "audio" }], format: { duration: "1" } })),
    ).toThrow(/no video stream/);
    expect(() =>
      parseFfprobeVideoJson(
        JSON.stringify({
          streams: [
            { codec_type: "video", codec_name: "h264", width: 1080, height: 1920 },
            { codec_type: "video", codec_name: "hevc", width: 1080, height: 1920 },
          ],
          format: { duration: "1" },
        }),
      ),
    ).toThrow(/exactly one video stream/);
    expect(() =>
      parseFfprobeVideoJson(
        JSON.stringify({
          streams: [{ codec_type: "video", codec_name: "h264", width: 1080, height: 1920 }],
          format: { duration: "0" },
        }),
      ),
    ).toThrow(VideoClipError);
  });
});

describe("injected incoming video ffprobe process", () => {
  it("classifies timeout, missing binary, and non-zero exit", async () => {
    const dir = mkdtempSync(join(tmpdir(), "clip-probe-"));
    tempDirs.push(dir);
    const absolutePath = join(dir, "shot-0001.mp4");
    writeFileSync(absolutePath, "bytes");

    await expect(
      createFfprobeIncomingVideoProbe({
        execFile: async () => {
          const error = new Error("timeout") as Error & { killed: boolean; code: string };
          error.killed = true;
          error.code = "ERR_TIMEOUT";
          throw error;
        },
      }).probeIncomingVideo(absolutePath),
    ).rejects.toMatchObject({ code: "clip_probe_timeout" });

    await expect(
      createFfprobeIncomingVideoProbe({
        execFile: async () => {
          const error = new Error("spawn ffprobe ENOENT") as Error & { code: string };
          error.code = "ENOENT";
          throw error;
        },
      }).probeIncomingVideo(absolutePath),
    ).rejects.toMatchObject({ code: "clip_probe_unavailable" });

    await expect(
      createFfprobeIncomingVideoProbe({
        execFile: async () => {
          const error = new Error("Command failed") as Error & { code: number };
          error.code = 1;
          throw error;
        },
      }).probeIncomingVideo(absolutePath),
    ).rejects.toMatchObject({ code: "clip_probe_failed" });
  });
});

describe("video clip intake", () => {
  it("accepts one valid clip and copies target timing from the shot list", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    persistShotList(packageRoot, makeShotList({ shots: [makeShotList().shots[0]] }));
    const path = writeIncoming(packageRoot, "shot-0001.mp4", "clip-one");
    const before = lstatSync(path);
    const inspection = await inspectVideoClipIntake({
      packageRoot,
      probe: probeWith({
        "shot-0001.mp4": metadata({ sourceDurationMs: 3204 }),
      }),
    });
    expect(inspection.complete).toBe(true);
    expect(inspection.clips).toHaveLength(1);
    expect(inspection.clips[0]).toMatchObject({
      shotId: "shot-0001",
      targetStartMs: 0,
      targetEndMs: 3204,
      targetDurationMs: 3204,
      sourceDurationMs: 3204,
      trimRequired: false,
      sourceByteSize: "clip-one".length,
      sourceSha256: sha256Buffer("clip-one"),
    });
    expect(inspection.clips[0].sourceDurationMs).toBe(inspection.clips[0].targetDurationMs);
    expect(lstatSync(path).mtimeMs).toBe(before.mtimeMs);
    expect(readFileSync(path, "utf8")).toBe("clip-one");
  });

  it("completes two ordered shots, marks trimRequired when source is longer, and allows source audio", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    persistShotList(packageRoot);
    writeIncoming(packageRoot, "shot-0001.mp4", "one");
    writeIncoming(packageRoot, "shot-0002.mp4", "two");
    writeIncoming(packageRoot, "notes.txt", "ignore me");
    const result = await intakeVideoClipsFromPackage({
      packageRoot,
      persist: true,
      probe: defaultProbe(),
      createdAt: "2026-09-03T00:00:00.000Z",
    });
    expect(result.complete).toBe(true);
    expect(result.status).toBe("created");
    expect(result.inspection.unmatched).toEqual(["reel/incoming/notes.txt"]);
    expect(result.inspection.clips[0]).toMatchObject({
      shotId: "shot-0001",
      sourceDurationMs: 5000,
      targetDurationMs: 3204,
      trimRequired: true,
      hasAudio: true,
      width: 1080,
      height: 1920,
    });
    expect(result.inspection.clips[1]).toMatchObject({
      shotId: "shot-0002",
      sourceDurationMs: 3762,
      targetDurationMs: 3762,
      trimRequired: false,
      width: 720,
      height: 1280,
    });
    expect(result.inspection.clips[0].targetDurationMs).not.toBe(result.inspection.clips[0].sourceDurationMs);
    expect(existsSync(join(packageRoot, VIDEO_CLIP_INTAKE_RELATIVE_PATH))).toBe(true);
  });

  it("reports missing clips and does not write clip-intake.json", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    persistShotList(packageRoot);
    const result = await intakeVideoClipsFromPackage({ packageRoot, persist: true, probe: defaultProbe() });
    expect(result.complete).toBe(false);
    expect(result.persisted).toBe(false);
    expect(result.inspection.missing).toEqual(["shot-0001", "shot-0002"]);
    expect(existsSync(join(packageRoot, VIDEO_CLIP_INTAKE_RELATIVE_PATH))).toBe(false);
  });

  it("rejects duplicate clips for the same shot", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    persistShotList(packageRoot, makeShotList({ shots: [makeShotList().shots[0]] }));
    writeIncoming(packageRoot, "shot-0001.mp4", "a");
    writeIncoming(packageRoot, "shot-0001.mov", "b");
    const inspection = await inspectVideoClipIntake({ packageRoot, probe: defaultProbe() });
    expect(inspection.complete).toBe(false);
    expect(inspection.ambiguous[0]?.shotId).toBe("shot-0001");
  });

  it("rejects unsupported extension, symlink, shorter duration, and landscape", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    persistShotList(packageRoot, makeShotList({ shots: [makeShotList().shots[0]] }));
    writeIncoming(packageRoot, "shot-0001.avi", "avi");
    const avi = await inspectVideoClipIntake({ packageRoot, probe: defaultProbe() });
    expect(avi.invalid.some((item) => item.code === "unsupported_extension")).toBe(true);
    expect(existsSync(join(packageRoot, VIDEO_CLIP_INTAKE_RELATIVE_PATH))).toBe(false);

    rmSync(join(packageRoot, "reel/incoming/shot-0001.avi"));
    const target = writeIncoming(packageRoot, "source.mp4", "real");
    symlinkSync(target, join(packageRoot, "reel/incoming/shot-0001.mp4"));
    const linked = await inspectVideoClipIntake({ packageRoot, probe: defaultProbe() });
    expect(linked.invalid.some((item) => item.code === "symlink")).toBe(true);

    rmSync(join(packageRoot, "reel/incoming/shot-0001.mp4"));
    writeIncoming(packageRoot, "shot-0001.mp4", "short");
    const shortClip = await inspectVideoClipIntake({
      packageRoot,
      probe: probeWith({ "shot-0001.mp4": metadata({ sourceDurationMs: 1000 }) }),
    });
    expect(shortClip.invalid[0]?.reason).toMatch(/shorter/);

    const landscape = await inspectVideoClipIntake({
      packageRoot,
      probe: probeWith({ "shot-0001.mp4": metadata({ width: 1920, height: 1080, sourceDurationMs: 4000 }) }),
    });
    expect(landscape.invalid[0]?.reason).toMatch(/portrait|9:16/);
  });

  it("classifies injected ffprobe process failures", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    persistShotList(packageRoot, makeShotList({ shots: [makeShotList().shots[0]] }));
    writeIncoming(packageRoot, "shot-0001.mp4", "x");
    const timeout = await inspectVideoClipIntake({
      packageRoot,
      probe: {
        async probeIncomingVideo() {
          throw new VideoClipError("clip_probe_timeout", "ffprobe timed out after 25ms");
        },
      },
    });
    expect(timeout.invalid[0]?.code).toBe("clip_probe_timeout");
    const failed = await inspectVideoClipIntake({
      packageRoot,
      probe: {
        async probeIncomingVideo() {
          throw new VideoClipError("clip_probe_failed", "ffprobe exited unsuccessfully");
        },
      },
    });
    expect(failed.invalid[0]?.code).toBe("clip_probe_failed");
    const unavailable = await inspectVideoClipIntake({
      packageRoot,
      probe: {
        async probeIncomingVideo() {
          throw new VideoClipError("clip_probe_unavailable", "ffprobe executable was not found");
        },
      },
    });
    expect(unavailable.invalid[0]?.code).toBe("clip_probe_unavailable");
  });

  it("reuses identical complete intake and conflicts on different bytes", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    persistShotList(packageRoot);
    writeIncoming(packageRoot, "shot-0001.mp4", "one");
    writeIncoming(packageRoot, "shot-0002.mp4", "two");
    const first = await intakeVideoClipsFromPackage({
      packageRoot,
      persist: true,
      probe: defaultProbe(),
      createdAt: "2026-09-03T00:00:00.000Z",
    });
    const second = await intakeVideoClipsFromPackage({
      packageRoot,
      persist: true,
      probe: defaultProbe(),
      createdAt: "2026-09-03T00:05:00.000Z",
    });
    expect(first.status).toBe("created");
    expect(second.status).toBe("reused");
    expect(first.sha256).toBe(second.sha256);
    expect(JSON.parse(readFileSync(join(packageRoot, VIDEO_CLIP_INTAKE_RELATIVE_PATH), "utf8")).generatedAt).toBeUndefined();

    const intake = buildCompleteClipIntake(first.inspection);
    expect(() =>
      persistVideoClipIntake({
        packageRoot,
        intake: { ...intake, candidateId: "other-candidate" },
        createdAt: "2026-09-03T00:00:00.000Z",
      }),
    ).toThrow(MarketingAssetConflictError);
  });
});

describe("clip intake CLI", () => {
  it("dry-runs missing clips without writing or using a network", async () => {
    const parsed = parseIntakeMarketingVideoClipsArgs(["--package-root", "/tmp/pkg", "--dry-run"]);
    expect(parsed).toEqual({ packageRoot: "/tmp/pkg", dryRun: true, confirmDev: false });
    const packageRoot = join(tempRoot(), "pkg");
    persistShotList(packageRoot);
    const dry = await runIntakeMarketingVideoClipsCommand({
      options: { packageRoot, dryRun: true, confirmDev: true },
      probe: defaultProbe(),
    });
    expect(dry.dryRun).toBe(true);
    expect(dry.network).toBe(false);
    expect(dry.filesystem).toBe(false);
    expect(dry.complete).toBe(false);
    expect(existsSync(join(packageRoot, VIDEO_CLIP_INTAKE_RELATIVE_PATH))).toBe(false);
  });
});

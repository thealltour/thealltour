import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { MarketingAssetConflictError, VideoPreviewError } from "@/lib/marketing/assets/errors";
import { sha256Buffer, sha256FileSync, stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { writePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import type { AiVideoShotList } from "@/lib/marketing/assets/video/contracts";
import { AI_VIDEO_SHOT_LIST_RELATIVE_PATH } from "@/lib/marketing/assets/video/paths";
import { persistVideoClipIntake } from "@/lib/marketing/assets/video/intake/persist";
import type { VideoClipIntake } from "@/lib/marketing/assets/video/intake/contracts";
import {
  parseComposeMarketingVideoPreviewArgs,
  runComposeMarketingVideoPreviewCommand,
} from "@/lib/marketing/assets/video/preview/cli";
import {
  VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH,
  VIDEO_PREVIEW_RELATIVE_PATH,
} from "@/lib/marketing/assets/video/preview/contracts";
import { buildPreviewFilterComplex } from "@/lib/marketing/assets/video/preview/graph";
import {
  composeVideoPreviewFromPackage,
  createFfmpegRunner,
  type FfmpegRunner,
} from "@/lib/marketing/assets/video/preview/orchestrate";
import {
  assertPreviewOutputMetadata,
  parseFfprobePreviewJson,
  type PreviewOutputMetadata,
  type PreviewOutputProbe,
} from "@/lib/marketing/assets/video/preview/outputProbe";
import {
  VIDEO_PREVIEW_DURATION_QA_TOLERANCE_MS,
  VIDEO_PREVIEW_GAP_POLICY,
  VIDEO_PREVIEW_PROFILE,
  VIDEO_PREVIEW_SUBTITLE_MODE,
} from "@/lib/marketing/assets/video/preview/profile";
import { inspectVideoPreviewReadiness } from "@/lib/marketing/assets/video/preview/readiness";
import { persistAudioMasterTimeline } from "@/lib/marketing/tts/timeline/persist";
import { buildAudioMasterTimeline } from "@/lib/marketing/tts/timeline/build";
import type { AudioMasterTimeline } from "@/lib/marketing/tts/timeline/contracts";
import { persistSubtitlesSrt } from "@/lib/marketing/tts/subtitles/persist";
import { renderSrtFromTimeline } from "@/lib/marketing/tts/subtitles/render";

const tempDirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "video-preview-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const HOOK = "다낭 효도여행은 일정이 여유롭습니다.";
const CLOSE = "출발 전에 공식 안내를 다시 확인하세요.";

function writeBytes(packageRoot: string, relativePath: string, contents: string): string {
  const absolute = join(packageRoot, ...relativePath.split("/"));
  mkdirSync(join(absolute, ".."), { recursive: true });
  writeFileSync(absolute, contents);
  return absolute;
}

function makeTimeline(packageRoot: string, wavHashes: [string, string]): AudioMasterTimeline {
  return buildAudioMasterTimeline({
    candidateId: "dev-tts-a6-verification",
    profileId: "standard-ko-development",
    generatedAt: "2026-09-03T00:00:00.000Z",
    segments: [
      {
        segmentId: "hook",
        ordinal: 1,
        text: HOOK,
        relativeAudioPath: "reel/audio/segment-0001.wav",
        relativeGenerationPath: "reel/audio/segment-0001.generation.json",
        audioSha256: wavHashes[0],
        durationMs: 3204,
      },
      {
        segmentId: "close",
        ordinal: 2,
        text: CLOSE,
        relativeAudioPath: "reel/audio/segment-0002.wav",
        relativeGenerationPath: "reel/audio/segment-0002.generation.json",
        audioSha256: wavHashes[1],
        durationMs: 3762,
      },
    ],
  });
}

function makeShotList(): AiVideoShotList {
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
        narrationText: HOOK,
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
        narrationText: CLOSE,
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
  };
}

function makeIntake(clipHashes: Array<{ sha256: string; size: number }>): VideoClipIntake {
  return {
    contract: "video-clip-intake-v1",
    candidateId: "dev-tts-a6-verification",
    shotListRelativePath: "reel/shot-list.json",
    aspectRatio: "9:16",
    complete: true,
    clips: [
      {
        shotId: "shot-0001",
        ordinal: 1,
        sourceRelativePath: "reel/incoming/shot-0001.mp4",
        sourceSha256: clipHashes[0].sha256,
        sourceByteSize: clipHashes[0].size,
        codecName: "h264",
        width: 1080,
        height: 1920,
        sourceDurationMs: 5000,
        targetStartMs: 0,
        targetEndMs: 3204,
        targetDurationMs: 3204,
        trimRequired: true,
        frameRate: "30/1",
        hasAudio: true,
      },
      {
        shotId: "shot-0002",
        ordinal: 2,
        sourceRelativePath: "reel/incoming/shot-0002.mp4",
        sourceSha256: clipHashes[1].sha256,
        sourceByteSize: clipHashes[1].size,
        codecName: "h264",
        width: 720,
        height: 1280,
        sourceDurationMs: 3762,
        targetStartMs: 3454,
        targetEndMs: 7216,
        targetDurationMs: 3762,
        trimRequired: false,
        frameRate: "30/1",
        hasAudio: true,
      },
    ],
  };
}

function seedPackage(packageRoot: string, options?: { skipIntake?: boolean; oneShot?: boolean }): {
  clip1: string;
  wav1: string;
} {
  mkdirSync(packageRoot, { recursive: true });
  const clip1 = writeBytes(packageRoot, "reel/incoming/shot-0001.mp4", "clip-one");
  const clip2 = writeBytes(packageRoot, "reel/incoming/shot-0002.mp4", "clip-two");
  const wav1 = writeBytes(packageRoot, "reel/audio/segment-0001.wav", "wav-one");
  const wav2 = writeBytes(packageRoot, "reel/audio/segment-0002.wav", "wav-two");
  const timeline = options?.oneShot
    ? buildAudioMasterTimeline({
        candidateId: "dev-tts-a6-verification",
        profileId: "standard-ko-development",
        generatedAt: "2026-09-03T00:00:00.000Z",
        segments: [
          {
            segmentId: "hook",
            ordinal: 1,
            text: HOOK,
            relativeAudioPath: "reel/audio/segment-0001.wav",
            relativeGenerationPath: "reel/audio/segment-0001.generation.json",
            audioSha256: sha256FileSync(wav1),
            durationMs: 3204,
          },
        ],
      })
    : makeTimeline(packageRoot, [sha256FileSync(wav1), sha256FileSync(wav2)]);
  persistAudioMasterTimeline({ packageRoot, timeline, createdAt: timeline.generatedAt });
  const shotList = options?.oneShot ? { ...makeShotList(), shots: [makeShotList().shots[0]] } : makeShotList();
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
  persistSubtitlesSrt({
    packageRoot,
    srt: renderSrtFromTimeline(timeline),
    createdAt: "2026-09-03T00:00:00.000Z",
  });
  if (!options?.skipIntake) {
    const intake = options?.oneShot
      ? { ...makeIntake([{ sha256: sha256FileSync(clip1), size: "clip-one".length }, { sha256: sha256FileSync(clip2), size: "clip-two".length }]), clips: [makeIntake([{ sha256: sha256FileSync(clip1), size: "clip-one".length }, { sha256: sha256FileSync(clip2), size: "clip-two".length }]).clips[0]] }
      : makeIntake([
          { sha256: sha256FileSync(clip1), size: "clip-one".length },
          { sha256: sha256FileSync(clip2), size: "clip-two".length },
        ]);
    persistVideoClipIntake({ packageRoot, intake, createdAt: "2026-09-03T00:00:00.000Z" });
  }
  return { clip1, wav1 };
}

function validOutput(totalDurationMs: number): PreviewOutputMetadata {
  return {
    durationMs: totalDurationMs,
    videoCodec: "h264",
    width: 720,
    height: 1280,
    frameRate: "30/1",
    hasAudio: true,
    audioCodec: "aac",
    hasSubtitle: true,
    subtitleCodec: "mov_text",
  };
}

function fakeFfmpeg(calls: string[][] = []): FfmpegRunner {
  return {
    async run(args) {
      calls.push([...args]);
      const output = args[args.length - 1];
      if (typeof output === "string") writeFileSync(output, "fake-preview-mp4");
    },
  };
}

function fakeProbe(metadata: PreviewOutputMetadata = validOutput(7216)): PreviewOutputProbe {
  return {
    async probePreview() {
      return metadata;
    },
  };
}

describe("preview graph policy", () => {
  it("trims to target duration, holds the previous frame across the 250ms gap, and does not burn subtitles", () => {
    expect(VIDEO_PREVIEW_PROFILE).toMatchObject({
      width: 720,
      height: 1280,
      fps: 30,
      gapPolicy: VIDEO_PREVIEW_GAP_POLICY,
      subtitleMode: VIDEO_PREVIEW_SUBTITLE_MODE,
    });
    expect(VIDEO_PREVIEW_DURATION_QA_TOLERANCE_MS).toBe(Math.ceil(1000 / 30));

    const one = buildPreviewFilterComplex({
      shots: [{ targetStartMs: 0, targetDurationMs: 3204, gapAfterMs: 0 }],
      narration: [{ startMs: 0, durationMs: 3204 }],
      totalDurationMs: 3204,
    });
    expect(one).toContain("trim=start=0:duration=3.204");
    expect(one).not.toContain("5.000");
    expect(one).not.toContain("tpad=stop_mode=clone");
    expect(one).toContain("adelay=0|0");
    expect(one).toContain("force_original_aspect_ratio=decrease");
    expect(one).toContain("pad=720:1280");
    expect(one).toContain("fps=30");
    expect(one).not.toMatch(/subtitles=/);
    expect(one).not.toMatch(/\bass=/);
    expect(one).not.toMatch(/drawtext/);

    const two = buildPreviewFilterComplex({
      shots: [
        { targetStartMs: 0, targetDurationMs: 3204, gapAfterMs: 250 },
        { targetStartMs: 3454, targetDurationMs: 3762, gapAfterMs: 0 },
      ],
      narration: [
        { startMs: 0, durationMs: 3204 },
        { startMs: 3454, durationMs: 3762 },
      ],
      totalDurationMs: 7216,
    });
    expect(two).toContain("tpad=stop_mode=clone:stop_duration=0.250");
    expect(two).toContain("adelay=3454|3454");
    expect(two).toContain("amix=inputs=2:duration=longest:dropout_transition=0:normalize=0");
    expect(two.match(/tpad=stop_mode=clone/g)?.length).toBe(1);
  });
});

describe("preview output QA parsing", () => {
  it("accepts h264 720x1280 30fps AAC mov_text within one-frame tolerance", () => {
    const parsed = parseFfprobePreviewJson(
      JSON.stringify({
        streams: [
          { codec_type: "video", codec_name: "h264", width: 720, height: 1280, avg_frame_rate: "30/1" },
          { codec_type: "audio", codec_name: "aac" },
          { codec_type: "subtitle", codec_name: "mov_text" },
        ],
        format: { duration: "7.216" },
      }),
    );
    expect(parsed.durationMs).toBe(7216);
    assertPreviewOutputMetadata({ metadata: parsed, totalDurationMs: 7216 });
  });

  it("rejects missing video, missing audio, missing subtitles, and duration outside tolerance", () => {
    expect(() => parseFfprobePreviewJson("not-json")).toThrow(VideoPreviewError);
    expect(() =>
      parseFfprobePreviewJson(
        JSON.stringify({
          streams: [{ codec_type: "audio", codec_name: "aac" }],
          format: { duration: "1" },
        }),
      ),
    ).toThrow(/missing a video stream/);
    expect(() =>
      assertPreviewOutputMetadata({
        metadata: { ...validOutput(7216), hasAudio: false, audioCodec: null },
        totalDurationMs: 7216,
      }),
    ).toThrow(/canonical AAC/);
    expect(() =>
      assertPreviewOutputMetadata({
        metadata: { ...validOutput(7216), hasSubtitle: false, subtitleCodec: null },
        totalDurationMs: 7216,
      }),
    ).toThrow(/soft mov_text/);
    expect(() =>
      assertPreviewOutputMetadata({
        metadata: { ...validOutput(7216), durationMs: 7216 + VIDEO_PREVIEW_DURATION_QA_TOLERANCE_MS + 1 },
        totalDurationMs: 7216,
      }),
    ).toThrow(/tolerance/);
  });
});

describe("video preview composer", () => {
  it("reports missing clip-intake as not ready and writes nothing", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    seedPackage(packageRoot, { skipIntake: true });
    const result = await composeVideoPreviewFromPackage({
      packageRoot,
      persist: true,
      ffmpeg: fakeFfmpeg(),
      outputProbe: fakeProbe(),
    });
    expect(result).toMatchObject({ ready: false, reason: "clip_intake_missing", ffmpegInvoked: false });
    expect(existsSync(join(packageRoot, VIDEO_PREVIEW_RELATIVE_PATH))).toBe(false);
    expect(existsSync(join(packageRoot, VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH))).toBe(false);
  });

  it("rejects incomplete or unsupported clip-intake", () => {
    const packageRoot = join(tempRoot(), "pkg");
    seedPackage(packageRoot, { skipIntake: true });
    writeBytes(
      packageRoot,
      "reel/clip-intake.json",
      JSON.stringify({ contract: "video-clip-intake-v0", complete: false, clips: [] }),
    );
    expect(() => inspectVideoPreviewReadiness(packageRoot)).toThrow(/video-clip-intake-v1/);
  });

  it("plans one shot and two ordered shots without replacing target timing", async () => {
    const oneRoot = join(tempRoot(), "one");
    seedPackage(oneRoot, { oneShot: true });
    const one = inspectVideoPreviewReadiness(oneRoot);
    expect(one.ready).toBe(true);
    if (one.ready) {
      expect(one.plan.sources).toHaveLength(1);
      expect(one.plan.sources[0].targetDurationMs).toBe(3204);
      expect(one.plan.totalDurationMs).toBe(3204);
    }

    const twoRoot = join(tempRoot(), "two");
    seedPackage(twoRoot);
    const two = inspectVideoPreviewReadiness(twoRoot);
    expect(two.ready).toBe(true);
    if (two.ready) {
      expect(two.plan.sources.map((item) => item.shotId)).toEqual(["shot-0001", "shot-0002"]);
      expect(two.plan.sources[0].targetDurationMs).toBe(3204);
      expect(two.plan.filterShots[0].gapAfterMs).toBe(250);
      expect(two.plan.filterShots[1].gapAfterMs).toBe(0);
      expect(two.plan.narration[1].startMs).toBe(3454);
    }
  });

  it("renders a complete preview, ignores clip audio in the graph, and records no absolute paths", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    const seeded = seedPackage(packageRoot);
    const before = lstatSync(seeded.clip1);
    const calls: string[][] = [];
    const result = await composeVideoPreviewFromPackage({
      packageRoot,
      persist: true,
      ffmpeg: fakeFfmpeg(calls),
      outputProbe: fakeProbe(),
      createdAt: "2026-09-03T00:00:00.000Z",
    });
    expect(result.status).toBe("created");
    expect(result.ffmpegInvoked).toBe(true);
    expect(calls[0]?.join(" ")).toContain("-c:s mov_text");
    expect(calls[0]?.join(" ")).not.toMatch(/subtitles=/);
    expect(existsSync(join(packageRoot, VIDEO_PREVIEW_RELATIVE_PATH))).toBe(true);
    const composition = JSON.parse(readFileSync(join(packageRoot, VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH), "utf8"));
    expect(composition.contract).toBe("video-preview-composition-v1");
    expect(composition.generatedAt).toBeUndefined();
    expect(JSON.stringify(composition)).not.toContain(packageRoot);
    expect(composition.profile.gapPolicy).toBe("hold_previous_frame");
    expect(composition.profile.subtitleMode).toBe("soft_track");
    expect(composition.sources[0].targetDurationMs).toBe(3204);
    expect(lstatSync(seeded.clip1).mtimeMs).toBe(before.mtimeMs);
    expect(readFileSync(seeded.clip1, "utf8")).toBe("clip-one");
  });

  it("rejects source hash, size, narration hash, timing, and subtitle drift", () => {
    const packageRoot = join(tempRoot(), "pkg");
    seedPackage(packageRoot);
    writeBytes(packageRoot, "reel/incoming/shot-0001.mp4", "changed-bytes-same?");
    expect(() => inspectVideoPreviewReadiness(packageRoot)).toThrow(VideoPreviewError);

    const sizeRoot = join(tempRoot(), "size");
    seedPackage(sizeRoot);
    writeBytes(sizeRoot, "reel/incoming/shot-0001.mp4", "clip-one-plus");
    expect(() => inspectVideoPreviewReadiness(sizeRoot)).toThrow(/byte size/);

    const hashRoot = join(tempRoot(), "hash");
    seedPackage(hashRoot);
    writeBytes(hashRoot, "reel/incoming/shot-0001.mp4", "clip-xxx");
    try {
      inspectVideoPreviewReadiness(hashRoot);
      throw new Error("expected hash mismatch");
    } catch (error) {
      expect(error).toBeInstanceOf(VideoPreviewError);
      expect((error as VideoPreviewError).code === "source_hash_mismatch" || (error as VideoPreviewError).code === "source_size_mismatch").toBe(true);
    }

    const wavRoot = join(tempRoot(), "wav");
    seedPackage(wavRoot);
    writeBytes(wavRoot, "reel/audio/segment-0001.wav", "wav-changed");
    expect(() => inspectVideoPreviewReadiness(wavRoot)).toThrow(/Narration WAV SHA256/);

    const timingRoot = join(tempRoot(), "timing");
    seedPackage(timingRoot);
    const shotList = makeShotList();
    shotList.shots[0].durationMs = 3000;
    shotList.shots[0].endMs = 3000;
    writeFileSync(join(timingRoot, AI_VIDEO_SHOT_LIST_RELATIVE_PATH), stableJsonBytes(shotList));
    expect(() => inspectVideoPreviewReadiness(timingRoot)).toThrow(VideoPreviewError);

    const srtRoot = join(tempRoot(), "srt");
    seedPackage(srtRoot);
    writeBytes(srtRoot, "reel/subtitles.srt", "1\n00:00:00,000 --> 00:00:01,000\nchanged\n");
    expect(() => inspectVideoPreviewReadiness(srtRoot)).toThrow(/subtitles\.srt/);
  });

  it("classifies ffmpeg process failures and cleans temp output", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    seedPackage(packageRoot);
    await expect(
      composeVideoPreviewFromPackage({
        packageRoot,
        persist: true,
        ffmpeg: createFfmpegRunner({
          execFile: async () => {
            const error = new Error("spawn ffmpeg ENOENT") as Error & { code: string };
            error.code = "ENOENT";
            throw error;
          },
        }),
        outputProbe: fakeProbe(),
      }),
    ).rejects.toMatchObject({ code: "ffmpeg_unavailable" });

    await expect(
      composeVideoPreviewFromPackage({
        packageRoot,
        persist: true,
        ffmpeg: createFfmpegRunner({
          execFile: async () => {
            const error = new Error("timeout") as Error & { killed: boolean; code: string };
            error.killed = true;
            error.code = "ERR_TIMEOUT";
            throw error;
          },
        }),
        outputProbe: fakeProbe(),
      }),
    ).rejects.toMatchObject({ code: "ffmpeg_timeout" });

    await expect(
      composeVideoPreviewFromPackage({
        packageRoot,
        persist: true,
        ffmpeg: createFfmpegRunner({
          execFile: async () => {
            const error = new Error("failed") as Error & { code: number };
            error.code = 1;
            throw error;
          },
        }),
        outputProbe: fakeProbe(),
      }),
    ).rejects.toMatchObject({ code: "ffmpeg_failed" });

    const previewDir = join(packageRoot, "reel", "preview");
    if (existsSync(previewDir)) {
      expect(readdirSync(previewDir).some((name) => name.includes(".tmp"))).toBe(false);
    }
    expect(existsSync(join(packageRoot, VIDEO_PREVIEW_RELATIVE_PATH))).toBe(false);
  });

  it("rejects invalid output metadata and does not publish canonical preview", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    seedPackage(packageRoot);
    await expect(
      composeVideoPreviewFromPackage({
        packageRoot,
        persist: true,
        ffmpeg: fakeFfmpeg(),
        outputProbe: fakeProbe({ ...validOutput(7216), videoCodec: "mpeg4" }),
      }),
    ).rejects.toMatchObject({ code: "preview_qa_failed" });
    expect(existsSync(join(packageRoot, VIDEO_PREVIEW_RELATIVE_PATH))).toBe(false);
    expect(existsSync(join(packageRoot, VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH))).toBe(false);
  });

  it("reuses an identical complete preview without invoking FFmpeg, and conflicts on a changed plan", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    seedPackage(packageRoot);
    const calls: string[][] = [];
    const ffmpeg = fakeFfmpeg(calls);
    const first = await composeVideoPreviewFromPackage({
      packageRoot,
      persist: true,
      ffmpeg,
      outputProbe: fakeProbe(),
      createdAt: "2026-09-03T00:00:00.000Z",
    });
    const previewPath = join(packageRoot, VIDEO_PREVIEW_RELATIVE_PATH);
    const before = lstatSync(previewPath);
    const second = await composeVideoPreviewFromPackage({
      packageRoot,
      persist: true,
      ffmpeg,
      outputProbe: fakeProbe(),
      createdAt: "2026-09-03T00:05:00.000Z",
    });
    expect(first.status).toBe("created");
    expect(second.status).toBe("reused");
    expect(second.ffmpegInvoked).toBe(false);
    expect(calls).toHaveLength(1);
    expect(lstatSync(previewPath).mtimeMs).toBe(before.mtimeMs);
  });

  it("conflicts when existing composition does not match the current package plan", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    seedPackage(packageRoot);
    await composeVideoPreviewFromPackage({
      packageRoot,
      persist: true,
      ffmpeg: fakeFfmpeg(),
      outputProbe: fakeProbe(),
      createdAt: "2026-09-03T00:00:00.000Z",
    });
    const compositionPath = join(packageRoot, VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH);
    const composition = JSON.parse(readFileSync(compositionPath, "utf8"));
    composition.candidateId = "other-candidate";
    writeFileSync(compositionPath, `${JSON.stringify(composition, null, 2)}\n`);
    await expect(
      composeVideoPreviewFromPackage({
        packageRoot,
        persist: true,
        ffmpeg: fakeFfmpeg(),
        outputProbe: fakeProbe(),
      }),
    ).rejects.toBeInstanceOf(MarketingAssetConflictError);
    expect(readFileSync(join(packageRoot, VIDEO_PREVIEW_RELATIVE_PATH), "utf8")).toBe("fake-preview-mp4");
  });

  it("rejects orphan preview or composition files", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    seedPackage(packageRoot);
    writeBytes(packageRoot, VIDEO_PREVIEW_RELATIVE_PATH, "orphan-preview");
    await expect(
      composeVideoPreviewFromPackage({
        packageRoot,
        persist: true,
        ffmpeg: fakeFfmpeg(),
        outputProbe: fakeProbe(),
      }),
    ).rejects.toMatchObject({ code: "preview_orphan" });
  });

  it("detects a preview hash mismatch against composition.json", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    seedPackage(packageRoot);
    await composeVideoPreviewFromPackage({
      packageRoot,
      persist: true,
      ffmpeg: fakeFfmpeg(),
      outputProbe: fakeProbe(),
      createdAt: "2026-09-03T00:00:00.000Z",
    });
    writeBytes(packageRoot, VIDEO_PREVIEW_RELATIVE_PATH, "tampered-preview");
    await expect(
      composeVideoPreviewFromPackage({
        packageRoot,
        persist: true,
        ffmpeg: fakeFfmpeg(),
        outputProbe: fakeProbe(),
      }),
    ).rejects.toMatchObject({ code: "preview_orphan" });
  });
});

describe("preview CLI", () => {
  it("dry-runs a missing clip-intake without FFmpeg, network, or TTS", async () => {
    const parsed = parseComposeMarketingVideoPreviewArgs(["--package-root", "/tmp/pkg", "--dry-run"]);
    expect(parsed).toEqual({ packageRoot: "/tmp/pkg", dryRun: true, confirmDev: false });
    const packageRoot = join(tempRoot(), "pkg");
    seedPackage(packageRoot, { skipIntake: true });
    const dry = await runComposeMarketingVideoPreviewCommand({
      options: { packageRoot, dryRun: true, confirmDev: true },
      ffmpeg: fakeFfmpeg(),
      outputProbe: fakeProbe(),
    });
    expect(dry).toMatchObject({
      dryRun: true,
      network: false,
      tts: false,
      ffmpeg: false,
      ready: false,
      reason: "clip_intake_missing",
    });
    expect(existsSync(join(packageRoot, VIDEO_PREVIEW_RELATIVE_PATH))).toBe(false);
  });
});

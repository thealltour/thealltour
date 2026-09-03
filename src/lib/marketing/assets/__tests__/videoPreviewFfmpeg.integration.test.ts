import { mkdtempSync, mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { sha256FileSync } from "@/lib/marketing/assets/hashing";
import { composeVideoPreviewFromPackage } from "@/lib/marketing/assets/video/preview/orchestrate";
import { createFfprobePreviewOutputProbe } from "@/lib/marketing/assets/video/preview/outputProbe";
import { persistVideoClipIntake } from "@/lib/marketing/assets/video/intake/persist";
import { writePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { AI_VIDEO_SHOT_LIST_RELATIVE_PATH } from "@/lib/marketing/assets/video/paths";
import { persistAudioMasterTimeline } from "@/lib/marketing/tts/timeline/persist";
import { buildAudioMasterTimeline } from "@/lib/marketing/tts/timeline/build";
import { persistSubtitlesSrt } from "@/lib/marketing/tts/subtitles/persist";
import { renderSrtFromTimeline } from "@/lib/marketing/tts/subtitles/render";
import { VIDEO_PREVIEW_RELATIVE_PATH } from "@/lib/marketing/assets/video/preview/contracts";
import { runFfmpeg } from "@/lib/marketing/assets/ffmpeg/exec";

const enabled = process.env.A10_FFMPEG_INTEGRATION === "1";
const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe.skipIf(!enabled)("preview ffmpeg integration (A10_FFMPEG_INTEGRATION=1)", () => {
  it(
    "composes two tiny color fixtures with narration audio and a soft subtitle track",
    async () => {
    const packageRoot = mkdtempSync(join(tmpdir(), "a10-ffmpeg-it-"));
    tempDirs.push(packageRoot);
    mkdirSync(join(packageRoot, "reel", "incoming"), { recursive: true });
    mkdirSync(join(packageRoot, "reel", "audio"), { recursive: true });

    const clip1 = join(packageRoot, "reel/incoming/shot-0001.mp4");
    const clip2 = join(packageRoot, "reel/incoming/shot-0002.mp4");
    const wav1 = join(packageRoot, "reel/audio/segment-0001.wav");
    const wav2 = join(packageRoot, "reel/audio/segment-0002.wav");

    await runFfmpeg({
      args: ["-hide_banner", "-nostdin", "-y", "-f", "lavfi", "-i", "color=c=red:s=720x1280:d=1", "-pix_fmt", "yuv420p", "-t", "1", clip1],
    });
    await runFfmpeg({
      args: ["-hide_banner", "-nostdin", "-y", "-f", "lavfi", "-i", "color=c=blue:s=720x1280:d=1", "-pix_fmt", "yuv420p", "-t", "1", clip2],
    });
    await runFfmpeg({
      args: ["-hide_banner", "-nostdin", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "0.400", "-c:a", "pcm_s16le", wav1],
    });
    await runFfmpeg({
      args: ["-hide_banner", "-nostdin", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "0.400", "-c:a", "pcm_s16le", wav2],
    });

    const timeline = buildAudioMasterTimeline({
      candidateId: "a10-ffmpeg-fixture",
      profileId: "standard-ko-development",
      generatedAt: "2026-09-03T00:00:00.000Z",
      segments: [
        {
          segmentId: "hook",
          ordinal: 1,
          text: "첫번째 테스트 클립입니다.",
          relativeAudioPath: "reel/audio/segment-0001.wav",
          relativeGenerationPath: "reel/audio/segment-0001.generation.json",
          audioSha256: sha256FileSync(wav1),
          durationMs: 400,
        },
        {
          segmentId: "close",
          ordinal: 2,
          text: "두번째 테스트 클립입니다.",
          relativeAudioPath: "reel/audio/segment-0002.wav",
          relativeGenerationPath: "reel/audio/segment-0002.generation.json",
          audioSha256: sha256FileSync(wav2),
          durationMs: 400,
        },
      ],
    });
    persistAudioMasterTimeline({ packageRoot, timeline, createdAt: timeline.generatedAt });
    writePackageArtifact({
      packageRoot,
      createdAt: timeline.generatedAt,
      planned: {
        relativePath: AI_VIDEO_SHOT_LIST_RELATIVE_PATH,
        content: stableJsonBytes({
          contract: "ai-video-shot-list-v1",
          candidateId: "a10-ffmpeg-fixture",
          aspectRatio: "9:16",
          timingSource: "reel/timeline.json",
          authoritativeClock: "persisted_wav_ffprobe",
          pauseMs: 250,
          shots: timeline.segments.map((segment, index) => ({
            shotId: `shot-${String(index + 1).padStart(4, "0")}`,
            ordinal: index + 1,
            narrationSegmentId: segment.segmentId,
            narrationText: segment.text,
            purpose: segment.segmentId,
            visualIntent: "",
            startMs: segment.startMs,
            durationMs: segment.durationMs,
            endMs: segment.endMs,
            promptRelativePath: `reel/prompts/shot-${String(index + 1).padStart(4, "0")}.txt`,
            transitionHint: "cut",
            continuityGroup: "primary",
          })),
        }),
        kind: "context",
        origin: "video_shot_planning",
        mediaType: "application/json",
      },
    });
    persistSubtitlesSrt({
      packageRoot,
      srt: renderSrtFromTimeline(timeline),
      createdAt: timeline.generatedAt,
    });
    persistVideoClipIntake({
      packageRoot,
      createdAt: timeline.generatedAt,
      intake: {
        contract: "video-clip-intake-v1",
        candidateId: "a10-ffmpeg-fixture",
        shotListRelativePath: "reel/shot-list.json",
        aspectRatio: "9:16",
        complete: true,
        clips: [
          {
            shotId: "shot-0001",
            ordinal: 1,
            sourceRelativePath: "reel/incoming/shot-0001.mp4",
            sourceSha256: sha256FileSync(clip1),
            sourceByteSize: statSync(clip1).size,
            codecName: "h264",
            width: 720,
            height: 1280,
            sourceDurationMs: 1000,
            targetStartMs: 0,
            targetEndMs: 400,
            targetDurationMs: 400,
            trimRequired: true,
            frameRate: "25/1",
            hasAudio: false,
          },
          {
            shotId: "shot-0002",
            ordinal: 2,
            sourceRelativePath: "reel/incoming/shot-0002.mp4",
            sourceSha256: sha256FileSync(clip2),
            sourceByteSize: statSync(clip2).size,
            codecName: "h264",
            width: 720,
            height: 1280,
            sourceDurationMs: 1000,
            targetStartMs: 650,
            targetEndMs: 1050,
            targetDurationMs: 400,
            trimRequired: true,
            frameRate: "25/1",
            hasAudio: false,
          },
        ],
      },
    });

    const result = await composeVideoPreviewFromPackage({ packageRoot, persist: true });
    expect(result.status).toBe("created");
    const previewPath = join(packageRoot, VIDEO_PREVIEW_RELATIVE_PATH);
    const metadata = await createFfprobePreviewOutputProbe().probePreview(previewPath);
    expect(metadata.width).toBe(720);
    expect(metadata.height).toBe(1280);
    expect(metadata.hasAudio).toBe(true);
    expect(metadata.hasSubtitle).toBe(true);
    expect(Math.abs(metadata.durationMs - 1050)).toBeLessThanOrEqual(34);
  },
  60_000,
);
});

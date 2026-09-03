import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createFfprobeIncomingVideoProbe } from "@/lib/marketing/assets/video/intake/probe";
import { VideoClipError } from "@/lib/marketing/assets/errors";

const enabled = process.env.A9_FFPROBE_INTEGRATION === "1";
const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe.skipIf(!enabled)("incoming video ffprobe integration (A9_FFPROBE_INTEGRATION=1)", () => {
  it("rejects a non-video file through the real ffprobe process", async () => {
    const dir = mkdtempSync(join(tmpdir(), "clip-ffprobe-it-"));
    tempDirs.push(dir);
    const path = join(dir, "not-a-video.mp4");
    writeFileSync(path, "this is not a video");
    await expect(createFfprobeIncomingVideoProbe().probeIncomingVideo(path)).rejects.toBeInstanceOf(VideoClipError);
  });
});

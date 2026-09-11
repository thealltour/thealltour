import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ShortformProductionError } from "@/lib/marketing/assets/shortform/production/errors";
import {
  assertLocalMediaInsideAllowedRoot,
  isRemoteOrDataRemotionMediaSrc,
  stageTravelShortInfoMediaForRemotion,
} from "@/lib/marketing/assets/shortform/production/remotion/mediaSrc";

function tempRoots() {
  const root = mkdtempSync(join(tmpdir(), "sv8c3d5-"));
  const jobDir = join(root, "jobs", "svr_test");
  const sourceDir = join(jobDir, "source");
  const publicDir = join(jobDir, "render", "remotion-public");
  mkdirSync(sourceDir, { recursive: true });
  mkdirSync(publicDir, { recursive: true });
  return { root, jobDir, sourceDir, publicDir };
}

describe("Remotion local media staging (SV-8C3-D5)", () => {
  it("maps absolute workspace media into publicDir-relative src (not raw absolute / not localhost absolute)", () => {
    const { jobDir, sourceDir, publicDir } = tempRoots();
    const absolute = join(sourceDir, "scene-001.mp4");
    writeFileSync(absolute, Buffer.from("video-bytes"));
    const staged = stageTravelShortInfoMediaForRemotion({
      props: {
        scenes: [
          {
            sceneId: "scene-001",
            durationFrames: 30,
            mediaKind: "video",
            mediaSrc: absolute,
          },
        ],
      },
      publicDir,
      allowedRoot: jobDir,
    });
    expect(staged.scenes[0]!.mediaSrc).toBe("media/scene-001.mp4");
    expect(staged.scenes[0]!.mediaSrc.startsWith("/")).toBe(false);
    expect(staged.scenes[0]!.mediaSrc).not.toMatch(/^https?:\/\//);
    expect(staged.scenes[0]!.mediaSrc).not.toContain(jobDir);
    expect(existsSync(join(publicDir, "media/scene-001.mp4"))).toBe(true);
    expect(readFileSync(join(publicDir, "media/scene-001.mp4"))).toEqual(Buffer.from("video-bytes"));
  });

  it("does not put raw absolute filesystem path into browser media reference", () => {
    const { jobDir, sourceDir, publicDir } = tempRoots();
    const absolute = join(sourceDir, "clip.mp4");
    writeFileSync(absolute, Buffer.from("x"));
    const staged = stageTravelShortInfoMediaForRemotion({
      props: {
        scenes: [
          {
            sceneId: "scene-001",
            durationFrames: 10,
            mediaKind: "video",
            mediaSrc: absolute,
          },
        ],
      },
      publicDir,
      allowedRoot: jobDir,
    });
    const ref = staged.scenes[0]!.mediaSrc;
    expect(ref.includes("/home/")).toBe(false);
    expect(ref.includes(absolute)).toBe(false);
    expect(ref.startsWith("file:")).toBe(false);
  });

  it("rejects local paths outside allowed workspace root", () => {
    const { jobDir, publicDir } = tempRoots();
    const outside = join(tmpdir(), `sv8c3d5-out-${Date.now()}.mp4`);
    writeFileSync(outside, Buffer.from("x"));
    expect(() =>
      stageTravelShortInfoMediaForRemotion({
        props: {
          scenes: [
            {
              sceneId: "scene-001",
              durationFrames: 10,
              mediaKind: "video",
              mediaSrc: outside,
            },
          ],
        },
        publicDir,
        allowedRoot: jobDir,
      }),
    ).toThrow(ShortformProductionError);
    expect(() =>
      assertLocalMediaInsideAllowedRoot({ mediaSrc: outside, allowedRoot: jobDir }),
    ).toThrow(ShortformProductionError);
  });

  it("leaves remote http(s) media URLs unchanged", () => {
    const { jobDir, publicDir } = tempRoots();
    const remote = "https://cdn.example.com/clip.mp4?token=abc";
    const staged = stageTravelShortInfoMediaForRemotion({
      props: {
        scenes: [
          {
            sceneId: "scene-001",
            durationFrames: 10,
            mediaKind: "video",
            mediaSrc: remote,
          },
        ],
      },
      publicDir,
      allowedRoot: jobDir,
    });
    expect(staged.scenes[0]!.mediaSrc).toBe(remote);
    expect(isRemoteOrDataRemotionMediaSrc(remote)).toBe(true);
  });
});

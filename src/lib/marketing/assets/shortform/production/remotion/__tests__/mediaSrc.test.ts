import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ShortformProductionError } from "@/lib/marketing/assets/shortform/production/errors";
import {
  assertLocalMediaInsideAllowedRoot,
  isRemoteOrDataRemotionMediaSrc,
  materializeRegularPublicMediaFile,
  stageTravelShortInfoMediaForRemotion,
} from "@/lib/marketing/assets/shortform/production/remotion/mediaSrc";

function tempRoots() {
  const root = mkdtempSync(join(tmpdir(), "sv8c3d7-"));
  const jobDir = join(root, "jobs", "svr_test");
  const sourceDir = join(jobDir, "source");
  const publicDir = join(jobDir, "render", "remotion-public");
  mkdirSync(sourceDir, { recursive: true });
  mkdirSync(publicDir, { recursive: true });
  return { root, jobDir, sourceDir, publicDir };
}

describe("Remotion regular-file staging (SV-8C3-D7)", () => {
  it("stages absolute workspace media as a regular file (not a symlink)", () => {
    const { jobDir, sourceDir, publicDir } = tempRoots();
    const absolute = join(sourceDir, "scene-001.mp4");
    writeFileSync(absolute, Buffer.from("video-bytes-d7"));
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
    const dest = join(publicDir, "media/scene-001.mp4");
    const st = lstatSync(dest);
    expect(st.isSymbolicLink()).toBe(false);
    expect(st.isFile()).toBe(true);
    expect(readFileSync(dest)).toEqual(Buffer.from("video-bytes-d7"));
    expect(st.size).toBe(absolute.length && Buffer.from("video-bytes-d7").byteLength);
  });

  it("replaces a leftover symlink with a regular file copy", () => {
    const { jobDir, sourceDir, publicDir } = tempRoots();
    const absolute = join(sourceDir, "scene-002.mp4");
    writeFileSync(absolute, Buffer.from("real-bytes"));
    const dest = join(publicDir, "media/scene-002.mp4");
    mkdirSync(join(publicDir, "media"), { recursive: true });
    symlinkSync(absolute, dest);
    expect(lstatSync(dest).isSymbolicLink()).toBe(true);
    materializeRegularPublicMediaFile({ absoluteSource: absolute, destination: dest });
    const st = lstatSync(dest);
    expect(st.isSymbolicLink()).toBe(false);
    expect(st.isFile()).toBe(true);
    expect(readFileSync(dest)).toEqual(Buffer.from("real-bytes"));
  });

  it("does not expose raw absolute path in browser mediaSrc", () => {
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
    expect(ref.startsWith("/")).toBe(false);
  });

  it("rejects local paths outside allowed workspace root", () => {
    const { jobDir, publicDir } = tempRoots();
    const outside = join(tmpdir(), `sv8c3d7-out-${Date.now()}.mp4`);
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
    expect(existsSync(join(publicDir, "media"))).toBe(false);
  });
});

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { ShortformProductionError } from "@/lib/marketing/assets/shortform/production/errors";
import { toRemotionConsumableMediaSrc } from "@/lib/marketing/assets/shortform/production/remotion/mediaSrc";

function tempJobDir(): string {
  const root = mkdtempSync(join(tmpdir(), "sv8c3d5-"));
  const jobDir = join(root, "jobs", "svr_test");
  mkdirSync(join(jobDir, "source"), { recursive: true });
  return jobDir;
}

describe("toRemotionConsumableMediaSrc (SV-8C3-D5)", () => {
  it("maps absolute workspace media path to file:// URL without raw absolute HTTP path", () => {
    const jobDir = tempJobDir();
    const absolute = join(jobDir, "source", "scene-001.mp4");
    writeFileSync(absolute, Buffer.from("x"));
    const src = toRemotionConsumableMediaSrc({ mediaSrc: absolute, allowedRoot: jobDir });
    expect(src).toBe(pathToFileURL(absolute).href);
    expect(src.startsWith("file://")).toBe(true);
    expect(src).not.toMatch(/^https?:\/\//);
    // Must not be origin-relative style that Remotion would turn into localhost:3002/home/...
    expect(src.includes("localhost:3002")).toBe(false);
    expect(src.startsWith("/")).toBe(false);
  });

  it("rejects local paths outside allowed workspace root", () => {
    const jobDir = tempJobDir();
    const outside = join(tmpdir(), "sv8c3d5-outside.mp4");
    writeFileSync(outside, Buffer.from("x"));
    expect(() =>
      toRemotionConsumableMediaSrc({ mediaSrc: outside, allowedRoot: jobDir }),
    ).toThrow(ShortformProductionError);
    try {
      toRemotionConsumableMediaSrc({ mediaSrc: outside, allowedRoot: jobDir });
    } catch (error) {
      expect((error as ShortformProductionError).code).toBe("REMOTION_MEDIA_SRC_FORBIDDEN");
    }
  });

  it("rejects file:// URLs that escape the allowed root", () => {
    const jobDir = tempJobDir();
    const outside = join(tmpdir(), "sv8c3d5-outside2.mp4");
    writeFileSync(outside, Buffer.from("x"));
    expect(() =>
      toRemotionConsumableMediaSrc({
        mediaSrc: pathToFileURL(outside).href,
        allowedRoot: jobDir,
      }),
    ).toThrow(ShortformProductionError);
  });

  it("leaves remote http(s) media URLs unchanged", () => {
    const jobDir = tempJobDir();
    const remote = "https://cdn.example.com/clip.mp4?token=abc";
    expect(
      toRemotionConsumableMediaSrc({ mediaSrc: remote, allowedRoot: jobDir }),
    ).toBe(remote);
    expect(
      toRemotionConsumableMediaSrc({
        mediaSrc: "http://127.0.0.1:3101/v1/managed-sources/x/content",
        allowedRoot: jobDir,
      }),
    ).toBe("http://127.0.0.1:3101/v1/managed-sources/x/content");
  });

  it("rejects relative paths", () => {
    const jobDir = tempJobDir();
    expect(() =>
      toRemotionConsumableMediaSrc({ mediaSrc: "source/scene-001.mp4", allowedRoot: jobDir }),
    ).toThrow(ShortformProductionError);
  });
});

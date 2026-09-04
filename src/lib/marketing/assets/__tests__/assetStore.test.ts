import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  MARKETING_ASSET_GENERATED_DIRECTORIES,
  MARKETING_ASSET_HUMAN_EDITED_DIRECTORY,
  MARKETING_ASSET_PUBLISHED_DIRECTORY,
  assertSafeCandidateId,
  assertSafeRelativeArtifactPath,
  atomicWriteFile,
  byteSize,
  resolveMarketingAssetRoot,
  resolvePackageArtifactPath,
  resolvePackageDirectory,
  sha256Buffer,
  splitBusinessDateParts,
  writePackageArtifact,
} from "@/lib/marketing/assets";
import { MarketingAssetConfigError, MarketingAssetConflictError, MarketingAssetPathError } from "@/lib/marketing/assets/errors";
import { ensurePackageLayout, isPathInside } from "@/lib/marketing/assets/paths";

const tempDirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "marketing-assets-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("marketing asset root", () => {
  it("1. resolves an explicit absolute root and env override, and fails closed when missing", () => {
    const root = tempRoot();
    expect(resolveMarketingAssetRoot({ explicitRoot: root })).toBe(root);
    expect(
      resolveMarketingAssetRoot({
        env: { MARKETING_ASSET_ROOT: root },
      }),
    ).toBe(root);
    expect(() => resolveMarketingAssetRoot({ env: {} })).toThrow(MarketingAssetConfigError);
    expect(() => resolveMarketingAssetRoot({ explicitRoot: "relative/path" })).toThrow(
      /absolute filesystem path/,
    );
  });
});

describe("package paths", () => {
  it("2. builds package path from KST businessDate YYYY/MM/DD", () => {
    const root = tempRoot();
    const packageRoot = resolvePackageDirectory({
      assetRoot: root,
      businessDateKst: "2026-09-03",
      candidateId: "cmc_daily_marketing_plan_2026_09_03",
    });
    expect(packageRoot).toBe(join(root, "2026", "09", "03", "cmc_daily_marketing_plan_2026_09_03"));
    expect(splitBusinessDateParts("2026-09-03")).toEqual({ year: "2026", month: "09", day: "03" });
  });

  it("3. accepts a valid candidateId path segment", () => {
    expect(assertSafeCandidateId("cmc_daily_marketing_plan_2026_09_03")).toBe(
      "cmc_daily_marketing_plan_2026_09_03",
    );
  });

  it("4. rejects ../ candidateId values", () => {
    expect(() => assertSafeCandidateId("../foo")).toThrow(MarketingAssetPathError);
    expect(() =>
      resolvePackageDirectory({
        assetRoot: tempRoot(),
        businessDateKst: "2026-09-03",
        candidateId: "candidate/../../x",
      }),
    ).toThrow(MarketingAssetPathError);
  });

  it("5. rejects absolute path injection in candidateId", () => {
    expect(() => assertSafeCandidateId("/foo")).toThrow(MarketingAssetPathError);
    expect(() => assertSafeCandidateId("C:\\foo")).toThrow(MarketingAssetPathError);
  });

  it("6. rejects artifact path traversal", () => {
    const root = tempRoot();
    const packageRoot = resolvePackageDirectory({
      assetRoot: root,
      businessDateKst: "2026-09-03",
      candidateId: "cmc_safe",
    });
    const hostile = ["../foo", "../../etc/passwd", "/foo", "C:\\foo", "copy/../secret.txt"];
    for (const relativePath of hostile) {
      expect(() => assertSafeRelativeArtifactPath(relativePath)).toThrow(MarketingAssetPathError);
      expect(() => resolvePackageArtifactPath({ packageRoot, relativePath })).toThrow(
        MarketingAssetPathError,
      );
    }
  });

  it("13. keeps the package beneath the configured root", () => {
    const root = tempRoot();
    const packageRoot = resolvePackageDirectory({
      assetRoot: root,
      businessDateKst: "2026-09-03",
      candidateId: "cmc_safe",
    });
    expect(isPathInside(root, packageRoot)).toBe(true);
    expect(packageRoot.startsWith(root)).toBe(true);
  });
});

describe("atomic writes, hashes, idempotency", () => {
  it("7. atomically writes complete files and does not leave tmp siblings", () => {
    const dir = tempRoot();
    const path = join(dir, "manifest.json");
    atomicWriteFile(path, `${JSON.stringify({ ok: true }, null, 2)}\n`);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ ok: true });
    expect(readdirSync(dir).some((name) => name.endsWith(".tmp"))).toBe(false);
  });

  it("8. records the correct SHA-256", () => {
    expect(sha256Buffer("hello")).toBe(createHash("sha256").update("hello").digest("hex"));
    expect(sha256Buffer("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("9. records the correct byte size", () => {
    expect(byteSize("hello")).toBe(5);
    expect(byteSize("한글")).toBe(6);
  });

  it("10. identical repeat writes are idempotent", () => {
    const root = tempRoot();
    const packageRoot = join(root, "pkg");
    mkdirSync(packageRoot, { recursive: true });
    const planned = {
      relativePath: "copy/post.txt",
      content: Buffer.from("same\n", "utf8"),
      kind: "copy" as const,
      origin: "candidate_copy" as const,
      mediaType: "text/plain; charset=utf-8",
    };
    const first = writePackageArtifact({ packageRoot, planned, createdAt: "2026-09-03T00:00:00.000Z" });
    const second = writePackageArtifact({ packageRoot, planned, createdAt: "2026-09-03T00:00:00.000Z" });
    expect(first.status).toBe("created");
    expect(second.status).toBe("reused");
    expect(second.artifact.sha256).toBe(first.artifact.sha256);
    expect(readFileSync(join(packageRoot, "copy/post.txt"), "utf8")).toBe("same\n");
  });

  it("11. different content at the same relative path raises a typed conflict", () => {
    const root = tempRoot();
    const packageRoot = join(root, "pkg");
    const planned = {
      relativePath: "copy/post.txt",
      content: Buffer.from("one\n", "utf8"),
      kind: "copy" as const,
      origin: "candidate_copy" as const,
      mediaType: "text/plain; charset=utf-8",
    };
    writePackageArtifact({ packageRoot, planned, createdAt: "2026-09-03T00:00:00.000Z" });
    expect(() =>
      writePackageArtifact({
        packageRoot,
        planned: { ...planned, content: Buffer.from("two\n", "utf8") },
        createdAt: "2026-09-03T00:00:00.000Z",
      }),
    ).toThrow(MarketingAssetConflictError);
    expect(readFileSync(join(packageRoot, "copy/post.txt"), "utf8")).toBe("one\n");
  });

  it("12. manifest and artifact paths stay relative", () => {
    expect(assertSafeRelativeArtifactPath("manifest.json")).toBe("manifest.json");
    expect(assertSafeRelativeArtifactPath("copy/post.txt")).toBe("copy/post.txt");
    expect(assertSafeRelativeArtifactPath("reel/incoming/scene-01.mp4")).toBe(
      "reel/incoming/scene-01.mp4",
    );
  });

  it("29. generated, human-edited, and published boundaries are distinct", () => {
    const packageRoot = join(tempRoot(), "pkg");
    ensurePackageLayout(packageRoot);
    const names = new Set(readdirSync(packageRoot));
    for (const directory of MARKETING_ASSET_GENERATED_DIRECTORIES) {
      expect(names.has(directory)).toBe(true);
    }
    expect(names.has(MARKETING_ASSET_HUMAN_EDITED_DIRECTORY)).toBe(true);
    expect(names.has(MARKETING_ASSET_PUBLISHED_DIRECTORY)).toBe(true);
    expect(MARKETING_ASSET_GENERATED_DIRECTORIES).not.toContain(MARKETING_ASSET_HUMAN_EDITED_DIRECTORY);
    expect(MARKETING_ASSET_GENERATED_DIRECTORIES).not.toContain(MARKETING_ASSET_PUBLISHED_DIRECTORY);
    expect(existsSync(join(packageRoot, "reel/prompts"))).toBe(true);
    expect(existsSync(join(packageRoot, "reel/incoming"))).toBe(true);
    expect(existsSync(join(packageRoot, "reel/audio"))).toBe(true);
    expect(existsSync(join(packageRoot, "reel/audio/segments"))).toBe(true);
    expect(existsSync(join(packageRoot, "reel/final"))).toBe(true);
    writeFileSync(join(packageRoot, "human-edited", "note.txt"), "human");
    writeFileSync(join(packageRoot, "copy", "post.txt"), "generated");
    expect(readFileSync(join(packageRoot, "copy/post.txt"), "utf8")).not.toBe(
      readFileSync(join(packageRoot, "human-edited/note.txt"), "utf8"),
    );
  });
});

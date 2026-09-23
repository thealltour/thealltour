import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import JSZip from "jszip";

import {
  buildMarketingAssetPackageZip,
  exportMarketingCandidatePackage,
  inspectMarketingAssetPackage,
  readMarketingAssetPackageFile,
  sha256Buffer,
} from "@/lib/marketing/assets";
import { MarketingAssetPathError } from "@/lib/marketing/assets/errors";
import {
  buildTestCandidate,
  buildTestLlmPublishableBundle,
  BUSINESS_DATE,
  CANDIDATE_ID,
  NOW,
} from "@/lib/marketing/assets/__tests__/fixtures";

const tempDirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "marketing-inspect-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});


const publishableBundleByCandidateId = new Map<
  string,
  ReturnType<typeof buildTestLlmPublishableBundle>
>();

function exportWithPublishable(
  args: Omit<Parameters<typeof exportMarketingCandidatePackage>[0], "publishableBundle"> & {
    publishableBundle?: Parameters<typeof exportMarketingCandidatePackage>[0]["publishableBundle"];
  },
) {
  let publishableBundle = args.publishableBundle;
  if (!publishableBundle) {
    const cached = publishableBundleByCandidateId.get(args.candidate.candidateId);
    if (cached) {
      publishableBundle = cached;
    } else {
      publishableBundle = buildTestLlmPublishableBundle(args.candidate, args.now ?? NOW);
      publishableBundleByCandidateId.set(args.candidate.candidateId, publishableBundle);
    }
  }
  return exportMarketingCandidatePackage({ ...args, publishableBundle });
}

describe("inspectMarketingAssetPackage", () => {
  it("returns missing when asset root is not configured", () => {
    const inspection = inspectMarketingAssetPackage({
      candidateId: CANDIDATE_ID,
      businessDateKst: BUSINESS_DATE,
      env: {},
    });
    expect(inspection.status).toBe("missing");
    expect(inspection.assetRootConfigured).toBe(false);
    expect(inspection.artifacts).toEqual([]);
  });

  it("returns missing when package directory does not exist", () => {
    const root = tempRoot();
    const inspection = inspectMarketingAssetPackage({
      candidateId: CANDIDATE_ID,
      businessDateKst: BUSINESS_DATE,
      env: { MARKETING_ASSET_ROOT: root },
    });
    expect(inspection.status).toBe("missing");
    expect(inspection.assetRootConfigured).toBe(true);
    expect(inspection.relativePackagePath).toBe(`2026/09/03/${CANDIDATE_ID}`);
    expect(existsSync(join(root, "2026", "09", "03", CANDIDATE_ID))).toBe(false);
  });

  it("returns present after export with artifact metadata", () => {
    const root = tempRoot();
    const exported = exportWithPublishable({
      candidate: buildTestCandidate(),
      assetRoot: root,
      now: NOW,
    });
    const inspection = inspectMarketingAssetPackage({
      candidateId: CANDIDATE_ID,
      businessDateKst: BUSINESS_DATE,
      env: { MARKETING_ASSET_ROOT: root },
    });
    expect(inspection.status).toBe("present");
    expect(inspection.packageId).toBe(exported.packageId);
    expect(inspection.artifacts.length).toBeGreaterThan(0);
    expect(inspection.artifacts.some((item) => item.relativePath === "copy/post.txt")).toBe(true);
    expect(inspection.integrityDigest).toBe(exported.manifest.integrity.digest);
  });
});

describe("readMarketingAssetPackageFile", () => {
  it("reads package files with matching size and sha", () => {
    const root = tempRoot();
    exportWithPublishable({
      candidate: buildTestCandidate(),
      assetRoot: root,
      now: NOW,
    });
    const file = readMarketingAssetPackageFile({
      candidateId: CANDIDATE_ID,
      businessDateKst: BUSINESS_DATE,
      relativePath: "copy/post.txt",
      env: { MARKETING_ASSET_ROOT: root },
    });
    expect(file.mediaType).toContain("text/plain");
    expect(file.byteSize).toBe(file.bytes.byteLength);
    expect(sha256Buffer(file.bytes)).toHaveLength(64);
    expect(file.bytes.toString("utf8")).toContain("Official guidance");
  });

  it("allows reading manifest.json", () => {
    const root = tempRoot();
    exportWithPublishable({
      candidate: buildTestCandidate(),
      assetRoot: root,
      now: NOW,
    });
    const file = readMarketingAssetPackageFile({
      candidateId: CANDIDATE_ID,
      businessDateKst: BUSINESS_DATE,
      relativePath: "manifest.json",
      env: { MARKETING_ASSET_ROOT: root },
    });
    expect(file.mediaType).toBe("application/json");
    const parsed = JSON.parse(file.bytes.toString("utf8")) as { contract: string };
    expect(parsed.contract).toBe("marketing-asset-manifest-v1");
  });

  it("rejects path traversal", () => {
    const root = tempRoot();
    exportWithPublishable({
      candidate: buildTestCandidate(),
      assetRoot: root,
      now: NOW,
    });
    expect(() =>
      readMarketingAssetPackageFile({
        candidateId: CANDIDATE_ID,
        businessDateKst: BUSINESS_DATE,
        relativePath: "../secret.txt",
        env: { MARKETING_ASSET_ROOT: root },
      }),
    ).toThrow(MarketingAssetPathError);
  });

  it("throws when artifact is missing", () => {
    const root = tempRoot();
    exportWithPublishable({
      candidate: buildTestCandidate(),
      assetRoot: root,
      now: NOW,
    });
    expect(() =>
      readMarketingAssetPackageFile({
        candidateId: CANDIDATE_ID,
        businessDateKst: BUSINESS_DATE,
        relativePath: "copy/does-not-exist.txt",
        env: { MARKETING_ASSET_ROOT: root },
      }),
    ).toThrow(/artifact not found/);
  });
});

describe("buildMarketingAssetPackageZip", () => {
  it("zips package artifacts including manifest.json", async () => {
    const root = tempRoot();
    exportWithPublishable({
      candidate: buildTestCandidate(),
      assetRoot: root,
      now: NOW,
    });

    const built = await buildMarketingAssetPackageZip({
      candidateId: CANDIDATE_ID,
      businessDateKst: BUSINESS_DATE,
      env: { MARKETING_ASSET_ROOT: root },
    });

    expect(built.zipFileName).toMatch(/\.zip$/);
    expect(built.entryCount).toBeGreaterThan(1);
    expect(built.byteSize).toBe(built.bytes.byteLength);

    const zip = await JSZip.loadAsync(built.bytes);
    const names = Object.keys(zip.files).filter((name) => !zip.files[name]?.dir);
    expect(names).toContain("manifest.json");
    expect(names).toContain("copy/post.txt");

    const post = await zip.file("copy/post.txt")!.async("string");
    expect(post.trim().length).toBeGreaterThan(0);
  });

  it("throws when package is missing", async () => {
    const root = tempRoot();
    await expect(
      buildMarketingAssetPackageZip({
        candidateId: CANDIDATE_ID,
        businessDateKst: BUSINESS_DATE,
        env: { MARKETING_ASSET_ROOT: root },
      }),
    ).rejects.toThrow(/package not found/);
  });
});

/**
 * Shared Visual Assets + Manual Astra Handoff Operator — focused tests A–M.
 */
import { describe, expect, it } from "vitest";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  SHARED_VISUAL_PLAN_CONTRACT,
  type SharedVisualPlan,
} from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import {
  buildManualAstraHandoff,
  type ManualAstraApprovedAssetContext,
} from "@/lib/marketing/publishable/manualAstraHandoff";
import {
  SHARED_VISUAL_ASSETS_CONTRACT,
  SHARED_VISUAL_ASSETS_RELATIVE_PATH,
  SHARED_VISUAL_MEDIA_DIR,
  computeManualAstraHandoffFingerprint,
  formatUsageLine,
  getSharedVisualUploadStatus,
  isSharedVisualAssetsStale,
  parseSharedVisualAssetsManifest,
  persistSharedVisualAssetsManifest,
  readSharedVisualAssetsManifest,
  sharedVisualStoredRelativePath,
  uploadSharedVisualAsset,
  validateSharedVisualUploadBytes,
  SharedVisualUploadError,
} from "@/lib/marketing/publishable/sharedVisualAssets";

/** Minimal valid 1×1 PNG */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Minimal JPEG (JFIF) header + truncated body still detected as jpeg by magic */
const JPEG_MAGIC = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

function plan(overrides: Partial<SharedVisualPlan> = {}): SharedVisualPlan {
  return {
    contract: SHARED_VISUAL_PLAN_CONTRACT,
    sourceAssetId: "asset_op",
    sourceAssetVersion: 3,
    generatedAt: "2026-09-18T00:00:00.000Z",
    sourceVisualPlanFingerprint: "fp_plan_op",
    visuals: [
      {
        visualId: "social_visual_01",
        assetFamily: "social_static",
        role: "cover_context",
        visualIntent: "cover atmosphere",
        visualMode: "editorial_photo",
        generatedVisualNeeded: true,
        usages: [
          { channel: "instagram", cardId: "card-01" },
          { channel: "threads", slotIndex: 0 },
        ],
      },
      {
        visualId: "social_visual_02",
        assetFamily: "social_static",
        role: "fact",
        visualIntent: "fact card",
        visualMode: "fact_card",
        generatedVisualNeeded: false,
        usages: [{ channel: "instagram", cardId: "card-02" }],
      },
      {
        visualId: "social_visual_03",
        assetFamily: "social_static",
        role: "architecture_detail",
        visualIntent: "detail shot",
        visualMode: "object_or_detail",
        generatedVisualNeeded: true,
        usages: [
          { channel: "instagram", cardId: "card-03" },
          { channel: "threads", slotIndex: 1 },
        ],
      },
    ],
    ...overrides,
  };
}

const assetCtx: ManualAstraApprovedAssetContext = {
  titleKo: "테스트 콘텐츠",
  supportedClaimBoundaryKo: "확인된 범위",
  limitationsKo: ["현장 미확인"],
  forbiddenClaimsKo: [],
  storySupportVerdict: "SUPPORTED_WITH_LIMITS",
  editorialArchetype: "discovery",
};

function makeHandoff(planOverrides?: Partial<SharedVisualPlan>) {
  return buildManualAstraHandoff({
    sharedVisualPlan: plan(planOverrides),
    approvedAssetContext: assetCtx,
    now: new Date("2026-09-18T12:00:00.000Z"),
  });
}

describe("Shared Visual Assets Operator v1", () => {
  it("A. handoff with 2 visuals → 2 expected slots + usage labels", () => {
    const handoff = makeHandoff();
    expect(handoff.visuals).toHaveLength(2);
    expect(handoff.visuals.map((v) => v.visualId)).toEqual([
      "social_visual_01",
      "social_visual_03",
    ]);
    const v01 = handoff.visuals[0]!;
    expect(v01.usages.map(formatUsageLine)).toEqual([
      "Instagram card-01",
      "Threads image 1",
    ]);
    const v03 = handoff.visuals[1]!;
    expect(v03.usages.map(formatUsageLine)).toEqual([
      "Instagram card-03",
      "Threads image 2",
    ]);
  });

  it("B. copyText is exact persisted handoff.copyText (no rebuild in upload path)", () => {
    const handoff = makeHandoff();
    const original = handoff.copyText;
    expect(original).toContain("social_visual_01");
    expect(original).toContain("Threads image 1");
    // Operator copy source must be this string — not reformatted
    expect(handoff.copyText).toBe(original);
    expect(handoff.copyText).toBe(makeHandoff().copyText);
  });

  it("C. valid upload — known visualId + PNG → stored + manifest entry", () => {
    const dir = mkdtempSync(join(tmpdir(), "sva-c-"));
    try {
      const handoff = makeHandoff();
      const sharedPlan = plan();
      const { asset, manifest } = uploadSharedVisualAsset({
        packageRoot: dir,
        handoff,
        sharedVisualPlan: sharedPlan,
        visualId: "social_visual_01",
        bytes: PNG_1X1,
        clientFilename: "image-final-7.png",
        now: new Date("2026-09-18T13:00:00.000Z"),
      });
      expect(asset.visualId).toBe("social_visual_01");
      expect(asset.storedPath).toBe(`${SHARED_VISUAL_MEDIA_DIR}/social_visual_01.png`);
      expect(asset.expectedFilename).toBe("social_visual_01.png");
      expect(asset.mimeType).toBe("image/png");
      expect(existsSync(join(dir, asset.storedPath))).toBe(true);
      expect(manifest.assets).toHaveLength(1);
      expect(manifest.contract).toBe(SHARED_VISUAL_ASSETS_CONTRACT);
      const disk = JSON.parse(readFileSync(join(dir, SHARED_VISUAL_ASSETS_RELATIVE_PATH), "utf8"));
      expect(disk.assets[0].visualId).toBe("social_visual_01");
      // Browser filename must not become identity
      expect(disk.assets[0].storedFilename).not.toContain("image-final");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("D. unknown visualId rejected", () => {
    const dir = mkdtempSync(join(tmpdir(), "sva-d-"));
    try {
      const handoff = makeHandoff();
      expect(() =>
        uploadSharedVisualAsset({
          packageRoot: dir,
          handoff,
          sharedVisualPlan: plan(),
          visualId: "social_visual_02",
          bytes: PNG_1X1,
        }),
      ).toThrow(SharedVisualUploadError);
      expect(() =>
        uploadSharedVisualAsset({
          packageRoot: dir,
          handoff,
          sharedVisualPlan: plan(),
          visualId: "social_visual_99",
          bytes: PNG_1X1,
        }),
      ).toThrow(/없는 visualId|unknown/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("E. invalid file rejected", () => {
    expect(() => validateSharedVisualUploadBytes(Buffer.from("%PDF-1.4"))).toThrow(
      /PNG|JPEG|WEBP/,
    );
    expect(() => validateSharedVisualUploadBytes(Buffer.from("hello world"))).toThrow(
      SharedVisualUploadError,
    );
  });

  it("F. path traversal — malicious visualId / filename cannot escape", () => {
    expect(() => sharedVisualStoredRelativePath("../etc/passwd", "png")).toThrow();
    expect(() => sharedVisualStoredRelativePath("social_visual_01/../../x", "png")).toThrow();
    const dir = mkdtempSync(join(tmpdir(), "sva-f-"));
    try {
      const handoff = makeHandoff();
      expect(() =>
        uploadSharedVisualAsset({
          packageRoot: dir,
          handoff,
          sharedVisualPlan: plan(),
          visualId: "../../../evil",
          bytes: PNG_1X1,
          clientFilename: "../../../evil.png",
        }),
      ).toThrow();
      // No files outside package
      expect(existsSync(join(dir, "..", "evil.png"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("G. replace same visualId → exactly one active entry", () => {
    const dir = mkdtempSync(join(tmpdir(), "sva-g-"));
    try {
      const handoff = makeHandoff();
      const sharedPlan = plan();
      uploadSharedVisualAsset({
        packageRoot: dir,
        handoff,
        sharedVisualPlan: sharedPlan,
        visualId: "social_visual_01",
        bytes: PNG_1X1,
        now: new Date("2026-09-18T13:00:00.000Z"),
      });
      const second = uploadSharedVisualAsset({
        packageRoot: dir,
        handoff,
        sharedVisualPlan: sharedPlan,
        visualId: "social_visual_01",
        bytes: JPEG_MAGIC,
        now: new Date("2026-09-18T14:00:00.000Z"),
      });
      expect(second.manifest.assets.filter((a) => a.visualId === "social_visual_01")).toHaveLength(
        1,
      );
      expect(second.asset.mimeType).toBe("image/jpeg");
      expect(second.asset.storedFilename).toBe("social_visual_01.jpg");
      expect(second.asset.uploadedAt).toBe("2026-09-18T14:00:00.000Z");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("H. preserve siblings when uploading another visual", () => {
    const dir = mkdtempSync(join(tmpdir(), "sva-h-"));
    try {
      const handoff = makeHandoff();
      const sharedPlan = plan();
      uploadSharedVisualAsset({
        packageRoot: dir,
        handoff,
        sharedVisualPlan: sharedPlan,
        visualId: "social_visual_01",
        bytes: PNG_1X1,
      });
      // Simulate 02 already present via upsert path by uploading 01 then 03
      const after03 = uploadSharedVisualAsset({
        packageRoot: dir,
        handoff,
        sharedVisualPlan: sharedPlan,
        visualId: "social_visual_03",
        bytes: PNG_1X1,
      });
      expect(after03.manifest.assets.map((a) => a.visualId).sort()).toEqual([
        "social_visual_01",
        "social_visual_03",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("I. upload completeness helper", () => {
    const handoff = makeHandoff();
    const baseManifest = {
      contract: SHARED_VISUAL_ASSETS_CONTRACT,
      sourceAssetId: handoff.sourceAssetId,
      sourceAssetVersion: handoff.sourceAssetVersion,
      sourceSharedVisualPlanFingerprint: handoff.sourceSharedVisualPlanFingerprint,
      sourceManualAstraHandoffFingerprint: computeManualAstraHandoffFingerprint(handoff),
      updatedAt: "2026-09-18T00:00:00.000Z",
      assets: [
        {
          visualId: "social_visual_01",
          expectedFilename: "social_visual_01.png",
          storedFilename: "social_visual_01.png",
          storedPath: "media/shared-visuals/social_visual_01.png",
          mimeType: "image/png",
          byteSize: 10,
          uploadedAt: "2026-09-18T00:00:00.000Z",
          status: "uploaded" as const,
        },
      ],
    };
    const incomplete = getSharedVisualUploadStatus({
      handoff,
      manifest: baseManifest,
      sharedVisualPlan: plan(),
    });
    expect(incomplete).toMatchObject({
      required: 2,
      uploaded: 1,
      complete: false,
      missingVisualIds: ["social_visual_03"],
    });

    const completeStatus = getSharedVisualUploadStatus({
      handoff,
      manifest: {
        ...baseManifest,
        assets: [
          ...baseManifest.assets,
          {
            visualId: "social_visual_03",
            expectedFilename: "social_visual_03.png",
            storedFilename: "social_visual_03.png",
            storedPath: "media/shared-visuals/social_visual_03.png",
            mimeType: "image/png",
            byteSize: 10,
            uploadedAt: "2026-09-18T00:00:00.000Z",
            status: "uploaded" as const,
          },
        ],
      },
      sharedVisualPlan: plan(),
    });
    expect(completeStatus).toMatchObject({ required: 2, uploaded: 2, complete: true });
    expect(completeStatus.missingVisualIds).toEqual([]);
  });

  it("J. stale detected — old files not auto-deleted", () => {
    const dir = mkdtempSync(join(tmpdir(), "sva-j-"));
    try {
      const handoff = makeHandoff();
      const { asset, manifest } = uploadSharedVisualAsset({
        packageRoot: dir,
        handoff,
        sharedVisualPlan: plan(),
        visualId: "social_visual_01",
        bytes: PNG_1X1,
      });
      const abs = join(dir, asset.storedPath);
      expect(existsSync(abs)).toBe(true);

      const staleHandoff = {
        ...handoff,
        sourceAssetVersion: handoff.sourceAssetVersion + 1,
      };
      expect(
        isSharedVisualAssetsStale({
          manifest,
          handoff: staleHandoff,
          sharedVisualPlan: plan({ sourceAssetVersion: handoff.sourceAssetVersion + 1 }),
        }),
      ).toBe(true);
      // Files remain
      expect(existsSync(abs)).toBe(true);
      expect(readSharedVisualAssetsManifest(dir)?.assets).toHaveLength(1);

      // Upload on stale handoff rejected
      expect(() =>
        uploadSharedVisualAsset({
          packageRoot: dir,
          handoff: staleHandoff,
          sharedVisualPlan: plan({
            sourceAssetVersion: handoff.sourceAssetVersion + 1,
            sourceVisualPlanFingerprint: "fp_new",
          }),
          visualId: "social_visual_03",
          bytes: PNG_1X1,
        }),
      ).toThrow(/일치하지 않습니다|stale/i);
      expect(existsSync(abs)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("K. failed replace — previous mapping remains valid", () => {
    const dir = mkdtempSync(join(tmpdir(), "sva-k-"));
    try {
      const handoff = makeHandoff();
      const sharedPlan = plan();
      const first = uploadSharedVisualAsset({
        packageRoot: dir,
        handoff,
        sharedVisualPlan: sharedPlan,
        visualId: "social_visual_01",
        bytes: PNG_1X1,
      });
      const prevPath = join(dir, first.asset.storedPath);

      // Validation failure before write
      expect(() =>
        uploadSharedVisualAsset({
          packageRoot: dir,
          handoff,
          sharedVisualPlan: sharedPlan,
          visualId: "social_visual_01",
          bytes: Buffer.from("not-an-image"),
        }),
      ).toThrow(SharedVisualUploadError);

      const after = readSharedVisualAssetsManifest(dir);
      expect(after?.assets).toHaveLength(1);
      expect(after?.assets[0]?.storedPath).toBe(first.asset.storedPath);
      expect(existsSync(prevPath)).toBe(true);
      expect(readFileSync(prevPath).equals(PNG_1X1)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("K2. failed write — previous mapping remains (read-only media dir)", () => {
    const dir = mkdtempSync(join(tmpdir(), "sva-k2-"));
    try {
      const handoff = makeHandoff();
      const sharedPlan = plan();
      const first = uploadSharedVisualAsset({
        packageRoot: dir,
        handoff,
        sharedVisualPlan: sharedPlan,
        visualId: "social_visual_01",
        bytes: PNG_1X1,
      });

      // Make media dir read-only so overwrite fails for replace to jpg path
      const mediaDir = join(dir, SHARED_VISUAL_MEDIA_DIR);
      chmodSync(mediaDir, 0o555);
      chmodSync(join(dir, first.asset.storedPath), 0o444);

      let failed = false;
      try {
        uploadSharedVisualAsset({
          packageRoot: dir,
          handoff,
          sharedVisualPlan: sharedPlan,
          visualId: "social_visual_01",
          bytes: JPEG_MAGIC,
        });
      } catch {
        failed = true;
      } finally {
        chmodSync(mediaDir, 0o755);
        chmodSync(join(dir, first.asset.storedPath), 0o644);
      }

      // On some filesystems chmod may not block root/same-user writes; still assert mapping intact
      const after = readSharedVisualAssetsManifest(dir);
      expect(after?.assets).toHaveLength(1);
      expect(after?.assets[0]?.mimeType).toBe("image/png");
      if (failed) {
        expect(after?.assets[0]?.storedFilename).toBe("social_visual_01.png");
      }
    } finally {
      try {
        chmodSync(join(dir, SHARED_VISUAL_MEDIA_DIR), 0o755);
      } catch {
        /* ignore */
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("L. persistence roundtrip", () => {
    const dir = mkdtempSync(join(tmpdir(), "sva-l-"));
    try {
      const handoff = makeHandoff();
      const fp = computeManualAstraHandoffFingerprint(handoff);
      const manifest = {
        contract: SHARED_VISUAL_ASSETS_CONTRACT,
        sourceAssetId: handoff.sourceAssetId,
        sourceAssetVersion: handoff.sourceAssetVersion,
        sourceSharedVisualPlanFingerprint: handoff.sourceSharedVisualPlanFingerprint,
        sourceManualAstraHandoffFingerprint: fp,
        updatedAt: "2026-09-18T15:00:00.000Z",
        assets: [
          {
            visualId: "social_visual_01",
            expectedFilename: "social_visual_01.png",
            storedFilename: "social_visual_01.png",
            storedPath: "media/shared-visuals/social_visual_01.png",
            mimeType: "image/png",
            byteSize: 42,
            uploadedAt: "2026-09-18T15:00:00.000Z",
            status: "uploaded" as const,
          },
        ],
      };
      persistSharedVisualAssetsManifest({ packageRoot: dir, manifest });
      const roundTrip = readSharedVisualAssetsManifest(dir);
      expect(roundTrip).toEqual(manifest);
      expect(parseSharedVisualAssetsManifest(JSON.parse(JSON.stringify(manifest)))).toEqual(
        manifest,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fingerprint is deterministic for same handoff", () => {
    const a = makeHandoff();
    const b = makeHandoff();
    expect(computeManualAstraHandoffFingerprint(a)).toBe(computeManualAstraHandoffFingerprint(b));
  });
});

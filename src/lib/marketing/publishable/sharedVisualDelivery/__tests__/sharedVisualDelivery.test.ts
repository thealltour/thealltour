/**
 * Shared Visual Delivery Adapters v1 — focused tests A–M.
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

import {
  SHARED_VISUAL_PLAN_CONTRACT,
  type SharedVisualPlan,
} from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import {
  SHARED_VISUAL_ASSETS_CONTRACT,
  type SharedVisualAssetsManifest,
} from "@/lib/marketing/publishable/sharedVisualAssets/contracts";
import {
  buildInstagramRendererVisualMap,
  buildInstagramRendererVisualMapSafe,
  resolveThreadsSharedVisualAssets,
  SharedVisualInstagramMapError,
} from "@/lib/marketing/publishable/sharedVisualDelivery";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function jpegBytes(): Promise<Buffer> {
  return sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 200, g: 40, b: 40 } },
  })
    .jpeg()
    .toBuffer();
}

async function webpBytes(): Promise<Buffer> {
  return sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 40, g: 200, b: 40 } },
  })
    .webp()
    .toBuffer();
}

function basePlan(overrides: Partial<SharedVisualPlan> = {}): SharedVisualPlan {
  return {
    contract: SHARED_VISUAL_PLAN_CONTRACT,
    sourceAssetId: "asset_del",
    sourceAssetVersion: 1,
    generatedAt: "2026-09-18T00:00:00.000Z",
    sourceVisualPlanFingerprint: "fp_del_1",
    visuals: [
      {
        visualId: "social_visual_01",
        assetFamily: "social_static",
        role: "cover_context",
        visualIntent: "cover",
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
        visualIntent: "fact",
        visualMode: "fact_card",
        generatedVisualNeeded: false,
        usages: [{ channel: "instagram", cardId: "card-02" }],
      },
      {
        visualId: "social_visual_03",
        assetFamily: "social_static",
        role: "detail",
        visualIntent: "detail",
        visualMode: "object_or_detail",
        generatedVisualNeeded: true,
        usages: [
          { channel: "instagram", cardId: "card-03" },
          { channel: "threads", slotIndex: 2 },
        ],
      },
    ],
    ...overrides,
  };
}

function manifestFor(
  packageRoot: string,
  assets: Array<{ visualId: string; filename: string; mimeType?: string }>,
  overrides: Partial<SharedVisualAssetsManifest> = {},
): SharedVisualAssetsManifest {
  const mediaDir = join(packageRoot, "media/shared-visuals");
  mkdirSync(mediaDir, { recursive: true });
  return {
    contract: SHARED_VISUAL_ASSETS_CONTRACT,
    sourceAssetId: "asset_del",
    sourceAssetVersion: 1,
    sourceSharedVisualPlanFingerprint: "fp_del_1",
    sourceManualAstraHandoffFingerprint: "fp_handoff",
    updatedAt: "2026-09-18T12:00:00.000Z",
    assets: assets.map((a) => {
      const storedPath = `media/shared-visuals/${a.filename}`;
      return {
        visualId: a.visualId,
        expectedFilename: `${a.visualId}.png`,
        storedFilename: a.filename,
        storedPath,
        mimeType: a.mimeType ?? "image/png",
        byteSize: 10,
        uploadedAt: "2026-09-18T12:00:00.000Z",
        status: "uploaded" as const,
      };
    }),
    ...overrides,
  };
}

function writeAsset(packageRoot: string, filename: string, bytes: Buffer): void {
  const dir = join(packageRoot, "media/shared-visuals");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), bytes);
}

describe("Shared Visual Delivery Adapters v1", () => {
  it("A. Instagram basic mapping — uploaded visual → card-01 path", async () => {
    const dir = mkdtempSync(join(tmpdir(), "svd-a-"));
    try {
      writeAsset(dir, "social_visual_01.png", PNG_1X1);
      const plan = basePlan();
      const manifest = manifestFor(dir, [
        { visualId: "social_visual_01", filename: "social_visual_01.png" },
      ]);
      const result = await buildInstagramRendererVisualMap({
        packageRoot: dir,
        sharedVisualPlan: plan,
        manifest,
      });
      expect(result.injected).toBe(true);
      expect(result.visuals["card-01"]).toBe(join(dir, "media/shared-visuals/social_visual_01.png"));
      expect(result.visuals["card-02"]).toBeUndefined();
      expect(result.visuals["card-03"]).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("B. Instagram shared visual — one visual → IG card once (also used on Threads)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "svd-b-"));
    try {
      writeAsset(dir, "social_visual_01.png", PNG_1X1);
      const result = await buildInstagramRendererVisualMap({
        packageRoot: dir,
        sharedVisualPlan: basePlan(),
        manifest: manifestFor(dir, [
          { visualId: "social_visual_01", filename: "social_visual_01.png" },
        ]),
      });
      expect(Object.keys(result.visuals)).toEqual(["card-01"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("C. Instagram missing upload — omitted; empty map (renderer fallback)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "svd-c-"));
    try {
      const result = await buildInstagramRendererVisualMap({
        packageRoot: dir,
        sharedVisualPlan: basePlan(),
        manifest: manifestFor(dir, []),
      });
      expect(result.visuals).toEqual({});
      expect(result.injected).toBe(false);
      expect(result.skippedReason).toBe("none_uploaded");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("D. stale manifest → no injection", async () => {
    const dir = mkdtempSync(join(tmpdir(), "svd-d-"));
    try {
      writeAsset(dir, "social_visual_01.png", PNG_1X1);
      const result = await buildInstagramRendererVisualMap({
        packageRoot: dir,
        sharedVisualPlan: basePlan(),
        manifest: manifestFor(
          dir,
          [{ visualId: "social_visual_01", filename: "social_visual_01.png" }],
          { sourceSharedVisualPlanFingerprint: "fp_old_other" },
        ),
      });
      expect(result.stale).toBe(true);
      expect(result.injected).toBe(false);
      expect(result.visuals).toEqual({});
      expect(result.skippedReason).toBe("stale");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("E. duplicate card mapping → refuse ambiguous injection", async () => {
    const dir = mkdtempSync(join(tmpdir(), "svd-e-"));
    try {
      writeAsset(dir, "social_visual_01.png", PNG_1X1);
      writeAsset(dir, "social_visual_03.png", PNG_1X1);
      const plan = basePlan({
        visuals: [
          {
            visualId: "social_visual_01",
            assetFamily: "social_static",
            role: "a",
            visualIntent: "a",
            generatedVisualNeeded: true,
            usages: [{ channel: "instagram", cardId: "card-01" }],
          },
          {
            visualId: "social_visual_03",
            assetFamily: "social_static",
            role: "b",
            visualIntent: "b",
            generatedVisualNeeded: true,
            usages: [{ channel: "instagram", cardId: "card-01" }],
          },
        ],
      });
      const manifest = manifestFor(dir, [
        { visualId: "social_visual_01", filename: "social_visual_01.png" },
        { visualId: "social_visual_03", filename: "social_visual_03.png" },
      ]);

      await expect(
        buildInstagramRendererVisualMap({
          packageRoot: dir,
          sharedVisualPlan: plan,
          manifest,
        }),
      ).rejects.toBeInstanceOf(SharedVisualInstagramMapError);

      const safe = await buildInstagramRendererVisualMapSafe({
        packageRoot: dir,
        sharedVisualPlan: plan,
        manifest,
      });
      expect(safe.visuals).toEqual({});
      expect(safe.skippedReason).toBe("duplicate_card_mapping");
      expect(safe.warnings.some((w) => w.includes("Ambiguous"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("F. path safety — tampered storedPath outside package not injected", async () => {
    const dir = mkdtempSync(join(tmpdir(), "svd-f-"));
    const outside = mkdtempSync(join(tmpdir(), "svd-f-out-"));
    try {
      const evil = join(outside, "evil.png");
      writeFileSync(evil, PNG_1X1);
      const manifest = manifestFor(dir, [
        { visualId: "social_visual_01", filename: "social_visual_01.png" },
      ]);
      manifest.assets[0]!.storedPath = "../" + evil; // traversal attempt
      // Also try absolute
      const absManifest = structuredClone(manifest);
      absManifest.assets[0]!.storedPath = evil;

      const r1 = await buildInstagramRendererVisualMap({
        packageRoot: dir,
        sharedVisualPlan: basePlan(),
        manifest,
      });
      expect(r1.visuals["card-01"]).toBeUndefined();

      const r2 = await buildInstagramRendererVisualMap({
        packageRoot: dir,
        sharedVisualPlan: basePlan(),
        manifest: absManifest,
      });
      expect(r2.visuals["card-01"]).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("G. PNG — direct renderer path (no normalize)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "svd-g-"));
    try {
      writeAsset(dir, "social_visual_01.png", PNG_1X1);
      const result = await buildInstagramRendererVisualMap({
        packageRoot: dir,
        sharedVisualPlan: basePlan(),
        manifest: manifestFor(dir, [
          { visualId: "social_visual_01", filename: "social_visual_01.png" },
        ]),
      });
      expect(result.visuals["card-01"]).toBe(join(dir, "media/shared-visuals/social_visual_01.png"));
      expect(result.warnings.some((w) => w.startsWith("normalized_"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("H. JPEG → normalized to PNG path", async () => {
    const dir = mkdtempSync(join(tmpdir(), "svd-h-"));
    try {
      const bytes = await jpegBytes();
      writeAsset(dir, "social_visual_01.jpg", bytes);
      const result = await buildInstagramRendererVisualMap({
        packageRoot: dir,
        sharedVisualPlan: basePlan(),
        manifest: manifestFor(dir, [
          {
            visualId: "social_visual_01",
            filename: "social_visual_01.jpg",
            mimeType: "image/jpeg",
          },
        ]),
      });
      expect(result.visuals["card-01"]).toBeTruthy();
      expect(result.visuals["card-01"]).toMatch(/\.png$/);
      expect(result.visuals["card-01"]).not.toBe(
        join(dir, "media/shared-visuals/social_visual_01.jpg"),
      );
      expect(result.warnings.some((w) => w.includes("image/jpeg"))).toBe(true);
      // PNG magic
      const { readFileSync } = await import("node:fs");
      const out = readFileSync(result.visuals["card-01"]!);
      expect(out.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
        true,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("I. WEBP → normalized to PNG path", async () => {
    const dir = mkdtempSync(join(tmpdir(), "svd-i-"));
    try {
      const bytes = await webpBytes();
      writeAsset(dir, "social_visual_01.webp", bytes);
      const result = await buildInstagramRendererVisualMap({
        packageRoot: dir,
        sharedVisualPlan: basePlan(),
        manifest: manifestFor(dir, [
          {
            visualId: "social_visual_01",
            filename: "social_visual_01.webp",
            mimeType: "image/webp",
          },
        ]),
      });
      expect(result.visuals["card-01"]).toMatch(/\.png$/);
      expect(result.warnings.some((w) => w.includes("image/webp"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("J. Threads ordering — slots 2,0,1 → ordered 0,1,2", () => {
    const dir = mkdtempSync(join(tmpdir(), "svd-j-"));
    try {
      writeAsset(dir, "social_visual_01.png", PNG_1X1);
      writeAsset(dir, "a.png", PNG_1X1);
      writeAsset(dir, "b.png", PNG_1X1);
      const plan = basePlan({
        visuals: [
          {
            visualId: "social_visual_03",
            assetFamily: "social_static",
            role: "x",
            visualIntent: "x",
            generatedVisualNeeded: true,
            usages: [{ channel: "threads", slotIndex: 2 }],
          },
          {
            visualId: "social_visual_01",
            assetFamily: "social_static",
            role: "x",
            visualIntent: "x",
            generatedVisualNeeded: true,
            usages: [{ channel: "threads", slotIndex: 0 }],
          },
          {
            visualId: "social_visual_02",
            assetFamily: "social_static",
            role: "x",
            visualIntent: "x",
            generatedVisualNeeded: true,
            usages: [{ channel: "threads", slotIndex: 1 }],
          },
        ],
      });
      const manifest = manifestFor(dir, [
        { visualId: "social_visual_01", filename: "social_visual_01.png" },
        { visualId: "social_visual_02", filename: "a.png" },
        { visualId: "social_visual_03", filename: "b.png" },
      ]);
      const result = resolveThreadsSharedVisualAssets({
        packageRoot: dir,
        sharedVisualPlan: plan,
        manifest,
      });
      expect(result.visuals.map((v) => v.slotIndex)).toEqual([0, 1, 2]);
      expect(result.stale).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("K. Threads sparse slots — keep 0,2 (no renumber)", () => {
    const dir = mkdtempSync(join(tmpdir(), "svd-k-"));
    try {
      writeAsset(dir, "social_visual_01.png", PNG_1X1);
      writeAsset(dir, "social_visual_03.png", PNG_1X1);
      const result = resolveThreadsSharedVisualAssets({
        packageRoot: dir,
        sharedVisualPlan: basePlan({
          visuals: [
            {
              visualId: "social_visual_01",
              assetFamily: "social_static",
              role: "a",
              visualIntent: "a",
              generatedVisualNeeded: true,
              usages: [{ channel: "threads", slotIndex: 0 }],
            },
            {
              visualId: "social_visual_02",
              assetFamily: "social_static",
              role: "b",
              visualIntent: "b",
              generatedVisualNeeded: true,
              usages: [{ channel: "threads", slotIndex: 1 }],
            },
            {
              visualId: "social_visual_03",
              assetFamily: "social_static",
              role: "c",
              visualIntent: "c",
              generatedVisualNeeded: true,
              usages: [{ channel: "threads", slotIndex: 2 }],
            },
          ],
        }),
        manifest: manifestFor(dir, [
          { visualId: "social_visual_01", filename: "social_visual_01.png" },
          { visualId: "social_visual_03", filename: "social_visual_03.png" },
        ]),
      });
      expect(result.visuals.map((v) => v.slotIndex)).toEqual([0, 2]);
      expect(result.visuals.map((v) => v.visualId)).toEqual([
        "social_visual_01",
        "social_visual_03",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("L. Threads stale → empty + stale", () => {
    const dir = mkdtempSync(join(tmpdir(), "svd-l-"));
    try {
      writeAsset(dir, "social_visual_01.png", PNG_1X1);
      const result = resolveThreadsSharedVisualAssets({
        packageRoot: dir,
        sharedVisualPlan: basePlan(),
        manifest: manifestFor(
          dir,
          [{ visualId: "social_visual_01", filename: "social_visual_01.png" }],
          { sourceAssetVersion: 99 },
        ),
      });
      expect(result.stale).toBe(true);
      expect(result.visuals).toEqual([]);
      expect(result.primaryVisual).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("M. Threads primaryVisual — lowest uploaded slotIndex", () => {
    const dir = mkdtempSync(join(tmpdir(), "svd-m-"));
    try {
      writeAsset(dir, "social_visual_03.png", PNG_1X1);
      // slot 0 missing, slot 2 uploaded → primary = slot 2 (lowest present)
      const result = resolveThreadsSharedVisualAssets({
        packageRoot: dir,
        sharedVisualPlan: basePlan({
          visuals: [
            {
              visualId: "social_visual_01",
              assetFamily: "social_static",
              role: "a",
              visualIntent: "a",
              generatedVisualNeeded: true,
              usages: [{ channel: "threads", slotIndex: 0 }],
            },
            {
              visualId: "social_visual_03",
              assetFamily: "social_static",
              role: "c",
              visualIntent: "c",
              generatedVisualNeeded: true,
              usages: [{ channel: "threads", slotIndex: 2 }],
            },
          ],
        }),
        manifest: manifestFor(dir, [
          { visualId: "social_visual_03", filename: "social_visual_03.png" },
        ]),
      });
      expect(result.primaryVisual?.slotIndex).toBe(2);
      expect(result.primaryVisual?.visualId).toBe("social_visual_03");

      writeAsset(dir, "social_visual_01.png", PNG_1X1);
      const withZero = resolveThreadsSharedVisualAssets({
        packageRoot: dir,
        sharedVisualPlan: basePlan({
          visuals: [
            {
              visualId: "social_visual_01",
              assetFamily: "social_static",
              role: "a",
              visualIntent: "a",
              generatedVisualNeeded: true,
              usages: [{ channel: "threads", slotIndex: 0 }],
            },
            {
              visualId: "social_visual_03",
              assetFamily: "social_static",
              role: "c",
              visualIntent: "c",
              generatedVisualNeeded: true,
              usages: [{ channel: "threads", slotIndex: 2 }],
            },
          ],
        }),
        manifest: manifestFor(dir, [
          { visualId: "social_visual_01", filename: "social_visual_01.png" },
          { visualId: "social_visual_03", filename: "social_visual_03.png" },
        ]),
      });
      expect(withZero.primaryVisual?.slotIndex).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/**
 * Manual Astra Handoff Builder v1 — focused tests.
 */
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  SHARED_VISUAL_PLAN_CONTRACT,
  type SharedVisualPlan,
} from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import {
  MANUAL_ASTRA_HANDOFF_CONTRACT,
  MANUAL_ASTRA_HANDOFF_RELATIVE_PATH,
  buildManualAstraHandoff,
  isManualAstraHandoffStale,
  persistManualAstraHandoff,
  readManualAstraHandoff,
  type ManualAstraApprovedAssetContext,
} from "@/lib/marketing/publishable/manualAstraHandoff";

function plan(overrides: Partial<SharedVisualPlan> = {}): SharedVisualPlan {
  return {
    contract: SHARED_VISUAL_PLAN_CONTRACT,
    sourceAssetId: "asset_astra",
    sourceAssetVersion: 2,
    generatedAt: "2026-09-18T00:00:00.000Z",
    sourceVisualPlanFingerprint: "fp_abc123",
    visuals: [
      {
        visualId: "social_visual_01",
        assetFamily: "social_static",
        role: "cover_context",
        visualIntent: "북부 산악지역 establishing atmosphere",
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
        visualIntent: "local fact card (renderer)",
        visualMode: "fact_card",
        generatedVisualNeeded: false,
        usages: [{ channel: "instagram", cardId: "card-02" }],
      },
      {
        visualId: "social_visual_03",
        assetFamily: "social_static",
        role: "architecture_detail",
        visualIntent: "nhà trình tường architecture detail",
        visualMode: "object_or_detail",
        generatedVisualNeeded: true,
        usages: [{ channel: "instagram", cardId: "card-03" }],
      },
    ],
    ...overrides,
  };
}

const assetCtx: ManualAstraApprovedAssetContext = {
  titleKo: "또 다른 베트남 — 북부 국경의 생활문화",
  supportedClaimBoundaryKo: "공식 기록에 담긴 북부 지역 문화적 면모까지",
  limitationsKo: [
    "세부 마을 위치나 현장 체험 내용은 확인되지 않음",
    "현장에서 어떤 체험이 가능한지 확인되지 않음",
  ],
  forbiddenClaimsKo: ["현지인의 삶이 고스란히 담겨 있다"],
  storySupportVerdict: "SUPPORTED_WITH_LIMITS",
  editorialArchetype: "discovery",
};

describe("Manual Astra Handoff Builder v1", () => {
  it("A. generatedVisualNeeded filter — only true visuals", () => {
    const handoff = buildManualAstraHandoff({
      sharedVisualPlan: plan(),
      approvedAssetContext: assetCtx,
      now: new Date("2026-09-18T12:00:00.000Z"),
    });
    expect(handoff.visualCount).toBe(2);
    expect(handoff.visuals.map((v) => v.visualId)).toEqual([
      "social_visual_01",
      "social_visual_03",
    ]);
    expect(handoff.visuals.some((v) => v.visualId === "social_visual_02")).toBe(false);
  });

  it("B. master ID preserved — no renumbering", () => {
    const handoff = buildManualAstraHandoff({
      sharedVisualPlan: plan(),
      approvedAssetContext: assetCtx,
    });
    const v03 = handoff.visuals.find((v) => v.visualId === "social_visual_03");
    expect(v03?.expectedFilename).toBe("social_visual_03.png");
  });

  it("C. shared usage rendering in copyText", () => {
    const handoff = buildManualAstraHandoff({
      sharedVisualPlan: plan(),
      approvedAssetContext: assetCtx,
    });
    expect(handoff.copyText).toContain("Instagram card-01");
    expect(handoff.copyText).toContain("Threads image 1");
    expect(handoff.copyText).not.toMatch(/Threads image 0\b/);
  });

  it("D. Instagram-only → 4:5 + text-safe guidance", () => {
    const handoff = buildManualAstraHandoff({
      sharedVisualPlan: plan({
        visuals: [
          {
            visualId: "social_visual_01",
            assetFamily: "social_static",
            role: "cover",
            visualIntent: "establishing cover",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            usages: [{ channel: "instagram", cardId: "card-01" }],
          },
        ],
      }),
      approvedAssetContext: assetCtx,
    });
    expect(handoff.visuals[0]?.aspectRatio).toBe("4:5");
    expect(handoff.visuals[0]?.textSafeArea.toLowerCase()).toMatch(/overlay|headline|korean|clean/);
  });

  it("E. Threads-only → valid 4:5, no mandatory IG overlay copy", () => {
    const handoff = buildManualAstraHandoff({
      sharedVisualPlan: plan({
        visuals: [
          {
            visualId: "social_visual_01",
            assetFamily: "social_static",
            role: "cover_context",
            visualIntent: "threads establishing",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            usages: [{ channel: "threads", slotIndex: 0 }],
          },
        ],
      }),
      approvedAssetContext: assetCtx,
    });
    expect(handoff.visuals[0]?.aspectRatio).toBe("4:5");
    expect(handoff.visuals[0]?.textSafeArea).toMatch(/no mandatory text overlay/i);
    expect(handoff.copyText).toContain("Threads image 1");
  });

  it("F. evidence boundary constraints without restating forbidden claim positively", () => {
    const handoff = buildManualAstraHandoff({
      sharedVisualPlan: plan(),
      approvedAssetContext: assetCtx,
    });
    expect(handoff.copyText).toMatch(/illustrative editorial material|documentary/i);
    expect(handoff.copyText).toMatch(/village|마을|location|위치/i);
    expect(handoff.copyText).toMatch(/tourist activities|체험/i);
    expect(handoff.copyText).not.toContain("현지인의 삶이 고스란히 담겨 있다");
    expect(handoff.visuals[0]?.evidenceGuidance.some((g) => /private life|privileged/i.test(g))).toBe(
      true,
    );
  });

  it("G. no-text / no-logo / no-readable-signage policy", () => {
    const handoff = buildManualAstraHandoff({
      sharedVisualPlan: plan(),
      approvedAssetContext: assetCtx,
    });
    for (const v of handoff.visuals) {
      expect(v.generatedTextAllowed).toBe(false);
      expect(v.logoAllowed).toBe(false);
      expect(v.readableSignageAllowed).toBe(false);
    }
    expect(handoff.copyText).toMatch(/이미지 내부 텍스트:\n금지/);
    expect(handoff.copyText).toMatch(/로고:\n금지/);
  });

  it("H. deterministic output except generatedAt", () => {
    const a = buildManualAstraHandoff({
      sharedVisualPlan: plan(),
      approvedAssetContext: assetCtx,
      now: new Date("2026-09-18T01:00:00.000Z"),
    });
    const b = buildManualAstraHandoff({
      sharedVisualPlan: plan(),
      approvedAssetContext: assetCtx,
      now: new Date("2026-09-18T02:00:00.000Z"),
    });
    expect(a.generatedAt).not.toBe(b.generatedAt);
    expect(a.visuals).toEqual(b.visuals);
    expect(a.copyText).toBe(b.copyText);
    expect(a.batchInstructions).toEqual(b.batchInstructions);
    expect(a.visualCount).toBe(b.visualCount);
  });

  it("I. stale detection — fingerprint / asset version / same source", () => {
    const handoff = buildManualAstraHandoff({
      sharedVisualPlan: plan(),
      approvedAssetContext: assetCtx,
    });
    expect(
      isManualAstraHandoffStale({
        handoff,
        sharedVisualPlan: plan(),
      }),
    ).toBe(false);
    expect(
      isManualAstraHandoffStale({
        handoff,
        sharedVisualPlan: plan({ sourceVisualPlanFingerprint: "fp_changed" }),
      }),
    ).toBe(true);
    expect(
      isManualAstraHandoffStale({
        handoff,
        sharedVisualPlan: plan({ sourceAssetVersion: 9 }),
      }),
    ).toBe(true);
    expect(
      isManualAstraHandoffStale({
        handoff,
        sharedVisualPlan: plan({ sourceAssetId: "other_asset" }),
      }),
    ).toBe(true);
  });

  it("J. empty plan — valid zero-item handoff", () => {
    const handoff = buildManualAstraHandoff({
      sharedVisualPlan: plan({
        visuals: [
          {
            visualId: "social_visual_01",
            assetFamily: "social_static",
            role: "fact",
            visualIntent: "local only",
            visualMode: "fact_card",
            generatedVisualNeeded: false,
            usages: [{ channel: "instagram", cardId: "card-01" }],
          },
        ],
      }),
      approvedAssetContext: assetCtx,
    });
    expect(handoff.visualCount).toBe(0);
    expect(handoff.visuals).toEqual([]);
    expect(handoff.copyText).toMatch(/현재 Astra에서 생성할 외부 비주얼이 없습니다/);
  });

  it("K. persistence roundtrip", () => {
    const dir = mkdtempSync(join(tmpdir(), "astra-handoff-"));
    try {
      const handoff = buildManualAstraHandoff({
        sharedVisualPlan: plan(),
        approvedAssetContext: assetCtx,
        now: new Date("2026-09-18T12:00:00.000Z"),
      });
      persistManualAstraHandoff({ packageRoot: dir, handoff });
      const disk = JSON.parse(readFileSync(join(dir, MANUAL_ASTRA_HANDOFF_RELATIVE_PATH), "utf8"));
      expect(disk.contract).toBe(MANUAL_ASTRA_HANDOFF_CONTRACT);
      expect(disk.generationMode).toBe("manual_human_in_the_loop");
      const roundTrip = readManualAstraHandoff(dir);
      expect(roundTrip?.visualCount).toBe(2);
      expect(roundTrip?.visuals[0]?.expectedFilename).toBe("social_visual_01.png");
      expect(roundTrip?.copyText).toContain("social_visual_01.png");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

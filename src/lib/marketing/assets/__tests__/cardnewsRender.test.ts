import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import {
  CARDNEWS_HEIGHT,
  CARDNEWS_MEDIA_TYPE,
  CARDNEWS_WIDTH,
  CardNewsRenderOverflowError,
  CardNewsVisualError,
  MarketingAssetConflictError,
  MarketingAssetPathError,
  createCardNewsVerificationBrief,
  fitText,
  parseMarketingAssetManifest,
  parseRenderMarketingCardNewsArgs,
  renderCardNewsPackage,
  sha256Buffer,
  wrapText,
} from "@/lib/marketing/assets";
import { CARDNEWS_SAFE } from "@/lib/marketing/assets/cardnews/brand";

const tempDirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "cardnews-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function briefWith(mutate: (brief: ReturnType<typeof createCardNewsVerificationBrief>) => void) {
  const brief = createCardNewsVerificationBrief();
  mutate(brief);
  return brief;
}

describe("CardNews text layout", () => {
  it("8. wraps Korean multiline body", () => {
    const lines = wrapText("가을 단풍 시즌을 앞두고 이동 예약 정보가 바뀌었습니다.", 30, 400);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toContain("단풍");
  });

  it("10. irreducibly oversized content causes typed overflow", () => {
    const huge = Array.from({ length: 80 }, (_, index) => `확인된 사실 ${index} 번째 줄입니다.`).join("\n");
    expect(() =>
      fitText({
        text: huge,
        preferredFontSize: 30,
        minFontSize: CARDNEWS_SAFE.minBodyPx,
        maxWidth: 800,
        maxHeight: 200,
        maxLines: 4,
        overflow: "error",
        cardId: "card-overflow",
        field: "body",
      }),
    ).toThrow(CardNewsRenderOverflowError);
  });

  it("11. minimum readable font size is enforced", () => {
    const fitted = fitText({
      text: "짧은 본문",
      preferredFontSize: 32,
      minFontSize: 20,
      maxWidth: 800,
      maxHeight: 200,
      maxLines: 3,
      overflow: "error",
      cardId: "card-min",
      field: "body",
    });
    expect(fitted.fontSize).toBeGreaterThanOrEqual(CARDNEWS_SAFE.minBodyPx);
  });
});

describe("CardNews renderer", () => {
  it("1-7, 12, 21-23. renders a Korean graphic-only package at 1080×1350 PNG", async () => {
    const root = tempRoot();
    const result = await renderCardNewsPackage({
      mediaBrief: createCardNewsVerificationBrief(),
      assetRoot: root,
      graphicOnly: true,
      now: new Date("2026-09-03T00:00:00.000Z"),
    });
    expect(result.status).toBe("rendered");
    expect(result.render?.cards.map((card) => card.cardRole)).toEqual([
      "cover",
      "information",
      "information",
      "information",
      "evidence",
      "cta",
    ]);
    for (const card of result.render!.cards) {
      const png = readFileSync(join(result.packageRoot, card.relativePath));
      const meta = await sharp(png).metadata();
      expect(meta.width).toBe(CARDNEWS_WIDTH);
      expect(meta.height).toBe(CARDNEWS_HEIGHT);
      expect(meta.format).toBe("png");
      expect(card.mediaType).toBe(CARDNEWS_MEDIA_TYPE);
      expect(card.relativePath.startsWith("cardnews/card-")).toBe(true);
      expect(card.relativePath.startsWith("/")).toBe(false);
      expect(card.relativePath.includes("..")).toBe(false);
      expect(card.sha256).toBe(sha256Buffer(png));
      expect(card.byteSize).toBe(png.byteLength);
      const stats = await sharp(png).stats();
      expect(stats.channels[0].mean).toBeLessThan(252);
    }
    const manifest = parseMarketingAssetManifest(
      JSON.parse(readFileSync(join(result.packageRoot, "manifest.json"), "utf8")),
    );
    expect(manifest.artifacts.every((artifact) => !artifact.relativePath.startsWith("/"))).toBe(true);
    expect(manifest.artifacts.some((artifact) => artifact.kind === "cardnews" && artifact.sha256.length === 64)).toBe(
      true,
    );
  }, 30_000);

  it("9. long wrapped text stays inside the canvas box", () => {
    const fitted = fitText({
      text: "가을 단풍 시즌을 앞두고 이동·예약 정보가 바뀌었습니다. 출발 전에 최신 공지를 확인하면 일정을 덜 흔들립니다. 교통편 운행 시간과 입장 예약을 순서대로 점검하세요.",
      preferredFontSize: 30,
      minFontSize: CARDNEWS_SAFE.minBodyPx,
      maxWidth: CARDNEWS_WIDTH - CARDNEWS_SAFE.padX * 2,
      maxHeight: 360,
      maxLines: 8,
      overflow: "error",
      cardId: "card-long",
      field: "body",
    });
    expect(fitted.height).toBeLessThanOrEqual(360);
    expect(fitted.fontSize).toBeGreaterThanOrEqual(CARDNEWS_SAFE.minBodyPx);
  });

  it("13. optional local PNG visual renders", async () => {
    const root = tempRoot();
    const visualPath = join(root, "local-visual.png");
    await sharp({
      create: { width: 320, height: 320, channels: 3, background: { r: 30, g: 90, b: 140 } },
    })
      .png()
      .toFile(visualPath);
    const withVisual = await renderCardNewsPackage({
      mediaBrief: createCardNewsVerificationBrief(),
      assetRoot: root,
      visuals: { "card-cover": visualPath },
      allowedVisualRoots: [root],
      now: new Date("2026-09-03T00:00:00.000Z"),
    });
    const graphicOnly = await renderCardNewsPackage({
      mediaBrief: briefWith((brief) => {
        brief.candidateId = "dev-cardnews-a3-visual-compare";
      }),
      assetRoot: root,
      graphicOnly: true,
      now: new Date("2026-09-03T00:00:00.000Z"),
    });
    const visualHash = withVisual.render!.cards[0].sha256;
    const graphicHash = graphicOnly.render!.cards[0].sha256;
    expect(visualHash).not.toBe(graphicHash);
    expect(withVisual.render!.cards[0].visualAssetId).toBe("local:card-cover");
  }, 30_000);

  it("14. external URL visuals are rejected and not fetched", async () => {
    await expect(
      renderCardNewsPackage({
        mediaBrief: createCardNewsVerificationBrief(),
        assetRoot: tempRoot(),
        visuals: { "card-cover": "https://example.com/photo.jpg" },
      }),
    ).rejects.toThrow(CardNewsVisualError);
  });

  it("15-17. evidence linkage is preserved, unlinked refs are omitted, empty refs fabricate nothing", async () => {
    const root = tempRoot();
    const linked = await renderCardNewsPackage({
      mediaBrief: createCardNewsVerificationBrief(),
      assetRoot: root,
      graphicOnly: true,
      now: new Date("2026-09-03T00:00:00.000Z"),
    });
    const evidenceSvgLinked = linked.render!.cards.find((card) => card.cardRole === "evidence");
    expect(evidenceSvgLinked).toBeTruthy();

    const unlinkedRoot = tempRoot();
    const unlinked = await renderCardNewsPackage({
      mediaBrief: briefWith((brief) => {
        brief.candidateId = "dev-cardnews-unlinked";
        const evidence = brief.formats.cardnews.cards.find((card) => card.role === "evidence");
        if (evidence) evidence.evidenceRefs = ["ev-invented"];
      }),
      assetRoot: unlinkedRoot,
      graphicOnly: true,
      now: new Date("2026-09-03T00:00:00.000Z"),
    });
    const missing = await renderCardNewsPackage({
      mediaBrief: briefWith((brief) => {
        brief.candidateId = "dev-cardnews-no-evidence";
        const evidence = brief.formats.cardnews.cards.find((card) => card.role === "evidence");
        if (evidence) evidence.evidenceRefs = [];
      }),
      assetRoot: unlinkedRoot,
      graphicOnly: true,
      now: new Date("2026-09-03T00:00:00.000Z"),
    });
    expect(unlinked.render!.cards.find((card) => card.cardRole === "evidence")?.sha256).toBe(
      missing.render!.cards.find((card) => card.cardRole === "evidence")?.sha256,
    );
    expect(linked.render!.cards.find((card) => card.cardRole === "evidence")?.sha256).not.toBe(
      missing.render!.cards.find((card) => card.cardRole === "evidence")?.sha256,
    );
  }, 30_000);

  it("18, 19, 24. same input produces identical hashes and is idempotent", async () => {
    const root = tempRoot();
    const brief = createCardNewsVerificationBrief();
    const first = await renderCardNewsPackage({
      mediaBrief: brief,
      assetRoot: root,
      graphicOnly: true,
      now: new Date("2026-09-03T00:00:00.000Z"),
    });
    const second = await renderCardNewsPackage({
      mediaBrief: brief,
      assetRoot: root,
      graphicOnly: true,
      now: new Date("2026-09-04T00:00:00.000Z"),
    });
    expect(second.reused).toBe(true);
    expect(second.wrote).toBe(false);
    expect(first.render!.cards.map((card) => card.sha256)).toEqual(second.render!.cards.map((card) => card.sha256));
    expect(createHash("sha256").update(readFileSync(join(first.packageRoot, "cardnews/card-01.png"))).digest("hex")).toBe(
      first.render!.cards[0].sha256,
    );
  }, 30_000);

  it("20. changed content at the same artifact path conflicts", async () => {
    const root = tempRoot();
    const first = await renderCardNewsPackage({
      mediaBrief: createCardNewsVerificationBrief(),
      assetRoot: root,
      graphicOnly: true,
      now: new Date("2026-09-03T00:00:00.000Z"),
    });
    writeFileSync(join(first.packageRoot, "cardnews/card-01.png"), "tampered");
    await expect(
      renderCardNewsPackage({
        mediaBrief: createCardNewsVerificationBrief(),
        assetRoot: root,
        graphicOnly: true,
        now: new Date("2026-09-03T00:00:00.000Z"),
      }),
    ).rejects.toThrow(MarketingAssetConflictError);
  }, 30_000);

  it("25. dry-run writes zero files", async () => {
    const root = join(tempRoot(), "missing");
    const result = await renderCardNewsPackage({
      mediaBrief: createCardNewsVerificationBrief(),
      assetRoot: root,
      dryRun: true,
      graphicOnly: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.wrote).toBe(false);
    expect(existsSync(root)).toBe(false);
    expect(result.plannedRelativePaths.some((path) => path.endsWith(".png"))).toBe(true);
  });

  it("26. cardnews disabled performs no render", async () => {
    const root = tempRoot();
    const result = await renderCardNewsPackage({
      mediaBrief: briefWith((brief) => {
        brief.formats.cardnews.enabled = false;
      }),
      assetRoot: root,
    });
    expect(result.status).toBe("not_applicable");
    expect(result.reason).toBe("cardnews_disabled");
    expect(existsSync(join(root, "2026/09/03/dev-cardnews-a3-verification/cardnews/card-01.png"))).toBe(false);
  });

  it("27. malicious local visual paths cannot escape", async () => {
    await expect(
      renderCardNewsPackage({
        mediaBrief: createCardNewsVerificationBrief(),
        assetRoot: tempRoot(),
        visuals: { "card-cover": "../etc/passwd" },
      }),
    ).rejects.toThrow(MarketingAssetPathError);
  });

  it("28. render metadata has no secret-like fields", async () => {
    const root = tempRoot();
    const result = await renderCardNewsPackage({
      mediaBrief: createCardNewsVerificationBrief(),
      assetRoot: root,
      graphicOnly: true,
      now: new Date("2026-09-03T00:00:00.000Z"),
    });
    const renderJson = JSON.parse(readFileSync(join(result.packageRoot, "cardnews/render.json"), "utf8"));
    expect(jsonContainsForbiddenBotLeak(renderJson)).toBe(false);
    expect(JSON.stringify(renderJson)).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|api[_-]?key|authorization|embedding/i);
  }, 30_000);

  it("parses CLI args", () => {
    expect(
      parseRenderMarketingCardNewsArgs([
        "--fixture",
        "--root",
        "/mnt/HDD2TB/marketing-assets",
        "--output-mode",
        "graphic-only",
        "--dry-run",
      ]),
    ).toEqual({
      candidateId: undefined,
      root: "/mnt/HDD2TB/marketing-assets",
      dryRun: true,
      graphicOnly: true,
      fixture: true,
    });
  });
});

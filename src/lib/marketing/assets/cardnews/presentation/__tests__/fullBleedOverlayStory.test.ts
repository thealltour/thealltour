/**
 * cardnews-render-v2.5 full-bleed overlay story regressions.
 */

import { describe, expect, it } from "vitest";

import {
  CARDNEWS_RENDERER_VERSION,
  resolveCardNewsGeometry,
} from "@/lib/marketing/assets/cardnews/brand";
import type { CardNewsCard } from "@/lib/marketing/assets/contracts";
import { buildDeterministicCardPresentationPlan } from "@/lib/marketing/assets/cardnews/presentation/deterministic";
import { buildResolvedCardRenderSpec } from "@/lib/marketing/assets/cardnews/presentation/resolveRenderSpec";
import { buildCardNewsSvgFromSpec } from "@/lib/marketing/assets/cardnews/svg";
import type { CardPresentation } from "@/lib/marketing/assets/cardnews/presentation/contracts";
import { TYPOGRAPHY_V23_BASELINE } from "@/lib/marketing/assets/cardnews/typographyTokens";
import { buildTextSafeArea } from "@/lib/marketing/publishable/manualAstraHandoff/compositionGuidance";
import type { SharedVisual } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";

function card(overrides: Partial<CardNewsCard> & Pick<CardNewsCard, "cardId" | "headline">): CardNewsCard {
  return {
    role: "information",
    body: "",
    visualIntent: "",
    evidenceRefs: [],
    ...overrides,
  };
}

function overlayPresentation(cardId: string, density: CardPresentation["textDensity"] = "standard"): CardPresentation {
  return {
    cardId,
    template: "photo_overlay_editorial",
    imagePlacement: "full",
    imageHeightRatio: 1,
    cropMode: "cover",
    focalAlignment: "center",
    textPlacement: "overlay-bottom",
    overlayMode: "gradient_dark",
    textDensity: density,
  };
}

function coverPresentation(): CardPresentation {
  return {
    cardId: "card-01",
    template: "cover_full_bleed",
    imagePlacement: "full",
    imageHeightRatio: 1,
    cropMode: "cover",
    focalAlignment: "center",
    textPlacement: "overlay-bottom",
    overlayMode: "gradient_dark",
    textDensity: "compact",
  };
}

function closingPresentation(): CardPresentation {
  return {
    cardId: "card-05",
    template: "closing_insight",
    imageHeightRatio: 0,
    cropMode: "cover",
    focalAlignment: "center",
    textPlacement: "bottom",
    overlayMode: "none",
    textDensity: "standard",
  };
}

const VIET = "전통 가옥 ‘nhà trình tường’은 흙을 단단하게 다져 올린 흙다짐 주택입니다.";

describe("cardnews v2.5 full-bleed overlay story", () => {
  it("bumps renderer version", () => {
    expect(CARDNEWS_RENDERER_VERSION).toBe("cardnews-render-v2.5-full-bleed-overlay-story");
  });

  it("A–C. Dao presentation: cover / overlay×3 / closing", () => {
    const plan = buildDeterministicCardPresentationPlan({
      assetId: "dao",
      assetVersion: 1,
      sourceInstagramFingerprint: "fp",
      cards: [
        { cardId: "card-01", role: "hook_cover", hasVisual: true },
        { cardId: "card-02", role: "reframe", hasVisual: true },
        { cardId: "card-03", role: "context", hasVisual: true },
        {
          cardId: "card-04",
          role: "evidence_detail",
          hasVisual: true,
          headlineHint: "nhà trình tường",
        },
        { cardId: "card-05", role: "closing", hasVisual: false },
      ],
    });
    expect(plan.cards.map((c) => c.template)).toEqual([
      "cover_full_bleed",
      "photo_overlay_editorial",
      "photo_overlay_editorial",
      "photo_overlay_editorial",
      "closing_insight",
    ]);
  });

  it("D/E. evidence role does not force inset; template is presentation authority", () => {
    const plan = buildDeterministicCardPresentationPlan({
      assetId: "dao",
      assetVersion: 1,
      sourceInstagramFingerprint: "fp",
      cards: [
        {
          cardId: "card-04",
          role: "evidence_detail",
          hasVisual: true,
          headlineHint: "architecture detail nhà",
        },
      ],
    });
    expect(plan.cards[0]!.template).toBe("photo_overlay_editorial");
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-04",
        role: "evidence",
        headline: "nhà trình tường",
        body: VIET,
      }),
      index: 4,
      total: 5,
      presentation: plan.cards[0]!,
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.layout.template).toBe("photo_overlay_editorial");
    expect(spec.layout.image).toEqual({ x: 0, y: 0, width: 1080, height: 1350, rx: 0 });
  });

  it("A. photo_overlay image full canvas", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-02",
        headline: "북쪽 국경으로 향하는 순간",
        body: "북부 국경 산악 지대로 올라가면 지형과 여행의 리듬이 달라집니다.",
      }),
      index: 2,
      total: 5,
      presentation: overlayPresentation("card-02"),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.layout.image).toEqual({ x: 0, y: 0, width: geo.width, height: geo.height, rx: 0 });
  });

  it("B/C. no white panel; gradient exists", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-02",
        headline: "헤드",
        body: "본문입니다. 산악 지형의 리듬이 달라집니다.",
      }),
      index: 2,
      total: 5,
      presentation: overlayPresentation("card-02"),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.layout.text.fill).toBe("transparent");
    expect(spec.layout.overlay?.mode).toBe("gradient_dark");
    expect(spec.layout.overlay!.height).toBeGreaterThan(200);
    const svg = buildCardNewsSvgFromSpec(spec, geo);
    expect(svg).toContain("linearGradient");
    expect(svg).not.toMatch(/fill="#F7F9FB"/); // paper panel absent on overlay
  });

  it("D/E. text in lower band; footer safe", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-03",
        headline: "랑선 Dao족 마을",
        body: "산비탈 경작지와 주거 공간이 이어지는 북부 산악 생활환경입니다.",
      }),
      index: 3,
      total: 5,
      presentation: overlayPresentation("card-03"),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    const bandTop = spec.layout.contentAware!.textBandTop!;
    expect(bandTop).toBeGreaterThan(geo.height * 0.35);
    const textBottom = bandTop + spec.layout.contentAware!.textBlockHeight;
    expect(textBottom).toBeLessThanOrEqual(spec.layout.contentAware!.footerSafeY! + 1);
    expect(spec.layout.brand.progressY).toBeGreaterThan(textBottom - 40);
  });

  it("F. contrast mechanism present (gradient + white text)", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({ cardId: "card-02", headline: "헤드", body: "밝은 해변 위에서도 읽히는 본문" }),
      index: 2,
      total: 5,
      presentation: overlayPresentation("card-02"),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.layout.text.headlineFill.toLowerCase()).toContain("fff");
    expect(spec.layout.overlay?.mode).toBe("gradient_dark");
    const svg = buildCardNewsSvgFromSpec(spec, geo);
    expect(svg).toMatch(/drop-shadow|rgba\(8,12,20/);
  });

  it("G/H. word-aware wrap; Vietnamese phrase intact", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-04",
        role: "evidence",
        headline: "전통 판축 가옥 nhà trình tường",
        body: VIET,
      }),
      index: 4,
      total: 5,
      presentation: overlayPresentation("card-04"),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.body.characterFallback).toBe(false);
    expect(spec.body.lines.join(" ")).toContain("nhà");
    expect(spec.body.lines.join("|")).not.toMatch(/trì\|nh|tườ\|ng/u);
    expect(spec.body.ellipsisApplied).toBe(false);
  });

  it("I. mobile body size stays above v2.3 baseline", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-02",
        headline: "북쪽 국경",
        body: "북부 국경 산악 지대로 올라가면 지형과 여행의 리듬이 달라집니다.",
      }),
      index: 2,
      total: 5,
      presentation: overlayPresentation("card-02"),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.body.fontSize).toBeGreaterThanOrEqual(TYPOGRAPHY_V23_BASELINE.bodyPreferred.standard);
  });

  it("J. 1:1 no overflow", () => {
    const geo = resolveCardNewsGeometry("1:1");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-02",
        headline: "북쪽 국경으로 향하는 순간",
        body: "북부 국경 산악 지대로 올라가면 지형과 여행의 리듬이 달라집니다.",
      }),
      index: 2,
      total: 5,
      presentation: overlayPresentation("card-02"),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.layout.image!.height).toBe(geo.height);
    const bottom =
      (spec.layout.contentAware!.textBandTop ?? 0) +
      (spec.layout.contentAware!.textBlockHeight ?? 0);
    expect(bottom).toBeLessThanOrEqual(geo.height);
  });

  it("K. cover regression — full-bleed + overlay", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-01",
        role: "cover",
        headline: "해변으로 기억하는 베트남",
        body: "다낭·푸꾸옥·리조트 이미지가 먼저 떠오릅니다",
      }),
      index: 1,
      total: 5,
      presentation: coverPresentation(),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.layout.template).toBe("cover_full_bleed");
    expect(spec.layout.image).toEqual({ x: 0, y: 0, width: 1080, height: 1350, rx: 0 });
  });

  it("L. closing regression — text-only, no image", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-05",
        role: "cta",
        headline: "휴양 프레임 밖에서",
        body: "랑선 Dao족 마을과 흙다짐 가옥까지 이어진 리듬이 payoff입니다",
      }),
      index: 5,
      total: 5,
      presentation: closingPresentation(),
      citation: null,
      visualDataUri: null,
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.layout.template).toBe("closing_insight");
    expect(spec.layout.image).toBeNull();
  });

  it("Astra handoff: lower-third text-safe intent", () => {
    const visual = {
      visualId: "social_visual_01",
      assetFamily: "social_static",
      role: "cover",
      visualIntent: "beach",
      visualMode: "editorial_photo",
      generatedVisualNeeded: true,
      usages: [{ channel: "instagram", cardId: "card-01" }],
    } as SharedVisual;
    const safe = buildTextSafeArea(visual).toLowerCase();
    expect(safe).toMatch(/lower third/);
    expect(safe).toMatch(/overlay/);
    expect(safe).toMatch(/korean/);
  });
});

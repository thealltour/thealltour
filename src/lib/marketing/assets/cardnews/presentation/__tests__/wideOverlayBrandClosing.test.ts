/**
 * cardnews-render-v2.6 wide overlay typography + brand-signature closing (A–N).
 */

import { describe, expect, it } from "vitest";

import {
  CARDNEWS_RENDERER_VERSION,
  CARDNEWS_WORDMARK_TEXT,
  resolveCardNewsGeometry,
} from "@/lib/marketing/assets/cardnews/brand";
import type { CardNewsCard } from "@/lib/marketing/assets/contracts";
import {
  TYPOGRAPHY_PREFERRED,
  TYPOGRAPHY_V25_BASELINE,
  TYPOGRAPHY_WEIGHT,
  preferredBodyPx,
  preferredHeadlinePx,
} from "@/lib/marketing/assets/cardnews/typographyTokens";
import {
  OVERLAY_TEXT_INSETS,
  overlayTextMaxWidth,
} from "@/lib/marketing/assets/cardnews/overlayTextInsets";
import { buildResolvedCardRenderSpec } from "@/lib/marketing/assets/cardnews/presentation/resolveRenderSpec";
import { buildDeterministicCardPresentationPlan } from "@/lib/marketing/assets/cardnews/presentation/deterministic";
import { buildCardNewsSvgFromSpec } from "@/lib/marketing/assets/cardnews/svg";
import type { CardPresentation } from "@/lib/marketing/assets/cardnews/presentation/contracts";

function card(overrides: Partial<CardNewsCard> & Pick<CardNewsCard, "cardId" | "headline">): CardNewsCard {
  return {
    role: "information",
    body: "",
    visualIntent: "",
    evidenceRefs: [],
    ...overrides,
  };
}

function overlayPresentation(cardId: string): CardPresentation {
  return {
    cardId,
    template: "photo_overlay_editorial",
    imagePlacement: "full",
    imageHeightRatio: 1,
    cropMode: "cover",
    focalAlignment: "center",
    textPlacement: "overlay-bottom",
    overlayMode: "gradient_dark",
    textDensity: "standard",
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
    textDensity: "standard",
  };
}

function closingPresentation(): CardPresentation {
  return {
    cardId: "card-05",
    template: "closing_insight",
    imagePlacement: "full",
    imageHeightRatio: 0,
    cropMode: "cover",
    focalAlignment: "center",
    textPlacement: "bottom",
    overlayMode: "none",
    textDensity: "standard",
  };
}

const CTA_FORBIDDEN = [
  "검색",
  "여행플래너",
  "골프달력",
  "상담",
  "예약",
  "Follow",
  "Like",
  "문의",
];

describe("cardnews v2.6 wide overlay + brand closing", () => {
  it("version bump", () => {
    expect(CARDNEWS_RENDERER_VERSION).toBe(
      "cardnews-render-v2.6-wide-overlay-brand-closing",
    );
  });

  it("A. card-01 body typography parity with story overlay", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const cover = buildResolvedCardRenderSpec({
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
    const story = buildResolvedCardRenderSpec({
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
    expect(preferredBodyPx("standard", "cover")).toBe(
      preferredBodyPx("standard", "story"),
    );
    expect(cover.body.fontSize).toBeGreaterThanOrEqual(story.body.fontSize - 2);
    expect(cover.body.fontSize).toBeGreaterThan(
      TYPOGRAPHY_V25_BASELINE.body.cover.standard,
    );
  });

  it("B–C. overlay maxWidth wider than v2.5; right safe inset kept", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const width = overlayTextMaxWidth(geo.width);
    expect(width).toBeGreaterThan(TYPOGRAPHY_V25_BASELINE.overlayTextWidth4x5);
    expect(OVERLAY_TEXT_INSETS.right).toBeGreaterThanOrEqual(32);
    expect(OVERLAY_TEXT_INSETS.left + width + OVERLAY_TEXT_INSETS.right).toBe(
      geo.width,
    );
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
    expect(spec.layout.text.width).toBe(width);
    expect(spec.layout.text.x).toBe(OVERLAY_TEXT_INSETS.left);
    const rightInset = geo.width - (spec.layout.text.x + spec.layout.text.width);
    expect(rightInset).toBe(OVERLAY_TEXT_INSETS.right);
    expect(rightInset).toBeGreaterThan(0);
  });

  it("D. headline/body preferred sizes increase vs v2.5", () => {
    expect(TYPOGRAPHY_PREFERRED.headline.story.standard).toBeGreaterThan(
      TYPOGRAPHY_V25_BASELINE.headline.story.standard,
    );
    expect(TYPOGRAPHY_PREFERRED.body.story.standard).toBeGreaterThan(
      TYPOGRAPHY_V25_BASELINE.body.story.standard,
    );
    expect(preferredHeadlinePx("standard", "story")).toBeGreaterThanOrEqual(68);
    expect(preferredBodyPx("standard", "story")).toBeGreaterThanOrEqual(54);
  });

  it("E. no overflow on overlay cards", () => {
    const geo = resolveCardNewsGeometry("4:5");
    for (const id of ["card-02", "card-03", "card-04"] as const) {
      const spec = buildResolvedCardRenderSpec({
        card: card({
          cardId: id,
          headline: "북쪽 국경으로 향하는 순간, 리듬이 바뀐다",
          body: "북부 국경 산악 지대로 올라가면 지형과 여행의 리듬이 달라집니다. 산길이 이어집니다.",
        }),
        index: 2,
        total: 5,
        presentation: overlayPresentation(id),
        citation: null,
        visualDataUri: "data:image/png;base64,aaa",
        wordmarkDataUri: null,
        geometry: geo,
      });
      expect(spec.headline.ellipsisApplied).toBe(false);
      expect(spec.body.ellipsisApplied).toBe(false);
      const bottom =
        (spec.layout.contentAware?.textBandTop ?? 0) +
        (spec.layout.contentAware?.textBlockHeight ?? 0);
      expect(bottom).toBeLessThanOrEqual(geo.height);
    }
  });

  it("F. Korean wrapping preserved", () => {
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
    expect(spec.body.characterFallback).toBe(false);
    expect(spec.headline.characterFallback).toBe(false);
  });

  it("G. Vietnamese wrapping preserved", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-04",
        role: "evidence",
        headline: "nhà trình tường",
        body: "흙다짐 벽면 질감이 nhà trình tường 구조의 증거를 보여줍니다.",
      }),
      index: 4,
      total: 5,
      presentation: overlayPresentation("card-04"),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.headline.characterFallback).toBe(false);
    const joined = spec.headline.lines.join("|");
    expect(joined).not.toMatch(/tư\||\|ờng|trì\||\|nh|tườ\||\|ng/u);
    expect(joined).toContain("tường");
    expect(spec.headline.lines.some((l) => /nhà trình tường/.test(l))).toBe(true);
    expect(spec.body.lines.join(" ")).toContain("nhà");
  });

  it("H. card-04 no evidence inset regression", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-04",
        role: "evidence",
        headline: "nhà trình tường",
        body: "흙다짐 벽면 질감이 구조를 보여줍니다.",
      }),
      index: 4,
      total: 5,
      presentation: overlayPresentation("card-04"),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.layout.template).toBe("photo_overlay_editorial");
    expect(spec.layout.image).toEqual({
      x: 0,
      y: 0,
      width: geo.width,
      height: geo.height,
      rx: 0,
    });
  });

  it("I–J. card-05 brand signature present; no CTA", () => {
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
    expect(spec.layout.brand.signatureRule).toBeDefined();
    expect(spec.layout.brand.wordmark.width).toBeGreaterThanOrEqual(300);
    expect(spec.layout.brand.wordmark.height).toBeGreaterThanOrEqual(50);
    expect(spec.layout.brand.showEditorialAccent).toBe(true);
    const svg = buildCardNewsSvgFromSpec(spec, geo);
    expect(svg).toContain(CARDNEWS_WORDMARK_TEXT);
    expect(svg).toMatch(/signatureRule|width="112"|fill="#D7DEE6"/);
    for (const banned of CTA_FORBIDDEN) {
      expect(svg).not.toContain(banned);
    }
    expect(svg).not.toMatch(/여행플래너|골프달력|상담 문의|예약 유도/);
  });

  it("K. 4:5 hierarchy weights + safe overlay", () => {
    expect(TYPOGRAPHY_WEIGHT.headline).toBe(700);
    expect(TYPOGRAPHY_WEIGHT.body).toBe(500);
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
    const svg = buildCardNewsSvgFromSpec(spec, geo);
    expect(svg).toMatch(/drop-shadow\(0 3px 10px/);
    expect(svg).toMatch(/drop-shadow\(0 2px 6px/);
    expect(spec.headline.fontSize).toBeGreaterThan(spec.body.fontSize);
  });

  it("L. 1:1 safe with format scale (no overflow)", () => {
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
    expect(spec.headline.fontSize).toBeLessThanOrEqual(
      preferredHeadlinePx("standard", "story"),
    );
    const bottom =
      (spec.layout.contentAware?.textBandTop ?? 0) +
      (spec.layout.contentAware?.textBlockHeight ?? 0);
    expect(bottom).toBeLessThanOrEqual(geo.height);
  });

  it("M. Presentation regressions — Dao templates", () => {
    const plan = buildDeterministicCardPresentationPlan({
      assetId: "dao-v26",
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
    expect(plan.cards[0]!.textDensity).toBe("standard");
  });

  it("N. cover + story share overlay family width", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const cover = buildResolvedCardRenderSpec({
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
    const story = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-02",
        headline: "북쪽 국경",
        body: "북부 국경 산악 지대로 올라가면 리듬이 달라집니다.",
      }),
      index: 2,
      total: 5,
      presentation: overlayPresentation("card-02"),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(cover.layout.text.width).toBe(story.layout.text.width);
    expect(cover.layout.text.x).toBe(story.layout.text.x);
  });
});

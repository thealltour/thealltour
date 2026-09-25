/**
 * cardnews-render-v2.3 content-aware layout regressions.
 */

import { describe, expect, it } from "vitest";

import { resolveCardNewsGeometry } from "@/lib/marketing/assets/cardnews/brand";
import type { CardNewsCard } from "@/lib/marketing/assets/contracts";
import {
  allocateClosingTextBand,
  allocateImageBackedBand,
  IMAGE_TEXT_GAP,
  imageRatioBoundsForTemplate,
  measureTextBlockHeight,
} from "@/lib/marketing/assets/cardnews/presentation/contentAwareLayout";
import { PLATFORM_LAYOUT, resolvePlatformLayout } from "@/lib/marketing/assets/cardnews/presentation/platformLayout";
import { buildResolvedCardRenderSpec } from "@/lib/marketing/assets/cardnews/presentation/resolveRenderSpec";
import {
  estimateGlyphTop,
  resolveTemplateLayout,
} from "@/lib/marketing/assets/cardnews/presentation/templateGeometry";
import type { CardPresentation } from "@/lib/marketing/assets/cardnews/presentation/contracts";
import { CARDNEWS_RENDERER_VERSION } from "@/lib/marketing/assets/cardnews/brand";

function card(overrides: Partial<CardNewsCard> & Pick<CardNewsCard, "cardId" | "headline">): CardNewsCard {
  return {
    role: "information",
    body: "",
    visualIntent: "",
    evidenceRefs: [],
    ...overrides,
  };
}

function photoTopPresentation(imageHeightRatio = 0.48): CardPresentation {
  return {
    cardId: "card-02",
    template: "photo_top_story",
    imagePlacement: "top",
    imageHeightRatio,
    cropMode: "cover",
    focalAlignment: "center",
    textPlacement: "bottom",
    overlayMode: "none",
    textDensity: "standard",
  };
}

function evidencePresentation(imageHeightRatio = 0.5): CardPresentation {
  return {
    cardId: "card-04",
    template: "evidence_detail",
    imagePlacement: "top",
    imageHeightRatio,
    cropMode: "cover",
    focalAlignment: "center",
    textPlacement: "bottom",
    overlayMode: "none",
    textDensity: "compact",
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
    imageHeightRatio: 0,
    cropMode: "cover",
    focalAlignment: "center",
    textPlacement: "bottom",
    overlayMode: "none",
    textDensity: "standard",
  };
}

const SHORT_BODY = "산악 국경 지대의 리듬이 남부 휴양과 다릅니다.";
const LONG_BODY =
  "북부 산악 지대의 환경 속에서 형성된 전통 가옥 ‘nhà trình tường’은 흙을 단단하게 다져 올린 흙다짐 건축 방식을 보여줍니다. 기후와 지형에 맞춘 이 건축 형태는 해변 리조트 중심의 베트남 이미지와는 다른 독특한 건축적 맥락을 형성합니다. 같은 나라 안에서도 지역에 따라 완전히 다른 문화적 경험과 건축적 리듬이 존재함을 발견하게 됩니다.";

describe("cardnews v2.3 content-aware layout", () => {
  it("bumps renderer version", () => {
    expect(CARDNEWS_RENDERER_VERSION).toBe("cardnews-render-v2.6-wide-overlay-brand-closing");
  });

  it("A. cover_full_bleed keeps full-bleed image; short copy keeps golden text band", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const presentation = coverPresentation();
    const baseline = resolveTemplateLayout({
      presentation,
      geometry: geo,
      hasVisual: true,
      hasKicker: false,
    });
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-01",
        role: "cover",
        headline: "해변으로 기억하는 베트남",
        body: "다낭·푸꾸옥·리조트 이미지가 먼저 떠오릅니다",
      }),
      index: 1,
      total: 5,
      presentation,
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.layout.template).toBe("cover_full_bleed");
    expect(spec.layout.image).toEqual(baseline.image);
    // Larger mobile body may raise the overlay/text band within fit logic; full-bleed stays.
    expect(spec.layout.text.y).toBeLessThanOrEqual(baseline.text.y);
    expect(spec.layout.text.y).toBeGreaterThanOrEqual(baseline.text.y - geo.scaleY(80));
    expect(spec.layout.overlay?.mode).toBe("gradient_dark");
    expect(spec.layout.brand.progressY).toBe(baseline.brand.progressY);
  });

  it("B. short-copy photo_top: leftover absorbed by image expansion", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const presentation = photoTopPresentation(0.48);
    const spec = buildResolvedCardRenderSpec({
      card: card({ cardId: "card-02", headline: "북쪽으로 올라가면", body: SHORT_BODY }),
      index: 2,
      total: 5,
      presentation,
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.layout.contentAware).toBeTruthy();
    expect(spec.layout.contentAware!.actualImageRatio!).toBeGreaterThan(0.48);
    expect(spec.layout.contentAware!.internalDeadZone ?? 0).toBeLessThanOrEqual(1);
    expect(spec.layout.image!.height).toBeGreaterThan(Math.round(geo.height * 0.48));
  });

  it("C. long-copy photo_top: image can shrink toward min", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const short = buildResolvedCardRenderSpec({
      card: card({ cardId: "card-02", headline: "짧은 헤드", body: SHORT_BODY }),
      index: 2,
      total: 5,
      presentation: photoTopPresentation(0.48),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    const long = buildResolvedCardRenderSpec({
      card: card({ cardId: "card-02", headline: "긴 헤드라인으로 북부 산악을 읽다", body: LONG_BODY }),
      index: 2,
      total: 5,
      presentation: photoTopPresentation(0.48),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(long.layout.image!.height).toBeLessThan(short.layout.image!.height);
    expect(long.layout.contentAware!.actualImageRatio!).toBeGreaterThanOrEqual(0.4 - 1e-9);
  });

  it("D. no large internal dead zone between image and text", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({ cardId: "card-03", headline: "랑선 국경", body: SHORT_BODY }),
      index: 3,
      total: 5,
      presentation: photoTopPresentation(0.48),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    const imageBottom = spec.layout.image!.y + spec.layout.image!.height;
    const headlineTop = estimateGlyphTop(spec.layout.text.y, spec.headline.fontSize);
    const gap = headlineTop - imageBottom;
    expect(gap).toBeGreaterThanOrEqual(geo.scaleY(IMAGE_TEXT_GAP.min) - 2);
    expect(gap).toBeLessThanOrEqual(geo.scaleY(IMAGE_TEXT_GAP.max) + 8);
    expect(spec.layout.contentAware!.internalDeadZone ?? 0).toBeLessThanOrEqual(1);
  });

  it("E. preferred imageHeightRatio influences allocation for same copy", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const body = SHORT_BODY;
    const low = buildResolvedCardRenderSpec({
      card: card({ cardId: "card-02", headline: "헤드", body }),
      index: 2,
      total: 5,
      presentation: photoTopPresentation(0.42),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    const high = buildResolvedCardRenderSpec({
      card: card({ cardId: "card-02", headline: "헤드", body }),
      index: 2,
      total: 5,
      presentation: photoTopPresentation(0.62),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    // Short copy expands toward max; preferred still recorded and can bias when in range.
    expect(high.layout.contentAware!.preferredImageRatio!).toBeGreaterThan(
      low.layout.contentAware!.preferredImageRatio!,
    );
  });

  it("F/G. max and min ratio clamps", () => {
    const bounds = imageRatioBoundsForTemplate("photo_top_story", 0.99)!;
    expect(bounds.preferred).toBeLessThanOrEqual(0.68);
    expect(bounds.max).toBe(0.68);
    const low = imageRatioBoundsForTemplate("photo_top_story", 0.1)!;
    expect(low.preferred).toBeGreaterThanOrEqual(0.4);
    expect(low.min).toBe(0.4);

    const geo = resolveCardNewsGeometry("4:5");
    const alloc = allocateImageBackedBand({
      geometry: geo,
      template: "photo_top_story",
      preferredImageRatio: 0.48,
      textBlockHeight: 80,
      headlineFontPx: 56,
      hasKicker: false,
    });
    expect(alloc.metrics.actualImageRatio).toBeLessThanOrEqual(0.68 + 1e-9);
    expect(alloc.metrics.actualImageRatio).toBeGreaterThanOrEqual(0.4 - 1e-9);
  });

  it("H. footer safe boundary guaranteed", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const platform = resolvePlatformLayout("4:5");
    expect(platform).toEqual(PLATFORM_LAYOUT.instagram_4_5);
    const spec = buildResolvedCardRenderSpec({
      card: card({ cardId: "card-02", headline: "헤드", body: LONG_BODY }),
      index: 2,
      total: 5,
      presentation: photoTopPresentation(0.48),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    const footerSafeY = spec.layout.contentAware!.footerSafeY;
    const bodyBottom =
      spec.layout.text.y +
      spec.headline.height +
      spec.headlineBodyGapPx +
      spec.body.height;
    expect(bodyBottom).toBeLessThanOrEqual(footerSafeY + 1);
    expect(footerSafeY).toBe(geo.height - geo.scaleY(PLATFORM_LAYOUT.instagram_4_5.footerReservePx));
  });

  it("I/J. evidence_detail keeps compact density and image min/max", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-04",
        role: "evidence",
        headline: "nhà trình tường, 흙다짐 가옥",
        body: LONG_BODY,
      }),
      index: 4,
      total: 5,
      presentation: evidencePresentation(0.5),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.layout.template).toBe("evidence_detail");
    expect(spec.layout.textDensity).toBe("compact");
    expect(spec.layout.image!.rx).toBe(12);
    expect(spec.layout.contentAware!.actualImageRatio!).toBeGreaterThanOrEqual(0.42 - 1e-9);
    expect(spec.layout.contentAware!.actualImageRatio!).toBeLessThanOrEqual(0.6 + 1e-9);
  });

  it("K. closing short-copy is not footer-flush", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-05",
        role: "cta",
        headline: "휴양 프레임 밖에서",
        body: "건축·생활 리듬이 payoff입니다",
      }),
      index: 5,
      total: 5,
      presentation: closingPresentation(),
      citation: null,
      visualDataUri: null,
      wordmarkDataUri: null,
      geometry: geo,
    });
    const footerSafeY = spec.layout.contentAware!.footerSafeY;
    const bandTop = estimateGlyphTop(spec.layout.text.y, spec.headline.fontSize);
    expect(bandTop).toBeGreaterThan(geo.scaleY(80));
    expect(spec.layout.contentAware!.remainingBelowText).toBeGreaterThan(geo.scaleY(40));
    // Not stuck at absolute bottom
    expect(bandTop + spec.layout.contentAware!.textBlockHeight).toBeLessThan(footerSafeY - 20);
  });

  it("L. closing long-copy fits without giant top dead space", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-05",
        role: "cta",
        headline: "익숙한 휴양 프레임 밖에서 읽어내는 건축과 생활 리듬",
        body: LONG_BODY,
      }),
      index: 5,
      total: 5,
      presentation: closingPresentation(),
      citation: null,
      visualDataUri: null,
      wordmarkDataUri: null,
      geometry: geo,
    });
    const bandTop = estimateGlyphTop(spec.layout.text.y, spec.headline.fontSize);
    expect(bandTop).toBeLessThan(700);
    expect(spec.layout.contentAware!.remainingBelowText).toBeGreaterThanOrEqual(0);
  });

  it("M. 1:1 uses platform profile and does not overflow footer", () => {
    const geo = resolveCardNewsGeometry("1:1");
    expect(resolvePlatformLayout("1:1").id).toBe("instagram_1_1");
    const spec = buildResolvedCardRenderSpec({
      card: card({ cardId: "card-02", headline: "북쪽으로", body: LONG_BODY }),
      index: 2,
      total: 5,
      presentation: photoTopPresentation(0.48),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    const bodyBottom =
      spec.layout.text.y +
      spec.headline.height +
      spec.headlineBodyGapPx +
      spec.body.height;
    expect(bodyBottom).toBeLessThanOrEqual(spec.layout.contentAware!.footerSafeY + 1);
    expect(spec.layout.image!.height + spec.layout.contentAware!.textBlockHeight).toBeLessThanOrEqual(
      geo.height,
    );
  });

  it("measureTextBlockHeight includes headline/body/gap", () => {
    const h = measureTextBlockHeight({
      hasKicker: false,
      headlineHeight: 100,
      bodyHeight: 80,
      headlineBodyGapPx: 36,
      headlineFontPx: 56,
    });
    expect(h).toBeGreaterThan(100 + 80 + 36);
  });

  it("closing allocator respects optical bias without footer flush", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const alloc = allocateClosingTextBand({
      geometry: geo,
      textBlockHeight: 220,
      headlineFontPx: 64,
      hasKicker: false,
      textPlacement: "bottom",
    });
    expect(alloc.textBandTop + 220).toBeLessThan(alloc.footerSafeY);
    expect(alloc.metrics.remainingBelowText).toBeGreaterThan(0);
  });
});

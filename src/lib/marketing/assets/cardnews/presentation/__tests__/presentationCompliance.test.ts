/**
 * cardnews-render-v2.2 — Presentation Field Compliance regressions (A–J).
 */

import { describe, expect, it } from "vitest";

import {
  CARDNEWS_RENDERER_VERSION,
  resolveCardNewsGeometry,
} from "@/lib/marketing/assets/cardnews/brand";
import type { CardPresentation } from "@/lib/marketing/assets/cardnews/presentation/contracts";
import {
  buildResolvedCardRenderSpec,
} from "@/lib/marketing/assets/cardnews/presentation/resolveRenderSpec";
import {
  densityHeadlineBodyGapPx,
  estimateGlyphBottom,
  estimateGlyphTop,
  footerSafeTextBottom,
  MIN_IMAGE_TEXT_BAND_GAP_PX,
  placeMeasuredBlockInBand,
  progressYForGeometry,
  resolveTemplateLayout,
} from "@/lib/marketing/assets/cardnews/presentation/templateGeometry";
import type { CardNewsCard } from "@/lib/marketing/assets/contracts";

const geo = resolveCardNewsGeometry("4:5");
const SAFE_BOTTOM = footerSafeTextBottom(geo);

function basePresentation(partial: Partial<CardPresentation> & Pick<CardPresentation, "cardId" | "template">): CardPresentation {
  return {
    textPlacement: "bottom",
    textDensity: "standard",
    imageHeightRatio: 0.48,
    cropMode: "cover",
    focalAlignment: "center",
    overlayMode: "none",
    imagePlacement: "top",
    ...partial,
  };
}

function briefCard(partial: Partial<CardNewsCard> & Pick<CardNewsCard, "cardId" | "headline">): CardNewsCard {
  return {
    role: "information",
    body: "짧은 본문으로 밴드 배치를 검증합니다.",
    visualIntent: "",
    evidenceRefs: [],
    ...partial,
  };
}

function measureSpec(input: {
  presentation: CardPresentation;
  headline?: string;
  body?: string;
  hasVisual?: boolean;
  role?: CardNewsCard["role"];
}) {
  const hasVisual = input.hasVisual ?? true;
  const spec = buildResolvedCardRenderSpec({
    card: briefCard({
      cardId: input.presentation.cardId,
      role: input.role ?? "information",
      headline: input.headline ?? "헤드라인으로 레이아웃을 확인합니다",
      body: input.body ?? "본문 한두 줄로 밴드 안 배치를 확인합니다.",
    }),
    index: 2,
    total: 5,
    presentation: input.presentation,
    citation: null,
    visualDataUri: hasVisual ? "data:image/png;base64,aaa" : null,
    wordmarkDataUri: null,
    geometry: geo,
  });
  const gap = spec.headlineBodyGapPx;
  const headlineTop = estimateGlyphTop(spec.layout.text.y, spec.headline.fontSize);
  const bodyBaseline =
    spec.layout.text.y +
    (spec.headline.lines.length ? spec.headline.height + gap : 0);
  const bodyTop =
    spec.body.lines.length > 0
      ? estimateGlyphTop(bodyBaseline, spec.body.fontSize)
      : null;
  const lastBaseline =
    spec.body.lines.length > 0
      ? bodyBaseline + Math.max(0, spec.body.lines.length - 1) * spec.body.lineHeight
      : spec.layout.text.y +
        Math.max(0, spec.headline.lines.length - 1) * spec.headline.lineHeight;
  const textBlockBottom = estimateGlyphBottom(
    lastBaseline,
    spec.body.lines.length > 0 ? spec.body.fontSize : spec.headline.fontSize,
  );
  const image = spec.layout.image;
  return {
    spec,
    image,
    imageBottom: image ? image.y + image.height : null,
    headlineTop,
    bodyTop,
    bodyBaseline,
    textBlockBottom,
    blankAboveFooter: SAFE_BOTTOM - textBlockBottom,
  };
}

describe("v2.2 presentation compliance", () => {
  it("bumps renderer version", () => {
    expect(CARDNEWS_RENDERER_VERSION).toBe("cardnews-render-v2.2-presentation-compliance");
  });

  // A — cover_full_bleed golden geometry unchanged
  it("A: cover_full_bleed golden geometry unchanged", () => {
    const presentation = basePresentation({
      cardId: "card_1",
      template: "cover_full_bleed",
      textPlacement: "overlay-bottom",
      textDensity: "compact",
      imageHeightRatio: 1,
      imagePlacement: "full",
      overlayMode: "gradient_dark",
    });
    const layout = resolveTemplateLayout({
      presentation,
      geometry: geo,
      hasVisual: true,
      hasKicker: false,
    });
    expect(layout.image).toEqual({ x: 0, y: 0, width: 1080, height: 1350, rx: 0 });
    expect(layout.overlay?.mode).toBe("gradient_dark");
    expect(layout.textPlacement).toBe("overlay-bottom");
    expect(layout.brand.progressY).toBe(geo.height - geo.scaleY(40));
    expect(layout.text.headlinePreferred).toBe(64); // compact cover
    expect(layout.text.y).toBeGreaterThan(900);

    const m = measureSpec({
      presentation,
      headline: "해변으로 기억하는 베트남",
      body: "짧은 설명.",
      role: "cover",
    });
    // Measured placement must not move cover overlay band; legacy 36px gap preserved.
    expect(m.spec.layout.text.y).toBe(layout.text.y);
    expect(m.spec.layout.image).toEqual(layout.image);
    expect(m.spec.headlineBodyGapPx).toBe(36);
  });

  // B — photo_top top vs bottom → distinct Y
  it("B: photo_top same ratio+content top vs bottom → distinct text Y", () => {
    const top = measureSpec({
      presentation: basePresentation({
        cardId: "card_2",
        template: "photo_top_story",
        textPlacement: "top",
        imageHeightRatio: 0.48,
      }),
    });
    const bottom = measureSpec({
      presentation: basePresentation({
        cardId: "card_2",
        template: "photo_top_story",
        textPlacement: "bottom",
        imageHeightRatio: 0.48,
      }),
    });
    expect(top.image?.height).toBe(bottom.image?.height);
    expect(bottom.headlineTop).toBeGreaterThan(top.headlineTop + 40);
    expect(bottom.textBlockBottom).toBeGreaterThan(top.textBlockBottom + 40);
  });

  // C — imageHeightRatio still drives imageH
  it("C: photo_top imageHeightRatio 0.42 vs 0.56 → distinct imageH", () => {
    const a = measureSpec({
      presentation: basePresentation({
        cardId: "card_2",
        template: "photo_top_story",
        textPlacement: "top",
        imageHeightRatio: 0.42,
      }),
    });
    const b = measureSpec({
      presentation: basePresentation({
        cardId: "card_2",
        template: "photo_top_story",
        textPlacement: "top",
        imageHeightRatio: 0.56,
      }),
    });
    expect(a.image?.height).toBe(Math.round(1350 * 0.42));
    expect(b.image?.height).toBe(Math.round(1350 * 0.56));
    expect(b.image!.height - a.image!.height).toBeGreaterThan(100);
  });

  // D — bottom placement stays above footer safe
  it("D: bottom placement text bottom < footer safe boundary", () => {
    const m = measureSpec({
      presentation: basePresentation({
        cardId: "card_2",
        template: "photo_top_story",
        textPlacement: "bottom",
        imageHeightRatio: 0.48,
      }),
    });
    expect(m.textBlockBottom).toBeLessThanOrEqual(SAFE_BOTTOM);
    expect(progressYForGeometry(geo)).toBe(1350 - 96);
    expect(SAFE_BOTTOM).toBe(progressYForGeometry(geo) - 28);
  });

  // E — long copy clamps without image collision
  it("E: long copy bottom placement clamps without image collision", () => {
    // Tall-but-fittable body: fills most of the band so bottom placement clamps to top.
    const longBody =
      "북부 산악 지대의 리듬은 남부 휴양 프레임과 다릅니다. " +
      "국경 마을의 일상과 흙다짐 건축이 보여주는 생활 밀도를 함께 읽습니다. " +
      "여행의 기준이 휴양에서 현장으로 옮겨갈 때 풍경의 결이 바뀝니다.";
    const m = measureSpec({
      presentation: basePresentation({
        cardId: "card_2",
        template: "photo_top_story",
        textPlacement: "bottom",
        imageHeightRatio: 0.48,
      }),
      headline: "랑선 국경에서 읽히는 Dao족 마을의 결",
      body: longBody,
    });
    expect(m.imageBottom).not.toBeNull();
    expect(m.headlineTop - m.imageBottom!).toBeGreaterThanOrEqual(MIN_IMAGE_TEXT_BAND_GAP_PX);
    expect(m.textBlockBottom).toBeLessThanOrEqual(SAFE_BOTTOM);
    expect(m.headlineTop).toBeGreaterThanOrEqual(0);
    expect(m.spec.layout.text.y).toBeGreaterThan(0);
  });

  // F — closing top vs bottom distinct
  it("F: closing top/bottom → distinct band position", () => {
    const top = measureSpec({
      presentation: basePresentation({
        cardId: "card_5",
        template: "closing_insight",
        textPlacement: "top",
        textDensity: "standard",
        imageHeightRatio: 0,
        imagePlacement: "full",
      }),
      hasVisual: false,
      role: "cta",
      headline: "휴양 프레임 밖에서 읽히는 베트남",
      body: "다음 여행의 기준을 바꿔 보세요.",
    });
    const bottom = measureSpec({
      presentation: basePresentation({
        cardId: "card_5",
        template: "closing_insight",
        textPlacement: "bottom",
        textDensity: "standard",
        imageHeightRatio: 0,
        imagePlacement: "full",
      }),
      hasVisual: false,
      role: "cta",
      headline: "휴양 프레임 밖에서 읽히는 베트남",
      body: "다음 여행의 기준을 바꿔 보세요.",
    });
    expect(top.headlineTop).toBeLessThan(320);
    expect(bottom.headlineTop).toBeGreaterThan(top.headlineTop + 80);
    expect(bottom.textBlockBottom).toBeLessThanOrEqual(SAFE_BOTTOM);
  });

  // G/H — evidence density from plan
  it("G/H: evidence plan textDensity drives preferred fonts and gap", () => {
    const standard = measureSpec({
      presentation: basePresentation({
        cardId: "card_4",
        template: "evidence_detail",
        textPlacement: "bottom",
        textDensity: "standard",
        imageHeightRatio: 0.5,
      }),
      role: "evidence",
      headline: "nhà trình tường 흙다짐",
      body: "현장 스케치 본문입니다.",
    });
    const compact = measureSpec({
      presentation: basePresentation({
        cardId: "card_4",
        template: "evidence_detail",
        textPlacement: "bottom",
        textDensity: "compact",
        imageHeightRatio: 0.5,
      }),
      role: "evidence",
      headline: "nhà trình tường 흙다짐",
      body: "현장 스케치 본문입니다.",
    });
    expect(standard.spec.layout.text.headlinePreferred).toBe(56);
    expect(standard.spec.layout.text.bodyPreferred).toBe(34);
    expect(compact.spec.layout.text.headlinePreferred).toBe(52);
    expect(compact.spec.layout.text.bodyPreferred).toBe(30);
    expect(standard.spec.headlineBodyGapPx).toBe(densityHeadlineBodyGapPx("standard", geo));
    expect(compact.spec.headlineBodyGapPx).toBe(densityHeadlineBodyGapPx("compact", geo));
    expect(standard.spec.headlineBodyGapPx).toBeGreaterThan(compact.spec.headlineBodyGapPx);
    // Image frame geometry unchanged by density
    expect(standard.image).toEqual(compact.image);
  });

  // I — no overflow / negative geometry
  it("I: no overflow or negative geometry across templates", () => {
    const cases: Array<{
      presentation: CardPresentation;
      hasVisual: boolean;
      role?: CardNewsCard["role"];
    }> = [
      {
        presentation: basePresentation({
          cardId: "c1",
          template: "cover_full_bleed",
          textPlacement: "overlay-bottom",
          textDensity: "compact",
          imageHeightRatio: 1,
        }),
        hasVisual: true,
        role: "cover",
      },
      {
        presentation: basePresentation({
          cardId: "c2",
          template: "photo_top_story",
          textPlacement: "bottom",
        }),
        hasVisual: true,
      },
      {
        presentation: basePresentation({
          cardId: "c4",
          template: "evidence_detail",
          textPlacement: "bottom",
          textDensity: "compact",
          imageHeightRatio: 0.5,
        }),
        hasVisual: true,
        role: "evidence",
      },
      {
        presentation: basePresentation({
          cardId: "c5",
          template: "closing_insight",
          textPlacement: "bottom",
          imageHeightRatio: 0,
        }),
        hasVisual: false,
        role: "cta",
      },
    ];
    for (const row of cases) {
      const m = measureSpec({
        presentation: row.presentation,
        hasVisual: row.hasVisual,
        role: row.role,
      });
      expect(m.spec.layout.text.y).toBeGreaterThan(0);
      expect(m.headlineTop).toBeGreaterThanOrEqual(0);
      expect(m.textBlockBottom).toBeLessThanOrEqual(geo.height);
      if (m.image) {
        expect(m.image.y).toBeGreaterThanOrEqual(0);
        expect(m.image.height).toBeGreaterThan(0);
        expect(m.image.y + m.image.height).toBeLessThanOrEqual(geo.height);
      }
    }
  });

  it("placeMeasuredBlockInBand clamps top/bottom", () => {
    expect(
      placeMeasuredBlockInBand({
        availableTop: 100,
        availableBottom: 500,
        blockHeight: 80,
        placement: "top",
      }),
    ).toBe(100);
    expect(
      placeMeasuredBlockInBand({
        availableTop: 100,
        availableBottom: 500,
        blockHeight: 80,
        placement: "bottom",
      }),
    ).toBe(420);
    expect(
      placeMeasuredBlockInBand({
        availableTop: 100,
        availableBottom: 500,
        blockHeight: 600,
        placement: "bottom",
      }),
    ).toBe(100);
  });
});

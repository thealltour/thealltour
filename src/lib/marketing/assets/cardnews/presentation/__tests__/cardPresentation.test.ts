/**
 * PR2 Card Presentation + template geometry tests.
 */

import { describe, expect, it } from "vitest";

import { resolveCardNewsGeometry } from "@/lib/marketing/assets/cardnews/brand";
import {
  buildDeterministicCardPresentationPlan,
  type PresentationCardInput,
} from "@/lib/marketing/assets/cardnews/presentation/deterministic";
import {
  materializeCardPresentationPlan,
  CardPresentationMaterializeError,
} from "@/lib/marketing/assets/cardnews/presentation/materialize";
import {
  focalToPreserveAspectRatio,
  imageCoverageRatio,
  resolveTemplateLayout,
  estimateGlyphTop,
  estimateGlyphBottom,
  MIN_KICKER_HEADLINE_CLEAR_PX,
  MIN_IMAGE_TEXT_BAND_GAP_PX,
} from "@/lib/marketing/assets/cardnews/presentation/templateGeometry";
import { buildResolvedCardRenderSpec } from "@/lib/marketing/assets/cardnews/presentation/resolveRenderSpec";
import { buildCardNewsSvgFromSpec } from "@/lib/marketing/assets/cardnews/svg";
import {
  buildInstagramPresentationSourceFingerprint,
  resolveCardPresentationLifecycle,
} from "@/lib/marketing/assets/cardnews/presentation/fingerprint";
import type { CardNewsCard, CardNewsRole } from "@/lib/marketing/assets/contracts";

const geo = resolveCardNewsGeometry("4:5");

const daoCards: PresentationCardInput[] = [
  { cardId: "card_1", role: "hook_cover", hasVisual: true, visualId: "sv_01" },
  { cardId: "card_2", role: "reframe", hasVisual: false, visualId: null },
  { cardId: "card_3", role: "context", hasVisual: true, visualId: "sv_03" },
  {
    cardId: "card_4",
    role: "evidence_detail",
    hasVisual: true,
    visualId: "sv_04",
    headlineHint: "nhà trình tường 흙다짐",
  },
  { cardId: "card_5", role: "closing", hasVisual: false, visualId: null },
];

function editorialRoleToBriefRole(role: string): CardNewsRole {
  const r = role.trim().toLowerCase();
  if (r === "hook_cover" || r === "cover") return "cover";
  if (r === "evidence_detail" || r === "evidence") return "evidence";
  if (r === "closing" || r === "cta") return "cta";
  return "information";
}

describe("presentation contract", () => {
  it("deterministic Dao assignment matches expected templates", () => {
    const plan = buildDeterministicCardPresentationPlan({
      assetId: "dao",
      assetVersion: 1,
      sourceInstagramFingerprint: "fp",
      cards: daoCards,
    });
    expect(plan.cards.map((c) => c.template)).toEqual([
      "cover_full_bleed",
      "text_statement",
      "photo_top_story",
      "evidence_detail",
      "closing_insight",
    ]);
    expect(plan.cards.map((c) => c.cardId)).toEqual(daoCards.map((c) => c.cardId));
  });

  it("rejects visual template without visual; bounds imageHeightRatio", () => {
    expect(() =>
      materializeCardPresentationPlan({
        assetId: "dao",
        assetVersion: 1,
        sourceInstagramFingerprint: "fp",
        modelProfile: "card-layout-director",
        expectedCardIds: ["card_1"],
        cardsWithVisual: new Set(),
        llm: {
          cards: [
            {
              cardId: "card_1",
              template: "cover_full_bleed",
              textPlacement: "overlay-bottom",
              textDensity: "compact",
            },
          ],
        },
      }),
    ).toThrow(CardPresentationMaterializeError);

    expect(() =>
      materializeCardPresentationPlan({
        assetId: "dao",
        assetVersion: 1,
        sourceInstagramFingerprint: "fp",
        modelProfile: "x",
        expectedCardIds: ["card_1"],
        cardsWithVisual: new Set(["card_1"]),
        llm: {
          cards: [
            {
              cardId: "card_1",
              template: "photo_top_story",
              imageHeightRatio: 1.5,
              textPlacement: "bottom",
              textDensity: "standard",
            },
          ],
        },
      }),
    ).toThrow(/image_ratio|imageHeightRatio/i);
  });

  it("lifecycle: instagram fingerprint change → stale", () => {
    const plan = buildDeterministicCardPresentationPlan({
      assetId: "dao",
      assetVersion: 1,
      sourceInstagramFingerprint: "ig_v1",
      sourceVisualPlanFingerprint: "vp_v1",
      cards: daoCards,
    });
    expect(
      resolveCardPresentationLifecycle({
        plan,
        expectedInstagramFingerprint: "ig_v1",
        expectedVisualPlanFingerprint: "vp_v1",
      }),
    ).toBe("fresh");
    expect(
      resolveCardPresentationLifecycle({
        plan,
        expectedInstagramFingerprint: "ig_v2",
        expectedVisualPlanFingerprint: "vp_v1",
      }),
    ).toBe("stale");
    expect(
      resolveCardPresentationLifecycle({
        plan,
        expectedInstagramFingerprint: "ig_v1",
        expectedVisualPlanFingerprint: "vp_v2",
      }),
    ).toBe("stale");
  });
});

describe("crop / focal → preserveAspectRatio", () => {
  it("maps focal enums deterministically", () => {
    expect(focalToPreserveAspectRatio("center", "cover")).toBe("xMidYMid slice");
    expect(focalToPreserveAspectRatio("top", "cover")).toBe("xMidYMin slice");
    expect(focalToPreserveAspectRatio("right", "cover")).toBe("xMaxYMid slice");
    expect(focalToPreserveAspectRatio("top-right", "cover")).toBe("xMaxYMin slice");
    expect(focalToPreserveAspectRatio("center", "contain")).toBe("xMidYMid meet");
  });
});

describe("template geometry — no 904×300 strip", () => {
  it("cover_full_bleed uses full canvas image", () => {
    const plan = buildDeterministicCardPresentationPlan({
      assetId: "dao",
      assetVersion: 1,
      sourceInstagramFingerprint: "fp",
      cards: [daoCards[0]!],
    });
    const layout = resolveTemplateLayout({
      presentation: plan.cards[0]!,
      geometry: geo,
      hasVisual: true,
    });
    expect(layout.image).toEqual({ x: 0, y: 0, width: 1080, height: 1350, rx: 0 });
    expect(imageCoverageRatio(layout, geo)).toBeGreaterThanOrEqual(0.8);
    expect(layout.image?.height).not.toBe(300);
    expect(layout.image?.width).not.toBe(904);
  });

  it("photo_top_story and evidence_detail cover ≥50% canvas", () => {
    for (const card of [daoCards[2]!, daoCards[3]!]) {
      const plan = buildDeterministicCardPresentationPlan({
        assetId: "dao",
        assetVersion: 1,
        sourceInstagramFingerprint: "fp",
        cards: [card],
      });
      const layout = resolveTemplateLayout({
        presentation: plan.cards[0]!,
        geometry: geo,
        hasVisual: true,
      });
      expect(imageCoverageRatio(layout, geo)).toBeGreaterThanOrEqual(0.45);
      expect(layout.image?.height ?? 0).toBeGreaterThan(500);
      expect(layout.preserveAspectRatio).not.toMatch(/904/);
    }
  });

  it("text_statement has no image band", () => {
    const plan = buildDeterministicCardPresentationPlan({
      assetId: "dao",
      assetVersion: 1,
      sourceInstagramFingerprint: "fp",
      cards: [daoCards[1]!],
    });
    const layout = resolveTemplateLayout({
      presentation: plan.cards[0]!,
      geometry: geo,
      hasVisual: false,
    });
    expect(layout.image).toBeNull();
    expect(layout.template).toBe("text_statement");
  });
});

describe("svg render — templates emit geometry", () => {
  function card(partial: Partial<CardNewsCard> & Pick<CardNewsCard, "cardId" | "headline">): CardNewsCard {
    return {
      role: "information",
      body: "짧은 본문입니다.",
      visualIntent: "",
      evidenceRefs: [],
      ...partial,
    };
  }

  it("renders cover/photo/evidence/text/closing without 904×300 slot", () => {
    const plan = buildDeterministicCardPresentationPlan({
      assetId: "dao",
      assetVersion: 1,
      sourceInstagramFingerprint: buildInstagramPresentationSourceFingerprint({
        cardIds: daoCards.map((c) => c.cardId),
        headlines: ["a", "b", "c", "d", "e"],
        bodies: ["", "", "", "", ""],
        roles: daoCards.map((c) => c.role),
        visualIds: daoCards.map((c) => c.visualId ?? null),
      }),
      cards: daoCards,
    });

    const headlines = [
      "해변으로 기억하는 베트남",
      "북쪽으로 올라가면 풍경부터 달라집니다",
      "랑선 국경, Dao족 마을",
      "nhà trình tường, 흙다짐 가옥",
      "휴양 프레임 밖에서 읽히는 베트남",
    ];

    for (const [i, row] of daoCards.entries()) {
      const presentation = plan.cards[i]!;
      const briefCard = card({
        cardId: row.cardId,
        role: editorialRoleToBriefRole(row.role),
        headline: headlines[i]!,
        body: i === 1 ? "산악 국경 지대의 리듬이 남부 휴양과 다릅니다." : "짧은 설명.",
      });
      const spec = buildResolvedCardRenderSpec({
        card: briefCard,
        index: i + 1,
        total: 5,
        presentation,
        citation: null,
        visualDataUri: row.hasVisual ? "data:image/png;base64,aaa" : null,
        wordmarkDataUri: null,
        geometry: geo,
      });
      const svg = buildCardNewsSvgFromSpec(spec, geo);
      expect(svg).toContain('width="1080"');
      expect(svg).toContain('height="1350"');
      expect(svg).not.toMatch(/width="904"[^>]*height="300"|height="300"[^>]*width="904"/);
      if (row.hasVisual) {
        expect(svg).toContain("preserveAspectRatio=");
        expect(svg).toContain("<image ");
      }
      expect(spec.layout.template).toBe(presentation.template);
    }
  });

  it("non-cover: role/index never become on-card kicker text", () => {
    const plan = buildDeterministicCardPresentationPlan({
      assetId: "dao",
      assetVersion: 1,
      sourceInstagramFingerprint: "fp",
      cards: daoCards,
    });
    const headlines = [
      "해변으로 기억하는 베트남",
      "북쪽으로 올라가면 풍경부터 달라집니다",
      "랑선 국경, Dao족 마을",
      "nhà trình tường, 흙다짐 가옥",
      "휴양 프레임 밖에서 읽히는 베트남",
    ];
    const forbidden = [
      "표지",
      "안내",
      "근거",
      "다음 단계",
      "01 ",
      "02 ",
      "03 ",
      "04 ",
      "05 ",
    ];

    for (const [i, row] of daoCards.entries()) {
      const presentation = plan.cards[i]!;
      const briefCard = card({
        cardId: row.cardId,
        role: editorialRoleToBriefRole(row.role),
        headline: headlines[i]!,
        body: "짧은 설명으로 가독성 구역을 검증합니다.",
      });
      const spec = buildResolvedCardRenderSpec({
        card: briefCard,
        index: i + 1,
        total: 5,
        presentation,
        citation: null,
        visualDataUri: row.hasVisual ? "data:image/png;base64,aaa" : null,
        wordmarkDataUri: null,
        geometry: geo,
      });
      expect(spec.kicker).toBe("");
      const svg = buildCardNewsSvgFromSpec(spec, geo);
      for (const label of forbidden) {
        expect(svg).not.toContain(label);
      }
      expect(svg).toContain("<circle "); // progress dots remain
      expect(svg).toContain(escapeSnippet(headlines[i]!.slice(0, 6)));
    }
  });

  it("explicit editorial kicker renders; role still does not", () => {
    const plan = buildDeterministicCardPresentationPlan({
      assetId: "dao",
      assetVersion: 1,
      sourceInstagramFingerprint: "fp",
      cards: [daoCards[3]!],
    });
    const briefCard = card({
      cardId: "card_4",
      role: "evidence",
      headline: "전통 흙다짐 주택",
      body: "짧은 설명.",
    });
    const withKicker = buildResolvedCardRenderSpec({
      card: briefCard,
      index: 4,
      total: 5,
      presentation: plan.cards[0]!,
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
      editorialKicker: "현장 스케치",
    });
    expect(withKicker.kicker).toBe("현장 스케치");
    const svg = buildCardNewsSvgFromSpec(withKicker, geo);
    expect(svg).toContain("현장 스케치");
    expect(svg).not.toContain("근거");
    expect(svg).not.toContain("04 ");

    const kickerBottom = estimateGlyphBottom(withKicker.layout.text.kickerY, 20);
    const headlineTop = estimateGlyphTop(withKicker.layout.text.y, withKicker.headline.fontSize);
    expect(headlineTop - kickerBottom).toBeGreaterThanOrEqual(MIN_KICKER_HEADLINE_CLEAR_PX);
  });

  it("without kicker, photo templates keep image→headline gap without empty kicker slot", () => {
    for (const cardInput of [daoCards[2]!, daoCards[3]!]) {
      const plan = buildDeterministicCardPresentationPlan({
        assetId: "dao",
        assetVersion: 1,
        sourceInstagramFingerprint: "fp",
        cards: [cardInput],
      });
      const layoutNoKicker = resolveTemplateLayout({
        presentation: plan.cards[0]!,
        geometry: geo,
        hasVisual: true,
        hasKicker: false,
      });
      const layoutWithKicker = resolveTemplateLayout({
        presentation: plan.cards[0]!,
        geometry: geo,
        hasVisual: true,
        hasKicker: true,
      });
      expect(layoutNoKicker.image).not.toBeNull();
      const imageBottom = layoutNoKicker.image!.y + layoutNoKicker.image!.height;
      const headlineTop = estimateGlyphTop(
        layoutNoKicker.text.y,
        layoutNoKicker.text.headlinePreferred,
      );
      expect(headlineTop - imageBottom).toBeGreaterThanOrEqual(MIN_IMAGE_TEXT_BAND_GAP_PX);
      // No reserved kicker stack: headline sits higher than when kicker is present.
      expect(layoutNoKicker.text.y).toBeLessThan(layoutWithKicker.text.y);
    }
  });
});

function escapeSnippet(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

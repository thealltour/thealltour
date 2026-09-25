/**
 * cardnews-render-v2.4 mobile-readable typography regressions (A–N).
 */

import { describe, expect, it } from "vitest";

import {
  CARDNEWS_RENDERER_VERSION,
  CARDNEWS_SAFE,
  resolveCardNewsGeometry,
} from "@/lib/marketing/assets/cardnews/brand";
import type { CardNewsCard } from "@/lib/marketing/assets/contracts";
import {
  TYPOGRAPHY_PREFERRED,
  TYPOGRAPHY_V23_BASELINE,
  TYPOGRAPHY_WEIGHT,
  TYPOGRAPHY_BODY_FILL_PAPER,
  preferredBodyPx,
  preferredHeadlinePx,
} from "@/lib/marketing/assets/cardnews/typographyTokens";
import {
  fitText,
  wrapTextDetailed,
  tokenizeForWrap,
} from "@/lib/marketing/assets/cardnews/textLayout";
import { buildResolvedCardRenderSpec } from "@/lib/marketing/assets/cardnews/presentation/resolveRenderSpec";
import { HEADLINE_BODY_GAP } from "@/lib/marketing/assets/cardnews/presentation/contentAwareLayout";
import { densityBodyPx, densityHeadlinePx } from "@/lib/marketing/assets/cardnews/presentation/templateGeometry";
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

function photoTop(density: CardPresentation["textDensity"] = "standard"): CardPresentation {
  return {
    cardId: "card-02",
    template: "photo_top_story",
    imagePlacement: "top",
    imageHeightRatio: 0.48,
    cropMode: "cover",
    focalAlignment: "center",
    textPlacement: "bottom",
    overlayMode: "none",
    textDensity: density,
  };
}

function evidence(): CardPresentation {
  return {
    cardId: "card-04",
    template: "evidence_detail",
    imagePlacement: "top",
    imageHeightRatio: 0.5,
    cropMode: "cover",
    focalAlignment: "center",
    textPlacement: "bottom",
    overlayMode: "none",
    textDensity: "compact",
  };
}

function cover(): CardPresentation {
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

function closing(): CardPresentation {
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

const VIET_PHRASE = "전통 가옥 ‘nhà trình tường’은 흙을 단단하게 다져 올린다.";
const MIXED = "Dao족 마을의 nhà trình tường 건축";
const LONG_HEADLINE =
  "북부 산악 국경에서 읽는 베트남 공식 문화유산과 랑선 마을 전통과 건축 리듬";

describe("cardnews v2.4 mobile-readable typography", () => {
  it("bumps renderer version", () => {
    expect(CARDNEWS_RENDERER_VERSION).toBe(
      "cardnews-render-v2.4-mobile-readable-typography",
    );
  });

  it("A. body preferred size meaningfully above v2.3", () => {
    for (const density of ["compact", "standard", "minimal"] as const) {
      const v24 = preferredBodyPx(density, "story");
      const v23 = TYPOGRAPHY_V23_BASELINE.bodyPreferred[density];
      expect(v24).toBeGreaterThanOrEqual(v23 + 10);
      expect(v24).toBeGreaterThanOrEqual(42);
      expect(v24).toBeLessThanOrEqual(52);
    }
    expect(densityBodyPx("standard")).toBe(TYPOGRAPHY_PREFERRED.body.story.standard);
    expect(CARDNEWS_SAFE.minBodyPx).toBeGreaterThanOrEqual(36);
  });

  it("B. headline/body hierarchy via size + weight + gap tokens", () => {
    const h = preferredHeadlinePx("standard", "story");
    const b = preferredBodyPx("standard", "story");
    expect(h).toBeGreaterThan(b);
    expect(h - b).toBeLessThanOrEqual(20);
    expect(TYPOGRAPHY_WEIGHT.headline).toBe(700);
    expect(TYPOGRAPHY_WEIGHT.body).toBe(500);
    expect(HEADLINE_BODY_GAP.standard).toBeGreaterThanOrEqual(22);
    expect(TYPOGRAPHY_BODY_FILL_PAPER).not.toBe("#6B7280");
  });

  it("C. Korean word-aware wrapping keeps eojeol intact when possible", () => {
    const text = "공식 문화유산을 확인하세요";
    const wrapped = wrapTextDetailed(text, 48, 200);
    const joined = wrapped.lines.join("|");
    // Prefer not splitting 공식 across lines as 공|식 when a word break exists.
    expect(joined).not.toMatch(/공\|식/);
    const tokens = tokenizeForWrap(text);
    expect(tokens.some((t) => t.text === "공식")).toBe(true);
  });

  it("D. Vietnamese phrase wraps on whitespace, not mid-token", () => {
    const wrapped = wrapTextDetailed(VIET_PHRASE, 48, 420);
    const all = wrapped.lines.join(" ");
    expect(all).toContain("nhà");
    expect(all).toContain("trình");
    expect(all).toContain("tường");
    for (const word of ["nhà", "trình", "tường"]) {
      expect(wrapped.lines.some((l) => l.includes(word))).toBe(true);
    }
    expect(wrapped.characterFallback).toBe(false);
    // No mid-word character split of Vietnamese tokens
    expect(wrapped.lines.join("|")).not.toMatch(/trì\|nh|tườ\|ng|nh\|à/u);
  });

  it("E. mixed Korean/Latin keeps script tokens", () => {
    const wrapped = wrapTextDetailed(MIXED, 48, 380);
    expect(wrapped.lines.join("")).toContain("Dao");
    expect(wrapped.lines.join("")).toContain("족");
    // Dao족 may split at script boundary but not D|ao
    expect(wrapped.lines.join("|")).not.toMatch(/D\|ao/i);
  });

  it("F. long headline shrinks font before character split", () => {
    const fitted = fitText({
      text: LONG_HEADLINE,
      preferredFontSize: 62,
      minFontSize: CARDNEWS_SAFE.minHeadlinePx,
      maxWidth: 800,
      maxHeight: 280,
      maxLines: 4,
      overflow: "error",
      cardId: "card-hl",
      field: "headline",
    });
    if (fitted.fontShrunk) {
      expect(fitted.characterFallback).toBe(false);
    }
    expect(fitted.fontSize).toBeLessThanOrEqual(62);
    expect(fitted.ellipsisApplied).toBe(false);
  });

  it("G. body does not truncate", () => {
    const body =
      "북부 산악 지대의 환경 속에서 형성된 전통 가옥 ‘nhà trình tường’은 흙을 단단하게 다져 올린 흙다짐 건축 방식을 보여줍니다.";
    const fitted = fitText({
      text: body,
      preferredFontSize: 48,
      minFontSize: CARDNEWS_SAFE.minBodyPx,
      maxWidth: 920,
      maxHeight: 520,
      maxLines: 8,
      overflow: "error",
      cardId: "card-body",
      field: "body",
    });
    expect(fitted.ellipsisApplied).toBe(false);
    expect(fitted.lines.join("")).toContain("nhà");
    expect(fitted.lines.join("").includes("…")).toBe(false);
  });

  it("H. image min ratio protected with larger body", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const longBody =
      "북부 산악 지대의 환경 속에서 형성된 전통 가옥 ‘nhà trình tường’은 흙을 단단하게 다져 올린 흙다짐 건축 방식을 보여줍니다. 기후와 지형에 맞춘 이 건축 형태는 해변 리조트 중심의 베트남 이미지와는 다른 독특한 건축적 맥락을 형성합니다.";
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-02",
        headline: "북쪽으로 올라가면",
        body: longBody,
      }),
      index: 2,
      total: 5,
      presentation: photoTop("standard"),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.body.fontSize).toBeGreaterThanOrEqual(36);
    expect(spec.layout.contentAware!.actualImageRatio!).toBeGreaterThanOrEqual(0.4 - 1e-9);
  });

  it("I. footer safe — text stays above footer reserve", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-02",
        headline: "랑선 국경",
        body: "산악 국경 지대의 리듬이 남부 휴양과 다릅니다.",
      }),
      index: 2,
      total: 5,
      presentation: photoTop(),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    const textBottom =
      spec.layout.contentAware!.textBandTop! +
      (spec.layout.contentAware!.textBlockHeight ?? 0);
    expect(textBottom).toBeLessThanOrEqual(spec.layout.contentAware!.footerSafeY! + 1);
  });

  it("J. 4:5 no overflow", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-03",
        headline: densityHeadlinePx("standard", false, false).toString() + "px 헤드",
        body: "본문 가독성 검증용 문장입니다. 모바일에서 읽히는 체급을 유지합니다.",
      }),
      index: 3,
      total: 5,
      presentation: photoTop(),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.headline.height + spec.body.height).toBeLessThan(geo.height);
    expect(spec.layout.image!.y + spec.layout.image!.height).toBeLessThanOrEqual(geo.height);
  });

  it("K. 1:1 no overflow", () => {
    const geo = resolveCardNewsGeometry("1:1");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-02",
        headline: "북쪽으로 올라가면",
        body: "산악 국경 지대의 리듬이 남부 휴양과 다릅니다.",
      }),
      index: 2,
      total: 5,
      presentation: photoTop(),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.layout.image!.height).toBeGreaterThan(0);
    expect(
      (spec.layout.contentAware!.textBandTop ?? 0) +
        (spec.layout.contentAware!.textBlockHeight ?? 0),
    ).toBeLessThanOrEqual(geo.height);
  });

  it("L. cover regression — full-bleed preserved; body scale applied", () => {
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
      presentation: cover(),
      citation: null,
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.layout.template).toBe("cover_full_bleed");
    expect(spec.layout.image).toEqual({
      x: 0,
      y: 0,
      width: geo.width,
      height: geo.height,
      rx: 0,
    });
    expect(spec.body.fontSize).toBeGreaterThanOrEqual(TYPOGRAPHY_V23_BASELINE.bodyPreferred.standard);
    expect(spec.body.fontSize).toBeLessThanOrEqual(preferredBodyPx("standard", "cover") + 1);
  });

  it("M. evidence detail keeps image weight + Viet phrase", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-04",
        role: "evidence",
        headline: "nhà trình tường",
        body: VIET_PHRASE,
      }),
      index: 4,
      total: 5,
      presentation: evidence(),
      citation: { label: "출처", detail: "현장 기록" },
      visualDataUri: "data:image/png;base64,aaa",
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.layout.contentAware!.actualImageRatio!).toBeGreaterThanOrEqual(0.42 - 1e-9);
    expect(spec.body.lines.join(" ")).toContain("nhà");
    expect(spec.body.characterFallback).toBe(false);
    expect(spec.body.ellipsisApplied).toBe(false);
  });

  it("N. closing optical balance — no giant dead space / footer clash", () => {
    const geo = resolveCardNewsGeometry("4:5");
    const spec = buildResolvedCardRenderSpec({
      card: card({
        cardId: "card-05",
        role: "cta",
        headline: "휴양 프레임 밖에서 읽히는 베트남",
        body: "같은 나라 안에서도 지역에 따라 다른 문화적 층위가 있습니다.",
      }),
      index: 5,
      total: 5,
      presentation: closing(),
      citation: null,
      visualDataUri: null,
      wordmarkDataUri: null,
      geometry: geo,
    });
    expect(spec.body.fontSize).toBeGreaterThanOrEqual(36);
    expect(spec.layout.contentAware!.remainingBelowText!).toBeGreaterThan(0);
    const topAir = spec.layout.contentAware!.textBandTop ?? 0;
    expect(topAir).toBeLessThan(geo.height * 0.55);
  });

  it("mobile preview scale: body remains ≥12 CSS-px at feed width ~390", () => {
    // 1080 canvas → ~390 feed width ⇒ scale ≈ 0.361
    const feedScale = 390 / 1080;
    const bodyPx = preferredBodyPx("standard", "story");
    expect(bodyPx * feedScale).toBeGreaterThanOrEqual(12);
    expect(preferredHeadlinePx("standard", "story") * feedScale).toBeGreaterThanOrEqual(16);
  });
});

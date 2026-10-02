import { describe, expect, it } from "vitest";
import { CARDNEWS_SAFE, resolveCardNewsGeometry } from "@/lib/marketing/assets/cardnews/brand";
import { buildCardNewsSvgFromSpec } from "@/lib/marketing/assets/cardnews/svg";
import { fitText, normalizeCardnewsRenderText, wrapTextDetailed } from "@/lib/marketing/assets/cardnews/textLayout";
import { CardNewsRenderOverflowError } from "@/lib/marketing/assets/errors";
import { CARD_NEWS_ROLES } from "@/lib/marketing/assets/contracts";
import { CARD_PRESENTATION_TEMPLATES } from "../contracts";
import { buildResolvedCardRenderSpec, type BuildCardRenderSpecInput } from "../resolveRenderSpec";
import { estimateGlyphBottom, estimateGlyphTop } from "../templateGeometry";

function input(overrides: Partial<BuildCardRenderSpecInput> = {}): BuildCardRenderSpecInput {
  return {
    card: { cardId: "card-review", role: "information", headline: "여행 이야기", body: "새로운 동네를 걸어요", visualIntent: "", evidenceRefs: [] },
    index: 2, total: 5,
    presentation: { cardId: "card-review", template: "photo_overlay_editorial", textPlacement: "overlay-bottom", textDensity: "standard" },
    geometry: resolveCardNewsGeometry("4:5"), citation: null,
    visualDataUri: "data:image/png;base64,placeholder", wordmarkDataUri: null,
    ...overrides,
  };
}

describe("reviewed four-field cardnews layout", () => {
  for (const ratio of ["4:5", "1:1"] as const) {
    for (const template of CARD_PRESENTATION_TEMPLATES) {
      it(`${ratio} ${template} renders all fields for every card role without overlap`, () => {
        for (const role of CARD_NEWS_ROLES) {
          const args = input({ geometry: resolveCardNewsGeometry(ratio), editorialKicker: "현장 이야기", editorialMicrocopy: "저장해 두세요" });
          args.card.role = role;
          args.presentation.template = template;
          const spec = buildResolvedCardRenderSpec(args);
          const svg = buildCardNewsSvgFromSpec(spec, args.geometry);
          for (const text of ["현장 이야기", "여행 이야기", "새로운 동네를 걸어요", "저장해 두세요"]) expect(svg).toContain(text);
          expect(spec.kickerText!.fontSize).toBeLessThan(spec.body.fontSize);
          expect(spec.microcopy!.fontSize).toBeLessThan(spec.body.fontSize);
          expect(spec.body.fontSize).toBeLessThan(spec.headline.fontSize);
          const kickerBottom = estimateGlyphBottom(spec.layout.text.kickerY + (spec.kickerText!.lines.length - 1) * spec.kickerText!.lineHeight, spec.kickerText!.fontSize);
          expect(estimateGlyphTop(spec.layout.text.y, spec.headline.fontSize) - kickerBottom).toBeGreaterThanOrEqual(32);
          const bodyY = spec.layout.text.y + spec.headline.height + spec.headlineBodyGapPx;
          const bodyBottom = estimateGlyphBottom(bodyY + (spec.body.lines.length - 1) * spec.body.lineHeight, spec.body.fontSize);
          expect(estimateGlyphTop(spec.microcopyY!, spec.microcopy!.fontSize) - bodyBottom).toBeGreaterThanOrEqual(18);
          const bottom = estimateGlyphBottom(spec.microcopyY! + (spec.microcopy!.lines.length - 1) * spec.microcopy!.lineHeight, spec.microcopy!.fontSize);
          expect(bottom).toBeLessThanOrEqual(spec.layout.contentAware!.footerSafeY!);
          if (template === "closing_insight") {
            expect(estimateGlyphTop(spec.layout.text.kickerY, 20)).toBeGreaterThan(spec.layout.brand.editorialAccentY! + 17);
          }
        }
      });
    }
  }

  it("absent and blank auxiliary fields collapse with identical legacy headline/body layout", () => {
    const absent = buildResolvedCardRenderSpec(input());
    for (const blank of [undefined, null, "", " \n "]) {
      const spec = buildResolvedCardRenderSpec(input({ editorialKicker: blank, editorialMicrocopy: blank }));
      expect(spec).toEqual(absent);
      expect(buildCardNewsSvgFromSpec(spec)).toBe(buildCardNewsSvgFromSpec(absent));
    }
  });

  it("empty body contributes no body gap before microcopy", () => {
    const args = input({ editorialMicrocopy: "짧은 안내" });
    args.card.body = "";
    const spec = buildResolvedCardRenderSpec(args);
    const bottom = estimateGlyphBottom(spec.layout.text.y + (spec.headline.lines.length - 1) * spec.headline.lineHeight, spec.headline.fontSize);
    expect(estimateGlyphTop(spec.microcopyY!, spec.microcopy!.fontSize) - bottom).toBe(18);
  });

  it("empty headline and all-empty copy reserve no phantom text block", () => {
    const args = input();
    args.card.headline = "";
    const bodyOnly = buildResolvedCardRenderSpec(args);
    expect(estimateGlyphTop(bodyOnly.layout.text.y, bodyOnly.body.fontSize)).toBe(bodyOnly.layout.contentAware!.textBandTop);
    args.card.body = "";
    const empty = buildResolvedCardRenderSpec(args);
    expect(empty.layout.contentAware!.textBlockHeight).toBe(0);
    expect(empty.headline.lines).toEqual([]);
    expect(empty.body.lines).toEqual([]);
  });

  it("explicit and Korean semantic breaks work in every field without changing input", () => {
    const args = input({ editorialKicker: "최근,발견\n안내", editorialMicrocopy: "저장,추천\n확인" });
    args.card.headline = "그런데 최근,한국인 숙박이\n늘었어요";
    args.card.body = "가을,여행\n\n다음 이야기";
    const original = { ...args, card: { ...args.card }, presentation: { ...args.presentation } };
    const spec = buildResolvedCardRenderSpec(args);
    expect(spec.kickerText!.lines).toEqual(["최근", "발견", "안내"]);
    expect(spec.headline.lines).toEqual(["그런데 최근", "한국인 숙박이", "늘었어요"]);
    expect(spec.body.lines).toEqual(["가을", "여행", "", "다음 이야기"]);
    expect(spec.microcopy!.lines).toEqual(["저장", "추천", "확인"]);
    const kickerBottom = estimateGlyphBottom(spec.layout.text.kickerY + 2 * spec.kickerText!.lineHeight, spec.kickerText!.fontSize);
    expect(estimateGlyphTop(spec.layout.text.y, spec.headline.fontSize) - kickerBottom).toBeGreaterThanOrEqual(32);
    const svg = buildCardNewsSvgFromSpec(spec, args.geometry);
    const bodyY = spec.layout.text.y + spec.headline.height + spec.headlineBodyGapPx;
    expect(svg).toContain(`<tspan x="${spec.layout.text.x}" y="${bodyY + 3 * spec.body.lineHeight}">다음 이야기</tspan>`);
    expect(args).toEqual(original);
  });

  it.each(["4:5", "1:1"] as const)("%s expands the band for the former card-3 six-line overflow", (ratio) => {
    const args = input({ geometry: resolveCardNewsGeometry(ratio) });
    args.card.headline = "역시 한국인들 여행 눈썰미,꽤 빠릅니다.";
    args.card.body = "고치 대표 먹거리인\n가쓰오 타타키(가다랑어 짚불구이) 맛집에 가면\n요즘은 한국어로 대화하는 소리가\n제법 자주 들린다네요.\n\n시만토강, 태평양 풍경, 로컬 맛집까지.\n알고 보면 한국 여행객 취향에 딱 맞는 요소가 꽤 많습니다.";
    const spec = buildResolvedCardRenderSpec(args);
    expect(spec.body.lines.length).toBeGreaterThan(6);
    expect(spec.body.lines).toContain("");
    expect(spec.body.fontSize).toBeGreaterThanOrEqual(CARDNEWS_SAFE.minBodyPx);
    expect(spec.body.ellipsisApplied).toBe(false);
    expect(spec.layout.image!.height).toBe(args.geometry.height);
    expect(spec.layout.contentAware!.textBandTop! + spec.layout.contentAware!.textBlockHeight!).toBeLessThanOrEqual(spec.layout.contentAware!.footerSafeY!);
  });

  it("irreducible body and auxiliary overflow still fail explicitly", () => {
    for (const field of ["body", "kicker", "microcopy"] as const) {
      const args = input();
      const huge = Array.from({ length: 90 }, () => "줄바꿈").join("\n");
      if (field === "body") args.card.body = huge;
      else if (field === "kicker") args.editorialKicker = huge;
      else args.editorialMicrocopy = huge;
      try {
        buildResolvedCardRenderSpec(args);
        expect.fail("must reject an unreadable stack");
      } catch (error) {
        expect(error).toBeInstanceOf(CardNewsRenderOverflowError);
        expect(error).toMatchObject({ cardId: "card-review", field });
      }
    }
  });
});

describe("render-time break precedence", () => {
  it("keeps manual paragraphs ahead of automatic wrapping and headline balancing", () => {
    const wrapped = wrapTextDetailed("그런데 최근,한국인 숙박이 아주 크게 늘었다네요\n\n다음 이야기", 40, 270, { balanceDanglingTail: true });
    expect(wrapped.lines[0]).toBe("그런데 최근");
    expect(wrapped.lines).toContain("");
    expect(wrapped.lines.at(-1)).toBe("다음 이야기");
    expect(wrapped.lines.slice(1, wrapped.lines.indexOf("")).join(" ")).toContain("한국인 숙박이");
  });

  it.each([
    "1,000명", "12,345.67", "서울, 부산", "Seoul,Busan", "name,value,id",
    "https://example.com/서울,부산", "(https://example.com/서울,부산)",
    "링크=https://example.com/서울,부산", "example.com/서울,부산", "mailto:서울,부산@example.com",
  ])("does not introduce semantic breaks in %s", (text) => {
    expect(normalizeCardnewsRenderText(text)).toBe(text);
    expect(wrapTextDetailed(text, 20, 10_000).lines).toEqual([text]);
  });

  it("fit preserves authored leading, trailing and blank newline lines", () => {
    const fitted = fitText({ text: "\n최근\n\n여행\n", preferredFontSize: 40, minFontSize: 38, maxWidth: 800, maxHeight: 600, maxLines: 12, overflow: "error", cardId: "manual", field: "body" });
    expect(fitted.lines).toEqual(["", "최근", "", "여행", ""]);
  });
});

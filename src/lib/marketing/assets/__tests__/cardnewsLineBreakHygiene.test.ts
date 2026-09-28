import { describe, expect, it } from "vitest";

import {
  CARDNEWS_ASPECT_RATIOS,
  CARDNEWS_SAFE,
  resolveCardNewsGeometry,
} from "@/lib/marketing/assets/cardnews/brand";
import { buildInstagramThumbnailSpec } from "@/lib/marketing/assets/cardnews/instagramThumbnail";
import type { CardPresentation } from "@/lib/marketing/assets/cardnews/presentation/contracts";
import { buildResolvedCardRenderSpec } from "@/lib/marketing/assets/cardnews/presentation/resolveRenderSpec";
import {
  fitText,
  measureTextWidth,
  wrapTextDetailed,
} from "@/lib/marketing/assets/cardnews/textLayout";
import type { CardNewsCard } from "@/lib/marketing/assets/contracts";
import { CardNewsRenderOverflowError } from "@/lib/marketing/assets/errors";

const FORBIDDEN_LINE_START = /^[)\]},.!?:;%]/u;

const PHRASES = [
  "Mẫu Sơn(머우선)",
  "Dao(자오)족",
  "Tày(따이)족",
  "Nùng(눙)족",
  "nhà trình tường(냐 찐 뜨엉)",
];

const SAMPLES = [
  "북부 산악지대, Mẫu Sơn(머우선) 정상에 오르면 구름이 발아래 깔린다",
  "Dao(자오)족과 Tày(따이)족, Nùng(눙)족이 함께 사는 국경 마을",
  "흙을 다져 올린 nhà trình tường(냐 찐 뜨엉) 가옥이 이어진다.",
  "랑선(Lạng Sơn)에서 만난 새벽 시장, 그리고 국경의 아침!",
  "사파 트레킹, 다랭이논, 소수민족 마을까지! 3일 코스: 준비물; 만족도 90% 이상",
  "전통 가옥 ‘nhà trình tường’은 흙을 단단하게 다져 올린다.",
];

const WIDTHS = Array.from({ length: 41 }, (_, i) => 200 + i * 20);

const compact = (text: string) => text.replace(/\s+/gu, "");

function greedyWordWrap(text: string, fontSize: number, maxWidth: number): string[] {
  const wrapWidth = maxWidth * 0.98;
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(" ")) {
    const next = current ? `${current} ${word}` : word;
    if (current && measureTextWidth(next, fontSize) > wrapWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function card(overrides: Partial<CardNewsCard> & Pick<CardNewsCard, "cardId" | "headline">): CardNewsCard {
  return { role: "information", body: "", visualIntent: "", evidenceRefs: [], ...overrides };
}

const PRESENTATIONS: CardPresentation[] = [
  {
    cardId: "card-01",
    template: "cover_full_bleed",
    imagePlacement: "full",
    imageHeightRatio: 1,
    cropMode: "cover",
    focalAlignment: "center",
    textPlacement: "overlay-bottom",
    overlayMode: "gradient_dark",
    textDensity: "standard",
  },
  {
    cardId: "card-02",
    template: "photo_top_story",
    imagePlacement: "top",
    imageHeightRatio: 0.48,
    cropMode: "cover",
    focalAlignment: "center",
    textPlacement: "bottom",
    overlayMode: "none",
    textDensity: "standard",
  },
  {
    cardId: "card-05",
    template: "closing_insight",
    imageHeightRatio: 0,
    cropMode: "cover",
    focalAlignment: "center",
    textPlacement: "bottom",
    overlayMode: "none",
    textDensity: "standard",
  },
];

describe("cardnews line-break hygiene — wrap", () => {
  it("1. keeps Mẫu Sơn(머우선) on one line whenever it fits a line", () => {
    const text = SAMPLES[0]!;
    for (const width of WIDTHS) {
      const { lines } = wrapTextDetailed(text, 48, width);
      if (measureTextWidth("Mẫu Sơn(머우선)", 48) <= width * 0.98) {
        expect(lines.some((line) => line.includes("Mẫu Sơn(머우선)")), `width ${width}`).toBe(true);
      }
      expect(lines.join("|")).not.toMatch(/\(\|/u);
    }
  });

  it("2. keeps Dao(자오)족 and other transliteration pairs whole", () => {
    const texts = [SAMPLES[1]!, SAMPLES[2]!];
    for (const width of WIDTHS) {
      for (const text of texts) {
        const { lines } = wrapTextDetailed(text, 48, width);
        for (const phrase of PHRASES.filter((p) => text.includes(p))) {
          // The unit is the whole eojeol with its glued marks: `Nùng(눙)족이`, `Tày(따이)족,`.
          const eojeol = text.slice(text.indexOf(phrase)).match(/^\S+/u)![0];
          if (measureTextWidth(eojeol, 48) <= width * 0.98) {
            expect(lines.some((line) => line.includes(eojeol)), `${eojeol} @ ${width}`).toBe(true);
          }
        }
      }
    }
  });

  it("3–4. never starts a line with ) ] } , . ! ? : ; %", () => {
    for (const fontSize of [40, 48, 64]) {
      for (const width of WIDTHS) {
        for (const text of SAMPLES) {
          const { lines } = wrapTextDetailed(text, fontSize, width);
          for (const line of lines) {
            expect(line, `${text} @ ${fontSize}/${width}`).not.toMatch(FORBIDDEN_LINE_START);
          }
        }
      }
    }
  });

  it("5. moves a protected phrase that does not fit whole to the next line", () => {
    const { lines } = wrapTextDetailed(SAMPLES[0]!, 48, 420);
    expect(lines[0]).toBe("북부 산악지대,");
    expect(lines[1]!.startsWith("Mẫu Sơn(머우선)")).toBe(true);
  });

  it("only changes break positions — text, widths and character fallback are preserved", () => {
    for (const width of WIDTHS) {
      for (const text of SAMPLES) {
        for (const balance of [false, true]) {
          const wrapped = wrapTextDetailed(text, 48, width, { balanceDanglingTail: balance });
          expect(compact(wrapped.lines.join(""))).toBe(compact(text));
          expect(wrapped.characterFallback).toBe(false);
          for (const line of wrapped.lines) {
            expect(measureTextWidth(line, 48)).toBeLessThanOrEqual(width);
          }
        }
      }
    }
  });

  it("6. plain Korean copy wraps exactly as a greedy word wrap", () => {
    const plain = [
      "하롱베이의 아침 풍경은 언제나 조용하다",
      "북부 산악 국경에서 읽는 베트남 공식 문화유산과 랑선 마을 전통과 건축 리듬",
      "산악 국경 지대의 리듬이 남부 휴양과 다르게 흘러가는 이유를 찾아서",
    ];
    for (const text of plain) {
      const widest = Math.max(...text.split(" ").map((word) => measureTextWidth(word, 48)));
      for (const width of WIDTHS.filter((w) => widest <= w * 0.98)) {
        expect(wrapTextDetailed(text, 48, width).lines).toEqual(greedyWordWrap(text, 48, width));
      }
    }
  });

  it("headline balance lifts a dangling last token without changing the line count", () => {
    const text = "사파의 계단식 논에서 만난 아침 빛!";
    expect(wrapTextDetailed(text, 64, 520).lines).toEqual(["사파의 계단식", "논에서 만난 아침", "빛!"]);
    expect(wrapTextDetailed(text, 64, 520, { balanceDanglingTail: true }).lines).toEqual([
      "사파의 계단식",
      "논에서 만난",
      "아침 빛!",
    ]);

    for (const width of WIDTHS) {
      for (const sample of [...SAMPLES, text]) {
        const plain = wrapTextDetailed(sample, 64, width).lines;
        const balanced = wrapTextDetailed(sample, 64, width, { balanceDanglingTail: true }).lines;
        expect(balanced.length).toBe(plain.length);
        for (const phrase of PHRASES.filter((p) => plain.some((line) => line.includes(p)))) {
          expect(balanced.some((line) => line.includes(phrase))).toBe(true);
        }
      }
    }
  });
});

describe("cardnews line-break hygiene — fit and specs", () => {
  it("7. 4:5, 1:1 and 9:16 specs keep phrases whole with clean line starts", () => {
    for (const ratio of CARDNEWS_ASPECT_RATIOS) {
      const geometry = resolveCardNewsGeometry(ratio);
      for (const presentation of PRESENTATIONS) {
        const spec = buildResolvedCardRenderSpec({
          card: card({
            cardId: presentation.cardId,
            headline: "북부 산악지대, Mẫu Sơn(머우선)",
            body: `${SAMPLES[1]!} ${SAMPLES[2]!}`,
          }),
          index: Number(presentation.cardId.slice(-1)),
          total: 5,
          presentation,
          citation: null,
          visualDataUri: "data:image/png;base64,aaa",
          wordmarkDataUri: null,
          geometry,
        });
        const label = `${ratio} ${presentation.template}`;
        for (const fitted of [spec.headline, spec.body]) {
          expect(fitted.ellipsisApplied, label).toBe(false);
          expect(fitted.characterFallback, label).toBe(false);
          for (const line of fitted.lines) expect(line, label).not.toMatch(FORBIDDEN_LINE_START);
        }
        expect(spec.headline.lines.some((line) => line.includes("Mẫu Sơn(머우선)")), label).toBe(true);
        expect(spec.headline.fontSize).toBeGreaterThanOrEqual(CARDNEWS_SAFE.minHeadlinePx);
        expect(spec.body.fontSize).toBeGreaterThanOrEqual(CARDNEWS_SAFE.minBodyPx);
      }
    }
  });

  it("8. Instagram thumbnail title keeps phrases whole inside the safe width", () => {
    const geometry = resolveCardNewsGeometry("1:1");
    for (const title of [
      "북부 산악지대, Mẫu Sơn(머우선) 가는 길",
      "Dao(자오)족 마을에서 보낸 하루",
      "가을 제주 억새, 사람 적은 시간에 걷는 법",
    ]) {
      const spec = buildInstagramThumbnailSpec({
        cardId: "card-cover",
        title,
        visualDataUri: null,
        preserveAspectRatio: "xMidYMid slice",
        geometry,
      });
      expect(spec.title.lines.length).toBeLessThanOrEqual(3);
      expect(spec.title.ellipsisApplied).toBe(false);
      for (const line of spec.title.lines) {
        expect(line).not.toMatch(FORBIDDEN_LINE_START);
        expect(measureTextWidth(line, spec.title.fontSize)).toBeLessThanOrEqual(spec.safe.width);
      }
      for (const phrase of PHRASES.filter((p) => title.includes(p))) {
        expect(spec.title.lines.some((line) => line.includes(phrase))).toBe(true);
      }
    }
  });

  it("9. respects max lines and shrinks the font to fit", () => {
    const fitted = fitText({
      text: "Dao(자오)족과 Tày(따이)족, Nùng(눙)족이 함께 사는 국경 마을의 아침",
      preferredFontSize: 72,
      minFontSize: 40,
      maxWidth: 640,
      maxHeight: 400,
      maxLines: 3,
      overflow: "error",
      cardId: "card-02",
      field: "headline",
    });
    expect(fitted.lines.length).toBeLessThanOrEqual(3);
    expect(fitted.fontShrunk).toBe(true);
    expect(fitted.ellipsisApplied).toBe(false);
    for (const line of fitted.lines) {
      expect(measureTextWidth(line, fitted.fontSize)).toBeLessThanOrEqual(640);
      expect(line).not.toMatch(FORBIDDEN_LINE_START);
    }
  });

  it("10. overflow fallbacks still apply", () => {
    const text = `${SAMPLES[0]!} ${SAMPLES[1]!} ${SAMPLES[2]!}`;
    const base = {
      text,
      preferredFontSize: 64,
      minFontSize: 40,
      maxWidth: 480,
      maxHeight: 200,
      maxLines: 3,
      cardId: "card-02",
      field: "headline" as const,
    };
    expect(() => fitText({ ...base, overflow: "error" })).toThrow(CardNewsRenderOverflowError);
    const clipped = fitText({ ...base, overflow: "ellipsis" });
    expect(clipped.ellipsisApplied).toBe(true);
    expect(clipped.lines.at(-1)!.endsWith("…")).toBe(true);

    const narrow = wrapTextDetailed("nhà trình tường(냐 찐 뜨엉)족", 48, 240);
    expect(compact(narrow.lines.join(""))).toBe(compact("nhà trình tường(냐 찐 뜨엉)족"));
    expect(narrow.characterFallback).toBe(false);
    for (const line of narrow.lines) {
      expect(line).not.toMatch(FORBIDDEN_LINE_START);
      expect(line).not.toMatch(/\($/u);
    }
  });
});

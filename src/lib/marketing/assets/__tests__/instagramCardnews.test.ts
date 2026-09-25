import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import {
  CARDNEWS_SIZE_PRESETS,
  resolveCardNewsGeometry,
} from "@/lib/marketing/assets/cardnews/brand";
import { createCardNewsVerificationBrief } from "@/lib/marketing/assets/cardnews/fixture";
import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { renderCardNewsPackage } from "@/lib/marketing/assets/cardnews/renderCardNewsPackage";
import {
  buildInstagramCardnewsCards,
  applyInstagramCardnewsToBrief,
  diffInstagramCardPlanCopyParity,
  resolveInstagramCardnewsRenderBrief,
  resolveInstagramCardnewsSkip,
} from "@/lib/marketing/assets/cardnews/instagramCards";
import { renderInstagramCardnewsForPackage } from "@/lib/marketing/assets/cardnews/instagramCardnews";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableChannelContent,
  type PublishableContentBundle,
  type PublishableInstagramCardPlan,
} from "@/lib/marketing/publishable/contracts";

const tempDirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "ig-cardnews-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const CAPTION = [
  "첫 크루즈는 배 안보다 부산항 탑승 직전이 훨씬 헷갈립니다.",
  "",
  "1. 승선 수속은 터미널 2층에서 시작합니다.",
  "2. 수하물 규정은 공항과 다르게 적용됩니다.",
  "3. 대기 시간은 출발 3시간 전이 가장 짧습니다.",
  "",
  "저장해 두고 출발 전에 다시 확인해 보세요.",
  "",
  "#부산크루즈 #부산항 #여행준비",
].join("\n");

function instagramContent(
  overrides?: Partial<PublishableChannelContent>,
): PublishableChannelContent {
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "instagram",
    format: "instagram_caption",
    title: null,
    body: CAPTION,
    status: "generated",
    generatedAt: "2026-09-14T00:00:00.000Z",
    sourceCandidateId: "dev-cardnews-a3-verification",
    sourceRevision: "rev1",
    provenance: {
      composer: "llm",
      evidenceRefIds: ["ev-1"],
      commercialIntent: "informational",
      generationMode: "llm",
      attemptCount: 1,
    },
    validation: { ok: true, issues: [] },
    publishableSuccess: true,
    needsRegeneration: false,
    instagramMeta: {
      hook: "첫 크루즈는 배 안보다 부산항 탑승 직전이 훨씬 헷갈립니다.",
      hashtags: ["#부산크루즈", "#부산항", "#여행준비"],
      slideHeadlines: ["탑승 직전 체크", "수속 시작 위치", "수하물 규정", "대기 시간"],
      cta: "저장해 두고 출발 전에 다시 확인해 보세요.",
      altText: "부산항 크루즈 탑승 안내 카드",
    },
    ...overrides,
  } as PublishableChannelContent;
}

function bundle(overrides?: Partial<PublishableContentBundle>): PublishableContentBundle {
  const threads = { ...instagramContent(), channel: "threads", format: "threads_text" };
  return {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: "dev-cardnews-a3-verification",
    businessDateKst: "2026-09-03",
    generatedAt: "2026-09-14T00:00:00.000Z",
    sourceRevision: "rev1",
    targetChannels: ["threads", "instagram"],
    threads,
    shortform: { ...threads, channel: "shortform", format: "short_video_narration" },
    instagram: instagramContent(),
    ...overrides,
  } as PublishableContentBundle;
}

describe("cardnews aspect ratio presets", () => {
  it("keeps 4:5 anchors identical and scales other ratios from it", () => {
    const four = resolveCardNewsGeometry("4:5");
    expect([four.width, four.height]).toEqual([1080, 1350]);
    expect(four.scaleY(470)).toBe(470);

    const square = resolveCardNewsGeometry("1:1");
    expect([square.width, square.height]).toEqual([1080, 1080]);
    expect(square.scaleY(470)).toBe(376);

    const vertical = resolveCardNewsGeometry("9:16");
    expect([vertical.width, vertical.height]).toEqual([1080, 1920]);
    expect(vertical.scaleY(470)).toBe(668);
  });

  it("falls back to 4:5 for unknown or missing ratios", () => {
    expect(resolveCardNewsGeometry(null).aspectRatio).toBe("4:5");
    expect(resolveCardNewsGeometry("16:9").aspectRatio).toBe("4:5");
  });

  it("renders a 1:1 variant into its own subdirectory at the preset size", async () => {
    const root = tempRoot();
    const result = await renderCardNewsPackage({
      mediaBrief: createCardNewsVerificationBrief(),
      assetRoot: root,
      aspectRatio: "1:1",
      graphicOnly: true,
      now: new Date("2026-09-03T00:00:00.000Z"),
    });
    expect(result.render?.aspectRatio).toBe("1:1");
    const first = result.render!.cards[0]!;
    expect(first.relativePath).toBe("cardnews/1x1/card-01.png");
    const meta = await sharp(readFileSync(join(result.packageRoot, first.relativePath))).metadata();
    expect(meta.width).toBe(CARDNEWS_SIZE_PRESETS["1:1"].width);
    expect(meta.height).toBe(CARDNEWS_SIZE_PRESETS["1:1"].height);
  }, 30_000);
});

describe("Instagram cardnews cards", () => {
  it("derives cover, information, and CTA cards from slide headlines", () => {
    const cards = buildInstagramCardnewsCards(instagramContent(), ["ev-1"]);
    expect(cards.map((card) => card.role)).toEqual([
      "cover",
      "information",
      "information",
      "information",
      "cta",
    ]);
    expect(cards[0]!.headline).toBe("탑승 직전 체크");
    expect(cards[0]!.body).toContain("배 안보다");
    expect(cards[1]!.body).toContain("터미널 2층");
    expect(cards.at(-1)!.headline).toContain("저장해");
  });

  it("does not repeat the hook or hashtags as card bodies", () => {
    const cards = buildInstagramCardnewsCards(instagramContent());
    expect(cards.slice(1).some((card) => card.body.startsWith("#"))).toBe(false);
    expect(cards.filter((card) => card.body.includes("배 안보다")).length).toBe(1);
  });

  it("enables cardnews on the brief only when Instagram is selected and publishable", () => {
    const brief = createCardNewsVerificationBrief();
    brief.formats.cardnews.enabled = false;
    brief.formats.cardnews.cards = [];

    const enabled = applyInstagramCardnewsToBrief(brief, bundle());
    expect(enabled.formats.cardnews.enabled).toBe(true);
    expect(enabled.formats.cardnews.cards.length).toBeGreaterThanOrEqual(4);

    const unselected = applyInstagramCardnewsToBrief(
      brief,
      bundle({ targetChannels: ["threads"] }),
    );
    expect(unselected.formats.cardnews.enabled).toBe(false);
  });

  it("skips fallback captions and short slide decks", () => {
    expect(resolveInstagramCardnewsSkip(bundle())).toBeNull();
    expect(resolveInstagramCardnewsSkip(bundle({ instagram: undefined }))).toBe(
      "instagram_not_selected",
    );
    expect(
      resolveInstagramCardnewsSkip(
        bundle({
          instagram: instagramContent({
            publishableSuccess: false,
            status: "fallback_generated",
          }),
        }),
      ),
    ).toBe("instagram_not_publishable");
    expect(
      resolveInstagramCardnewsSkip(
        bundle({
          instagram: instagramContent({
            instagramMeta: {
              hook: "훅",
              hashtags: [],
              slideHeadlines: ["하나", "둘"],
              cta: null,
              altText: null,
            },
          }),
        }),
      ),
    ).toBe("slide_headlines_missing");
  });
});

describe("Instagram cardnews render step", () => {
  function seedPackage(input: {
    assetRoot: string;
    bundle: PublishableContentBundle;
    cardnewsEnabled?: boolean;
  }): string {
    const packageRoot = join(input.assetRoot, "2026/09/03/dev-cardnews-a3-verification");
    mkdirSync(join(packageRoot, "context"), { recursive: true });
    const brief = createCardNewsVerificationBrief();
    if (input.cardnewsEnabled === false) {
      brief.formats.cardnews.enabled = false;
      brief.formats.cardnews.cards = [];
    }
    // Must match how the export writes it, or the artifact sha guard fires.
    writeFileSync(join(packageRoot, "context/media-brief.json"), stableJsonBytes(brief));
    writeFileSync(
      join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH),
      JSON.stringify(input.bundle),
      "utf8",
    );
    return packageRoot;
  }

  it("renders 4:5 and 1:1 for an eligible package without rewriting the brief", async () => {
    const assetRoot = tempRoot();
    const packageRoot = seedPackage({ assetRoot, bundle: bundle() });
    const briefBefore = readFileSync(join(packageRoot, "context/media-brief.json"), "utf8");

    const result = await renderInstagramCardnewsForPackage({
      packageRoot,
      assetRoot,
      graphicOnly: true,
      now: new Date("2026-09-14T00:00:00.000Z"),
    });

    expect(result.status).toBe("rendered");
    expect(result.aspectRatios).toEqual(["4:5", "1:1"]);
    expect(result.renders.map((render) => render.render?.aspectRatio)).toEqual(["4:5", "1:1"]);
    expect(readFileSync(join(packageRoot, "context/media-brief.json"), "utf8")).toBe(briefBefore);
  }, 60_000);

  it("skips when Instagram was not selected", async () => {
    const assetRoot = tempRoot();
    const packageRoot = seedPackage({ assetRoot, bundle: bundle({ targetChannels: ["threads"] }) });
    const result = await renderInstagramCardnewsForPackage({ packageRoot, assetRoot });
    expect(result.status).toBe("skipped");
    expect(result.skipReason).toBe("instagram_not_selected");
    expect(result.renders).toEqual([]);
  });

  it("enables cardnews from publishable slides when disk brief has none", async () => {
    // Export may lag; render must still resolve copy from publishable authority.
    const assetRoot = tempRoot();
    const packageRoot = seedPackage({ assetRoot, bundle: bundle(), cardnewsEnabled: false });
    const result = await renderInstagramCardnewsForPackage({
      packageRoot,
      assetRoot,
      graphicOnly: true,
      now: new Date("2026-09-14T00:00:00.000Z"),
    });
    expect(result.status).toBe("rendered");
    expect(result.cardCount).toBeGreaterThanOrEqual(4);
  }, 60_000);

  it("skips an incomplete package instead of throwing", async () => {
    const assetRoot = tempRoot();
    const result = await renderInstagramCardnewsForPackage({
      packageRoot: join(assetRoot, "2026/09/03/missing"),
      assetRoot,
    });
    expect(result.status).toBe("skipped");
    expect(result.skipReason).toBe("package_incomplete");
  });
});

/** Dao production fixture — current Card Copy / cardPlan headlines. */
const DAO_CURRENT_CARD_PLAN: PublishableInstagramCardPlan[] = [
  {
    cardId: "card-01",
    role: "cover",
    headline: "해변으로 기억하는 베트남",
    body: "다낭·푸꾸옥·리조트 이미지가 먼저 떠오릅니다",
    visualIntent: "",
  },
  {
    cardId: "card-02",
    role: "information",
    headline: "북쪽으로 올라가면 풍경부터 달라집니다",
    body: "산악 국경 지대의 리듬이 남부 휴양과 다릅니다",
    visualIntent: "",
  },
  {
    cardId: "card-03",
    role: "information",
    headline: "랑선 국경, Dao족 마을",
    body: "험준한 지형 속 생활 공간이 이야기를 받칩니다",
    visualIntent: "",
  },
  {
    cardId: "card-04",
    role: "evidence",
    headline: "nhà trình tường, 흙다짐 가옥",
    body: "판축(rammed-earth) 구조가 구체적 건축 단서입니다",
    visualIntent: "",
  },
  {
    cardId: "card-05",
    role: "cta",
    headline: "휴양 프레임 밖에서 읽히는 베트남",
    body: "익숙한 해변 요약이 아니라 건축·생활의 payoff",
    visualIntent: "",
  },
];

/** Stale media-brief / slideHeadlines copy that must never win over cardPlan. */
const DAO_STALE_HEADLINES = [
  "해변과 리조트만 떠올렸다면",
  "익숙한 베트남의 풍경 너머",
  "북부 국경지대와 Dao족의 기록",
  "전통 흙다짐 주택 ‘nhà trình tường’",
  "베트남을 바라보는 또 하나의 기준",
];

const DAO_STALE_BRIEF_PHRASES = [
  "도시 중심의 익숙한 베트남",
  "우리가 주로 접해온",
  "거주 배경과 생활문화",
  "보여주는 면모",
];

describe("Instagram cardnews copy SoT parity", () => {
  it("prefers cardPlan over stale slideHeadlines and media-brief cards", () => {
    const brief = createCardNewsVerificationBrief();
    brief.formats.cardnews.cards = DAO_STALE_HEADLINES.map((headline, i) => ({
      cardId: `card_${i + 1}`,
      role: (i === 0 ? "cover" : i === 4 ? "cta" : "information") as
        | "cover"
        | "information"
        | "cta",
      headline,
      body: DAO_STALE_BRIEF_PHRASES[Math.min(i, DAO_STALE_BRIEF_PHRASES.length - 1)]!,
      visualIntent: "",
      evidenceRefs: [],
    }));

    const ig = instagramContent({
      instagramMeta: {
        hook: "hook",
        hashtags: [],
        slideHeadlines: DAO_STALE_HEADLINES,
        cta: null,
        altText: null,
        cardPlan: DAO_CURRENT_CARD_PLAN,
      },
    });
    const b = bundle({ instagram: ig });

    const resolved = resolveInstagramCardnewsRenderBrief(brief, b);
    const cards = resolved.formats.cardnews.cards;

    expect(cards.map((c) => c.headline)).toEqual(DAO_CURRENT_CARD_PLAN.map((c) => c.headline));
    expect(cards.map((c) => c.body)).toEqual(DAO_CURRENT_CARD_PLAN.map((c) => c.body));
    expect(cards.map((c) => c.cardId)).toEqual(DAO_CURRENT_CARD_PLAN.map((c) => c.cardId));

    for (const phrase of DAO_STALE_BRIEF_PHRASES) {
      expect(cards.some((c) => c.headline.includes(phrase) || c.body.includes(phrase))).toBe(
        false,
      );
    }
    for (const stale of DAO_STALE_HEADLINES) {
      expect(cards.some((c) => c.headline === stale)).toBe(false);
    }

    expect(diffInstagramCardPlanCopyParity(b, cards)).toEqual([]);
  });

  it("keeps legacy slideHeadlines fallback when cardPlan is absent", () => {
    const cards = buildInstagramCardnewsCards(instagramContent());
    expect(cards[0]!.headline).toBe("탑승 직전 체크");
    expect(diffInstagramCardPlanCopyParity(bundle(), cards)).toEqual([]);
  });

  it("fails parity when resolved copy drifts from cardPlan", () => {
    const ig = instagramContent({
      instagramMeta: {
        hook: "hook",
        hashtags: [],
        slideHeadlines: DAO_STALE_HEADLINES,
        cta: null,
        altText: null,
        cardPlan: DAO_CURRENT_CARD_PLAN,
      },
    });
    const mismatches = diffInstagramCardPlanCopyParity(bundle({ instagram: ig }), [
      { cardId: "card_1", headline: DAO_STALE_HEADLINES[0]!, body: DAO_STALE_BRIEF_PHRASES[0]! },
      ...DAO_CURRENT_CARD_PLAN.slice(1).map((c) => ({
        cardId: c.cardId,
        headline: c.headline,
        body: c.body,
      })),
    ]);
    expect(mismatches.some((m) => m.field === "headline")).toBe(true);
    expect(mismatches.some((m) => m.field === "cardId")).toBe(true);
  });
});

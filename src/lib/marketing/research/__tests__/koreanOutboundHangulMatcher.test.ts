import { describe, expect, it } from "vitest";

import {
  detectKoreanOutboundDemandBand,
  scoreKoreanOutboundRelevance,
} from "@/lib/marketing/research/services/koreanOutboundRelevanceScorer";
import {
  diversifyCompactCurationCandidates,
  destinationTopicFamilyKey,
} from "@/lib/marketing/research/services/diversifyAgendaCandidatesForCuration";
import {
  hangulCompoundTermSource,
  hangulPlaceTermSource,
} from "@/lib/marketing/research/services/hangulAwareTermMatcher";
import { collectUniqueArticleAgendaCandidates } from "@/lib/marketing/research/manager/collectUniqueArticleAgendaCandidates";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import type { AgendaCandidate } from "@/lib/marketing/research/types/researchBrief";

const detect = (title: string) => detectKoreanOutboundDemandBand({ title }).matchedId;

function practical(title: string): boolean {
  return scoreKoreanOutboundRelevance({ title, summary: "", destinations: [], topics: [] }).reasons.includes(
    "practical_traveler_impact",
  );
}

describe("Hangul destination matching", () => {
  it.each([
    ["베트남 다낭 가을 여행", "vietnam"],
    ["일본 도쿄 단풍 여행", "japan"],
    ["태국 방콕 우기 여행 팁", "thailand"],
    ["대만 타이베이 주말 여행", "taiwan"],
  ])("%s → %s", (title, id) => {
    expect(detect(title)).toBe(id);
  });

  it.each([
    ["다낭 해변 리조트 특가", "vietnam"],
    ["나트랑 신규 취항", "vietnam"],
    ["하노이 구시가지 걷기", "vietnam"],
    ["호치민 야시장 투어", "vietnam"],
    ["도쿄 단풍 명소", "japan"],
    ["오사카 먹방 코스", "japan"],
    ["교토 사찰 순례", "japan"],
    ["홋카이도 첫눈 소식", "japan"],
    ["오키나와 해변", "japan"],
    ["후쿠오카 온천 여행", "japan"],
    ["나고야 신규 노선", "japan"],
    ["방콕 야시장", "thailand"],
    ["치앙마이 한달살기", "thailand"],
    ["푸켓 우기 주의보", "thailand"],
    ["타이베이 야시장", "taiwan"],
  ])("city-only alias %s → %s", (title, id) => {
    expect(detect(title)).toBe(id);
  });

  it.each([
    ["일본행 항공권 특가", "japan"],
    ["괌에서 보내는 겨울", "usa_fit"],
    ["‘호주’ 노선 확대", "australia"],
    ["호주의 겨울 축제", "australia"],
    ["다낭·호이안 3박5일", "vietnam"],
    ["[단독]베트남 비자 면제 연장", "vietnam"],
    ["그랜드캐년 국립공원", "usa_fit"],
    ["세부 막탄 리조트", "philippines"],
    ["인도 여행 비자 발급", "india"],
    ["수단 내전 격화", "sudan"],
    ["남수단 여행금지", "south_sudan"],
    ["인도네시아 발리 여행", "se_asia_core"],
  ])("particles / punctuation keep the place: %s → %s", (title, id) => {
    expect(detect(title)).toBe(id);
  });

  it.each([
    ["Vietnam autumn escapes", "vietnam"],
    ["Tokyo foliage weekend", "japan"],
    ["Bangkok rainy season tips", "thailand"],
    ["Taipei night markets", "taiwan"],
    ["Sudan conflict update", "sudan"],
    ["South Sudan travel advice", "south_sudan"],
    ["Indonesia Bali reopening", "se_asia_core"],
    ["India e-visa change", "india"],
    ["Grand Canyon flood safety tips", "usa_fit"],
    ["USA road trip planner", "usa_fit"],
    ["Hawaii volcano advisory", "usa_fit"],
    ["Chiang Mai lantern festival", "thailand"],
  ])("English regression %s → %s", (title, id) => {
    expect(detect(title)).toBe(id);
  });

  it("matches mixed Korean/English the same way", () => {
    expect(detect("Japan 도쿄 여행 가이드")).toBe("japan");
    expect(detect("다낭 Danang beach")).toBe("vietnam");
    expect(detect("베트남 vietnam 가을")).toBe("vietnam");
    expect(
      detectKoreanOutboundDemandBand({ title: "가을 여행", destinations: ["베트남-다낭-가을-여행"] })
        .matchedId,
    ).toBe("vietnam");
  });

  it.each([
    ["교통수단 비교", "sudan"],
    ["결제수단 안내", "sudan"],
    ["이동수단 확충", "sudan"],
    ["결제 수단 다양화", "sudan"],
    ["최후의 수단으로 꺼낸 카드", "sudan"],
    ["수단과 방법을 가리지 않고", "sudan"],
    ["인도네시아 발리 여행", "india"],
    ["인도어 골프 연습장", "india"],
    ["차량 인도 받은 후기", "india"],
    ["범죄인 인도 조약", "india"],
    ["호주머니에 여권 보관", "australia"],
    ["대만족 후기 이벤트", "taiwan"],
    ["세부 일정 안내", "philippines"],
    ["세부적인 사항 공지", "philippines"],
    ["단독일정 패키지", "germany"],
    ["학교토론 대회", "japan"],
    ["방콕족을 위한 홈캉스", "thailand"],
  ])("no substring false positive: %s is not %s", (title, id) => {
    expect(detect(title)).not.toBe(id);
  });

  it("does not detect any destination inside ordinary Korean sentences", () => {
    for (const title of [
      "교통수단 비교",
      "결제수단 안내",
      "호주머니에 여권 보관",
      "대만족 후기 이벤트",
      "세부 내용은 추후 공지",
      "소비자 보호 강화",
      "인도어 골프 연습장",
      "독일정 신메뉴",
    ]) {
      expect(detect(title)).toBeNull();
    }
  });

  it("India pattern alone never matches inside 인도네시아", () => {
    const re = new RegExp(hangulPlaceTermSource({ term: "인도", notBefore: "네시아|어" }));
    expect(re.test("인도네시아")).toBe(false);
    expect(re.test("인도 뉴델리")).toBe(true);
  });
});

describe("Hangul practical-impact matching", () => {
  it.each([
    ["베트남 비자 면제 연장"],
    ["무비자 입국 확대"],
    ["입국 심사 강화"],
    ["항공권 특가 오픈"],
    ["저비용항공사 증편"],
    ["태풍 북상에 결항 속출"],
    ["가을 축제 일정"],
    ["벚꽃축제 개막"],
    ["환승 관광 프로그램"],
    ["성수기 숙소 예약"],
    ["여행 안전 수칙"],
    ["비자발급 절차 간소화"],
  ])("matches %s", (title) => {
    expect(practical(title)).toBe(true);
  });

  it.each([["소비자 만족도 조사"], ["비자금 의혹"], ["비자발적 퇴사"], ["환승연애 촬영지"], ["항공모함 입항"]])(
    "does not match %s",
    (title) => {
      expect(practical(title)).toBe(false);
    },
  );

  it.each([
    ["Visa rules change"],
    ["Flight delays at airport"],
    ["Typhoon warning"],
    ["Lantern festival season"],
    ["Travel advisory update"],
  ])("English regression %s", (title) => {
    expect(practical(title)).toBe(true);
  });

  it("compound source keeps negative contexts explicit", () => {
    const re = new RegExp(hangulCompoundTermSource({ term: "비자", notAfter: "소", notBefore: "금" }));
    expect(re.test("무비자")).toBe(true);
    expect(re.test("소비자")).toBe(false);
    expect(re.test("비자금")).toBe(false);
  });
});

describe("Korean-only titles no longer rely on English destinations", () => {
  it("일본 소도시 title alone reaches the japan high band", () => {
    const result = scoreKoreanOutboundRelevance({
      title: "올가을을 위한 일본 소도시 여행",
      summary: "한국인 해외여행객을 위한 도쿄·오사카 가을 일정",
      destinations: [],
      topics: [],
    });
    expect(result.demandBand).toBe("high");
    expect(result.reasons).toContain("destination_demand_high:japan");
  });

  it("‘호주’ title alone reaches australia with practical impact", () => {
    const result = scoreKoreanOutboundRelevance({
      title: "올겨울 항공 공급 폭발하는 여행지 ‘호주’, 기회의 땅 될까?",
      summary: "한국발 호주 노선 공급이 늘며 해외여행 수요가 움직인다",
      destinations: [],
      topics: [],
    });
    expect(result.reasons).toContain("destination_demand_high:australia");
    expect(result.reasons).toContain("practical_traveler_impact");
  });
});

function compact(id: string, title: string, sourceName: string): CompactManagerAgendaCandidate {
  return {
    agendaCandidateId: id,
    researchBriefId: `brief-${id}`,
    title,
    summary: "",
    destinations: [],
    topics: [],
    entities: [],
    signalTypes: [],
    publishedAt: null,
    observedAt: "2026-09-02T00:00:00.000Z",
    freshnessScore: 0.9,
    credibilityScore: 0.8,
    travelRelevanceScore: 0.8,
    publicInterestScore: 0.7,
    commercialRelevanceScore: 0,
    seasonalityScore: 0,
    corroborationScore: 0,
    noveltyScore: 0,
    koreanOutboundRelevanceScore: 0.7,
    totalResearchScore: 0.8,
    researchScoreComponents: null,
    scoreReasons: [],
    riskFlags: [],
    matchedProductIds: [],
    evidence: [
      {
        evidenceId: `ev-${id}`,
        sourceId: `src-${sourceName}`,
        sourceType: "news",
        sourceName,
        isOfficial: false,
        evidenceType: "direct_source",
        url: null,
        reference: null,
        excerpt: null,
        publishedAt: null,
        observedAt: "2026-09-02T00:00:00.000Z",
      },
    ],
    candidateStatus: "candidate",
  };
}

describe("A1 unique-article pre-pool is independent of destination grouping", () => {
  it("keeps distinct Korean Vietnam articles even though they share destination:vietnam", async () => {
    const rows = [
      { id: "k1", title: "베트남 다낭 가을 여행", url: "https://traveldaily.example/1" },
      { id: "k2", title: "베트남 다낭 가을 여행", url: "https://traveltimes.example/2" },
      { id: "k3", title: "하노이 구시가지 걷기", url: "https://travie.example/3" },
      { id: "k4", title: "베트남 다낭 가을 여행", url: "https://traveldaily.example/1?utm_source=rss" },
    ];
    const candidates = rows.map(
      (r, i) =>
        ({
          id: r.id,
          researchBriefId: `brief-${r.id}`,
          title: r.title,
          compositeResearchScore: 0.9 - i * 0.01,
          createdAt: "2026-09-02T00:00:00.000Z",
        }) as AgendaCandidate,
    );
    const repo = {
      async findRecentAgendaCandidates() {
        return candidates;
      },
      async findRecentAgendaCandidatesPage(input: { limit: number; offset: number }) {
        return candidates.slice(input.offset, input.offset + input.limit);
      },
      async findAgendaCandidateArticleRefs(page: AgendaCandidate[]) {
        return new Map(
          page.map((c) => [
            c.id,
            { canonicalUrl: rows.find((r) => r.id === c.id)!.url, signalId: `sig-${c.id}`, sourceId: "s" },
          ]),
        );
      },
    } as unknown as ResearchRepository;

    const { candidates: kept } = await collectUniqueArticleAgendaCandidates(repo, {
      since: "2026-08-26T00:00:00.000Z",
      targetUniqueArticles: 180,
    });
    expect(kept.map((c) => c.id)).toEqual(["k1", "k2", "k3"]);
    expect(new Set(kept.map((c) => destinationTopicFamilyKey(c)))).toEqual(
      new Set(["destination:vietnam"]),
    );
  });
});

describe("destination group canonicalization", () => {
  it("베트남 / 다낭 / 하노이 / vietnam share one family", () => {
    const keys = new Set(
      ["베트남 다낭 가을 여행", "하노이 구시가지", "다낭 리조트", "Vietnam autumn escapes"].map((title) =>
        destinationTopicFamilyKey({ title }),
      ),
    );
    expect([...keys]).toEqual(["destination:vietnam"]);
    expect(
      destinationTopicFamilyKey({ title: "가을 여행", destinations: ["베트남-다낭-가을-여행"] }),
    ).toBe("destination:vietnam");
  });

  it("일본 / 도쿄 / 오사카 / japan share one family", () => {
    const keys = new Set(
      ["일본 도쿄 단풍 여행", "오사카 먹방", "Japan foliage weekend"].map((title) =>
        destinationTopicFamilyKey({ title }),
      ),
    );
    expect([...keys]).toEqual(["destination:japan"]);
  });

  it("Korean and English titles score alike for the same destination", () => {
    const base = { summary: "", destinations: [] as string[], topics: [] as string[] };
    const pairs: Array<[string, string]> = [
      ["베트남 다낭 가을 여행", "Vietnam Danang autumn trip"],
      ["일본 도쿄 단풍 여행", "Japan Tokyo foliage trip"],
      ["태국 방콕 우기 여행 팁 비자", "Thailand Bangkok rainy trip tips visa"],
    ];
    for (const [ko, en] of pairs) {
      const koScore = scoreKoreanOutboundRelevance({ ...base, title: ko });
      const enScore = scoreKoreanOutboundRelevance({ ...base, title: en });
      expect(koScore.demandBand).toBe(enScore.demandBand);
      expect(koScore.score).toBeCloseTo(enScore.score, 6);
    }
  });

  it("diversify caps a Korean+English Vietnam mix as one destination family", () => {
    const pool = [
      compact("v1", "베트남 다낭 가을 여행", "트래블데일리"),
      compact("v2", "Vietnam autumn escapes", "Vietnam Tourism"),
      compact("v3", "하노이 구시가지 걷기", "여행신문"),
      compact("j1", "일본 도쿄 단풍 여행", "트래비"),
      compact("t1", "태국 방콕 우기 여행 팁", "NYT"),
    ];
    const picked = diversifyCompactCurationCandidates(pool, { limit: 4 });
    const vietnam = picked.filter((c) => destinationTopicFamilyKey(c) === "destination:vietnam");
    expect(vietnam).toHaveLength(2);
    expect(picked.map((c) => c.agendaCandidateId)).toEqual(
      expect.arrayContaining(["j1", "t1"]),
    );
  });
});

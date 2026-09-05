import { describe, expect, it } from "vitest";

import {
  diversifyCompactCurationCandidates,
  destinationTopicFamilyKey,
  diversityDiagnosticsForCompactCandidates,
  isCredibleForCurationDiversity,
} from "@/lib/marketing/research/services/diversifyAgendaCandidatesForCuration";
import { buildDailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/buildDailyAgendaSlate";
import { buildManagerAgendaSlateCurationPrompt } from "@/lib/marketing/cron/daily/agendaSlate/curateManagerAgendaSlate";
import {
  agendaCandidate,
  buildResearchContext,
  officialEvidence,
} from "@/lib/marketing/cron/daily/__tests__/fixtures";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import { scoreKoreanOutboundRelevance } from "@/lib/marketing/research/services/koreanOutboundRelevanceScorer";
import { classifyTravelDirection } from "@/lib/marketing/research/services/travelDirection";

function cand(
  partial: Partial<CompactManagerAgendaCandidate> &
    Pick<CompactManagerAgendaCandidate, "agendaCandidateId" | "title" | "summary">,
): CompactManagerAgendaCandidate {
  return {
    ...agendaCandidate,
    researchBriefId: partial.researchBriefId ?? `rb-${partial.agendaCandidateId}`,
    destinations: partial.destinations ?? [],
    topics: partial.topics ?? ["travel"],
    signalTypes: partial.signalTypes ?? [],
    totalResearchScore: partial.totalResearchScore ?? 0.5,
    freshnessScore: partial.freshnessScore ?? 0.7,
    credibilityScore: partial.credibilityScore ?? 0.7,
    travelRelevanceScore: partial.travelRelevanceScore ?? 0.6,
    publicInterestScore: partial.publicInterestScore ?? 0.5,
    commercialRelevanceScore: partial.commercialRelevanceScore ?? 0.3,
    koreanOutboundRelevanceScore: partial.koreanOutboundRelevanceScore ?? 0.3,
    researchScoreComponents: partial.researchScoreComponents ?? null,
    scoreReasons: partial.scoreReasons ?? [],
    riskFlags: partial.riskFlags ?? [],
    matchedProductIds: partial.matchedProductIds ?? [],
    evidence: partial.evidence ?? [officialEvidence],
    ...partial,
  };
}

function vietnamPoolPlusAlts() {
  const vietnam = [1, 2, 3, 4, 5, 6].map((n) =>
    cand({
      agendaCandidateId: `ac-vn-${n}`,
      title: `Vietnam autumn escape ${n}`,
      summary: `Vietnam beach and autumn tips ${n} for Korean outbound travelers`,
      destinations: ["Vietnam"],
      topics: n % 2 === 0 ? ["season"] : ["beach"],
      totalResearchScore: 0.8 - n * 0.01,
      koreanOutboundRelevanceScore: 0.85 - n * 0.01,
      scoreReasons: ["koreanOutbound_destination_demand_high:vietnam", "koreanOutbound_travelDirection_outbound"],
      evidence: [
        {
          ...officialEvidence,
          sourceId: "vietnam-tourism",
          sourceName: "Vietnam Tourism",
        },
      ],
    }),
  );
  const alts = [
    cand({
      agendaCandidateId: "ac-jp-1",
      title: "Japan foliage weekend plan",
      summary: "Tokyo and Kyoto autumn foliage for Korean travelers",
      destinations: ["Japan"],
      topics: ["season"],
      totalResearchScore: 0.72,
      koreanOutboundRelevanceScore: 0.78,
      scoreReasons: ["koreanOutbound_destination_demand_high:japan", "koreanOutbound_travelDirection_outbound"],
      evidence: [{ ...officialEvidence, sourceId: "traveltimes", sourceName: "Traveltimes" }],
    }),
    cand({
      agendaCandidateId: "ac-au-1",
      title: "Australia flight expansion winter",
      summary: "More Korea-Australia seats for outbound winter travel",
      destinations: ["Australia"],
      topics: ["flight_route"],
      totalResearchScore: 0.7,
      koreanOutboundRelevanceScore: 0.76,
      scoreReasons: ["koreanOutbound_destination_demand_high:australia", "koreanOutbound_travelDirection_outbound"],
      evidence: [{ ...officialEvidence, sourceId: "travie", sourceName: "Travie" }],
    }),
    cand({
      agendaCandidateId: "ac-th-1",
      title: "Thailand visa tips for autumn",
      summary: "Practical Bangkok entry notes for Korean outbound travelers",
      destinations: ["Thailand"],
      topics: ["visa"],
      totalResearchScore: 0.68,
      koreanOutboundRelevanceScore: 0.74,
      scoreReasons: ["koreanOutbound_destination_demand_high:thailand", "koreanOutbound_travelDirection_outbound"],
      evidence: [{ ...officialEvidence, sourceId: "traveldaily", sourceName: "TravelDailyNews" }],
    }),
  ];
  // Ranked outbound-aware: Vietnam head, then alts
  return [...vietnam, ...alts];
}

describe("STEP R-4 diversified curation pool", () => {
  it("1. six high-score Vietnam + JP/AU/TH alts do not yield all-Vietnam MM input", () => {
    const ranked = vietnamPoolPlusAlts();
    const pool = diversifyCompactCurationCandidates(ranked, { limit: 10 });
    const families = new Set(
      pool.map((c) =>
        destinationTopicFamilyKey({
          destinations: c.destinations,
          topics: c.topics,
          title: c.title,
        }),
      ),
    );
    const vietnamOnly = pool.every((c) =>
      (c.destinations ?? []).some((d) => /vietnam/i.test(d)),
    );
    expect(vietnamOnly).toBe(false);
    expect(families.size).toBeGreaterThanOrEqual(3);
    expect(pool.some((c) => c.agendaCandidateId.startsWith("ac-jp"))).toBe(true);
    expect(pool.some((c) => c.agendaCandidateId.startsWith("ac-au"))).toBe(true);
    expect(pool.some((c) => c.agendaCandidateId.startsWith("ac-th"))).toBe(true);
    // Soft-cap head keeps Vietnam from monopolizing the early diverse window
    const firstFive = pool.slice(0, 5);
    const vnInFirstFive = firstFive.filter((c) =>
      (c.destinations ?? []).some((d) => /vietnam/i.test(d)),
    ).length;
    expect(vnInFirstFive).toBeLessThanOrEqual(2);
  });

  it("2. high-quality relevance remains primary (top ranked credible still preferred)", () => {
    const ranked = vietnamPoolPlusAlts();
    const pool = diversifyCompactCurationCandidates(ranked, { limit: 6 });
    // First Vietnam item should still be present (highest rank) even with caps
    expect(pool[0]?.agendaCandidateId).toBe("ac-vn-1");
    expect(pool.map((c) => c.agendaCandidateId)).toContain("ac-vn-2");
  });

  it("3. LOW inbound/domestic/B2B is not promoted just for diversity", () => {
    const ranked = [
      ...vietnamPoolPlusAlts(),
      cand({
        agendaCandidateId: "ac-inbound",
        title: "ai 추천 따라 움직이는 외국인…관광지·맛집 방한",
        summary: "한국여행을 준비하는 외국인 관광객 인바운드 트렌드",
        destinations: [],
        topics: ["inbound"],
        totalResearchScore: 0.9,
        koreanOutboundRelevanceScore: 0.12,
        scoreReasons: ["koreanOutbound_inbound_demoted_for_agenda_seed"],
        evidence: [{ ...officialEvidence, sourceId: "tt", sourceName: "Traveltimes" }],
      }),
      cand({
        agendaCandidateId: "ac-domestic",
        title: "여수세계섬박람회 개막 국내 여행",
        summary: "국내 관광객을 위한 여수 섬박람회",
        destinations: [],
        topics: ["domestic"],
        totalResearchScore: 0.88,
        koreanOutboundRelevanceScore: 0.1,
        scoreReasons: ["koreanOutbound_domestic_demoted_for_agenda_seed"],
        evidence: [{ ...officialEvidence, sourceId: "tt2", sourceName: "Travie" }],
      }),
      cand({
        agendaCandidateId: "ac-b2b",
        title: "서울관협 mou 체결 여행업계",
        summary: "업무협약으로 관광 콘텐츠 공동 개발",
        destinations: [],
        topics: ["industry"],
        totalResearchScore: 0.87,
        koreanOutboundRelevanceScore: 0.11,
        scoreReasons: ["koreanOutbound_industry_b2b_demoted_for_agenda_seed"],
        evidence: [{ ...officialEvidence, sourceId: "tt3", sourceName: "TravelDailyNews" }],
      }),
    ];
    const pool = diversifyCompactCurationCandidates(ranked, { limit: 8 });
    expect(pool.some((c) => c.agendaCandidateId === "ac-inbound")).toBe(false);
    expect(pool.some((c) => c.agendaCandidateId === "ac-domestic")).toBe(false);
    expect(pool.some((c) => c.agendaCandidateId === "ac-b2b")).toBe(false);
    expect(
      isCredibleForCurationDiversity({
        koreanOutboundRelevanceScore: 0.12,
        scoreReasons: ["inbound_demoted_for_agenda_seed"],
        title: "외국인 관광",
        summary: "방한",
      }),
    ).toBe(false);
  });

  it("4. same-source soft cap applies when alternatives exist", () => {
    const ranked = vietnamPoolPlusAlts();
    // Limit fits under soft caps (2 VN + JP + AU + TH)
    const pool = diversifyCompactCurationCandidates(ranked, { limit: 5 });
    const diag = diversityDiagnosticsForCompactCandidates(pool);
    expect(diag.maxCandidatesPerSource).toBeLessThanOrEqual(2);
  });

  it("5. same-destination soft cap applies when alternatives exist", () => {
    const ranked = vietnamPoolPlusAlts();
    const pool = diversifyCompactCurationCandidates(ranked, { limit: 5 });
    const diag = diversityDiagnosticsForCompactCandidates(pool);
    expect(diag.maxCandidatesPerDestinationFamily).toBeLessThanOrEqual(2);
  });

  it("6. constraints relax deterministically when alternatives do not exist", () => {
    const onlyVietnam = [1, 2, 3, 4, 5, 6].map((n) =>
      cand({
        agendaCandidateId: `ac-only-vn-${n}`,
        title: `Vietnam tip ${n}`,
        summary: `Vietnam outbound tip ${n}`,
        destinations: ["Vietnam"],
        koreanOutboundRelevanceScore: 0.8,
        scoreReasons: ["koreanOutbound_travelDirection_outbound"],
        evidence: [
          {
            ...officialEvidence,
            sourceId: "vietnam-tourism",
            sourceName: "Vietnam Tourism",
          },
        ],
      }),
    );
    const pool = diversifyCompactCurationCandidates(onlyVietnam, { limit: 6 });
    expect(pool).toHaveLength(6);
    // Soft caps relax in pass 2/3 when no alternatives exist
    expect(pool.every((c) => c.agendaCandidateId.startsWith("ac-only-vn"))).toBe(true);
  });

  it("7. at least 3 families are exposed to MM when available", () => {
    const pool = diversifyCompactCurationCandidates(vietnamPoolPlusAlts(), { limit: 10 });
    const diag = diversityDiagnosticsForCompactCandidates(pool);
    expect(diag.uniqueDestinationFamilyCount).toBeGreaterThanOrEqual(3);
  });

  it("8. fallback uses the same diversified ordering", () => {
    const ranked = vietnamPoolPlusAlts();
    const diversified = diversifyCompactCurationCandidates(ranked, { limit: 6 });
    const slate = buildDailyAgendaSlate({
      research: buildResearchContext({ agendaCandidates: ranked }),
      logicalRunKey: "test:r4-fallback-parity",
      businessDateKst: "2026-09-05",
      runId: "run-r4",
      correlationId: "corr-r4",
      targetSize: 6,
    });
    expect(slate.candidates.map((c) => c.agendaCandidateId)).toEqual(
      diversified.map((c) => c.agendaCandidateId),
    );
  });

  it("9. R-3 outbound scoring behavior remains intact", () => {
    const inbound = scoreKoreanOutboundRelevance({
      title: "ai 추천 따라 움직이는 외국인…관광지·맛집 45.4% 실제 방문",
      summary: "한국여행을 준비하는 외국인 관광객",
      destinations: [],
      topics: ["travel"],
    });
    const outbound = scoreKoreanOutboundRelevance({
      title: "올가을을 위한 일본 소도시 여행",
      summary: "한국인 해외여행객을 위한 도쿄·오사카 가을 일정",
      destinations: ["japan"],
      topics: ["travel", "season"],
    });
    expect(classifyTravelDirection({
      title: "ai 추천 따라 움직이는 외국인…관광지·맛집 45.4% 실제 방문",
      summary: "한국여행을 준비하는 외국인 관광객",
    })).toBe("inbound");
    expect(outbound.score).toBeGreaterThan(inbound.score);
  });

  it("13. no semantic/vector dedupe introduced in diversify module", async () => {
    const src = await import(
      "@/lib/marketing/research/services/diversifyAgendaCandidatesForCuration"
    );
    const keys = Object.keys(src);
    expect(keys.some((k) => /embed|vector|semantic/i.test(k))).toBe(false);
    const prompt = buildManagerAgendaSlateCurationPrompt(
      buildResearchContext({ agendaCandidates: vietnamPoolPlusAlts() }),
      6,
    );
    expect(prompt).toContain("varied slate");
    expect(prompt).toContain("3 destination/topic families");
    expect(/embedding|vector semantic/i.test(prompt)).toBe(false);
  });

  it("slug destinations with shared place in title collapse to one family", () => {
    expect(
      destinationTopicFamilyKey({
        title: "Vietnam’s best september escapes",
        destinations: ["chasing-gold-and-clouds-vietnam-s-best-september-escapes"],
      }),
    ).toBe("destination:vietnam");
    expect(
      destinationTopicFamilyKey({
        title: "Enjoy early autumn in northern Vietnam",
        destinations: ["enjoy-early-autumn-in-northern-vietnam"],
      }),
    ).toBe("destination:vietnam");
    expect(
      destinationTopicFamilyKey({
        title: "Japan foliage weekend",
        destinations: ["japan-foliage-weekend"],
      }),
    ).toBe("destination:japan");
  });
});

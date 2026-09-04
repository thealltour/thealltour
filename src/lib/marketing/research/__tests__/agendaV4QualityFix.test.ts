import { describe, expect, it } from "vitest";

import { classifyTravelDirection } from "@/lib/marketing/research/services/travelDirection";
import { scoreKoreanOutboundRelevance } from "@/lib/marketing/research/services/koreanOutboundRelevanceScorer";
import { resolveSourceRoleWeights } from "@/lib/marketing/research/portfolio/sourcePortfolioRoles";
import {
  MVP_RESEARCH_SOURCES,
  TRAVELTIMES_SOURCE_ID,
  UK_GOV_TRAVEL_SOURCE_ID,
  VIETNAM_TRAVEL_SOURCE_ID,
} from "@/lib/marketing/research/collectors/config";
import { buildDailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/buildDailyAgendaSlate";
import { parseManagerAgendaSlateCuration } from "@/lib/marketing/cron/daily/agendaSlate/curateManagerAgendaSlate";
import {
  agendaCandidate,
  buildResearchContext,
  officialEvidence,
  researchBrief,
  NOW,
} from "@/lib/marketing/cron/daily/__tests__/fixtures";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

const KR_SOURCE = MVP_RESEARCH_SOURCES.find((s) => s.id === TRAVELTIMES_SOURCE_ID)!;
const VN_SOURCE = MVP_RESEARCH_SOURCES.find((s) => s.id === VIETNAM_TRAVEL_SOURCE_ID)!;
const FCDO = MVP_RESEARCH_SOURCES.find((s) => s.id === UK_GOV_TRAVEL_SOURCE_ID)!;

function role(source: ResearchSource) {
  return resolveSourceRoleWeights({
    ...source,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  });
}

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

describe("STEP R-3 travelDirection / audienceIntent", () => {
  it("4. inbound Korean article ranks below genuine outbound Japan/Vietnam topic", () => {
    const inbound = scoreKoreanOutboundRelevance({
      title: "ai 추천 따라 움직이는 외국인…관광지·맛집 45.4% 실제 방문",
      summary: "한국여행을 준비하는 외국인 관광객이 생성형 AI를 이용한다",
      destinations: [],
      topics: ["travel"],
      sourceRole: role(KR_SOURCE),
    });
    const outbound = scoreKoreanOutboundRelevance({
      title: "올가을을 위한 일본 소도시 여행",
      summary: "한국인 해외여행객을 위한 도쿄·오사카 가을 일정",
      destinations: ["japan"],
      topics: ["travel", "season"],
      sourceRole: role(KR_SOURCE),
    });
    expect(classifyTravelDirection({ title: inbound.reasons.join(" "), summary: "외국인 관광" })).toBeTruthy();
    expect(classifyTravelDirection({
      title: "ai 추천 따라 움직이는 외국인…관광지·맛집 45.4% 실제 방문",
      summary: "한국여행을 준비하는 외국인 관광객",
    })).toBe("inbound");
    expect(classifyTravelDirection({
      title: "올가을을 위한 일본 소도시 여행",
      summary: "한국인 해외여행객을 위한 도쿄 일정",
      destinations: ["japan"],
    })).toBe("outbound");
    expect(outbound.score).toBeGreaterThan(inbound.score);
  });

  it("5. domestic event ranks below outbound travel-planning topic", () => {
    const domestic = scoreKoreanOutboundRelevance({
      title: "여수세계섬박람회 5일 개막…61일간 섬·해양 콘텐츠 선보인다",
      summary: "국내 관광객을 위한 여수 섬박람회 개막",
      destinations: [],
      topics: ["event"],
      sourceRole: role(KR_SOURCE),
    });
    const outbound = scoreKoreanOutboundRelevance({
      title: "9월에 알아두면 좋은 해외여행 소식",
      summary: "부산발 광저우 노선과 해외 패키지 여행 팁",
      destinations: ["china"],
      topics: ["flight_route"],
      signalTypes: ["flight_route"],
      sourceRole: role(KR_SOURCE),
    });
    expect(domestic.travelDirection).toBe("domestic");
    expect(outbound.score).toBeGreaterThan(domestic.score);
  });

  it("6. tourism-industry B2B article is demoted", () => {
    const b2b = scoreKoreanOutboundRelevance({
      title: "‘서울관협-아트피아드위원회’ mou 체결",
      summary: "업무협약으로 관광 콘텐츠 공동 개발",
      destinations: [],
      topics: ["travel"],
      sourceRole: role(KR_SOURCE),
    });
    expect(b2b.travelDirection).toBe("industry_b2b");
    expect(b2b.score).toBeLessThan(0.3);
  });

  it("7. Korean editorial outbound article still receives strong contribution", () => {
    const scored = scoreKoreanOutboundRelevance({
      title: "올겨울 항공 공급 폭발하는 여행지 ‘호주’, 기회의 땅 될까?",
      summary: "한국발 호주 노선 공급이 늘며 해외여행 수요가 움직인다",
      destinations: ["australia"],
      topics: ["travel", "airfare"],
      signalTypes: ["flight_route"],
      sourceRole: role(KR_SOURCE),
    });
    expect(scored.travelDirection).toBe("outbound");
    expect(scored.score).toBeGreaterThan(0.55);
    expect(scored.reasons.some((r) => r.includes("korean_market_source"))).toBe(true);
  });

  it("8. Vietnam official outbound item outranks unrelated domestic/inbound article", () => {
    const vietnam = scoreKoreanOutboundRelevance({
      title: "Chasing Gold and Clouds: Vietnam’s Best September Escapes",
      summary: "September escapes across Vietnam for autumn travelers",
      destinations: ["vietnam"],
      topics: ["travel", "season"],
      sourceRole: role(VN_SOURCE),
    });
    const inbound = scoreKoreanOutboundRelevance({
      title: "관통사 한시자격 논란 계속되자…문관부 보완책",
      summary: "관광통역안내사 한시자격 제도 설명",
      destinations: [],
      topics: ["policy"],
      sourceRole: role(KR_SOURCE),
    });
    expect(vietnam.score).toBeGreaterThan(inbound.score);
  });

  it("11. FCDO remains high-authority evidence despite low agenda-seed value", () => {
    const weights = role(FCDO);
    expect(weights.evidenceAuthorityWeight).toBeGreaterThan(0.9);
    expect(weights.agendaSeedWeight).toBeLessThan(0.3);
  });
});

describe("STEP R-3 MM parse + fallback", () => {
  function poolContext() {
    const agendaCandidates = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
      cand({
        agendaCandidateId: `ac-item-${n}`,
        researchBriefId: `rb-item-${n}`,
        title: `Travel topic ${n}`,
        summary: `Summary for topic ${n} with enough detail for travelers.`,
        totalResearchScore: 0.4 + n * 0.02,
        koreanOutboundRelevanceScore: n >= 5 ? 0.75 : 0.35,
        evidence: [
          {
            ...officialEvidence,
            sourceId: `src-${n % 3}`,
            sourceName: `Source-${n % 3}`,
          },
        ],
        destinations: n % 2 === 0 ? ["vietnam"] : ["japan"],
      }),
    );
    return buildResearchContext({
      agendaCandidates,
      briefs: agendaCandidates.map((c) => ({
        ...researchBrief,
        researchBriefId: c.researchBriefId,
        title: c.title,
        summary: c.summary,
      })),
    });
  }

  it("1. valid manager 6-item response remains 6", () => {
    const research = poolContext();
    const raw = JSON.stringify({
      decision: "curate",
      items: [1, 2, 3, 4, 5, 6].map((n) => ({
        agendaCandidateId: `ac-item-${n}`,
        researchBriefId: `rb-item-${n}`,
        title: `Travel topic ${n}`,
        summary: `Summary for topic ${n} with enough detail for travelers.`,
        rationale: [`pick ${n}`],
      })),
    });
    const parsed = parseManagerAgendaSlateCuration(raw, research, 6);
    expect(parsed.outcome).toBe("curated");
    if (parsed.outcome === "curated") expect(parsed.items).toHaveLength(6);
  });

  it("2. malformed/fabricated IDs are rejected", () => {
    const research = poolContext();
    const raw = JSON.stringify({
      decision: "curate",
      items: Array.from({ length: 6 }, (_, i) => ({
        agendaCandidateId: `fabricated-${i}`,
        researchBriefId: `fabricated-rb-${i}`,
        title: `Fake ${i}`,
        summary: `Fake summary ${i} that looks complete enough.`,
        rationale: ["x"],
      })),
    });
    const parsed = parseManagerAgendaSlateCuration(raw, research, 6);
    expect(parsed.outcome).toBe("invalid");
    if (parsed.outcome === "invalid") {
      expect(parsed.message).toBe("manager_slate_too_small:0");
    }
  });

  it("3. v3 zero-item failure mode (ID-only / empty title) is fixed when IDs resolve", () => {
    const research = poolContext();
    const emptyShapeEcho = JSON.stringify({
      decision: "curate|defer_all",
      items: [
        {
          agendaCandidateId: null,
          researchBriefId: null,
          title: "",
          summary: "",
          rationale: [],
        },
      ],
    });
    const emptyParsed = parseManagerAgendaSlateCuration(emptyShapeEcho, research, 6);
    expect(emptyParsed.outcome).toBe("invalid");
    if (emptyParsed.outcome === "invalid") {
      expect(emptyParsed.message).toBe("manager_slate_too_small:0");
    }

    const idOnly = JSON.stringify({
      decision: "curate",
      items: [1, 2, 3, 4, 5, 6].map((n) => ({
        agendaCandidateId: `ac-item-${n}`,
        researchBriefId: `rb-item-${n}`,
        title: "",
        summary: "",
        rationale: [`id-only ${n}`],
      })),
    });
    const fixed = parseManagerAgendaSlateCuration(idOnly, research, 6);
    expect(fixed.outcome).toBe("curated");
    if (fixed.outcome === "curated") {
      expect(fixed.items).toHaveLength(6);
      expect(fixed.items[0]?.title).toContain("Travel topic");
    }
  });

  it("9. fallback uses outbound-aware pool ranking (not legacy total top-N)", () => {
    const lowTotalHighOutbound = cand({
      agendaCandidateId: "ac-out",
      researchBriefId: "rb-out",
      title: "Vietnam September escapes",
      summary: "Outbound Vietnam autumn ideas",
      destinations: ["vietnam"],
      totalResearchScore: 0.55,
      koreanOutboundRelevanceScore: 0.82,
      evidence: [{ ...officialEvidence, sourceName: "Vietnam Tourism", sourceId: "vn" }],
    });
    const highTotalInbound = cand({
      agendaCandidateId: "ac-in",
      researchBriefId: "rb-in",
      title: "외국인 관광객 AI 추천",
      summary: "방한 외국인 관광 트렌드",
      destinations: [],
      totalResearchScore: 0.8,
      koreanOutboundRelevanceScore: 0.12,
      evidence: [{ ...officialEvidence, sourceName: "Traveltimes", sourceId: "tt" }],
    });
    // Context order is the pre-MM ranked order (outbound first).
    const dests = ["japan", "vietnam", "thailand", "taiwan", "australia", "spain"];
    const research = buildResearchContext({
      agendaCandidates: [lowTotalHighOutbound, highTotalInbound, ...[3, 4, 5, 6, 7].map((n) =>
        cand({
          agendaCandidateId: `ac-fill-${n}`,
          title: `Fill ${n} outbound tips`,
          summary: `Outbound fill candidate ${n}`,
          destinations: [dests[n - 3]!],
          totalResearchScore: 0.5,
          koreanOutboundRelevanceScore: 0.7,
          evidence: [{ ...officialEvidence, sourceName: `Src${n}`, sourceId: `s${n}` }],
        }),
      )],
    });
    const slate = buildDailyAgendaSlate({
      research,
      logicalRunKey: "test:fallback-outbound",
      businessDateKst: "2026-09-05",
      runId: "run-1",
      correlationId: "corr-1",
      targetSize: 6,
    });
    expect(slate.candidates[0]?.agendaCandidateId).toBe("ac-out");
    // High totalResearchScore inbound must not beat lower-total outbound head, and is skipped while alternatives exist.
    expect(slate.candidates.some((c) => c.agendaCandidateId === "ac-in")).toBe(false);
    expect(slate.candidates[0]?.score ?? 0).toBeLessThan(highTotalInbound.totalResearchScore);
  });

  it("10. fallback does not overconcentrate one source when alternatives exist", () => {
    const agendaCandidates = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
      cand({
        agendaCandidateId: `ac-${n}`,
        title: `Topic ${n}`,
        summary: `Outbound summary ${n}`,
        destinations: [`dest-${n}`],
        totalResearchScore: 0.7 - n * 0.01,
        koreanOutboundRelevanceScore: 0.7,
        evidence: [
          {
            ...officialEvidence,
            sourceName: n <= 4 ? "SameSource" : `Alt-${n}`,
            sourceId: n <= 4 ? "same" : `alt-${n}`,
          },
        ],
      }),
    );
    const slate = buildDailyAgendaSlate({
      research: buildResearchContext({ agendaCandidates }),
      logicalRunKey: "test:fallback-diversity",
      businessDateKst: "2026-09-05",
      runId: "run-2",
      correlationId: "corr-2",
      targetSize: 6,
    });
    const sameSourceCount = slate.candidates.filter((c) =>
      c.evidenceSummary.some((e) => e.sourceName === "SameSource"),
    ).length;
    expect(sameSourceCount).toBeLessThanOrEqual(2);
  });
});

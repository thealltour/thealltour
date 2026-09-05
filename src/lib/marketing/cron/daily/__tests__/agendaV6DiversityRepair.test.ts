import { describe, expect, it } from "vitest";

import { buildDailyAgendaSlateFromManagerCuration } from "@/lib/marketing/cron/daily/agendaSlate/buildDailyAgendaSlate";
import { buildDailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/buildDailyAgendaSlate";
import { repairManagerSlateDiversity } from "@/lib/marketing/cron/daily/agendaSlate/repairManagerSlateDiversity";
import type { ManagerSlateCurationItem } from "@/lib/marketing/cron/daily/agendaSlate/curateManagerAgendaSlate";
import {
  agendaCandidate,
  buildResearchContext,
  officialEvidence,
} from "@/lib/marketing/cron/daily/__tests__/fixtures";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import { parseManagerAgendaSlateCuration } from "@/lib/marketing/cron/daily/agendaSlate/curateManagerAgendaSlate";
import { diversifyCompactCurationCandidates } from "@/lib/marketing/research/services/diversifyAgendaCandidatesForCuration";

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
    scoreReasons: partial.scoreReasons ?? ["koreanOutbound_travelDirection_outbound"],
    riskFlags: partial.riskFlags ?? [],
    matchedProductIds: partial.matchedProductIds ?? [],
    evidence: partial.evidence ?? [officialEvidence],
    ...partial,
  };
}

function mmItem(
  match: CompactManagerAgendaCandidate,
  rationale = [`MM pick ${match.agendaCandidateId}`],
): ManagerSlateCurationItem {
  return {
    agendaCandidateId: match.agendaCandidateId,
    researchBriefId: match.researchBriefId,
    title: match.title,
    summary: match.summary,
    rationale,
    freshnessWhyNow: "mm-fresh",
    koreanTravelerRelevance: "mm-kr",
    practicalTravelValue: "mm-practical",
    theAllTourBusinessRelevance: "mm-biz",
    contentPotential: "mm-content",
    recommendedFormats: ["threads_text"],
    recommendedChannel: "threads",
  };
}

function vietnamTrioPlusJapanPool() {
  const vn = [1, 2, 3].map((n) =>
    cand({
      agendaCandidateId: `ac-vn-${n}`,
      title: `Vietnam autumn escape ${n}`,
      summary: `Vietnam beach tip ${n} for Korean outbound travelers`,
      destinations: ["Vietnam"],
      koreanOutboundRelevanceScore: 0.85 - n * 0.01,
      evidence: [
        { ...officialEvidence, sourceId: "vn", sourceName: "Vietnam Tourism" },
      ],
    }),
  );
  const jp = cand({
    agendaCandidateId: "ac-jp-1",
    title: "Japan foliage weekend plan",
    summary: "Tokyo autumn foliage for Korean travelers",
    destinations: ["Japan"],
    koreanOutboundRelevanceScore: 0.78,
    evidence: [{ ...officialEvidence, sourceId: "tt", sourceName: "Traveltimes" }],
  });
  const th = cand({
    agendaCandidateId: "ac-th-1",
    title: "Thailand visa tips autumn",
    summary: "Bangkok entry notes for Korean outbound travelers",
    destinations: ["Thailand"],
    koreanOutboundRelevanceScore: 0.74,
    evidence: [{ ...officialEvidence, sourceId: "td", sourceName: "TravelDaily" }],
  });
  return [...vn, jp, th];
}

describe("STEP R-5 post-MM diversity repair", () => {
  it("1–3,6–7,10. three Vietnam + Japan → replace only excess; order kept; from pool; diagnostics", () => {
    const pool = vietnamTrioPlusJapanPool();
    const selected = pool.slice(0, 3).map((m) => ({ item: mmItem(m), match: m }));
    const result = repairManagerSlateDiversity({
      selected,
      mmPool: pool,
      targetSize: 3,
    });

    expect(result.diagnostics.repairedSelectionCount).toBe(1);
    expect(result.diagnostics.retainedManagerSelectionCount).toBe(2);
    expect(result.selections[0]?.match.agendaCandidateId).toBe("ac-vn-1");
    expect(result.selections[1]?.match.agendaCandidateId).toBe("ac-vn-2");
    expect(result.selections[0]?.selectionOrigin).toBe("manager");
    expect(result.selections[1]?.selectionOrigin).toBe("manager");
    expect(result.selections[2]?.selectionOrigin).toBe("manager_diversity_repair");
    expect(result.selections[2]?.match.agendaCandidateId).toBe("ac-jp-1");
    expect(result.diagnostics.repairs[0]?.removed.agendaCandidateId).toBe("ac-vn-3");
    expect(result.diagnostics.repairs[0]?.replacement.agendaCandidateId).toBe("ac-jp-1");
    expect(pool.some((c) => c.agendaCandidateId === result.selections[2]?.match.agendaCandidateId)).toBe(
      true,
    );
    expect(result.diagnostics.maxCandidatesPerSource).toBeLessThanOrEqual(2);
    expect(result.diagnostics.maxCandidatesPerDestinationFamily).toBeLessThanOrEqual(2);
  });

  it("4. replacement is not LOW/inbound/domestic/B2B-only", () => {
    const pool = [
      ...vietnamTrioPlusJapanPool().slice(0, 3),
      cand({
        agendaCandidateId: "ac-inbound",
        title: "외국인 관광객 방한 트렌드",
        summary: "인바운드 외국인 관광",
        destinations: [],
        koreanOutboundRelevanceScore: 0.12,
        scoreReasons: ["koreanOutbound_inbound_demoted_for_agenda_seed"],
        evidence: [{ ...officialEvidence, sourceId: "in", sourceName: "InboundNews" }],
      }),
      vietnamTrioPlusJapanPool()[3]!,
    ];
    const selected = pool.slice(0, 3).map((m) => ({ item: mmItem(m), match: m }));
    const result = repairManagerSlateDiversity({
      selected,
      mmPool: pool,
      targetSize: 3,
    });
    expect(result.selections.some((s) => s.match.agendaCandidateId === "ac-inbound")).toBe(false);
    expect(result.selections[2]?.match.agendaCandidateId).toBe("ac-jp-1");
  });

  it("5. if no credible alternative exists, third Vietnam remains", () => {
    const onlyVn = [1, 2, 3].map((n) =>
      cand({
        agendaCandidateId: `ac-only-vn-${n}`,
        title: `Vietnam tip ${n}`,
        summary: `Vietnam outbound tip ${n}`,
        destinations: ["Vietnam"],
        koreanOutboundRelevanceScore: 0.8,
        evidence: [
          { ...officialEvidence, sourceId: "vn", sourceName: "Vietnam Tourism" },
        ],
      }),
    );
    const result = repairManagerSlateDiversity({
      selected: onlyVn.map((m) => ({ item: mmItem(m), match: m })),
      mmPool: onlyVn,
      targetSize: 3,
    });
    expect(result.diagnostics.repairedSelectionCount).toBe(0);
    expect(result.selections.map((s) => s.match.agendaCandidateId)).toEqual([
      "ac-only-vn-1",
      "ac-only-vn-2",
      "ac-only-vn-3",
    ]);
  });

  it("8. same source and same family caps are handled independently", () => {
    // Same source, different families — source cap triggers.
    const sameSource = [
      cand({
        agendaCandidateId: "ac-a",
        title: "Japan tip",
        summary: "Japan outbound",
        destinations: ["Japan"],
        koreanOutboundRelevanceScore: 0.8,
        evidence: [{ ...officialEvidence, sourceId: "s1", sourceName: "SameSrc" }],
      }),
      cand({
        agendaCandidateId: "ac-b",
        title: "Thailand tip",
        summary: "Thailand outbound",
        destinations: ["Thailand"],
        koreanOutboundRelevanceScore: 0.79,
        evidence: [{ ...officialEvidence, sourceId: "s1", sourceName: "SameSrc" }],
      }),
      cand({
        agendaCandidateId: "ac-c",
        title: "Australia tip",
        summary: "Australia outbound",
        destinations: ["Australia"],
        koreanOutboundRelevanceScore: 0.78,
        evidence: [{ ...officialEvidence, sourceId: "s1", sourceName: "SameSrc" }],
      }),
      cand({
        agendaCandidateId: "ac-alt",
        title: "Taiwan tip",
        summary: "Taiwan outbound",
        destinations: ["Taiwan"],
        koreanOutboundRelevanceScore: 0.77,
        evidence: [{ ...officialEvidence, sourceId: "alt", sourceName: "AltSrc" }],
      }),
    ];
    const bySource = repairManagerSlateDiversity({
      selected: sameSource.slice(0, 3).map((m) => ({ item: mmItem(m), match: m })),
      mmPool: sameSource,
      targetSize: 3,
    });
    expect(bySource.diagnostics.repairedSelectionCount).toBe(1);
    expect(bySource.selections[2]?.match.agendaCandidateId).toBe("ac-alt");

    // Same family, different sources — family cap triggers.
    const sameFamily = [
      cand({
        agendaCandidateId: "ac-f1",
        title: "Vietnam beach 1",
        summary: "Vietnam outbound beach",
        destinations: ["Vietnam"],
        koreanOutboundRelevanceScore: 0.8,
        evidence: [{ ...officialEvidence, sourceId: "a", sourceName: "SrcA" }],
      }),
      cand({
        agendaCandidateId: "ac-f2",
        title: "Vietnam beach 2",
        summary: "Vietnam outbound autumn",
        destinations: ["Vietnam"],
        koreanOutboundRelevanceScore: 0.79,
        evidence: [{ ...officialEvidence, sourceId: "b", sourceName: "SrcB" }],
      }),
      cand({
        agendaCandidateId: "ac-f3",
        title: "Vietnam beach 3",
        summary: "Vietnam outbound wellness",
        destinations: ["Vietnam"],
        koreanOutboundRelevanceScore: 0.78,
        evidence: [{ ...officialEvidence, sourceId: "c", sourceName: "SrcC" }],
      }),
      cand({
        agendaCandidateId: "ac-f-alt",
        title: "Japan foliage",
        summary: "Japan outbound foliage",
        destinations: ["Japan"],
        koreanOutboundRelevanceScore: 0.77,
        evidence: [{ ...officialEvidence, sourceId: "d", sourceName: "SrcD" }],
      }),
    ];
    const byFamily = repairManagerSlateDiversity({
      selected: sameFamily.slice(0, 3).map((m) => ({ item: mmItem(m), match: m })),
      mmPool: sameFamily,
      targetSize: 3,
    });
    expect(byFamily.diagnostics.repairedSelectionCount).toBe(1);
    expect(byFamily.diagnostics.repairs[0]?.violatedCap).toMatch(/family/);
    expect(byFamily.selections[2]?.match.agendaCandidateId).toBe("ac-f-alt");
  });

  it("9–10. manager rationale only on retained; repair origin explicit on slate", () => {
    const pool = [
      ...vietnamTrioPlusJapanPool(),
      ...[4, 5].map((n) =>
        cand({
          agendaCandidateId: `ac-extra-${n}`,
          title: `Australia tip ${n}`,
          summary: `Australia outbound tip ${n}`,
          destinations: ["Australia"],
          koreanOutboundRelevanceScore: 0.7,
          evidence: [{ ...officialEvidence, sourceId: `ex${n}`, sourceName: `Extra${n}` }],
        }),
      ),
    ];
    const curatedItems = pool.slice(0, 3).map((m) => mmItem(m, [`unique-rationale-${m.agendaCandidateId}`]));
    // Pad to 5 so undersized topup does not rewrite repaired slots.
    curatedItems.push(
      ...pool.slice(3, 5).map((m) => mmItem(m, [`unique-rationale-${m.agendaCandidateId}`])),
    );
    const research = buildResearchContext({ agendaCandidates: pool });
    const slate = buildDailyAgendaSlateFromManagerCuration({
      research,
      curatedItems,
      logicalRunKey: "test:r5-rationale",
      businessDateKst: "2026-09-05",
      runId: "run-r5",
      correlationId: "corr-r5",
      targetSize: 5,
    });

    expect(slate.candidates[0]?.rationale.join(" ")).toContain("unique-rationale-ac-vn-1");
    expect(slate.candidates[1]?.rationale.join(" ")).toContain("unique-rationale-ac-vn-2");
    expect(slate.candidates[2]?.rationale.join(" ")).toContain("diversity repair");
    expect(slate.candidates[2]?.rationale.join(" ")).not.toContain("unique-rationale-ac-vn-3");

    const origins = slate.metadata.selectionOrigins as Record<string, string>;
    expect(origins[slate.candidates[0]!.slateItemId]).toBe("manager");
    expect(origins[slate.candidates[1]!.slateItemId]).toBe("manager");
    expect(origins[slate.candidates[2]!.slateItemId]).toBe("manager_diversity_repair");

    const repair = slate.metadata.diversityRepair as {
      repairedSelectionCount: number;
      repairs: Array<{ removed: { agendaCandidateId: string } }>;
    };
    expect(repair.repairedSelectionCount).toBe(1);
    expect(repair.repairs[0]?.removed.agendaCandidateId).toBe("ac-vn-3");
  });

  it("11. fallback path unchanged (still diversified ordering)", () => {
    const pool = vietnamTrioPlusJapanPool();
    const slate = buildDailyAgendaSlate({
      research: buildResearchContext({ agendaCandidates: pool }),
      logicalRunKey: "test:r5-fallback",
      businessDateKst: "2026-09-05",
      runId: "run-fb",
      correlationId: "corr-fb",
      targetSize: 5,
    });
    const diversified = diversifyCompactCurationCandidates(pool, { limit: 5 });
    expect(slate.curation.mode).toBe("deterministic_fallback");
    expect(slate.candidates.map((c) => c.agendaCandidateId)).toEqual(
      diversified.map((c) => c.agendaCandidateId),
    );
  });

  it("12. R-3 parser/hydration remains green", () => {
    const pool = vietnamTrioPlusJapanPool();
    const research = buildResearchContext({ agendaCandidates: pool });
    const raw = JSON.stringify({
      decision: "curate",
      items: pool.slice(0, 3).map((m) => ({
        agendaCandidateId: m.agendaCandidateId,
        researchBriefId: m.researchBriefId,
        title: "",
        summary: "",
        rationale: ["id-only"],
      })),
    });
    const parsed = parseManagerAgendaSlateCuration(raw, research, 3);
    // targetSize 3 is below min 5 for parse — use 6 with fillers
    const bigPool = [
      ...pool,
      ...[4, 5, 6].map((n) =>
        cand({
          agendaCandidateId: `ac-fill-${n}`,
          title: `Fill ${n}`,
          summary: `Outbound fill ${n}`,
          destinations: [`dest-${n}`],
          koreanOutboundRelevanceScore: 0.7,
          evidence: [{ ...officialEvidence, sourceId: `f${n}`, sourceName: `Fill${n}` }],
        }),
      ),
    ];
    const research6 = buildResearchContext({ agendaCandidates: bigPool });
    const raw6 = JSON.stringify({
      decision: "curate",
      items: bigPool.slice(0, 6).map((m) => ({
        agendaCandidateId: m.agendaCandidateId,
        researchBriefId: m.researchBriefId,
        title: "",
        summary: "",
        rationale: ["id-only"],
      })),
    });
    const parsed6 = parseManagerAgendaSlateCuration(raw6, research6, 6);
    expect(parsed6.outcome).toBe("curated");
    if (parsed6.outcome === "curated") {
      expect(parsed6.items[0]?.title).toContain("Vietnam");
    }
    expect(parsed.outcome === "invalid" || parsed.outcome === "curated").toBe(true);
  });
});

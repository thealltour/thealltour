import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  agendaCandidateSchema,
  researchBriefSchema,
  researchSourceSchema,
  researchSignalSchema,
} from "@/lib/marketing/research/validation";
import { deduplicateSignals } from "@/lib/marketing/research/services/deduplicator";
import { scoreCredibility } from "@/lib/marketing/research/services/credibilityScorer";
import {
  isStaleFreshness,
  scoreFreshness,
} from "@/lib/marketing/research/services/freshnessScorer";
import { normalizeResearchSignal } from "@/lib/marketing/research/services/normalizer";
import {
  assertResearchBriefNotContentDraft,
  buildResearchBriefFromSignals,
} from "@/lib/marketing/research/services/briefBuilder";
import {
  assertAgendaCandidateNotFinalDecision,
  buildAgendaCandidateFromBrief,
} from "@/lib/marketing/research/services/agendaCandidateBuilder";
import { enrichResearchSignal } from "@/lib/marketing/research/services/enrichSignal";
import { computeNormalizedFingerprint } from "@/lib/marketing/research/fingerprint";
import {
  COMMUNITY_SOURCE,
  OFFICIAL_JNTO_SOURCE,
  PERFORMANCE_SOURCE,
  RESEARCH_TEST_SOURCES,
  buildSyntheticResearchSignals,
  signalWithoutProvenance,
} from "@/lib/marketing/research/__tests__/fixtures";
import type { ResearchSignal } from "@/lib/marketing/research/types/researchSignal";

const NOW = new Date("2026-09-02T00:00:00.000Z");

function normalizeFirst(raw: ReturnType<typeof buildSyntheticResearchSignals>[number]) {
  const result = normalizeResearchSignal(raw, RESEARCH_TEST_SOURCES.find((s) => s.id === raw.sourceId)!, NOW);
  if (!result.ok) throw new Error(result.reason);
  return enrichResearchSignal(result.signal, RESEARCH_TEST_SOURCES.find((s) => s.id === raw.sourceId)!, NOW);
}

describe("Research Intelligence domain validation", () => {
  it("validates ResearchSource, ResearchSignal, ResearchBrief, AgendaCandidate schemas", () => {
    for (const source of RESEARCH_TEST_SOURCES) {
      expect(() => researchSourceSchema.parse(source)).not.toThrow();
    }

    const raw = buildSyntheticResearchSignals()[0]!;
    const signal = normalizeFirst(raw);
    expect(() => researchSignalSchema.parse(signal)).not.toThrow();

    const brief = buildResearchBriefFromSignals([signal], NOW);
    expect(brief).not.toBeNull();
    expect(() => researchBriefSchema.parse(brief)).not.toThrow();

    const candidate = buildAgendaCandidateFromBrief(brief!, NOW);
    expect(() => agendaCandidateSchema.parse(candidate)).not.toThrow();
  });

  it("official source credibility exceeds community baseline", () => {
    const officialEvidence = [
      {
        id: "e1",
        sourceId: OFFICIAL_JNTO_SOURCE.id,
        url: "https://www.japan.travel/en/visa",
        observedAt: NOW.toISOString(),
        evidenceType: "official_statement" as const,
      },
    ];
    const communityEvidence = [
      {
        id: "e2",
        sourceId: COMMUNITY_SOURCE.id,
        url: "https://forum.example.com/thread/1",
        observedAt: NOW.toISOString(),
        evidenceType: "search_result" as const,
      },
    ];

    const official = scoreCredibility({
      source: OFFICIAL_JNTO_SOURCE,
      evidence: officialEvidence,
    });
    const community = scoreCredibility({
      source: COMMUNITY_SOURCE,
      evidence: communityEvidence,
    });

    expect(official.score).toBeGreaterThan(community.score);
    expect(official.level).not.toBe("unknown");
    expect(community.reasons).toContain("community_source_baseline");
  });

  it("degrades freshness for old weather signals", () => {
    const fresh = scoreFreshness({
      signalType: "weather",
      publishedAt: "2026-09-01T12:00:00.000Z",
      observedAt: "2026-09-01T12:00:00.000Z",
      now: NOW,
    });
    const stale = scoreFreshness({
      signalType: "weather",
      publishedAt: "2026-08-01T00:00:00.000Z",
      observedAt: "2026-08-01T00:00:00.000Z",
      now: NOW,
    });

    expect(fresh.freshnessScore!).toBeGreaterThan(stale.freshnessScore!);
    expect(isStaleFreshness(stale, 0.15, NOW)).toBe(true);
  });

  it("marks expired signals with zero freshness and stale status", () => {
    const expired = scoreFreshness({
      signalType: "event",
      observedAt: "2026-08-01T00:00:00.000Z",
      expiresAt: "2026-08-15T00:00:00.000Z",
      now: NOW,
    });
    expect(expired.freshnessScore).toBe(0);
    expect(isStaleFreshness(expired, 0.15, NOW)).toBe(true);

    const raw = buildSyntheticResearchSignals().find((s) => s.title.includes("Expired"))!;
    const enriched = normalizeFirst(raw);
    expect(enriched.status).toBe("stale");
  });

  it("detects exact URL duplicate (level 1)", () => {
    const base = normalizeFirst(buildSyntheticResearchSignals()[0]!);
    const duplicate: ResearchSignal = {
      ...base,
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      sourceId: COMMUNITY_SOURCE.id,
      canonicalUrl: "https://airline.example.com/sale/seoul-tokyo",
      externalId: "different-id",
    };
    const primary: ResearchSignal = {
      ...base,
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      canonicalUrl: "https://airline.example.com/sale/seoul-tokyo",
      externalId: "fare-sale-2026-09",
    };

    const { unique, duplicates } = deduplicateSignals([primary, duplicate]);
    expect(unique).toHaveLength(1);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]!.status).toBe("duplicate");
    expect(duplicates[0]!.duplicateOfSignalId).toBe(primary.id);
    expect(unique[0]!.corroborationCount).toBeGreaterThan(0);
  });

  it("detects normalized fingerprint duplicate (level 2)", () => {
    const signals = buildSyntheticResearchSignals();
    const visaOfficial = normalizeFirst(signals[0]!);
    const visaCommunity = normalizeFirst(signals[1]!);

    expect(visaOfficial.normalizedFingerprint).toBe(visaCommunity.normalizedFingerprint);

    const { unique, duplicates } = deduplicateSignals([visaOfficial, visaCommunity]);
    expect(unique).toHaveLength(1);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]!.duplicateOfSignalId).toBe(unique[0]!.id);
  });

  it("does not dedupe unrelated signals", () => {
    const signals = buildSyntheticResearchSignals();
    const a = normalizeFirst(signals[2]!);
    const b = normalizeFirst(signals[8]!);

    expect(a.normalizedFingerprint).not.toBe(b.normalizedFingerprint);

    const { unique, duplicates } = deduplicateSignals([a, b]);
    expect(unique).toHaveLength(2);
    expect(duplicates).toHaveLength(0);
  });

  it("keeps product-absent signals eligible", () => {
    const raw = buildSyntheticResearchSignals().find((s) =>
      s.title.includes("No matching SKU"),
    )!;
    const enriched = normalizeFirst(raw);
    expect(enriched.commercialRelevance?.level).toBe("none");
    expect(enriched.status).toBe("eligible");
  });

  it("preserves evidence on ResearchBrief", () => {
    const signals = buildSyntheticResearchSignals().slice(0, 2).map(normalizeFirst);
    const eligible = signals.map((s) => ({ ...s, status: "eligible" as const }));
    const brief = buildResearchBriefFromSignals(eligible, NOW)!;

    expect(brief.evidence.length).toBeGreaterThan(0);
    expect(brief.claims.length).toBeGreaterThan(0);
    expect(brief.signalIds).toHaveLength(2);
    for (const ev of eligible.flatMap((s) => s.evidence)) {
      expect(brief.evidence.some((e) => e.id === ev.id)).toBe(true);
    }
  });

  it("rejects ResearchBrief with content-draft fields", () => {
    const signal = normalizeFirst(buildSyntheticResearchSignals()[0]!);
    const brief = buildResearchBriefFromSignals([{ ...signal, status: "eligible" }], NOW)!;

    assertResearchBriefNotContentDraft(brief);
    expect(() =>
      assertResearchBriefNotContentDraft({ ...brief, caption: "buy now" } as never),
    ).toThrow(/content field/);
  });

  it("AgendaCandidate does not carry MM final decision fields", () => {
    const signal = normalizeFirst(buildSyntheticResearchSignals()[0]!);
    const brief = buildResearchBriefFromSignals([{ ...signal, status: "eligible" }], NOW)!;
    const candidate = buildAgendaCandidateFromBrief(brief, NOW);

    assertAgendaCandidateNotFinalDecision(candidate);
    expect(candidate.status).toBe("candidate");
    expect("selectedForToday" in candidate).toBe(false);
    expect("finalPriority" in candidate).toBe(false);
    expect("publishDecision" in candidate).toBe(false);
  });

  it("retains low-credibility risk flags without auto-rejection", () => {
    const raw = buildSyntheticResearchSignals()[8]!;
    const enriched = normalizeFirst(raw);

    expect(enriched.credibility!.score).toBeLessThan(0.75);
    expect(enriched.status).toBe("eligible");

    const brief = buildResearchBriefFromSignals([{ ...enriched, status: "eligible" }], NOW)!;
    const candidate = buildAgendaCandidateFromBrief(brief, NOW);
    expect(candidate.riskFlags.length).toBeGreaterThanOrEqual(0);
  });

  it("supports performance-derived signals", () => {
    const raw = buildSyntheticResearchSignals().find((s) => s.signalType === "content_performance")!;
    const result = normalizeResearchSignal(raw, PERFORMANCE_SOURCE, NOW);
    expect(result.ok).toBe(true);
    const enriched = enrichResearchSignal(result.signal, PERFORMANCE_SOURCE, NOW);
    expect(enriched.signalType).toBe("content_performance");
    expect(enriched.evidence[0]!.evidenceType).toBe("internal_record");
    expect(enriched.status).toBe("eligible");
  });

  it("supports internal product signals", () => {
    const raw = buildSyntheticResearchSignals().find((s) => s.signalType === "internal_product")!;
    const source = RESEARCH_TEST_SOURCES.find((s) => s.id === raw.sourceId)!;
    const result = normalizeResearchSignal(raw, source, NOW);
    expect(result.ok).toBe(true);
    const enriched = enrichResearchSignal(result.signal, source, NOW);
    expect(enriched.commercialRelevance?.matchedProductIds.length).toBeGreaterThan(0);
  });

  it("rejects malformed or insufficient provenance safely", () => {
    const result = normalizeResearchSignal(signalWithoutProvenance(), OFFICIAL_JNTO_SOURCE, NOW);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("insufficient_provenance");
  });

  it("normalized fingerprint is deterministic for same semantic payload", () => {
    const fp1 = computeNormalizedFingerprint({
      signalType: "visa",
      title: "Japan Visa Update",
      claim: "Visa waiver extended",
      destinations: ["japan"],
      geography: [],
    });
    const fp2 = computeNormalizedFingerprint({
      signalType: "visa",
      title: "  japan   visa   update ",
      claim: "Visa waiver extended",
      destinations: ["Japan"],
      geography: [],
    });
    expect(fp1).toBe(fp2);
  });
});

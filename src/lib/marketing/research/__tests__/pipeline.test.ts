import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { runResearchPipeline } from "@/lib/marketing/research/services/pipeline";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import {
  RESEARCH_TEST_SOURCES,
  buildSyntheticResearchSignals,
  signalWithoutProvenance,
} from "@/lib/marketing/research/__tests__/fixtures";

const NOW = new Date("2026-09-02T00:00:00.000Z");

describe("Research Intelligence pipeline", () => {
  it("runs normalize → enrich → dedup → brief → agenda candidate on synthetic data", async () => {
    const repo = createInMemoryResearchRepository(RESEARCH_TEST_SOURCES);
    const rawSignals = buildSyntheticResearchSignals();

    const result = await runResearchPipeline({
      repo,
      rawSignals,
      now: NOW,
    });

    expect(result.normalized.length).toBeGreaterThanOrEqual(9);
    expect(result.rejected).toHaveLength(0);
    expect(result.duplicates.length).toBeGreaterThanOrEqual(1);
    expect(result.briefs.length).toBeGreaterThan(0);
    expect(result.agendaCandidates.length).toBe(result.briefs.length);

    for (const brief of result.briefs) {
      expect(brief.evidence.length).toBeGreaterThan(0);
      expect(brief.status).toBe("active");
      expect("caption" in brief).toBe(false);
    }

    for (const candidate of result.agendaCandidates) {
      expect(candidate.status).toBe("candidate");
      expect(candidate.compositeResearchScore).toBeGreaterThan(0);
      expect("selectedForToday" in candidate).toBe(false);
    }

    const eligible = await repo.findEligibleSignals();
    expect(eligible.length).toBeGreaterThan(0);

    const japanSignals = await repo.findSignalsByDestination("japan");
    expect(japanSignals.length).toBeGreaterThan(0);

    const performanceSignals = await repo.findSignalsByTopic("performance");
    expect(performanceSignals.length).toBeGreaterThan(0);

    const activeBriefs = await repo.findActiveBriefs();
    expect(activeBriefs.length).toBe(result.briefs.length);

    const candidates = await repo.findRecentAgendaCandidates({
      since: "2026-09-01T00:00:00.000Z",
    });
    expect(candidates.length).toBe(result.agendaCandidates.length);
  });

  it("rejects signals with insufficient provenance in pipeline", async () => {
    const repo = createInMemoryResearchRepository(RESEARCH_TEST_SOURCES);
    const result = await runResearchPipeline({
      repo,
      rawSignals: [...buildSyntheticResearchSignals(), signalWithoutProvenance()],
      now: NOW,
    });

    expect(result.rejected.some((r) => r.reason === "insufficient_provenance")).toBe(true);
  });

  it("stores duplicate signals separately from eligible unique signals", async () => {
    const repo = createInMemoryResearchRepository(RESEARCH_TEST_SOURCES);
    const result = await runResearchPipeline({
      repo,
      rawSignals: buildSyntheticResearchSignals(),
      now: NOW,
    });

    const allStored = [...result.enriched, ...result.duplicates];
    const duplicateRows = allStored.filter((s) => s.status === "duplicate");
    const eligibleRows = result.enriched.filter((s) => s.status === "eligible");

    expect(duplicateRows.length).toBeGreaterThan(0);
    expect(eligibleRows.length).toBeGreaterThan(0);
    for (const dup of duplicateRows) {
      expect(dup.duplicateOfSignalId).toBeTruthy();
    }
  });

  it("findByFingerprint resolves stored signals", async () => {
    const repo = createInMemoryResearchRepository(RESEARCH_TEST_SOURCES);
    const result = await runResearchPipeline({
      repo,
      rawSignals: buildSyntheticResearchSignals(),
      now: NOW,
    });

    const signal = result.enriched[0]!;
    const byRaw = await repo.findByFingerprint(signal.rawFingerprint);
    expect(byRaw?.id).toBe(signal.id);

    if (signal.normalizedFingerprint) {
      const byNorm = await repo.findByFingerprint(signal.normalizedFingerprint);
      expect(byNorm?.id).toBe(signal.id);
    }
  });
});

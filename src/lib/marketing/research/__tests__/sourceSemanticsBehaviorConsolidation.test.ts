import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PARITY_FIXTURE_BY_FEED, mockFeedFetch } from "@/lib/marketing/research/__tests__/sourceRegistryParityFixtures";
import { buildSyntheticResearchSignals } from "@/lib/marketing/research/__tests__/fixtures";
import { createResearchCollectorForSource, mapRawResearchItemToSignalInput } from "@/lib/marketing/research/collectors";
import { createConfiguredRssCollector } from "@/lib/marketing/research/collectors/configuredRssCollector";
import { normalizeResearchSignal } from "@/lib/marketing/research/services/normalizer";
import { scoreCredibility } from "@/lib/marketing/research/services/credibilityScorer";
import { scoreCorroboration } from "@/lib/marketing/research/services/corroborationScorer";
import { selectPrimarySignal } from "@/lib/marketing/research/services/primarySignalSelector";
import { signalFixture } from "@/lib/marketing/research/__tests__/semanticCalibrationFixtures";
import { isOfficialResearchSource } from "@/lib/marketing/research/sourceAuthority";
import { adjustAgendaSeedForCommercialBias, resolveCommercialBias } from "@/lib/marketing/research/sourceCommercialBias";
import { canCollectResearchSource, canSourceParticipateInCandidates, canSourceParticipateInMm, SOURCE_SEMANTICS_UNRESOLVED } from "@/lib/marketing/research/sourceLifecycle";
import { EXTERNAL_RESEARCH_SOURCE_REGISTRY, RESEARCH_SOURCE_REGISTRY, NYT_TRAVEL_SOURCE, UK_GOV_TRAVEL_SOURCE, projectResearchSource, toConfiguredRssCollectorConfig } from "@/lib/marketing/research/sources/sourceRegistry";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

const NOW = new Date("2026-10-01T09:00:00.000Z");
const row = (): ResearchSource => ({ ...projectResearchSource(NYT_TRAVEL_SOURCE), createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() });

describe("6B-2 behavior consolidation", () => {
  it("official runtime consumers use one explicit predicate and never infer from source type or authority tier", () => {
    const files = [
      "services/credibilityScorer.ts", "services/primarySignalSelector.ts", "services/corroborationScorer.ts",
      "manager/getMarketingManagerResearchContext.ts", "collectors/configuredRssCollector.ts",
      "../cron/daily/agendaSlate/hydrateProductionResearchContext.ts",
    ];
    for (const file of files) {
      const code = readFileSync(path.resolve(__dirname, "..", file), "utf8");
      expect(code).toContain("isOfficialResearchSource");
      expect(code).not.toMatch(/OFFICIAL_(?:SOURCE_)?TYPES|authorityLevel\s*===\s*["']official|sourceType\s*===\s*["']official_government/);
    }
  });

  it("derives enabled from lifecycle for feed/internal/push sources; only active and shadow collect", () => {
    for (const status of ["active", "shadow", "paused", "retired"] as const) {
      for (const definition of RESEARCH_SOURCE_REGISTRY) {
        const def = structuredClone(definition);
        def.semantics.lifecycle.status = status;
        expect(projectResearchSource(def).isEnabled).toBe(status === "active" || status === "shadow");
      }
    }
  });

  it("missing and malformed lifecycle block every participation gate and direct normalization", () => {
    for (const metadata of [null, {}, { semantics: {} }, { semantics: "active" }, { semantics: { lifecycle: { status: "ACTIVE" } } }]) {
      const source = { ...row(), metadata };
      expect([canCollectResearchSource(source), canSourceParticipateInCandidates(source), canSourceParticipateInMm(source)]).toEqual([false, false, false]);
      expect(normalizeResearchSignal(buildSyntheticResearchSignals()[0]!, source, NOW)).toEqual({ ok: false, reason: SOURCE_SEMANTICS_UNRESOLVED });
    }
    expect([canCollectResearchSource(null), canSourceParticipateInCandidates(undefined), canSourceParticipateInMm(null)]).toEqual([false, false, false]);
  });

  it("stale isEnabled values cannot override lifecycle in either direction", () => {
    const active = { ...row(), isEnabled: false };
    expect(normalizeResearchSignal(buildSyntheticResearchSignals()[0]!, active, NOW).ok).toBe(true);
    const paused = structuredClone(row());
    paused.isEnabled = true;
    paused.metadata = { ...paused.metadata, semantics: { ...NYT_TRAVEL_SOURCE.semantics, lifecycle: { status: "paused" } } };
    expect(normalizeResearchSignal(buildSyntheticResearchSignals()[0]!, paused, NOW)).toEqual({ ok: false, reason: "source_lifecycle_inactive" });
  });

  it("all six collectors leave language unresolved; primary fills it with explicit provenance", async () => {
    for (const def of EXTERNAL_RESEARCH_SOURCE_REGISTRY) {
      const collector = createResearchCollectorForSource(def, { fetchImpl: mockFeedFetch(PARITY_FIXTURE_BY_FEED) });
      const items = await collector.collect({ sourceId: def.id, sourceType: def.sourceType, now: NOW });
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.language).toBeNull();
        const raw = mapRawResearchItemToSignalInput(item, { sourceId: def.id, sourceType: def.sourceType })!;
        const result = normalizeResearchSignal(raw, { ...projectResearchSource(def), createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() }, NOW);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.signal.language).toBe(def.semantics.languages.primary);
          expect(result.signal.metadata).toMatchObject({ languageFallbackApplied: true });
        }
      }
    }
  });

  it("a real supplied item language still wins and compatibility config language cannot stamp a default", async () => {
    const config = { ...toConfiguredRssCollectorConfig(NYT_TRAVEL_SOURCE), language: "ja" };
    const collector = createConfiguredRssCollector(config, { fetchImpl: mockFeedFetch(PARITY_FIXTURE_BY_FEED) });
    const [item] = await collector.collect({ sourceId: config.sourceId, sourceType: config.sourceType, now: NOW });
    expect(item?.language).toBeNull();
    const raw = mapRawResearchItemToSignalInput({ ...item!, language: "fr" }, { sourceId: config.sourceId, sourceType: config.sourceType })!;
    const result = normalizeResearchSignal(raw, row(), NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.signal.language).toBe("fr");
      expect(result.signal.metadata ?? {}).not.toHaveProperty("languageFallbackApplied");
    }
  });

  it("unknown commercial bias stays unknown and grants no above-neutral boost", () => {
    expect(resolveCommercialBias({ metadata: null })).toBeNull();
    expect(adjustAgendaSeedForCommercialBias(0.9, null)).toBe(0.5);
    expect(adjustAgendaSeedForCommercialBias(0.2, null)).toBe(0.2);
    expect(adjustAgendaSeedForCommercialBias(0.9, "none")).toBe(0.9);
  });

  it.each(["official_government", "tourism_board", "airline", "airport"] as const)("%s does not imply official; conflicting authority tiers do not override the flag", (sourceType) => {
    const unflagged = { ...row(), sourceType, isOfficial: false, authorityLevel: "official" as const, defaultCredibility: 0.4 };
    const plain = { ...unflagged, authorityLevel: "secondary" as const };
    expect(isOfficialResearchSource(unflagged)).toBe(false);
    expect(scoreCredibility({ source: unflagged, evidence: [] })).toEqual(scoreCredibility({ source: plain, evidence: [] }));
    const flagged = { ...unflagged, isOfficial: true, sourceType: "news" as const };
    expect(isOfficialResearchSource(flagged)).toBe(true);
    expect(scoreCredibility({ source: flagged, evidence: [] }).score).toBeGreaterThan(scoreCredibility({ source: plain, evidence: [] }).score);

    const a = { ...signalFixture({ id: "authority-fixture", title: "Authority fixture", summary: "One claim under conflicting source metadata", signalType: "general_travel_news" }), id: "official-signal", sourceId: unflagged.id, credibility: { score: 0.8, level: "high" as const, reasons: [] } };
    const b = { ...a, id: "news-signal", sourceId: UK_GOV_TRAVEL_SOURCE.id, credibility: { score: 0.2, level: "low" as const, reasons: [] } };
    const news = { ...row(), id: b.sourceId, sourceType: "news" as const, isOfficial: false };
    const sources = new Map<string, ResearchSource>([[unflagged.id, unflagged], [news.id, news]]);
    expect(scoreCorroboration({ clusterSignals: [a, b], sources }).reasons).not.toContain("official_plus_news_corroboration");
    expect(selectPrimarySignal([a, b], sources).id).toBe(a.id);
    sources.set(news.id, { ...news, isOfficial: true });
    expect(selectPrimarySignal([a, b], sources).id).toBe(b.id);
    expect(scoreCorroboration({ clusterSignals: [a, b], sources }).reasons).toContain("official_plus_news_corroboration");
  });
});

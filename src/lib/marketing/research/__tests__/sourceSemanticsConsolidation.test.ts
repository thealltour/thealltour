import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import * as performanceConstants from "@/lib/marketing/performance/constants";
import * as researchBarrel from "@/lib/marketing/research";
import { researchSourceSemanticsSchema } from "@/lib/marketing/research";
import { bootstrapResearchSources } from "@/lib/marketing/research/collection/bootstrapSources";
import * as collectorsBarrel from "@/lib/marketing/research/collectors";
import * as collectorsConfig from "@/lib/marketing/research/collectors/config";
import { createResearchCollectorForSource } from "@/lib/marketing/research/collectors";
import * as registryShim from "@/lib/marketing/research/collectors/sourceRegistry";
import { resolveSourceRoleWeights } from "@/lib/marketing/research/portfolio/sourcePortfolioRoles";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import * as registry from "@/lib/marketing/research/sources/sourceRegistry";
import {
  EXTERNAL_RESEARCH_SOURCE_REGISTRY,
  META_AI_TREND_SOURCE_DEFINITION,
  PERFORMANCE_MEMORY_SOURCE_DEFINITION,
  RESEARCH_SOURCE_REGISTRY,
  projectResearchSource,
  toConfiguredRssCollectorConfig,
  type ResearchSourceDefinition,
} from "@/lib/marketing/research/sources/sourceRegistry";
import * as trendSourceAdapter from "@/lib/marketing/trends/adapter/trendSourceAdapter";
import { adaptTrendSignalToResearch, persistAdaptedTrend } from "@/lib/marketing/trends/adapter/trendSourceAdapter";
import { FIXTURE_BUSAN_FAMILY_CRUISE } from "@/lib/marketing/trends/fixtures/positiveFixtures";
import { PARITY_FIXTURE_BY_FEED, mockFeedFetch } from "@/lib/marketing/research/__tests__/sourceRegistryParityFixtures";

const NOW = new Date("2026-10-01T09:00:00.000Z");

const SRC_ROOT = path.resolve(__dirname, "../../../..");
const CANONICAL_REGISTRY = "lib/marketing/research/sources/sourceRegistry.ts";
const REGISTRY_SHIM = "lib/marketing/research/collectors/sourceRegistry.ts";
const SEMANTICS_HELPERS = [
  "lib/marketing/research/sourceCommercialBias.ts",
  "lib/marketing/research/sourceCoverage.ts",
  "lib/marketing/research/sourceLanguage.ts",
  "lib/marketing/research/sourceLifecycle.ts",
];
/** Files that declare semantics values or their schema rather than read them. */
const DECLARATION_FILES = new Set([
  CANONICAL_REGISTRY,
  "lib/marketing/research/types/sourceSemantics.ts",
  "lib/marketing/research/validation.ts",
]);
const DEPRECATED_FEED_ID_EXPORTS = [
  "UK_GOV_TRAVEL_SOURCE_ID",
  "NYT_TRAVEL_SOURCE_ID",
  "TRAVELTIMES_SOURCE_ID",
  "TRAVIE_SOURCE_ID",
  "TRAVELDAILY_SOURCE_ID",
  "VIETNAM_TRAVEL_SOURCE_ID",
];

/** Comments may name a field without reading it. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const runtimeFiles = (readdirSync(SRC_ROOT, { recursive: true }) as string[])
  .filter((file) => /\.(ts|tsx)$/.test(file) && !/__tests__|\.test\.|\.spec\./.test(file))
  .map((file) => file.split(path.sep).join("/"))
  .map((file) => {
    const text = readFileSync(path.join(SRC_ROOT, file), "utf8");
    return { file, text, code: stripComments(text) };
  });

/** Dead-field checks pass `{ text: true }` so a mention in a comment also fails. */
function filesMatching(pattern: RegExp, { includeDeclarations = false, text = false } = {}): string[] {
  return runtimeFiles
    .filter(({ file }) => includeDeclarations || !DECLARATION_FILES.has(file))
    .filter((entry) => pattern.test(text ? entry.text : entry.code))
    .map(({ file }) => file)
    .sort();
}

function sourceText(file: string): string {
  return readFileSync(path.join(SRC_ROOT, file), "utf8");
}

function sourceCode(file: string): string {
  return stripComments(sourceText(file));
}

function withPrimary<T extends ResearchSourceDefinition>(source: T, primary: string): T {
  const clone = structuredClone(source);
  clone.semantics.languages = { primary };
  return clone;
}

describe("source semantics consolidation — legacy language derives from languages.primary", () => {
  it("projected language equals languages.primary for all eight sources", () => {
    expect(RESEARCH_SOURCE_REGISTRY).toHaveLength(8);
    for (const source of RESEARCH_SOURCE_REGISTRY) {
      expect(projectResearchSource(source).language).toBe(source.semantics.languages.primary);
    }
    for (const source of EXTERNAL_RESEARCH_SOURCE_REGISTRY) {
      expect(toConfiguredRssCollectorConfig(source).language).toBe(source.semantics.languages.primary);
    }
  });

  it("no registry definition declares a separate language", () => {
    for (const source of RESEARCH_SOURCE_REGISTRY) {
      expect(Object.hasOwn(source, "language")).toBe(false);
    }
    expect(sourceCode(CANONICAL_REGISTRY)).not.toMatch(/^\s*language\s*:\s*["'`]/m);
    expect(sourceCode(CANONICAL_REGISTRY)).not.toMatch(/languages\??\.primary/);
  });

  it("mutating primary moves the projected row language and the collector config language; locale never follows", () => {
    for (const source of RESEARCH_SOURCE_REGISTRY) {
      const row = projectResearchSource(withPrimary(source, "ja"));
      expect(row.language).toBe("ja");
      expect(row.locale).toBe(projectResearchSource(source).locale);
    }
    for (const source of EXTERNAL_RESEARCH_SOURCE_REGISTRY) {
      const config = toConfiguredRssCollectorConfig(withPrimary(source, "ja"));
      expect([config.language, config.locale]).toEqual(["ja", source.locale]);
    }
  });

  it("every collector profile leaves item language unresolved, even after a primary mutation", async () => {
    for (const source of EXTERNAL_RESEARCH_SOURCE_REGISTRY) {
      const relabeled = withPrimary(source, "ja");
      const collector = createResearchCollectorForSource(relabeled, { fetchImpl: mockFeedFetch(PARITY_FIXTURE_BY_FEED) });
      const items = await collector.collect({ sourceId: source.id, sourceType: source.sourceType, now: NOW });
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect([item.language, item.locale]).toEqual([null, source.locale]);
        expect(item.metadata ?? {}).not.toHaveProperty("languageFallbackApplied");
      }
    }
  });
});

describe("source semantics consolidation — dead fields stay removed", () => {
  it("destinationFocus, evidenceAuthorityWeight and languages.content have no runtime reader or writer", () => {
    const all = { includeDeclarations: true, text: true };
    expect(filesMatching(/\bdestinationFocus\b/, all)).toEqual([]);
    expect(filesMatching(/\bevidenceAuthorityWeight\b/, all)).toEqual([]);
    expect(filesMatching(/\blanguages\??\.content\b|\blanguages\b[^;]*\[\s*["']content["']\s*\]/, all)).toEqual([]);
    expect(sourceText("lib/marketing/research/types/sourceSemantics.ts")).not.toMatch(/\bcontent\??\s*:/);
  });

  it("the semantics schema rejects languages.content", () => {
    const semantics = structuredClone(RESEARCH_SOURCE_REGISTRY[0]!.semantics);
    expect(researchSourceSemanticsSchema.safeParse(semantics).success).toBe(true);
    expect(
      researchSourceSemanticsSchema.safeParse({ ...semantics, languages: { primary: "en", content: ["en"] } }).success,
    ).toBe(false);
  });

  it("role weights carry only portfolioRole, agendaSeedWeight and koreanMarketWeight", () => {
    const officialUnknown = { sourceType: "other", metadata: null, isOfficial: true, authorityLevel: "official" } as const;
    for (const source of [...RESEARCH_SOURCE_REGISTRY.map(projectResearchSource), officialUnknown]) {
      expect(Object.keys(resolveSourceRoleWeights(source))).toEqual(["portfolioRole", "agendaSeedWeight", "koreanMarketWeight"]);
    }
  });

  it("stored source rows drop destinationFocus and portfolio.evidenceAuthorityWeight and keep semantics, seed, market and role", async () => {
    const repo = createInMemoryResearchRepository();
    // Exercise replacement of already persisted metadata, not only insertion of fresh rows.
    const historical = JSON.parse(readFileSync(path.join(__dirname, "fixtures/phase6b1Before.json"), "utf8")) as {
      sources: Array<{ stored: Parameters<typeof repo.upsertSource>[0] }>;
    };
    expect(historical.sources.some(({ stored }) => Object.hasOwn(stored.metadata ?? {}, "destinationFocus"))).toBe(true);
    for (const { stored } of historical.sources) {
      await repo.upsertSource({ ...stored, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() });
    }
    await bootstrapResearchSources(repo, NOW);
    await persistAdaptedTrend(adaptTrendSignalToResearch(FIXTURE_BUSAN_FAMILY_CRUISE, NOW), repo);
    for (const definition of RESEARCH_SOURCE_REGISTRY) {
      const metadata = (await repo.getSourceById(definition.id))?.metadata as Record<string, unknown>;
      expect(metadata).not.toHaveProperty("destinationFocus");
      expect(metadata.semantics).toEqual(definition.semantics);
      expect(Object.keys(metadata).at(-1)).toBe("semantics");
      if (definition.kind === "push") {
        expect(metadata).not.toHaveProperty("portfolio");
        continue;
      }
      expect(metadata.portfolio).toEqual({
        role: definition.portfolio.portfolioRole,
        agendaSeedWeight: definition.portfolio.agendaSeedWeight,
        koreanMarketWeight: definition.portfolio.koreanMarketWeight,
      });
    }
  });
});

describe("source semantics consolidation — authority locations", () => {
  it("lifecycle is read only by the lifecycle helpers", () => {
    expect(
      filesMatching(/semantics\??\.lifecycle\b|\blifecycle\??\.status\b|\bResearchSourceLifecycle\w*\b|\bRESEARCH_SOURCE_LIFECYCLE_STATUSES\b/),
    ).toEqual(["lib/marketing/research/sourceLifecycle.ts"]);
  });

  it("defaultSignalType is handed only to the classifier terminal fallback of each mapper profile", () => {
    expect(filesMatching(/classification\??\.defaultSignalType/)).toEqual([
      "lib/marketing/research/collectors/nytTravelRssCollector.ts",
      "lib/marketing/research/collectors/ukGovTravelAdviceCollector.ts",
      "lib/marketing/trends/adapter/trendSourceAdapter.ts",
    ]);
    for (const file of ["lib/marketing/research/collectors/nytTravelRssCollector.ts", "lib/marketing/research/collectors/ukGovTravelAdviceCollector.ts"]) {
      const context = sourceCode(file);
      const reads = context.match(/[^\n]*classification\??\.defaultSignalType[^\n]*/g) ?? [];
      expect(reads.length).toBeGreaterThan(0);
      for (const read of reads) {
        const at = context.indexOf(read);
        expect(context.slice(Math.max(0, at - 200), at + read.length)).toMatch(/infer(Official|News)SignalType(Detailed)?\(/);
      }
    }
  });

  it("coverage, languages.primary and commercialBias each have exactly one reader", () => {
    expect(
      filesMatching(/semantics\??\.coverage\b|\{\s*coverage\?:|\bResearchSourceCoverage\w*\b|\bRESEARCH_SOURCE_COVERAGE_SCOPES\b/),
    ).toEqual(["lib/marketing/research/sourceCoverage.ts"]);
    expect(
      filesMatching(/semantics\??\.languages\b|\{\s*languages\?:\s*unknown|\bResearchSourceLanguages\w*\b|\blanguages\??\.primary\b/),
    ).toEqual(["lib/marketing/research/sourceLanguage.ts"]);
    expect(filesMatching(/semantics\??\.commercialBias\b|\bresolveCommercialBias\b|\bCOMMERCIAL_BIAS_AGENDA_SEED_RETENTION\b/)).toEqual([
      "lib/marketing/research/sourceCommercialBias.ts",
    ]);
  });

  it("the derived legacy language is used only by the registry compatibility projection", () => {
    expect(filesMatching(/export function deriveLegacySourceLanguage\b/, { includeDeclarations: true })).toEqual([
      "lib/marketing/research/sourceLanguage.ts",
    ]);
    expect(filesMatching(/\bderiveLegacySourceLanguage\(/, { includeDeclarations: true })).toEqual([
      "lib/marketing/research/sourceLanguage.ts",
      CANONICAL_REGISTRY,
    ]);
  });

  it("source ids and collector keys are literal only in the registry: no switch or duplicate map elsewhere", () => {
    for (const source of RESEARCH_SOURCE_REGISTRY) {
      expect(filesMatching(new RegExp(source.id), { includeDeclarations: true })).toEqual([CANONICAL_REGISTRY]);
    }
    for (const source of [...EXTERNAL_RESEARCH_SOURCE_REGISTRY, PERFORMANCE_MEMORY_SOURCE_DEFINITION]) {
      expect(filesMatching(new RegExp(`["'\`]${source.key}["'\`]`), { includeDeclarations: true })).toEqual([CANONICAL_REGISTRY]);
    }
  });
});

describe("source semantics consolidation — public id surface", () => {
  it("the six deprecated feed *_SOURCE_ID exports are gone from config, collectors and research", () => {
    for (const surface of [collectorsConfig, collectorsBarrel, researchBarrel, registry]) {
      expect(Object.keys(surface).filter((name) => DEPRECATED_FEED_ID_EXPORTS.includes(name))).toEqual([]);
    }
    expect(
      filesMatching(new RegExp(`\\b(${DEPRECATED_FEED_ID_EXPORTS.join("|")})\\b`), { includeDeclarations: true, text: true }),
    ).toEqual([]);
  });

  it("Performance and Meta keep their source id exports", () => {
    expect(performanceConstants.PERFORMANCE_MEMORY_SOURCE_ID).toBe(PERFORMANCE_MEMORY_SOURCE_DEFINITION.id);
    expect(trendSourceAdapter.META_AI_TREND_SOURCE_ID).toBe(META_AI_TREND_SOURCE_DEFINITION.id);
  });
});

describe("source semantics consolidation — registry location", () => {
  it("the collectors/sourceRegistry shim re-exports exactly the canonical module", () => {
    expect(Object.keys(registryShim).sort()).toEqual(Object.keys(registry).sort());
    for (const name of Object.keys(registry)) {
      expect((registryShim as Record<string, unknown>)[name]).toBe((registry as Record<string, unknown>)[name]);
    }
    const statements = sourceText(REGISTRY_SHIM)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    expect(statements).toEqual(['export * from "@/lib/marketing/research/sources/sourceRegistry";']);
  });

  it("runtime code imports the canonical path, never the shim", () => {
    expect(
      runtimeFiles
        .filter(({ file, code }) => file !== REGISTRY_SHIM && /research\/collectors\/sourceRegistry["']/.test(code))
        .map(({ file }) => file),
    ).toEqual([]);
  });

  it("the registry has no runtime dependency on collectors, and semantics helpers never import the registry", () => {
    const imports = sourceCode(CANONICAL_REGISTRY).match(/^import[\s\S]*?from\s+["'][^"']+["'];/gm) ?? [];
    for (const statement of imports.filter((s) => /research\/collectors\//.test(s))) {
      expect(statement).toMatch(/^import type\b/);
    }
    for (const helper of SEMANTICS_HELPERS) {
      expect(sourceCode(helper)).not.toMatch(/sourceRegistry["']/);
    }
  });
});

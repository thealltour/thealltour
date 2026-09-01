#!/usr/bin/env npx tsx
/**
 * Human-readable Top 10 research ranking report + live BGE-M3 replay.
 * Usage:
 *   npx tsx scripts/research-quality-report.ts
 *   RESEARCH_USE_SUPABASE=true npx tsx scripts/research-quality-report.ts
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
try {
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  } as NodeModule;
} catch {
  // ignore
}

function loadEnvIntoProcess(): void {
  for (const file of [
    resolve(process.cwd(), ".env.local"),
    resolve(process.env.HOME || "/home/ysh", ".hermes/.env"),
  ]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#") || !t.includes("=")) continue;
        const i = t.indexOf("=");
        const k = t.slice(0, i).trim();
        let v = t.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!process.env[k]) process.env[k] = v;
      }
    } catch {
      // ignore missing env files
    }
  }
}

loadEnvIntoProcess();

type ReportRow = {
  rank: number;
  title: string;
  sources: string;
  destinations: string;
  topics: string;
  freshness: number;
  credibility: number;
  relevance: number;
  publicInterest: number;
  corroboration: number;
  novelty: number;
  seasonality: number;
  commercial: number;
  composite: number;
  reasons: string[];
};

function formatRow(row: ReportRow): string {
  const pad = (n: number, w: number) => String(n).padStart(w);
  return [
    `#${pad(row.rank, 2)}`,
    row.title.slice(0, 56),
    `src=${row.sources}`,
    `dest=${row.destinations}`,
    `fresh=${row.freshness.toFixed(2)}`,
    `cred=${row.credibility.toFixed(2)}`,
    `rel=${row.relevance.toFixed(2)}`,
    `pub=${row.publicInterest.toFixed(2)}`,
    `corr=${row.corroboration.toFixed(2)}`,
    `nov=${row.novelty.toFixed(2)}`,
    `com=${row.commercial.toFixed(2)}`,
    `score=${row.composite.toFixed(3)}`,
    `reasons=${row.reasons.join(",")}`,
  ].join(" | ");
}

function signalToRawInput(
  signal: import("@/lib/marketing/research/types/researchSignal").ResearchSignal,
): import("@/lib/marketing/research/types/researchSignal").RawResearchSignalInput {
  return {
    id: signal.id,
    sourceId: signal.sourceId,
    sourceType: signal.sourceType,
    signalType: signal.signalType,
    title: signal.title,
    summary: signal.summary,
    claim: signal.claim,
    claimSource: signal.claimSource,
    evidence: signal.evidence,
    canonicalUrl: signal.canonicalUrl,
    externalId: signal.externalId,
    publishedAt: signal.publishedAt,
    observedAt: signal.observedAt,
    expiresAt: signal.expiresAt,
    geography: signal.geography,
    destinations: signal.destinations,
    topics: signal.topics,
    entities: signal.entities,
    language: signal.language,
    seasonality: signal.seasonality,
    metadata: signal.metadata,
  };
}

function summarizeDataset(
  signals: import("@/lib/marketing/research/types/researchSignal").ResearchSignal[],
): Record<string, unknown> {
  const bySource = new Map<string, number>();
  const byType = new Map<string, number>();
  const destinations = new Set<string>();
  const topics = new Set<string>();
  let minPublished: string | null = null;
  let maxPublished: string | null = null;

  for (const signal of signals) {
    bySource.set(signal.sourceType, (bySource.get(signal.sourceType) ?? 0) + 1);
    byType.set(signal.signalType, (byType.get(signal.signalType) ?? 0) + 1);
    signal.destinations.forEach((d) => destinations.add(d));
    signal.topics.forEach((t) => topics.add(t));
    if (signal.publishedAt) {
      if (!minPublished || signal.publishedAt < minPublished) minPublished = signal.publishedAt;
      if (!maxPublished || signal.publishedAt > maxPublished) maxPublished = signal.publishedAt;
    }
  }

  return {
    totalSignals: signals.length,
    sourceDistribution: Object.fromEntries(bySource),
    signalTypes: Object.fromEntries(byType),
    destinationCount: destinations.size,
    topicCount: topics.size,
    publishedAtRange: { min: minPublished, max: maxPublished },
  };
}

function candidatesToRows(
  candidates: import("@/lib/marketing/research/types/researchBrief").AgendaCandidate[],
  briefs: import("@/lib/marketing/research/types/researchBrief").ResearchBrief[],
): ReportRow[] {
  return candidates.slice(0, 10).map((c, i) => {
    const brief = briefs.find((b) => b.id === c.researchBriefId);
    return {
      rank: i + 1,
      title: c.title,
      sources: String(brief?.signalIds.length ?? c.supportingEvidenceIds.length),
      destinations: (brief?.destinations ?? []).slice(0, 3).join(","),
      topics: (brief?.topics ?? []).slice(0, 3).join(","),
      freshness: c.freshnessScore,
      credibility: c.credibilityScore,
      relevance: c.travelRelevanceScore,
      publicInterest: c.publicInterestScore,
      corroboration: c.corroborationScore ?? 0,
      novelty: c.researchScoreComponents?.novelty ?? 0,
      seasonality: c.seasonalityScore,
      commercial: c.commercialLinkageScore,
      composite: c.compositeResearchScore,
      reasons: c.scoreReasons ?? [],
    };
  });
}

async function runCalibrationFallback(): Promise<{
  briefCount: number;
  candidateCount: number;
  rows: ReportRow[];
  semanticMetrics?: Record<string, unknown>;
}> {
  const {
    createDeterministicEmbeddingProvider,
    semanticTextFor,
    signalFixture,
  } = await import("@/lib/marketing/research/__tests__/semanticCalibrationFixtures");
  const { MVP_RESEARCH_SOURCES } = await import("@/lib/marketing/research/collectors/config");
  const { createInMemoryResearchRepository } = await import(
    "@/lib/marketing/research/repository/inMemoryResearchRepository"
  );
  const { runResearchPipeline } = await import("@/lib/marketing/research/services/pipeline");

  const repo = createInMemoryResearchRepository();
  for (const source of MVP_RESEARCH_SOURCES) {
    await repo.upsertSource({
      ...source,
      createdAt: "2026-09-02T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
    });
  }

  const provider = createDeterministicEmbeddingProvider();
  const official = signalFixture({
    id: "11111111-1111-4111-8111-111111111701",
    title: "Urgent Kenya travel restriction",
    summary: "Official urgent travel restriction issued for Kenya.",
    signalType: "safety",
    destinations: ["kenya"],
    sourceId: MVP_RESEARCH_SOURCES[0]!.id,
    sourceType: "official_government",
  });
  const news = signalFixture({
    id: "22222222-2222-4222-8222-222222222702",
    title: "Kenya travel restriction reported",
    summary: "News coverage of Kenya travel restriction.",
    signalType: "safety",
    destinations: ["kenya"],
    sourceId: MVP_RESEARCH_SOURCES[1]!.id,
    sourceType: "news",
    rawFingerprint: "report-news-01-raw",
    normalizedFingerprint: "report-news-01-n",
  });
  provider.pinSimilar(semanticTextFor(official), semanticTextFor(news));

  const pipeline = await runResearchPipeline({
    repo,
    rawSignals: [official, news].map(signalToRawInput),
    semantic: { provider },
  });

  return {
    briefCount: pipeline.briefs.length,
    candidateCount: pipeline.agendaCandidates.length,
    rows: candidatesToRows(pipeline.agendaCandidates, pipeline.briefs),
    semanticMetrics: pipeline.semanticMetrics as unknown as Record<string, unknown>,
  };
}

async function runSupabaseLiveReplay(): Promise<{
  briefCount: number;
  candidateCount: number;
  rows: ReportRow[];
  semanticMetrics?: Record<string, unknown>;
  datasetSummary?: Record<string, unknown>;
  clusterSpotChecks: Array<Record<string, unknown>>;
  bgeHealth?: Record<string, unknown>;
  persistenceCheck?: Record<string, unknown>;
  idempotencyCheck?: Record<string, unknown>;
}> {
  const { checkEmbeddingHealth } = await import("@/lib/marketing/semantic/embeddingProvider");
  const { createResearchRepository } = await import(
    "@/lib/marketing/research/repository/createResearchRepository"
  );
  const {
    createResearchPipelineSemanticDeps,
    runResearchPipeline,
  } = await import("@/lib/marketing/research/services/pipeline");
  const { buildClustersFromMergeGroups } = await import(
    "@/lib/marketing/research/services/researchCluster"
  );

  let bgeHealth: Record<string, unknown> = { ok: false, reason: "not_checked" };
  try {
    const health = await checkEmbeddingHealth(process.env);
    bgeHealth = { ok: true, ...health };
  } catch (error) {
    bgeHealth = {
      ok: false,
      reason: error instanceof Error ? error.message : "health_check_failed",
    };
  }

  const repo = await createResearchRepository({ backend: "supabase" });
  const sources = await repo.listEnabledSources();
  for (const source of sources) {
    await repo.upsertSource(source);
  }

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const stored = await repo.findRecentSignals({ since, limit: 50 });
  const replaySignals = stored.filter((s) => s.status !== "duplicate");
  const datasetSummary = summarizeDataset(replaySignals);

  const semantic = await createResearchPipelineSemanticDeps({ env: process.env });
  const signalCountBefore = stored.length;

  const pipeline = await runResearchPipeline({
    repo,
    rawSignals: replaySignals.map(signalToRawInput),
    semantic,
  });

  const allSignals = [...pipeline.enriched, ...pipeline.duplicates];
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  const mergeGroups = new Map<string, string[]>();
  for (const signal of pipeline.enriched) {
    mergeGroups.set(signal.id, [signal.id]);
  }
  for (const dup of pipeline.duplicates) {
    if (!dup.duplicateOfSignalId) continue;
    const group = mergeGroups.get(dup.duplicateOfSignalId) ?? [dup.duplicateOfSignalId];
    if (!group.includes(dup.id)) group.push(dup.id);
    mergeGroups.set(dup.duplicateOfSignalId, group);
  }

  const clusters = buildClustersFromMergeGroups({
    signals: allSignals,
    mergeGroups: [...mergeGroups.values()],
    sources: sourceById,
  });

  const clusterSpotChecks: Array<Record<string, unknown>> = [];
  for (const cluster of clusters.filter((c) => c.signalIds.length > 1).slice(0, 10)) {
    const members = allSignals.filter((s) => cluster.signalIds.includes(s.id));
    const primary = members.find((m) => m.id === cluster.primarySignalId) ?? members[0];
    const mergeComparison = pipeline.semanticMetrics
      ? undefined
      : undefined;
    void mergeComparison;
    clusterSpotChecks.push({
      clusterId: cluster.id,
      primaryTitle: primary?.title,
      primarySource: sourceById.get(primary?.sourceId ?? "")?.name ?? primary?.sourceType,
      supportingSources: members
        .filter((m) => m.id !== primary?.id)
        .map((m) => sourceById.get(m.sourceId)?.name ?? m.sourceType),
      signalTypes: [...new Set(members.map((m) => m.signalType))],
      destinations: [...new Set(members.flatMap((m) => m.destinations))],
      topics: [...new Set(members.flatMap((m) => m.topics))].slice(0, 5),
      memberCount: members.length,
    });
  }

  const sampleBrief = pipeline.briefs[0];
  const sampleCandidate = pipeline.agendaCandidates[0];
  let persistenceCheck: Record<string, unknown> = { ok: false, reason: "no_samples" };

  if (sampleBrief && sampleCandidate) {
    const readBrief = await repo.findBriefById(sampleBrief.id);
    const readCandidate = await repo.findAgendaCandidateById(sampleCandidate.id);
    persistenceCheck = {
      ok: Boolean(
        readBrief?.clusterId &&
          readBrief.corroboration &&
          readCandidate?.corroborationScore != null &&
          readCandidate.researchScoreComponents &&
          readCandidate.scoreReasons?.length,
      ),
      briefClusterId: readBrief?.clusterId ?? null,
      briefCorroborationScore: readBrief?.corroboration?.score ?? null,
      candidateCorroborationScore: readCandidate?.corroborationScore ?? null,
      candidateComponents: readCandidate?.researchScoreComponents ?? null,
      candidateReasons: readCandidate?.scoreReasons ?? null,
    };
  }

  const pipeline2 = await runResearchPipeline({
    repo,
    rawSignals: replaySignals.map(signalToRawInput),
    semantic,
  });
  const storedAfter = await repo.findRecentSignals({ since, limit: 50 });
  const idempotencyCheck = {
    signalsBefore: signalCountBefore,
    signalsAfter: storedAfter.length,
    briefsRun1: pipeline.briefs.length,
    briefsRun2: pipeline2.briefs.length,
    duplicatesRun1: pipeline.duplicates.length,
    duplicatesRun2: pipeline2.duplicates.length,
    ok: storedAfter.length <= signalCountBefore + 5,
  };

  return {
    briefCount: pipeline.briefs.length,
    candidateCount: pipeline.agendaCandidates.length,
    rows: candidatesToRows(pipeline.agendaCandidates, pipeline.briefs),
    semanticMetrics: pipeline.semanticMetrics as unknown as Record<string, unknown>,
    datasetSummary,
    clusterSpotChecks,
    bgeHealth,
    persistenceCheck,
    idempotencyCheck,
  };
}

async function main(): Promise<void> {
  const useSupabase = process.env.RESEARCH_USE_SUPABASE?.trim().toLowerCase() === "true";
  let mode = "calibration_fixture";
  let rows: ReportRow[] = [];
  let briefCount = 0;
  let candidateCount = 0;
  let semanticMetrics: Record<string, unknown> | undefined;
  let datasetSummary: Record<string, unknown> | undefined;
  let clusterSpotChecks: Array<Record<string, unknown>> = [];
  let bgeHealth: Record<string, unknown> | undefined;
  let persistenceCheck: Record<string, unknown> | undefined;
  let idempotencyCheck: Record<string, unknown> | undefined;

  if (useSupabase) {
    try {
      const live = await runSupabaseLiveReplay();
      rows = live.rows;
      briefCount = live.briefCount;
      candidateCount = live.candidateCount;
      semanticMetrics = live.semanticMetrics;
      datasetSummary = live.datasetSummary;
      clusterSpotChecks = live.clusterSpotChecks;
      bgeHealth = live.bgeHealth;
      persistenceCheck = live.persistenceCheck;
      idempotencyCheck = live.idempotencyCheck;
      mode = "supabase_live_replay";
    } catch (error) {
      console.warn("[research-quality-report] supabase live replay failed, using calibration fixture");
      console.warn(error instanceof Error ? error.message : error);
      if (error instanceof Error && error.stack) console.warn(error.stack);
    }
  }

  if (rows.length === 0) {
    const fallback = await runCalibrationFallback();
    rows = fallback.rows;
    briefCount = fallback.briefCount;
    candidateCount = fallback.candidateCount;
    semanticMetrics = fallback.semanticMetrics;
    mode = "calibration_fixture";
  }

  console.log("=== Research Quality Report (Top 10 AgendaCandidates) ===");
  console.log(`mode=${mode} briefs=${briefCount} candidates=${candidateCount}`);
  if (bgeHealth) console.log(`bgeHealth=${JSON.stringify(bgeHealth)}`);
  if (datasetSummary) console.log(`dataset=${JSON.stringify(datasetSummary)}`);
  if (semanticMetrics) console.log(`semantic=${JSON.stringify(semanticMetrics)}`);
  if (persistenceCheck) console.log(`persistence=${JSON.stringify(persistenceCheck)}`);
  if (idempotencyCheck) console.log(`idempotency=${JSON.stringify(idempotencyCheck)}`);
  console.log("");

  if (clusterSpotChecks.length > 0) {
    console.log("--- semantic merge clusters (spot-check) ---");
    for (const cluster of clusterSpotChecks) {
      console.log(JSON.stringify(cluster));
    }
    console.log("");
  } else if (mode === "supabase_live_replay") {
    console.log("--- semantic merge clusters: none (no cross-source duplicates in dataset) ---");
    console.log("");
  }

  for (const row of rows) {
    console.log(formatRow(row));
  }
  console.log("");
  console.log("--- sanity checklist ---");
  console.log("A official/urgent high rank: inspect top titles for safety/restriction");
  console.log("B productless high-value: corroboration+relevance should beat commercial-only");
  console.log("C stale commercial: lower freshness should suppress rank");
  console.log("D low credibility: risk flags + lower composite");
  console.log("E cross-source event: corroboration > 0.5 when multi-source brief");
  console.log("F duplicate topic: novelty penalty visible in nov= column");
}

main().catch((error) => {
  console.error("[research-quality-report] failed", error);
  process.exitCode = 1;
});

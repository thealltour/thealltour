#!/usr/bin/env npx tsx
/**
 * Scoped acceptance: Meta trend freshness TTL → MM pool + live editorial apply.
 * Does NOT run full 09:00 cron / slate / ProductionRequest / CMC / HMR / SNS.
 * Does NOT reprocess existing production observations.
 */

import { createRequire } from "node:module";
import { loadLocalEnv } from "./loadLocalEnv";

const require = createRequire(import.meta.url);
const Module = require("module") as {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ) => string;
};
const originalResolve = Module._resolveFilename.bind(Module);
const serverOnlyStub = require.resolve("./shims/server-only.js");
Module._resolveFilename = function resolveFilename(
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: unknown,
) {
  if (request === "server-only") return serverOnlyStub;
  return originalResolve(request, parent, isMain, options);
};

loadLocalEnv();

async function main() {
  const { createTravelTrendsStagingRepository } = await import(
    "@/lib/marketing/trends/staging/createTravelTrendsStagingRepository"
  );
  const { createResearchRepository } = await import(
    "@/lib/marketing/research/repository/createResearchRepository"
  );
  const { processNewTrendStagingObservations } = await import(
    "@/lib/marketing/trends/staging/processNewTrendStaging"
  );
  const { ingestTrendIntakePaste } = await import(
    "@/lib/marketing/trends/intake/trendIntakeService"
  );
  const { getMarketingManagerResearchContext } = await import(
    "@/lib/marketing/research/manager/getMarketingManagerResearchContext"
  );
  const { isStaleFreshness } = await import(
    "@/lib/marketing/research/services/freshnessScorer"
  );
  const { buildTrendEditorialPlans } = await import(
    "@/lib/marketing/trends/editorial/trendEditorialPlanning"
  );
  const { resolveMarketingTrendEditorialMode } = await import(
    "@/lib/marketing/trends/editorial/trendEditorialModeConfig"
  );

  const stamp = Date.now();
  const observationId = `obs_scoped_ttl_${stamp}`;
  // Mirror production failure shape: window.end === observedAt (17:00 KST previous day).
  const observedAtKst = "2026-09-09T17:00:00+09:00";
  const mmRunAt = new Date("2026-09-10T00:00:00.000Z"); // 09:00 KST next day

  const paste = JSON.stringify({
    provider: "meta_ai",
    items: [
      {
        schema_version: "trend_signal_v1",
        provider: "meta_ai",
        provider_run_id: `meta_ai:scoped_ttl_${stamp}`,
        provider_run_at: observedAtKst,
        observation_id: observationId,
        provider_cluster_hint: `pcl_scoped_ttl_${stamp}`,
        cluster_label: "scoped_ttl_freshness_mm_pool",
        observed_at: observedAtKst,
        captured_at: "2026-09-09T16:50:00+09:00",
        window: {
          start: "2026-09-06T17:00:00+09:00",
          end: observedAtKst,
        },
        trend_type: "activity_trend",
        vertical_tags: ["family", "short-haul", "cruise"],
        topic: `TTL fix MM pool cruise scoped ${stamp}`,
        summary: "scoped freshness TTL fix — overnight MM eligibility",
        trend_signal_status: "repeated_pattern",
        confidence: {
          score: 0.74,
          type: "model_estimate",
          basis: ["3_posts", "1_platforms"],
        },
        popularity: {
          score: 68,
          type: "model_estimate",
          basis: ["repeated_pattern"],
        },
        market_relevance: {
          origin_market: "KR",
          travel_direction: "outbound",
          score: 0.89,
          basis: {
            observed: ["korean_language_source", "busan_port_mentioned"],
            inferred: ["korean_outbound_audience_fit"],
          },
        },
        marketing_observations: {
          hook_signals: ["비행기 없이 떠나는", "가족 단위 단체 탑승"],
          format_signals: ["릴스 기반 선내 동선 브이로그"],
          audience_pain_points: ["첫 크루즈 정보 부족"],
          audience_questions: ["부산 출발 일정과 기항지는"],
          persona_estimates: ["부산·경남 출발 가족"],
          content_angles: ["비행 없는 5박6일 크루즈로 효도·가족 포지셔닝"],
        },
        factual_claims: [],
        destinations: ["부산", "일본"],
        provenance: [
          {
            level: "L1",
            platform: "instagram",
            url: "https://www.instagram.com/reel/Dc8qCMPJZG5/",
            published_at: "2026-09-07T22:36:56+09:00",
            captured_at: "2026-09-07T22:45:00+09:00",
            source_id: "post-scoped-ttl-1",
          },
          {
            level: "L1",
            platform: "instagram",
            url: "https://www.instagram.com/reel/Dc-ie7iKW16/",
            published_at: "2026-09-08T16:10:26+09:00",
            captured_at: "2026-09-08T16:30:00+09:00",
            source_id: "post-scoped-ttl-2",
          },
          {
            level: "L1",
            platform: "instagram",
            url: "https://www.instagram.com/reel/DdAoENDzr0i/",
            published_at: "2026-09-09T11:38:39+09:00",
            captured_at: "2026-09-09T12:00:00+09:00",
            source_id: "post-scoped-ttl-3",
          },
        ],
        observed_metrics: {
          observation_count: 3,
          platform_count: 1,
          platforms: ["instagram"],
        },
        raw_context: {
          notes: "scoped freshness ttl acceptance",
          opaque: { queries: ["부산 출발 크루즈"] },
        },
      },
    ],
  });

  const stagingRepo = await createTravelTrendsStagingRepository();
  const researchRepo = await createResearchRepository();

  const intake = await ingestTrendIntakePaste(paste, stagingRepo);
  if (intake.counts.accepted !== 1) {
    throw new Error(
      `intake failed: accepted=${intake.counts.accepted} dup=${intake.counts.duplicate} rejected=${intake.counts.rejected} items=${JSON.stringify(intake.items).slice(0, 500)}`,
    );
  }

  const diag = await processNewTrendStagingObservations({
    stagingRepo,
    researchRepo,
    limit: 10,
  });

  const briefId = diag.researchBriefIds[0];
  const brief = briefId ? await researchRepo.findBriefById(briefId) : null;
  if (!brief) throw new Error("brief missing after adapt");

  const stale = isStaleFreshness(brief.freshness, 0.15, mmRunAt);
  const windowEnd = brief.trendContext?.window.end ?? null;
  const expiresAt = brief.freshness.expiresAt;

  // Isolated MM pool check: seed only this durable Meta artifact into memory.
  // Avoids production diversify competition (out of scope for freshness TTL fix).
  const { createInMemoryResearchRepository } = await import(
    "@/lib/marketing/research/repository/inMemoryResearchRepository"
  );
  const isolated = createInMemoryResearchRepository();
  const recentCands = await researchRepo.findRecentAgendaCandidates({
    since: "2026-09-09T00:00:00.000Z",
    limit: 80,
  });
  const candidate =
    recentCands.find((c) => c.researchBriefId === brief.id) ?? null;
  if (!candidate) throw new Error("agenda candidate missing after adapt");

  const signalId = brief.primarySignalId ?? brief.signalIds[0];
  const signal = signalId ? await researchRepo.findSignalById(signalId) : null;
  const source = signal
    ? await researchRepo.getSourceById(signal.sourceId)
    : null;
  if (source) await isolated.upsertSource(source);
  if (signal) await isolated.upsertSignal(signal);
  await isolated.upsertBrief(brief);
  await isolated.upsertAgendaCandidate(candidate);

  const ctx = await getMarketingManagerResearchContext(
    {},
    {
      now: mmRunAt,
      repo: isolated,
      checkSemanticInfrastructure: async () => false,
    },
  );
  const inPool = ctx.agendaCandidates.some((c) => c.researchBriefId === brief.id);

  const trendBriefs = [];
  for (const c of ctx.agendaCandidates.slice(0, 28)) {
    const b = await isolated.findBriefById(c.researchBriefId);
    if (b?.editorialIntelligence || b?.trendContext) trendBriefs.push(b);
  }
  const editorialMode = resolveMarketingTrendEditorialMode();
  const plan = buildTrendEditorialPlans({
    briefs: trendBriefs,
    mode: editorialMode === "live" ? "live" : editorialMode,
    availableTrendCount: diag.availableTrendCount,
    adaptedTrendCount: diag.adaptedTrendCount,
  });

  // Live production pool probe (informational only — may lose diversify competition).
  const liveCtx = await getMarketingManagerResearchContext(
    {},
    { now: mmRunAt, repo: researchRepo },
  );
  const inLivePool = liveCtx.agendaCandidates.some(
    (c) => c.researchBriefId === brief.id,
  );

  const stagingRow = await stagingRepo.findTrendObservationByIdentity(
    "meta_ai",
    observationId,
  );

  const report = {
    observationId,
    stagingStatus: stagingRow?.status ?? null,
    editorialMode,
    brief: {
      id: brief.id,
      observedAt: brief.freshness.observedAt,
      windowEnd,
      expiresAt,
      expiresAtEqualsWindowEnd: expiresAt === windowEnd,
    },
    mmRunAt: mmRunAt.toISOString(),
    isStaleFreshness: stale,
    inMmPool: inPool,
    mmPoolSize: ctx.agendaCandidates.length,
    inLiveProductionPool: inLivePool,
    liveProductionPoolSize: liveCtx.agendaCandidates.length,
    diagnostics: {
      availableTrendCount: diag.availableTrendCount,
      adaptedTrendCount: diag.adaptedTrendCount,
      researchBriefIds: diag.researchBriefIds,
    },
    liveEditorial: {
      editorialSignalCount: plan.diagnostics.editorialSignalCount,
      appliedCount: plan.diagnostics.appliedCount,
      hypotheticalAppliedCount: plan.diagnostics.hypotheticalAppliedCount,
      planIncludesBrief: plan.plansByBriefId.has(brief.id),
    },
  };

  console.log(JSON.stringify(report, null, 2));

  if (
    stagingRow?.status !== "ingested" ||
    stale ||
    !inPool ||
    plan.diagnostics.appliedCount < 1 ||
    plan.diagnostics.editorialSignalCount < 1 ||
    expiresAt === windowEnd ||
    editorialMode !== "live"
  ) {
    process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`scoped freshness acceptance failed: ${message.slice(0, 400)}`);
  process.exit(1);
});

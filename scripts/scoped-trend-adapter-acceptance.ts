#!/usr/bin/env npx tsx
/**
 * Scoped acceptance: Meta-like +09:00 TrendSignal → Research UTC Z persist.
 * Does NOT run full 09:00 cron. No ProductionRequest/CMC/HMR/SNS.
 */

import { createRequire } from "node:module";
import { loadLocalEnv } from "./loadLocalEnv";

const require = createRequire(import.meta.url);
const Module = require("module") as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string;
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
  const { buildTrendEditorialPlanForBrief } = await import(
    "@/lib/marketing/trends/editorial/trendEditorialPlanning"
  );
  const { resolveMarketingTrendEditorialMode } = await import(
    "@/lib/marketing/trends/editorial/trendEditorialModeConfig"
  );
  const { ingestTrendIntakePaste } = await import(
    "@/lib/marketing/trends/intake/trendIntakeService"
  );

  const observationId = `obs_scoped_fix_${Date.now()}`;
  const paste = JSON.stringify({
    provider: "meta_ai",
    items: [
      {
        schema_version: "trend_signal_v1",
        provider: "meta_ai",
        provider_run_id: "meta_ai:20260909T154500+0900",
        provider_run_at: "2026-09-09T15:45:00+09:00",
        observation_id: observationId,
        provider_cluster_hint: "pcl_scoped_fix_001",
        cluster_label: "busan_departure_cruise_family_activity_scoped",
        observed_at: "2026-09-09T15:45:00+09:00",
        captured_at: "2026-09-09T15:40:00+09:00",
        window: {
          start: "2026-09-06T15:45:00+09:00",
          end: "2026-09-09T15:45:00+09:00",
        },
        trend_type: "activity_trend",
        vertical_tags: ["family", "short-haul", "cruise"],
        topic: "부산 출발 크루즈 가족 여행 scoped acceptance",
        summary: "scoped adapter fix acceptance — offset datetime persist",
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
            source_id: "post-scoped-1",
          },
          {
            level: "L1",
            platform: "instagram",
            url: "https://www.instagram.com/reel/Dc-ie7iKW16/",
            published_at: "2026-09-08T16:10:26+09:00",
            captured_at: "2026-09-08T16:30:00+09:00",
            source_id: "post-scoped-2",
          },
          {
            level: "L1",
            platform: "instagram",
            url: "https://www.instagram.com/reel/DdAoENDzr0i/",
            published_at: "2026-09-09T11:38:39+09:00",
            captured_at: "2026-09-09T12:00:00+09:00",
            source_id: "post-scoped-3",
          },
        ],
        observed_metrics: {
          observation_count: 3,
          platform_count: 1,
          platforms: ["instagram"],
        },
        raw_context: {
          notes: "scoped acceptance",
          opaque: { queries: ["부산 출발 크루즈 가족"] },
        },
      },
    ],
  });

  const stagingRepo = await createTravelTrendsStagingRepository();
  const researchRepo = await createResearchRepository();

  const intake = await ingestTrendIntakePaste(paste, stagingRepo);
  if (intake.counts.accepted !== 1) {
    throw new Error(
      `intake failed: accepted=${intake.counts.accepted} dup=${intake.counts.duplicate} rejected=${intake.counts.rejected}`,
    );
  }

  const diag = await processNewTrendStagingObservations({
    stagingRepo,
    researchRepo,
    limit: 10,
  });

  const briefId = diag.researchBriefIds[0];
  const brief = briefId ? await researchRepo.findBriefById(briefId) : null;
  const candidates = await researchRepo.findRecentAgendaCandidates({
    since: "2026-09-09T00:00:00.000Z",
    limit: 40,
  });
  const linked = candidates.filter((c) => c.researchBriefId === briefId);
  const plan = brief ? buildTrendEditorialPlanForBrief(brief) : null;
  const stagingRow = await stagingRepo.findTrendObservationByIdentity("meta_ai", observationId);

  const report = {
    observationId,
    editorialMode: resolveMarketingTrendEditorialMode(),
    insertAccepted: intake.counts.accepted,
    stagingStatus: stagingRow?.status ?? null,
    diagnostics: {
      availableTrendCount: diag.availableTrendCount,
      adaptedTrendCount: diag.adaptedTrendCount,
      failedCount: diag.failedCount,
      discardedCount: diag.discardedCount,
      researchBriefIds: diag.researchBriefIds,
      degradeReason: diag.degradeReason,
      failures: diag.failures,
    },
    brief: brief
      ? {
          id: brief.id,
          observedAt: brief.freshness.observedAt,
          window: brief.trendContext?.window,
          editorialHooks: brief.editorialIntelligence?.hookSignals?.length ?? 0,
          hasUtcZ: brief.freshness.observedAt.endsWith("Z"),
        }
      : null,
    agendaCandidateCount: linked.length,
    editorialPlanSignals: plan
      ? {
          contentAngle: plan.contentAngle ? 1 : 0,
          formatSignals: plan.formatSignals?.length ?? 0,
          audiencePainPoints: plan.audiencePainPoints?.length ?? 0,
          hookSignals: plan.hookSignals?.length ?? 0,
        }
      : null,
    orphanCheck: {
      briefExists: !!brief,
      candidateLinked: linked.length > 0,
    },
  };

  console.log(JSON.stringify(report, null, 2));

  if (
    diag.adaptedTrendCount < 1 ||
    stagingRow?.status !== "ingested" ||
    !brief ||
    linked.length < 1 ||
    !brief.freshness.observedAt.endsWith("Z")
  ) {
    process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`scoped acceptance failed: ${message.slice(0, 400)}`);
  process.exit(1);
});

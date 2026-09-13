/**
 * MQ-2 bounded live smoke for RA-1 external research (Hermes-Pi).
 * Does NOT publish, render, or run channel composers.
 *
 *   npx tsx scripts/mq2-external-research-smoke.ts
 */
import { hostname } from "node:os";
import { createHash } from "node:crypto";

import { loadLocalEnv } from "./loadLocalEnv";
import { prepareManagerToContentHandoff } from "../src/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryContentAssignmentStore } from "../src/lib/marketing/content/store/contentAssignmentStore";
import { runBoundedExternalResearch } from "../src/lib/marketing/audienceResearch/external/runExternalResearch";
import { resolveResearchSearchProviderStatus } from "../src/lib/marketing/audienceResearch/external/createSearchProvider";
import { deriveAgendaTopicIdentity } from "../src/lib/marketing/audienceResearch/topicIdentity/deriveTopicIdentity";
import { identityIsCruise, identityIsPackage } from "../src/lib/marketing/audienceResearch/topicIdentity/contracts";
import { buildResearchQueryPlan } from "../src/lib/marketing/audienceResearch/external/queryPlan";

loadLocalEnv();

function keyMeta(key: string) {
  return {
    present: Boolean(key),
    len: key.length,
    sha8: key ? createHash("sha256").update(key).digest("hex").slice(0, 8) : null,
  };
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim() || "";
  const providerStatus = resolveResearchSearchProviderStatus(process.env);

  const selection = {
    title: "부산 출발 나트랑 추석 가족 패키지",
    summary: "부산 출발 나트랑 추석 가족 패키지 관측 — MQ-2 live smoke",
    contentObjective: "inform_travelers" as const,
    commercialIntent: "informational" as const,
    destinations: ["나트랑"],
    topics: ["패키지", "추석", "가족"],
    entities: [],
    researchBriefId: "rb_mq2_live_smoke",
    agendaCandidateId: "ac_mq2_live_smoke",
    evidenceRefs: [
      {
        evidenceId: "f4e6f641-d2cd-4704-8d01-2fbc890a516b",
        sourceId: "a1000000-0000-4000-8000-000000000001",
        sourceType: "social",
        sourceName: "Meta",
        isOfficial: false,
        evidenceType: "derived_signal",
        url: "https://www.instagram.com/reel/mq2-smoke/",
        reference: "meta_ai:mq2_smoke",
        excerpt: "부산 기반 여행사의 나트랑 추석 가족 패키지 프로모션",
        publishedAt: null,
        observedAt: new Date().toISOString(),
        credibilityHint: 0.35,
      },
    ],
  };

  const handoff = prepareManagerToContentHandoff(selection, {
    store: createInMemoryContentAssignmentStore(),
  });
  const identity = deriveAgendaTopicIdentity({
    selectedAgenda: handoff.selectedAgenda,
    assignment: handoff.contentAssignment,
  });
  const plan = buildResearchQueryPlan({ handoff, maxQueries: 2 });

  console.log(
    JSON.stringify(
      {
        host: hostname(),
        openrouter_credential: keyMeta(apiKey),
        provider_status: {
          providerId: providerStatus.providerId,
          enabled: providerStatus.enabled,
          credentialPresent: providerStatus.credentialPresent,
          reason: providerStatus.reason,
        },
        identity: {
          productTypes: identity.productTypes,
          destinations: identity.destinationEntities,
          origin: identity.originEntities,
          isPackage: identityIsPackage(identity),
          isCruise: identityIsCruise(identity),
        },
        planned_queries: plan.queries.map((q) => q.query),
        cruise_queries: plan.queries.filter((q) => /크루즈|cruise|msc|벨리시마/i.test(q.query)).map((q) => q.query),
      },
      null,
      2,
    ),
  );

  if (!apiKey || !providerStatus.enabled) {
    console.log(JSON.stringify({ smoke: "skipped_no_credential", verdict: "BLOCKED" }, null, 2));
    process.exit(2);
  }

  let reportedCost: number | null = null;
  let webSearchRequests: number | null = null;
  const { createOpenRouterWebSearchProvider, resolveOpenRouterApiKey } = await import(
    "../src/lib/marketing/audienceResearch/external/openrouterProvider"
  );
  const { apiKey: resolvedKey } = resolveOpenRouterApiKey(process.env);
  const liveProvider = createOpenRouterWebSearchProvider({
    apiKey: resolvedKey,
    onUsage: (usage) => {
      if (typeof usage.cost === "number") {
        reportedCost = (reportedCost ?? 0) + usage.cost;
      }
      if (typeof usage.webSearchRequests === "number") {
        webSearchRequests = (webSearchRequests ?? 0) + usage.webSearchRequests;
      }
    },
  });

  const bundle = await runBoundedExternalResearch({
    handoff,
    searchProvider: liveProvider,
    maxQueries: 2,
    maxRetryPerQuery: 1,
    maxPaidSearchRequests: 3,
    concurrency: 2,
    overallBudgetMs: 90_000,
    perQueryTimeoutMs: 30_000,
  });

  console.log(
    JSON.stringify(
      {
        smoke: "mq2_external_research",
        planned_queries: bundle.plannedQueryCount,
        attempted_queries: bundle.attemptedQueryCount,
        successful_queries: bundle.successfulQueryCount,
        failed_queries: bundle.failedQueryCount,
        retries: bundle.retryCount,
        search_request_count: bundle.searchRequestCount,
        usable_urls: bundle.evidence.map((e) => e.url).slice(0, 8),
        fetched_documents: bundle.fetchedDocumentCount,
        source_classes: [...new Set(bundle.evidence.map((e) => e.sourceClass))],
        package_identity_preserved: identityIsPackage(identity) && !identityIsCruise(identity),
        cruise_queries_generated: plan.queries.filter((q) =>
          /크루즈|cruise|msc|벨리시마/i.test(q.query),
        ).length,
        external_search_status: bundle.externalSearchStatus,
        external_research_used_signal: (bundle.usableResultCount ?? 0) > 0,
        limitations: bundle.limitations.slice(0, 8),
        reported_search_cost: reportedCost,
        web_search_requests: webSearchRequests,
        runtime_ms: bundle.runtimeMs,
        provider_id: bundle.providerId,
        verdict:
          (bundle.successfulQueryCount ?? 0) >= 1 &&
          (bundle.usableResultCount ?? 0) >= 1 &&
          identityIsPackage(identity) &&
          !identityIsCruise(identity)
            ? "PASS"
            : "FAIL",
      },
      null,
      2,
    ),
  );

  if ((bundle.successfulQueryCount ?? 0) < 1 || (bundle.usableResultCount ?? 0) < 1) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        smoke: "mq2_external_research",
        verdict: "ERROR",
        error: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      },
      null,
      2,
    ),
  );
  process.exit(1);
});

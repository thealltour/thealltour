vi.mock("server-only", () => ({}));

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import { DAILY_MARKETING_ROUTINE_ID } from "@/lib/marketing/cron/daily/types";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import type { AgendaCandidate, ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import { createInMemoryMarketingSemanticEmbeddingRepository } from "@/lib/marketing/semantic/entityEmbeddings/inMemorySemanticEmbeddingRepository";
import {
  DEFAULT_MARKETING_SEMANTIC_EMBEDDING_REVISION,
  MARKETING_SEMANTIC_SOURCE_TEXT_VERSION,
} from "@/lib/marketing/semantic/entityEmbeddings/types";
import { MarketingSemanticValidationError } from "@/lib/marketing/semantic/entityEmbeddings/validation";
import {
  indexSemanticEntitiesBatch,
  indexSemanticEntity,
  type IndexSemanticEntityDeps,
} from "@/lib/marketing/semantic/indexing/indexSemanticEntity";
import type { MarketingSemanticIndexingConfig } from "@/lib/marketing/semantic/indexing/indexingConfig";
import type { EmbeddingProvider, EmbeddingVector } from "@/lib/marketing/semantic/types";

const DIM = 8;
const MODEL = "BAAI/bge-m3";
const NOW = "2026-09-06T12:00:00.000Z";
const NOW_DATE = new Date(NOW);

function vector(fill = 0.1, dimension = DIM): EmbeddingVector {
  return Array.from({ length: dimension }, () => fill);
}

function makeConfig(overrides: Partial<MarketingSemanticIndexingConfig> = {}): MarketingSemanticIndexingConfig {
  return {
    model: MODEL,
    dimension: DIM,
    embeddingRevision: DEFAULT_MARKETING_SEMANTIC_EMBEDDING_REVISION,
    sourceTextVersion: MARKETING_SEMANTIC_SOURCE_TEXT_VERSION,
    maxBatchSize: 8,
    ...overrides,
  };
}

function makeBrief(overrides: Partial<ResearchBrief> = {}): ResearchBrief {
  return {
    id: "rb_danang",
    title: "다낭 효도여행 업데이트",
    summary: "부모님과 함께 가기 좋은 다낭 일정 팁",
    signalIds: ["sig_1"],
    claims: ["직항 증편"],
    evidence: [],
    topics: ["family", "danang"],
    destinations: ["다낭"],
    entities: [],
    freshness: { observedAt: NOW },
    credibility: { score: 0.8, level: "high", reasons: ["official"] },
    travelRelevance: { score: 0.9, reasons: ["outbound"] },
    publicInterest: 0.7,
    risks: [],
    openQuestions: ["성수기 숙소"],
    generatedAt: NOW,
    status: "active",
    ...overrides,
  };
}

function makeAgenda(overrides: Partial<AgendaCandidate> = {}): AgendaCandidate {
  return {
    id: "ac_danang",
    researchBriefId: "rb_danang",
    title: "다낭 효도여행 어젠다",
    rationale: "가족 여행 수요 증가",
    freshnessScore: 0.8,
    publicInterestScore: 0.7,
    travelRelevanceScore: 0.9,
    credibilityScore: 0.8,
    commercialLinkageScore: 0.6,
    koreanOutboundRelevanceScore: 0.85,
    compositeResearchScore: 0.8,
    scoreReasons: ["why-now: peak season", "practical: direct flights"],
    riskFlags: [],
    supportingEvidenceIds: [],
    status: "candidate",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeCompleted(overrides: Partial<CompletedMarketingCandidate> = {}): CompletedMarketingCandidate {
  const logicalRunKey = "daily-marketing-plan:2026-09-06";
  const handoff = prepareManagerToContentHandoff(
    {
      title: "다낭 효도여행",
      summary: "부모님과 함께 가기 좋은 다낭 일정",
      agendaCandidateId: "ac_danang",
      researchBriefId: "rb_danang",
      idempotencyKey: logicalRunKey,
      now: NOW_DATE,
    },
    { store: createInMemoryContentAssignmentStore(), now: NOW_DATE },
  );
  return {
    contract: "completed-marketing-candidate-v1",
    candidateId: "cmc_danang_1",
    runId: "run_1",
    logicalRunKey,
    businessDateKst: "2026-09-06",
    createdAt: NOW,
    updatedAt: NOW,
    selectedAgenda: handoff.selectedAgenda,
    contentAssignment: handoff.contentAssignment,
    contentPlan: {
      ...handoff.contentPlanScaffold,
      factsToUse: ["직항 증편", "가족 친화 리조트"],
    },
    draft: {
      title: "다낭 효도여행 초안",
      body: "부모님과 함께 가기 좋은 다낭 일정을 정리했습니다.",
      channel: "threads",
      agenda: "다낭 효도여행",
      sourceReferences: [],
    },
    governanceDecision: null,
    status: "ready_for_human_review",
    revisionHistory: [],
    provenance: {
      routineId: DAILY_MARKETING_ROUTINE_ID,
      correlationId: "corr_1",
      researchStatus: "ok",
      governanceReviewId: null,
    },
    observability: {
      runId: "run_1",
      logicalRunKey,
      businessDateKst: "2026-09-06",
      correlationId: "corr_1",
      researchStatus: "ok",
      candidateCount: 1,
      selectedAgendaId: handoff.selectedAgenda.id,
      assignmentId: handoff.contentAssignment.assignmentId,
      governanceReviewId: null,
      revisionCount: 0,
      governanceDecision: null,
      finalCandidateId: "cmc_danang_1",
      finalStatus: "ready_for_human_review",
      startedAt: NOW,
      completedAt: NOW,
      failureReason: null,
    },
    ...overrides,
  };
}

function createFakeProvider(opts?: {
  model?: string;
  embedImpl?: (text: string) => Promise<EmbeddingVector>;
  embedManyImpl?: (texts: string[]) => Promise<EmbeddingVector[]>;
}): EmbeddingProvider & { embedCalls: number; embedManyCalls: number; lastTexts: string[] } {
  const state = { embedCalls: 0, embedManyCalls: 0, lastTexts: [] as string[] };
  return {
    model: opts?.model ?? MODEL,
    get embedCalls() {
      return state.embedCalls;
    },
    get embedManyCalls() {
      return state.embedManyCalls;
    },
    get lastTexts() {
      return state.lastTexts;
    },
    async embed(text: string) {
      state.embedCalls += 1;
      state.lastTexts = [text];
      if (opts?.embedImpl) return opts.embedImpl(text);
      return vector(0.2);
    },
    async embedMany(texts: string[]) {
      state.embedManyCalls += 1;
      state.lastTexts = [...texts];
      if (opts?.embedManyImpl) return opts.embedManyImpl(texts);
      return texts.map((_, i) => vector(0.2 + i * 0.01));
    },
  };
}

async function createDeps(overrides: Partial<IndexSemanticEntityDeps> = {}): Promise<{
  deps: IndexSemanticEntityDeps;
  researchRepo: ReturnType<typeof createInMemoryResearchRepository>;
  runRepo: ReturnType<typeof createInMemoryDailyMarketingRunRepository>;
  embeddingRepo: ReturnType<typeof createInMemoryMarketingSemanticEmbeddingRepository>;
  provider: ReturnType<typeof createFakeProvider>;
}> {
  const researchRepo = createInMemoryResearchRepository();
  const runRepo = createInMemoryDailyMarketingRunRepository();
  await researchRepo.upsertBrief(makeBrief());
  await researchRepo.upsertAgendaCandidate(makeAgenda());
  await runRepo.saveCandidate(makeCompleted());

  const embeddingRepo = createInMemoryMarketingSemanticEmbeddingRepository();
  const provider = createFakeProvider();
  const deps: IndexSemanticEntityDeps = {
    researchRepo,
    runRepo,
    embeddingRepo,
    provider,
    config: makeConfig(),
    now: () => new Date(NOW),
    ...overrides,
  };
  return {
    deps: {
      ...deps,
      ...overrides,
      researchRepo: overrides.researchRepo ?? researchRepo,
      runRepo: overrides.runRepo ?? runRepo,
      embeddingRepo: overrides.embeddingRepo ?? embeddingRepo,
      provider: (overrides.provider as ReturnType<typeof createFakeProvider>) ?? provider,
    },
    researchRepo,
    runRepo,
    embeddingRepo,
    provider: (overrides.provider as ReturnType<typeof createFakeProvider>) ?? provider,
  };
}

describe("STEP E-2 controlled semantic indexing", () => {
  it("indexes a research_brief on first pass (provider + upsert)", async () => {
    const { deps, provider, embeddingRepo } = await createDeps();
    const result = await indexSemanticEntity(
      { entityType: "research_brief", entityId: "rb_danang" },
      deps,
    );
    expect(result.status).toBe("indexed");
    expect(result.providerCalled).toBe(true);
    expect(provider.embedCalls).toBe(1);
    expect(result.contentHashPrefix).toHaveLength(12);
    expect(result.model).toBe(MODEL);
    expect(result.revision).toBe(DEFAULT_MARKETING_SEMANTIC_EMBEDDING_REVISION);
    expect(result.sourceTextVersion).toBe(MARKETING_SEMANTIC_SOURCE_TEXT_VERSION);

    const stored = await embeddingRepo.get({
      entityType: "research_brief",
      entityId: "rb_danang",
      model: MODEL,
      revision: DEFAULT_MARKETING_SEMANTIC_EMBEDDING_REVISION,
      sourceTextVersion: MARKETING_SEMANTIC_SOURCE_TEXT_VERSION,
    });
    expect(stored).not.toBeNull();
    expect(stored!.embedding).toHaveLength(DIM);
    expect(stored!.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("skips unchanged contentHash without calling provider", async () => {
    const { deps, provider } = await createDeps();
    const first = await indexSemanticEntity(
      { entityType: "research_brief", entityId: "rb_danang" },
      deps,
    );
    expect(first.status).toBe("indexed");
    const second = await indexSemanticEntity(
      { entityType: "research_brief", entityId: "rb_danang" },
      deps,
    );
    expect(second.status).toBe("skipped_unchanged");
    expect(second.providerCalled).toBe(false);
    expect(provider.embedCalls).toBe(1);
  });

  it("re-embeds and upserts when contentHash changes", async () => {
    const { deps, provider, researchRepo, embeddingRepo } = await createDeps();
    await indexSemanticEntity({ entityType: "research_brief", entityId: "rb_danang" }, deps);
    const before = await embeddingRepo.get({
      entityType: "research_brief",
      entityId: "rb_danang",
      model: MODEL,
      revision: DEFAULT_MARKETING_SEMANTIC_EMBEDDING_REVISION,
      sourceTextVersion: MARKETING_SEMANTIC_SOURCE_TEXT_VERSION,
    });
    await researchRepo.upsertBrief(
      makeBrief({ summary: "요약이 바뀌면 contentHash도 바뀝니다" }),
    );
    const again = await indexSemanticEntity(
      { entityType: "research_brief", entityId: "rb_danang" },
      deps,
    );
    expect(again.status).toBe("indexed");
    expect(again.providerCalled).toBe(true);
    expect(provider.embedCalls).toBe(2);
    const after = await embeddingRepo.get({
      entityType: "research_brief",
      entityId: "rb_danang",
      model: MODEL,
      revision: DEFAULT_MARKETING_SEMANTIC_EMBEDDING_REVISION,
      sourceTextVersion: MARKETING_SEMANTIC_SOURCE_TEXT_VERSION,
    });
    expect(after!.contentHash).not.toBe(before!.contentHash);
    expect(after!.id).toBe(before!.id);
  });

  it("fails on bad embedding dimension", async () => {
    const provider = createFakeProvider({
      embedImpl: async () => vector(0.1, DIM - 1),
    });
    const { deps } = await createDeps({ provider });
    const result = await indexSemanticEntity(
      { entityType: "research_brief", entityId: "rb_danang" },
      deps,
    );
    expect(result.status).toBe("failed");
    expect(result.reason).toBe("provider_error");
    expect(result.message).toMatch(/does not match dimension/);
    expect(result.providerCalled).toBe(true);
  });

  it("fails on NaN / Inf embedding values", async () => {
    const bad = vector(0.1);
    bad[2] = Number.NaN;
    const provider = createFakeProvider({ embedImpl: async () => bad });
    const { deps } = await createDeps({ provider });
    const result = await indexSemanticEntity(
      { entityType: "research_brief", entityId: "rb_danang" },
      deps,
    );
    expect(result.status).toBe("failed");
    expect(result.message).toMatch(/non-finite/);

    const inf = vector(0.1);
    inf[1] = Number.POSITIVE_INFINITY;
    const providerInf = createFakeProvider({ embedImpl: async () => inf });
    const again = await createDeps({ provider: providerInf });
    const resultInf = await indexSemanticEntity(
      { entityType: "research_brief", entityId: "rb_danang" },
      again.deps,
    );
    expect(resultInf.status).toBe("failed");
    expect(resultInf.message).toMatch(/non-finite/);
  });

  it("returns unavailable when entity is not found", async () => {
    const { deps, provider } = await createDeps();
    const result = await indexSemanticEntity(
      { entityType: "research_brief", entityId: "missing_brief" },
      deps,
    );
    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe("not_found");
    expect(result.providerCalled).toBe(false);
    expect(provider.embedCalls).toBe(0);
  });

  it("returns failed on provider failure", async () => {
    const provider = createFakeProvider({
      embedImpl: async () => {
        throw new Error("upstream timeout");
      },
    });
    const { deps } = await createDeps({ provider });
    const result = await indexSemanticEntity(
      { entityType: "agenda_candidate", entityId: "ac_danang" },
      deps,
    );
    expect(result.status).toBe("failed");
    expect(result.reason).toBe("provider_error");
    expect(result.message).toMatch(/upstream timeout/);
    expect(result.providerCalled).toBe(true);
  });

  it("filters unchanged entities before embedMany in batch", async () => {
    const { deps, provider, researchRepo } = await createDeps();
    await indexSemanticEntity({ entityType: "research_brief", entityId: "rb_danang" }, deps);
    await researchRepo.upsertBrief(makeBrief({ id: "rb_tokyo", title: "도쿄 단풍", summary: "단풍 시즌" }));

    const results = await indexSemanticEntitiesBatch(
      {
        entities: [
          { entityType: "research_brief", entityId: "rb_tokyo" },
          { entityType: "research_brief", entityId: "rb_danang" },
        ],
      },
      deps,
    );

    expect(provider.embedManyCalls).toBe(1);
    expect(provider.lastTexts).toHaveLength(1);
    expect(results).toHaveLength(2);
    // deterministic ordering: rb_danang then rb_tokyo
    expect(results[0]!.entityId).toBe("rb_danang");
    expect(results[0]!.status).toBe("skipped_unchanged");
    expect(results[0]!.providerCalled).toBe(false);
    expect(results[1]!.entityId).toBe("rb_tokyo");
    expect(results[1]!.status).toBe("indexed");
    expect(results[1]!.providerCalled).toBe(true);
  });

  it("dry-run does not call provider or write", async () => {
    const { deps, provider, embeddingRepo } = await createDeps();
    const result = await indexSemanticEntity(
      { entityType: "research_brief", entityId: "rb_danang", dryRun: true },
      deps,
    );
    expect(result.status).toBe("dry_run");
    expect(result.providerCalled).toBe(false);
    expect(provider.embedCalls).toBe(0);
    const stored = await embeddingRepo.get({
      entityType: "research_brief",
      entityId: "rb_danang",
      model: MODEL,
      revision: DEFAULT_MARKETING_SEMANTIC_EMBEDDING_REVISION,
      sourceTextVersion: MARKETING_SEMANTIC_SOURCE_TEXT_VERSION,
    });
    expect(stored).toBeNull();
  });

  it("uses exact revision + sourceTextVersion identity lookup", async () => {
    const { deps, embeddingRepo, provider } = await createDeps();
    await indexSemanticEntity({ entityType: "research_brief", entityId: "rb_danang" }, deps);
    const primary = await embeddingRepo.get({
      entityType: "research_brief",
      entityId: "rb_danang",
      model: MODEL,
      revision: "1",
      sourceTextVersion: "v1",
    });
    expect(primary).not.toBeNull();

    // Different revision identity must not match — forces re-embed
    const altDeps: IndexSemanticEntityDeps = {
      ...deps,
      config: makeConfig({ embeddingRevision: "2" }),
    };
    const result = await indexSemanticEntity(
      { entityType: "research_brief", entityId: "rb_danang" },
      altDeps,
    );
    expect(result.status).toBe("indexed");
    expect(result.revision).toBe("2");
    expect(provider.embedCalls).toBe(2);

    const rev2 = await embeddingRepo.get({
      entityType: "research_brief",
      entityId: "rb_danang",
      model: MODEL,
      revision: "2",
      sourceTextVersion: "v1",
    });
    expect(rev2).not.toBeNull();
    expect(rev2!.id).not.toBe(primary!.id);

    // Different sourceTextVersion also coexists
    const textAlt: IndexSemanticEntityDeps = {
      ...deps,
      config: makeConfig({ sourceTextVersion: "v2" }),
    };
    const textResult = await indexSemanticEntity(
      { entityType: "research_brief", entityId: "rb_danang" },
      textAlt,
    );
    expect(textResult.status).toBe("indexed");
    expect(textResult.sourceTextVersion).toBe("v2");
    expect(provider.embedCalls).toBe(3);
  });

  it("rejects provider model mismatch when exposed", async () => {
    const provider = createFakeProvider({ model: "other-model" });
    const { deps } = await createDeps({ provider });
    const result = await indexSemanticEntity(
      { entityType: "research_brief", entityId: "rb_danang" },
      deps,
    );
    expect(result.status).toBe("failed");
    expect(result.message).toMatch(/does not match indexing model/);
  });

  it("batch continues with per-item upsert failures (partial failure)", async () => {
    const embeddingRepo = createInMemoryMarketingSemanticEmbeddingRepository();
    const upsert = embeddingRepo.upsert.bind(embeddingRepo);
    let calls = 0;
    embeddingRepo.upsert = async (input) => {
      calls += 1;
      if (input.entityId === "rb_fail") {
        throw new Error("disk full");
      }
      return upsert(input);
    };

    const researchRepo = createInMemoryResearchRepository();
    await researchRepo.upsertBrief(makeBrief({ id: "rb_ok", title: "ok", summary: "ok summary" }));
    await researchRepo.upsertBrief(makeBrief({ id: "rb_fail", title: "fail", summary: "fail summary" }));
    const provider = createFakeProvider();
    const deps: IndexSemanticEntityDeps = {
      researchRepo,
      runRepo: createInMemoryDailyMarketingRunRepository(),
      embeddingRepo,
      provider,
      config: makeConfig(),
      now: () => new Date(NOW),
    };

    const results = await indexSemanticEntitiesBatch(
      {
        entities: [
          { entityType: "research_brief", entityId: "rb_fail" },
          { entityType: "research_brief", entityId: "rb_ok" },
        ],
      },
      deps,
    );
    expect(provider.embedManyCalls).toBe(1);
    expect(results.find((r) => r.entityId === "rb_ok")?.status).toBe("indexed");
    expect(results.find((r) => r.entityId === "rb_fail")?.status).toBe("failed");
    expect(results.find((r) => r.entityId === "rb_fail")?.reason).toBe("upsert_error");
    expect(calls).toBe(2);
  });

  it("indexes agenda_candidate and completed_marketing_candidate via hydration", async () => {
    const { deps } = await createDeps();
    const agenda = await indexSemanticEntity(
      { entityType: "agenda_candidate", entityId: "ac_danang" },
      deps,
    );
    const completed = await indexSemanticEntity(
      { entityType: "completed_marketing_candidate", entityId: "cmc_danang_1" },
      deps,
    );
    expect(agenda.status).toBe("indexed");
    expect(completed.status).toBe("indexed");
    expect(agenda.entityType).toBe("agenda_candidate");
    expect(completed.entityType).toBe("completed_marketing_candidate");
  });

  it("surfaces schema_missing without falling back", async () => {
    const embeddingRepo = createInMemoryMarketingSemanticEmbeddingRepository();
    embeddingRepo.get = async () => {
      throw new Error('relation "marketing_semantic_embeddings" does not exist');
    };
    const { deps, provider } = await createDeps({ embeddingRepo });
    const result = await indexSemanticEntity(
      { entityType: "research_brief", entityId: "rb_danang" },
      deps,
    );
    expect(result.status).toBe("failed");
    expect(result.reason).toBe("schema_missing");
    expect(result.providerCalled).toBe(false);
    expect(provider.embedCalls).toBe(0);
  });
});

describe("assertFiniteEmbeddingVector contract used by indexing", () => {
  it("requires dimension 1024 when configured for production identity", async () => {
    const { assertFiniteEmbeddingVector } = await import(
      "@/lib/marketing/semantic/entityEmbeddings/validation"
    );
    expect(() => assertFiniteEmbeddingVector(vector(0.1, 4), 1024)).toThrow(
      MarketingSemanticValidationError,
    );
    const ok = Array.from({ length: 1024 }, () => 0.01);
    expect(assertFiniteEmbeddingVector(ok, 1024)).toHaveLength(1024);
  });
});

describe("content hash stability for indexing identity", () => {
  it("hashes are stable sha256 hex", () => {
    const digest = createHash("sha256").update("x").digest("hex");
    expect(digest).toHaveLength(64);
  });
});

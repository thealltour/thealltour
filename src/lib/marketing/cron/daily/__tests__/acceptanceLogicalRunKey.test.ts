vi.mock("server-only", () => ({}));

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, beforeEach } from "vitest";

import {
  ACCEPTANCE_LOGICAL_RUN_KEY_PREFIX,
  assertAcceptanceLogicalRunKey,
  resolveAgendaSlateLogicalRunKey,
} from "@/lib/marketing/cron/daily/acceptanceLogicalRunKey";
import { buildLogicalDailyRunKey } from "@/lib/marketing/cron/daily/kstBusinessDate";
import { runDailyMarketingAgendaSlate } from "@/lib/marketing/cron/daily/runDailyMarketingAgendaSlate";
import {
  createInMemoryDailyAgendaSlateRepository,
  resetDefaultDailyAgendaSlateRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyAgendaSlateRepository";
import {
  createInMemoryDailyMarketingRunRepository,
  resetDefaultDailyMarketingRunRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import {
  agendaCandidate,
  buildResearchContext,
  NOW,
  PRODUCT,
  researchBrief,
  officialEvidence,
} from "@/lib/marketing/cron/daily/__tests__/fixtures";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import { DAILY_MARKETING_ROUTINE_ID } from "@/lib/marketing/cron/daily/types";

const BUSINESS_DATE = "2026-09-04";
const PRODUCTION_KEY = `daily-marketing-plan:${BUSINESS_DATE}`;
const ACCEPTANCE_KEY = `daily-marketing-plan:acceptance:${BUSINESS_DATE}:agenda-v1`;
const ACCEPTANCE_KEY_B = `daily-marketing-plan:acceptance:${BUSINESS_DATE}:agenda-v1-b`;

function multiCandidateContext(count = 6) {
  const agendaCandidates: CompactManagerAgendaCandidate[] = Array.from({ length: count }, (_, i) => ({
    ...agendaCandidate,
    agendaCandidateId: `ac-accept-${i + 1}`,
    researchBriefId: `rb-accept-${i + 1}`,
    title: `Acceptance topic ${i + 1}`,
    summary: `Summary for acceptance topic ${i + 1} with enough detail.`,
    totalResearchScore: 0.9 - i * 0.05,
    evidence: [
      {
        ...officialEvidence,
        evidenceId: `ev-accept-${i + 1}`,
        url: `https://example.com/articles/accept-${i + 1}`,
        excerpt: `Summary for acceptance topic ${i + 1} with enough detail.`,
      },
    ],
  }));
  return buildResearchContext({
    agendaCandidates,
    briefs: agendaCandidates.map((c) => ({
      ...researchBrief,
      researchBriefId: c.researchBriefId,
      title: c.title,
      summary: c.summary,
      evidence: c.evidence,
    })),
  });
}

describe("acceptance logicalRunKey override", () => {
  beforeEach(() => {
    resetDefaultDailyMarketingRunRepository();
    resetDefaultDailyAgendaSlateRepository();
  });

  it("A: no override -> production daily key", () => {
    expect(
      resolveAgendaSlateLogicalRunKey({ businessDateKst: BUSINESS_DATE }),
    ).toBe(PRODUCTION_KEY);
    expect(
      buildLogicalDailyRunKey({
        routineId: DAILY_MARKETING_ROUTINE_ID,
        businessDateKst: BUSINESS_DATE,
      }),
    ).toBe(PRODUCTION_KEY);
  });

  it("B: acceptance override keeps same businessDate identity in key payload", () => {
    expect(
      resolveAgendaSlateLogicalRunKey({
        businessDateKst: BUSINESS_DATE,
        logicalRunKey: ACCEPTANCE_KEY,
      }),
    ).toBe(ACCEPTANCE_KEY);
    expect(ACCEPTANCE_KEY.startsWith(ACCEPTANCE_LOGICAL_RUN_KEY_PREFIX)).toBe(true);
  });

  it("C: production and acceptance runs do not collide", async () => {
    const repo = createInMemoryDailyMarketingRunRepository();
    const slateRepo = createInMemoryDailyAgendaSlateRepository();
    const research = multiCandidateContext();

    const production = await runDailyMarketingAgendaSlate(
      {
        productId: PRODUCT,
        channel: "threads",
        businessDateKst: BUSINESS_DATE,
      },
      {
        repo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => research,
      },
    );
    const acceptance = await runDailyMarketingAgendaSlate(
      {
        productId: PRODUCT,
        channel: "threads",
        businessDateKst: BUSINESS_DATE,
        logicalRunKey: ACCEPTANCE_KEY,
      },
      {
        repo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => research,
      },
    );

    expect(production.idempotent).toBe(false);
    expect(acceptance.idempotent).toBe(false);
    expect(production.run.logicalRunKey).toBe(PRODUCTION_KEY);
    expect(acceptance.run.logicalRunKey).toBe(ACCEPTANCE_KEY);
    expect(production.run.businessDateKst).toBe(BUSINESS_DATE);
    expect(acceptance.run.businessDateKst).toBe(BUSINESS_DATE);
    expect(production.slate?.slateId).not.toBe(acceptance.slate?.slateId);
    expect(await slateRepo.findByLogicalKey(PRODUCTION_KEY)).not.toBeNull();
    expect(await slateRepo.findByLogicalKey(ACCEPTANCE_KEY)).not.toBeNull();
  });

  it("D: same acceptance key rerun is idempotent", async () => {
    const repo = createInMemoryDailyMarketingRunRepository();
    const slateRepo = createInMemoryDailyAgendaSlateRepository();
    const research = multiCandidateContext();
    const deps = {
      repo,
      slateRepo,
      now: NOW,
      getResearchContext: async () => research,
    };
    const input = {
      productId: PRODUCT,
      channel: "threads",
      businessDateKst: BUSINESS_DATE,
      logicalRunKey: ACCEPTANCE_KEY,
    };

    const first = await runDailyMarketingAgendaSlate(input, deps);
    const second = await runDailyMarketingAgendaSlate(input, deps);

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(second.run.logicalRunKey).toBe(ACCEPTANCE_KEY);
    expect(second.slate?.slateId).toBe(first.slate?.slateId);
  });

  it("E: different acceptance key is a distinct manual run", async () => {
    const repo = createInMemoryDailyMarketingRunRepository();
    const slateRepo = createInMemoryDailyAgendaSlateRepository();
    const research = multiCandidateContext();
    const deps = {
      repo,
      slateRepo,
      now: NOW,
      getResearchContext: async () => research,
    };

    const a = await runDailyMarketingAgendaSlate(
      {
        productId: PRODUCT,
        channel: "threads",
        businessDateKst: BUSINESS_DATE,
        logicalRunKey: ACCEPTANCE_KEY,
      },
      deps,
    );
    const b = await runDailyMarketingAgendaSlate(
      {
        productId: PRODUCT,
        channel: "threads",
        businessDateKst: BUSINESS_DATE,
        logicalRunKey: ACCEPTANCE_KEY_B,
      },
      deps,
    );

    expect(a.idempotent).toBe(false);
    expect(b.idempotent).toBe(false);
    expect(a.run.logicalRunKey).toBe(ACCEPTANCE_KEY);
    expect(b.run.logicalRunKey).toBe(ACCEPTANCE_KEY_B);
    expect(a.slate?.slateId).not.toBe(b.slate?.slateId);
  });

  it("F: businessDate-based research/cooldown logic is unchanged by override", async () => {
    const repo = createInMemoryDailyMarketingRunRepository();
    const slateRepo = createInMemoryDailyAgendaSlateRepository();
    const research = multiCandidateContext();

    const priorHandoff = prepareManagerToContentHandoff(
      {
        title: "Acceptance topic 1",
        summary: "Summary for acceptance topic 1 with enough detail.",
        agendaCandidateId: "ac-accept-1",
        researchBriefId: "rb-accept-1",
        evidenceRefs: [
          {
            evidenceId: "ev-accept-1",
            sourceId: "src",
            sourceType: "news",
            sourceName: "Press",
            isOfficial: false,
            evidenceType: "article",
            url: "https://example.com/articles/accept-1",
            reference: null,
            excerpt: "Summary for acceptance topic 1 with enough detail.",
            publishedAt: "2026-09-01T00:00:00.000Z",
            observedAt: NOW.toISOString(),
            credibilityHint: 0.7,
          },
        ],
        idempotencyKey: "daily-marketing-plan:2026-09-01",
        now: NOW,
      },
      { store: createInMemoryContentAssignmentStore(), now: NOW },
    );
    await repo.saveCandidate({
      contract: "completed-marketing-candidate-v1",
      candidateId: "cmc_prior_accept",
      runId: "run_prior_accept",
      logicalRunKey: "daily-marketing-plan:2026-09-01",
      businessDateKst: "2026-09-01",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      selectedAgenda: priorHandoff.selectedAgenda,
      contentAssignment: priorHandoff.contentAssignment,
      contentPlan: priorHandoff.contentPlanScaffold,
      draft: {
        title: "Acceptance topic 1",
        body: "body",
        channel: "threads",
        agenda: "Acceptance topic 1",
        sourceReferences: ["evidence:ev-accept-1"],
      },
      governanceDecision: null,
      status: "ready_for_human_review",
      revisionHistory: [],
      provenance: {
        routineId: DAILY_MARKETING_ROUTINE_ID,
        correlationId: "corr",
        researchStatus: "ok",
        governanceReviewId: null,
      },
      observability: {
        runId: "run_prior_accept",
        logicalRunKey: "daily-marketing-plan:2026-09-01",
        businessDateKst: "2026-09-01",
        correlationId: "corr",
        researchStatus: "ok",
        candidateCount: 1,
        selectedAgendaId: priorHandoff.selectedAgenda.id,
        assignmentId: priorHandoff.contentAssignment.assignmentId,
        governanceReviewId: null,
        revisionCount: 0,
        governanceDecision: null,
        finalCandidateId: null,
        finalStatus: null,
        startedAt: NOW.toISOString(),
        completedAt: NOW.toISOString(),
        failureReason: null,
      },
    });

    const cooledId = "ac-accept-1";
    const production = await runDailyMarketingAgendaSlate(
      {
        productId: PRODUCT,
        channel: "threads",
        businessDateKst: BUSINESS_DATE,
      },
      {
        repo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => research,
      },
    );
    const acceptance = await runDailyMarketingAgendaSlate(
      {
        productId: PRODUCT,
        channel: "threads",
        businessDateKst: BUSINESS_DATE,
        logicalRunKey: ACCEPTANCE_KEY,
      },
      {
        repo,
        slateRepo,
        now: NOW,
        getResearchContext: async () => research,
      },
    );

    const prodExcluded = production.run.metadata?.researchIdentityCooldown as {
      excludedAgendaCandidateIds?: string[];
    };
    const acceptExcluded = acceptance.run.metadata?.researchIdentityCooldown as {
      excludedAgendaCandidateIds?: string[];
    };
    expect(prodExcluded.excludedAgendaCandidateIds).toContain(cooledId);
    expect(acceptExcluded.excludedAgendaCandidateIds).toContain(cooledId);
    expect(acceptExcluded.excludedAgendaCandidateIds).toEqual(
      prodExcluded.excludedAgendaCandidateIds,
    );
    expect(production.slate?.candidates.some((c) => c.agendaCandidateId === cooledId)).toBe(
      false,
    );
    expect(acceptance.slate?.candidates.some((c) => c.agendaCandidateId === cooledId)).toBe(
      false,
    );
    expect(acceptance.run.businessDateKst).toBe(BUSINESS_DATE);
  });

  it("G: invalid/non-acceptance override is rejected", () => {
    expect(() => assertAcceptanceLogicalRunKey(PRODUCTION_KEY)).toThrow(
      /impersonate the production daily/,
    );
    expect(() =>
      assertAcceptanceLogicalRunKey(
        "daily-marketing-production:2026-09-04:aaaaaaaaaaaaaaaaaaaaaaaa",
      ),
    ).toThrow(/impersonate a production selection/);
    expect(() => assertAcceptanceLogicalRunKey("daily-marketing-plan:other:x")).toThrow(
      /must start with/,
    );
    expect(() => assertAcceptanceLogicalRunKey("daily-marketing-plan:acceptance:bad key")).toThrow(
      /invalid characters/,
    );
    expect(() => assertAcceptanceLogicalRunKey("")).toThrow(/non-empty/);
    expect(() =>
      resolveAgendaSlateLogicalRunKey({
        businessDateKst: BUSINESS_DATE,
        logicalRunKey: PRODUCTION_KEY,
      }),
    ).toThrow(/impersonate the production daily/);
  });

  it("H: cron script without acceptance arg keeps production default wiring", () => {
    const cronPath = join(
      process.cwd(),
      "scripts/cron-daily-marketing-plan.ts",
    );
    const source = readFileSync(cronPath, "utf8");
    expect(source).toContain('--acceptance-run-key');
    expect(source).toContain("assertAcceptanceLogicalRunKey");
    // Default path still builds the historical daily key.
    expect(source).toContain("buildLogicalDailyRunKey");
    // Override is only spread into the slate input when present.
    expect(source).toContain(
      "...(acceptanceLogicalRunKey ? { logicalRunKey: acceptanceLogicalRunKey } : {})",
    );
  });
});

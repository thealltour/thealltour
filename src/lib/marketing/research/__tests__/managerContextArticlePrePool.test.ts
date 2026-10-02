import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { signalFixture } from "@/lib/marketing/research/__tests__/semanticCalibrationFixtures";
import { MVP_RESEARCH_SOURCES } from "@/lib/marketing/research/collectors/config";
import { getMarketingManagerResearchContext } from "@/lib/marketing/research/manager/getMarketingManagerResearchContext";
import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import {
  createInMemoryResearchRepository,
  type InMemoryResearchRepository,
} from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import { buildAgendaCandidateFromBrief } from "@/lib/marketing/research/services/agendaCandidateBuilder";
import { buildResearchBriefFromCluster } from "@/lib/marketing/research/services/briefBuilder";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

const NOW = new Date("2026-09-02T12:00:00.000Z");
const SOURCES: ResearchSource[] = MVP_RESEARCH_SOURCES.map((s) => ({
  ...s,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
}));
const DESTINATIONS = ["japan", "spain", "france", "italy", "vietnam", "thailand", "peru", "kenya"];

function uuid(group: number, n: number): string {
  return `${group.toString(16).padStart(8, "0")}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3600_000).toISOString();
}

type ArticleSpec = { article: number; rows: number; score: number; createdAtHoursAgo?: number };

let rowSeq = 0;

async function seed(specs: ArticleSpec[]): Promise<InMemoryResearchRepository> {
  const repo = createInMemoryResearchRepository(SOURCES);
  const sources = new Map(SOURCES.map((s) => [s.id, s]));
  for (const spec of specs) {
    const source = SOURCES[spec.article % SOURCES.length]!;
    const destination = DESTINATIONS[spec.article % DESTINATIONS.length]!;
    const signal = await repo.upsertSignal(
      signalFixture({
        id: uuid(1, spec.article),
        title: `${destination} travel update ${spec.article}`,
        summary: `Travel update ${spec.article} for ${destination}.`,
        signalType: "general_travel_news",
        sourceId: source.id,
        sourceType: source.sourceType,
        destinations: [destination],
        canonicalUrl: `https://news.example/${spec.article}`,
        rawFingerprint: `article-${spec.article}`,
        normalizedFingerprint: `article-${spec.article}-n`,
        evidence: [
          {
            id: `ev-${spec.article}`,
            sourceId: source.id,
            url: `https://news.example/${spec.article}`,
            excerpt: `Travel update ${spec.article}.`,
            observedAt: NOW.toISOString(),
            evidenceType: "direct_source",
          },
        ],
      }),
    );
    for (let i = 0; i < spec.rows; i += 1) {
      rowSeq += 1;
      const brief = buildResearchBriefFromCluster({
        cluster: {
          id: uuid(2, rowSeq),
          primarySignalId: signal.id,
          signalIds: [signal.id],
          clusterType: "destination_group",
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
        },
        signals: [signal],
        sources,
        now: NOW,
      })!;
      await repo.upsertBrief(brief);
      const createdAt = hoursAgo((spec.createdAtHoursAgo ?? 1) + i * 0.01);
      await repo.upsertAgendaCandidate({
        ...buildAgendaCandidateFromBrief(brief, NOW),
        id: uuid(3, rowSeq),
        compositeResearchScore: spec.score,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }
  return repo;
}

/** Same data, but without the paging methods → legacy top-N row read. */
function legacyView(repo: InMemoryResearchRepository): ResearchRepository {
  const view = Object.create(repo) as ResearchRepository;
  Object.assign(view, {
    findRecentAgendaCandidatesPage: undefined,
    findAgendaCandidateArticleRefs: undefined,
  });
  return view;
}

const deps = (repo: ResearchRepository) => ({
  repo,
  now: NOW,
  checkSemanticInfrastructure: async () => true,
});

describe("MM research context unique-article pre-pool", () => {
  it("keeps lower-scored distinct articles that a duplicate-saturated top-180 used to crowd out", async () => {
    const repo = await seed([
      { article: 1, rows: 200, score: 0.99 },
      { article: 2, rows: 1, score: 0.5 },
      { article: 3, rows: 1, score: 0.5 },
      { article: 4, rows: 1, score: 0.5 },
      { article: 5, rows: 1, score: 0.5 },
    ]);

    const legacy = await getMarketingManagerResearchContext({}, deps(legacyView(repo)));
    const context = await getMarketingManagerResearchContext({}, deps(repo));

    expect(legacy.agendaCandidates).toHaveLength(1);
    expect(context.agendaCandidates).toHaveLength(5);
    expect(context.observability.articlePrePool).toMatchObject({
      mode: "unique_article_pages",
      targetUniqueArticles: 180,
      uniqueArticleCandidates: 5,
      duplicateRowsDropped: 199,
      fetchedCandidateRows: 204,
      pagesRead: 1,
      lookbackExhausted: true,
      maxPagesReached: false,
    });
  });

  it("produces the same downstream rank/diversify output as the legacy read when rows are unique", async () => {
    const repo = await seed(
      Array.from({ length: 24 }, (_, i) => ({ article: 100 + i, rows: 1, score: 0.4 + i * 0.02 })),
    );
    for (const limit of [5, 18]) {
      const legacy = await getMarketingManagerResearchContext({ limit }, deps(legacyView(repo)));
      const context = await getMarketingManagerResearchContext({ limit }, deps(repo));
      expect(context.agendaCandidates.map((c) => c.agendaCandidateId)).toEqual(
        legacy.agendaCandidates.map((c) => c.agendaCandidateId),
      );
      expect(context.agendaCandidates.map((c) => c.totalResearchScore)).toEqual(
        legacy.agendaCandidates.map((c) => c.totalResearchScore),
      );
      expect(context.notes).toEqual(legacy.notes);
      expect(context.observability.articlePrePool?.duplicateRowsDropped).toBe(0);
    }
  });

  it("keeps the 168h lookback window", async () => {
    const repo = await seed([
      { article: 200, rows: 1, score: 0.6, createdAtHoursAgo: 2 },
      { article: 201, rows: 1, score: 0.99, createdAtHoursAgo: 169 },
    ]);
    const context = await getMarketingManagerResearchContext({}, deps(repo));
    expect(context.window.lookbackHours).toBe(168);
    expect(context.window.since).toBe(hoursAgo(168));
    expect(context.agendaCandidates.map((c) => c.title)).toEqual([
      expect.stringContaining("update 200"),
    ]);
  });

  it("keeps max(limit*10, 180) as the unique-article target with clamped limits", async () => {
    const repo = await seed([{ article: 300, rows: 1, score: 0.6 }]);
    const target = async (limit?: number) =>
      (await getMarketingManagerResearchContext({ limit }, deps(repo))).observability.articlePrePool
        ?.targetUniqueArticles;
    expect(await target()).toBe(180);
    expect(await target(5)).toBe(180);
    expect(await target(20)).toBe(200);
    expect(await target(99)).toBe(280);
  });

  it("does not mutate research rows while building the context", async () => {
    const repo = await seed([
      { article: 400, rows: 3, score: 0.8 },
      { article: 401, rows: 1, score: 0.7 },
    ]);
    const writes = [
      vi.spyOn(repo, "upsertAgendaCandidate"),
      vi.spyOn(repo, "deleteAgendaCandidateById"),
      vi.spyOn(repo, "upsertBrief"),
      vi.spyOn(repo, "deleteBriefById"),
      vi.spyOn(repo, "upsertSignal"),
      vi.spyOn(repo, "deleteSignalById"),
      vi.spyOn(repo, "upsertSource"),
    ];
    const before = await repo.findRecentAgendaCandidates({ since: hoursAgo(168), limit: 1000 });

    await getMarketingManagerResearchContext({}, deps(repo));

    for (const spy of writes) expect(spy).not.toHaveBeenCalled();
    const after = await repo.findRecentAgendaCandidates({ since: hoursAgo(168), limit: 1000 });
    expect(after).toEqual(before);
    expect(after).toHaveLength(4);
  });
});

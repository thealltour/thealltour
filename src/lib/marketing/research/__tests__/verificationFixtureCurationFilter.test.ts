vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import { STEP_3_9_VERIFICATION_PURPOSE } from "@/lib/marketing/operations/verification";
import { PERFORMANCE_MEMORY_SOURCE_ID } from "@/lib/marketing/performance/constants";
import { signalFixture } from "@/lib/marketing/research/__tests__/semanticCalibrationFixtures";
import { MVP_RESEARCH_SOURCES } from "@/lib/marketing/research/collectors/config";
import {
  hasVerificationBracketTitleMarker,
  isVerificationResearchArtifact,
} from "@/lib/marketing/research/manager/isVerificationResearchArtifact";
import { getMarketingManagerResearchContext } from "@/lib/marketing/research/manager/getMarketingManagerResearchContext";
import {
  buildAgendaCandidateFromBrief,
  rankAgendaCandidates,
} from "@/lib/marketing/research/services/agendaCandidateBuilder";
import { buildResearchBriefFromCluster } from "@/lib/marketing/research/services/briefBuilder";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import {
  computeSemanticDemotion,
  resolveDemotionAmount,
  resolveSemanticBand,
} from "@/lib/marketing/cron/daily/semanticSoftDemotion";
import { computeCorroborationSignals } from "@/lib/marketing/cron/daily/semanticSoftDemotion/corroboration";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import type { EmbeddingVector } from "@/lib/marketing/semantic/types";

const NOW = new Date("2026-09-04T12:00:00.000Z");

function unit(values: number[]): EmbeddingVector {
  const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0)) || 1;
  return values.map((v) => v / norm);
}

async function seedMixedPool() {
  const repo = createInMemoryResearchRepository();
  const sources: ResearchSource[] = MVP_RESEARCH_SOURCES.map((s) => ({
    ...s,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  }));
  // Ensure Performance Analyst Memory source exists without treating all of it as fixture.
  sources.push({
    id: PERFORMANCE_MEMORY_SOURCE_ID,
    sourceType: "performance_memory",
    name: "Performance Analyst Memory",
    authorityLevel: "primary",
    defaultCredibility: 0.75,
    language: "ko",
    isOfficial: false,
    isEnabled: true,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  });
  for (const source of sources) {
    await repo.upsertSource(source);
  }

  const travie = signalFixture({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
    title: "후지산과 예술 섬 [일본 소도시 이야기 ①]",
    summary: "Travie series article about a Japanese town.",
    signalType: "general_travel_news",
    destinations: ["japan"],
    topics: ["travel"],
    sourceId: MVP_RESEARCH_SOURCES.find((s) => /travie/i.test(s.name))?.id ?? MVP_RESEARCH_SOURCES[1]!.id,
    sourceType: "news",
    rawFingerprint: "travie-1",
    normalizedFingerprint: "travie-1-n",
  });

  const travelDaily = signalFixture({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01",
    title: "티웨이항공 간판 내린다 트리니티항공 데뷔",
    summary: "TravelDaily airline rebrand coverage.",
    signalType: "general_travel_news",
    destinations: ["korea"],
    topics: ["airline"],
    sourceId: MVP_RESEARCH_SOURCES[1]!.id,
    sourceType: "news",
    rawFingerprint: "td-1",
    normalizedFingerprint: "td-1-n",
  });

  const nyt = signalFixture({
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccc01",
    title: "After floods, Grand Canyon opens on a limited basis",
    summary: "NYT travel update.",
    signalType: "general_travel_news",
    destinations: ["grand-canyon"],
    topics: ["safety"],
    sourceId: MVP_RESEARCH_SOURCES[1]!.id,
    sourceType: "news",
    rawFingerprint: "nyt-1",
    normalizedFingerprint: "nyt-1-n",
  });

  const vn = signalFixture({
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddd01",
    title: "Enjoy early autumn in northern Vietnam",
    summary: "VN Tourism autumn escapes.",
    signalType: "destination_update",
    destinations: ["vietnam"],
    topics: ["festival"],
    sourceId: MVP_RESEARCH_SOURCES[1]!.id,
    sourceType: "rss",
    rawFingerprint: "vn-1",
    normalizedFingerprint: "vn-1-n",
  });

  const fcdo = signalFixture({
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01",
    title: "Indonesia",
    summary: "FCDO Indonesia travel advice.",
    signalType: "safety",
    destinations: ["indonesia"],
    sourceId: MVP_RESEARCH_SOURCES[0]!.id,
    sourceType: "official_government",
    rawFingerprint: "fcdo-1",
    normalizedFingerprint: "fcdo-1-n",
  });

  // Legitimate performance memory — NOT a STEP 3-x verification fixture.
  const legitPerf = signalFixture({
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff01",
    title: "Performance: Japan autumn engagement sample",
    summary: "channel=threads\ncontentOrigin=human_edited\ncollectionStatus=success",
    signalType: "content_performance",
    destinations: ["japan"],
    topics: ["performance", "threads"],
    sourceId: PERFORMANCE_MEMORY_SOURCE_ID,
    sourceType: "performance_memory",
    rawFingerprint: "perf-legit",
    normalizedFingerprint: "perf-legit-n",
    metadata: {
      snapshotId: "snap-legit-1",
      candidateId: "cmc_real_production_candidate",
      reviewId: "hmr_real_production_review",
      advisoryOnly: true,
      contentOrigin: "human_edited",
    },
  });

  // Known verification artifact (metadata path — same as leaked production rows).
  const verifSignal = signalFixture({
    id: "11111111-1111-4111-8111-111111111901",
    title: "performance: [verification] step 3-9 performance feedback wiring",
    summary: "channel=threads\ncontentOrigin=human_edited",
    signalType: "content_performance",
    destinations: ["japan"],
    topics: ["performance", "threads"],
    sourceId: PERFORMANCE_MEMORY_SOURCE_ID,
    sourceType: "performance_memory",
    rawFingerprint: "perf-verif",
    normalizedFingerprint: "perf-verif-n",
    metadata: {
      purpose: STEP_3_9_VERIFICATION_PURPOSE,
      reviewId: "hmr_step_3_9_verification",
      snapshotId: "snap-verif-1",
      candidateId: "cmc_step_3_9_verification",
      advisoryOnly: true,
      logicalObservationKey: "step-3-9-verification:2026-09-02:obs-1",
    },
  });

  // Ordinary travel title that happens to mention verification (no bracket marker, no fixture metadata).
  const ordinaryVerificationWord = signalFixture({
    id: "22222222-2222-4222-8222-222222222901",
    title: "Visa verification checklist for outbound travelers",
    summary: "Practical checklist; not a fixture.",
    signalType: "visa_entry",
    destinations: ["japan"],
    topics: ["visa"],
    sourceId: MVP_RESEARCH_SOURCES[1]!.id,
    sourceType: "news",
    rawFingerprint: "visa-verif-word",
    normalizedFingerprint: "visa-verif-word-n",
  });

  const signals = [
    travie,
    travelDaily,
    nyt,
    vn,
    fcdo,
    legitPerf,
    verifSignal,
    ordinaryVerificationWord,
  ];
  for (const signal of signals) {
    await repo.upsertSignal(signal);
  }

  const briefs = [];
  for (const [i, signal] of signals.entries()) {
    const brief = buildResearchBriefFromCluster({
      cluster: {
        id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa${String(i).padStart(2, "0")}`,
        primarySignalId: signal.id,
        signalIds: [signal.id],
        clusterType: "event",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
      signals: [signal],
      sources: new Map(sources.map((s) => [s.id, s])),
      now: NOW,
    })!;
    await repo.upsertBrief(brief);
    briefs.push(brief);
  }

  const candidates = rankAgendaCandidates(briefs.map((b) => buildAgendaCandidateFromBrief(b, NOW)));
  for (const candidate of candidates) {
    await repo.upsertAgendaCandidate(candidate);
  }

  return {
    repo,
    briefs,
    verifBriefId: briefs[6]!.id,
    legitPerfBriefId: briefs[5]!.id,
    ordinaryWordBriefId: briefs[7]!.id,
    preservedTitles: [
      travie.title,
      travelDaily.title,
      nyt.title,
      vn.title,
      fcdo.title,
      legitPerf.title,
      ordinaryVerificationWord.title,
    ],
  };
}

describe("STEP E-4G verification fixture curation filter", () => {
  it("helper: bracket marker is narrow; bare verification word is not", () => {
    expect(hasVerificationBracketTitleMarker("performance: [verification] step 3-9")).toBe(true);
    expect(hasVerificationBracketTitleMarker("[VERIFICATION] Japan autumn update")).toBe(true);
    expect(hasVerificationBracketTitleMarker("Visa verification checklist")).toBe(false);
    expect(
      isVerificationResearchArtifact({
        title: "Visa verification checklist",
        signal: null,
      }),
    ).toBe(false);
  });

  it("excludes known verification ResearchBrief; preserves real sources + legit performance", async () => {
    const seeded = await seedMixedPool();
    const context = await getMarketingManagerResearchContext(
      { limit: 18, lookbackHours: 168 },
      { repo: seeded.repo, now: NOW, checkSemanticInfrastructure: async () => true },
    );

    expect(context.status).toBe("ok");
    expect(context.notes.some((n) => n.startsWith("verification_fixture_excluded:"))).toBe(true);

    const titles = context.agendaCandidates.map((c) => c.title.toLowerCase());
    expect(titles.some((t) => t.includes("[verification]"))).toBe(false);
    expect(context.agendaCandidates.some((c) => c.researchBriefId === seeded.verifBriefId)).toBe(
      false,
    );

    for (const title of seeded.preservedTitles) {
      expect(context.agendaCandidates.some((c) => c.title === title)).toBe(true);
    }
    expect(context.agendaCandidates.some((c) => c.researchBriefId === seeded.legitPerfBriefId)).toBe(
      true,
    );
    expect(
      context.agendaCandidates.some((c) => c.researchBriefId === seeded.ordinaryWordBriefId),
    ).toBe(true);
  });

  it("Agenda curation still works when verification artifacts are present in DB", async () => {
    const seeded = await seedMixedPool();
    const context = await getMarketingManagerResearchContext(
      { limit: 8 },
      { repo: seeded.repo, now: NOW, checkSemanticInfrastructure: async () => false },
    );
    expect(context.agendaCandidates.length).toBeGreaterThan(0);
    expect(context.agendaCandidates.length).toBeLessThanOrEqual(8);
    expect(context.degradedState?.semanticInfrastructureAvailable).toBe(false);
  });

  it("does not change semantic demotion policy (content gate still applies)", () => {
    const a: CompactManagerAgendaCandidate = {
      agendaCandidateId: "ac_a",
      researchBriefId: "rb_a",
      title: "chasing gold vietnam september escapes",
      summary: "a",
      destinations: ["vietnam"],
      topics: ["festival"],
      entities: [],
      signalTypes: [],
      publishedAt: "2026-08-01T00:00:00.000Z",
      observedAt: "2026-08-01T00:00:00.000Z",
      freshnessScore: 0.8,
      credibilityScore: 0.8,
      travelRelevanceScore: 0.8,
      publicInterestScore: 0.7,
      commercialRelevanceScore: 0.5,
      seasonalityScore: 0.5,
      corroborationScore: 0.5,
      noveltyScore: 0.5,
      koreanOutboundRelevanceScore: 0.7,
      totalResearchScore: 0.9,
      researchScoreComponents: null,
      scoreReasons: [],
      riskFlags: [],
      matchedProductIds: [],
      evidence: [
        {
          evidenceId: "e1",
          sourceId: "vn",
          sourceType: "rss",
          sourceName: "VN Tourism",
          isOfficial: false,
          evidenceType: "article",
          url: "https://vn.example/a",
          reference: null,
          excerpt: null,
          publishedAt: "2026-08-01T00:00:00.000Z",
          observedAt: "2026-08-01T00:00:00.000Z",
        },
      ],
      candidateStatus: "candidate",
    };
    const b = {
      ...a,
      agendaCandidateId: "ac_b",
      researchBriefId: "rb_b",
      title: "enjoy early autumn northern vietnam hills",
      topics: ["nature"],
      totalResearchScore: 0.85,
      publishedAt: "2026-09-04T00:00:00.000Z",
      evidence: [
        {
          ...a.evidence[0]!,
          evidenceId: "e2",
          url: "https://vn.example/b",
        },
      ],
    };
    const breakdown = computeCorroborationSignals(a, b);
    expect(breakdown.hasContentCorroboration).toBe(false);
    expect(
      resolveDemotionAmount({
        band: resolveSemanticBand(0.727),
        breakdown,
      }).amount,
    ).toBe(0);

    const e0 = unit([1, 0, 0, 0, 0, 0, 0, 0]);
    const e1 = unit([0.727, Math.sqrt(1 - 0.727 ** 2), 0, 0, 0, 0, 0, 0]);
    const report = computeSemanticDemotion({
      candidates: [a, b],
      embeddingsByBriefId: new Map([
        ["rb_a", e0],
        ["rb_b", e1],
      ]),
    });
    expect(report.decisions.find((d) => d.agendaCandidateId === "ac_b")!.demotionAmount).toBe(0);
  });
});

vi.mock("server-only", () => ({}));

import { describe, expect, it, vi } from "vitest";

import {
  buildManagerAgendaSlateCurationPrompt,
  buildManagerAgendaSlateFormatRepairPrompt,
  parseManagerAgendaSlateCuration,
} from "@/lib/marketing/cron/daily/agendaSlate/curateManagerAgendaSlate";
import { buildDailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/buildDailyAgendaSlate";
import { runDailyMarketingAgendaSlate } from "@/lib/marketing/cron/daily/runDailyMarketingAgendaSlate";
import { createInMemoryDailyAgendaSlateRepository } from "@/lib/marketing/cron/daily/repository/createDailyAgendaSlateRepository";
import { createInMemoryDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import {
  agendaCandidate,
  buildResearchContext,
  NOW,
  officialEvidence,
  PRODUCT,
} from "@/lib/marketing/cron/daily/__tests__/fixtures";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";

const DAY = "2026-09-05";

function context(titles: string[]) {
  const agendaCandidates: CompactManagerAgendaCandidate[] = titles.map((title, i) => ({
    ...agendaCandidate,
    agendaCandidateId: `ac-ko-${i + 1}`,
    researchBriefId: `rb-ko-${i + 1}`,
    title,
    summary: `${title} summary`,
    totalResearchScore: 0.9 - i * 0.05,
    evidence: [
      {
        ...officialEvidence,
        evidenceId: `ev-ko-${i + 1}`,
        url: `https://example.com/ko/${i + 1}`,
      },
    ],
  }));
  return buildResearchContext({ agendaCandidates, briefs: [] });
}

const ENGLISH_TITLES = Array.from({ length: 6 }, (_, i) => `Japan rail pass update ${i + 1}`);

function curateJson(withKo: boolean) {
  return JSON.stringify({
    decision: "curate",
    managerMessage: null,
    items: ENGLISH_TITLES.map((_, i) => ({
      agendaCandidateId: `ac-ko-${i + 1}`,
      researchBriefId: `rb-ko-${i + 1}`,
      ...(withKo ? { titleKo: `일본 철도 패스 변경 ${i + 1}`, summaryKo: `일본 철도 패스 요금이 바뀝니다 ${i + 1}.` } : {}),
      rationale: ["한국 출국 여행자에게 실용적"],
      recommendedFormats: ["threads_text"],
      recommendedChannel: "threads",
    })),
  });
}

describe("agenda slate Korean display fields", () => {
  it("asks MM for titleKo/summaryKo in both the curation and repair prompts", () => {
    const ctx = context(ENGLISH_TITLES);
    for (const prompt of [
      buildManagerAgendaSlateCurationPrompt(ctx, 6),
      buildManagerAgendaSlateFormatRepairPrompt(ctx, 6, null),
    ]) {
      expect(prompt).toContain("titleKo");
      expect(prompt).toContain("summaryKo");
      expect(prompt).toContain("Korean");
    }
  });

  it("parses titleKo/summaryKo and leaves them null when omitted", () => {
    const ctx = context(ENGLISH_TITLES);
    const withKo = parseManagerAgendaSlateCuration(curateJson(true), ctx, 6);
    expect(withKo.outcome).toBe("curated");
    if (withKo.outcome !== "curated") return;
    expect(withKo.items[0]).toMatchObject({
      title: "Japan rail pass update 1",
      titleKo: "일본 철도 패스 변경 1",
      summaryKo: "일본 철도 패스 요금이 바뀝니다 1.",
    });

    const withoutKo = parseManagerAgendaSlateCuration(curateJson(false), ctx, 6);
    if (withoutKo.outcome !== "curated") throw new Error("expected curated");
    expect(withoutKo.items[0]?.titleKo).toBeNull();
    expect(withoutKo.items[0]?.summaryKo).toBeNull();
  });

  it("stores Korean display fields on the slate while keeping the source title", async () => {
    const result = await runDailyMarketingAgendaSlate(
      { productId: PRODUCT, channel: "threads", businessDateKst: DAY },
      {
        repo: createInMemoryDailyMarketingRunRepository(),
        slateRepo: createInMemoryDailyAgendaSlateRepository(),
        now: NOW,
        getResearchContext: async () => context(ENGLISH_TITLES),
        invokeManagerProfile: async () => curateJson(true),
      },
    );
    expect(result.slate?.curation.mode).toBe("manager_curated");
    const first = result.slate!.candidates.find((c) => c.agendaCandidateId === "ac-ko-1");
    expect(first).toMatchObject({
      title: "Japan rail pass update 1",
      titleKo: "일본 철도 패스 변경 1",
      summaryKo: "일본 철도 패스 요금이 바뀝니다 1.",
    });
  });

  it("deterministic fallback reuses Korean source text and leaves other languages null", () => {
    const slate = buildDailyAgendaSlate({
      research: context(["오사카 간사이 공항 입국 심사 변경", "Bangkok airport rail link closure"]),
      logicalRunKey: `daily-marketing-plan:${DAY}`,
      businessDateKst: DAY,
      runId: "run",
      correlationId: "corr",
      now: NOW,
    });
    const korean = slate.candidates.find((c) => c.agendaCandidateId === "ac-ko-1");
    const english = slate.candidates.find((c) => c.agendaCandidateId === "ac-ko-2");
    expect(korean?.titleKo).toBe("오사카 간사이 공항 입국 심사 변경");
    expect(english?.titleKo).toBeNull();
    expect(english?.title).toBe("Bangkok airport rail link closure");
  });
});

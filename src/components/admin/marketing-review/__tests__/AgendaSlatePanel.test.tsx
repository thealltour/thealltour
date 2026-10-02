/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/marketing-review",
}));

import {
  AgendaSlatePanel,
  agendaSlateItemDisplayText,
} from "@/components/admin/marketing-review/AgendaSlatePanel";
import { buildDailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/buildDailyAgendaSlate";
import type { DailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/types";
import { agendaCandidate, buildResearchContext, NOW } from "@/lib/marketing/cron/daily/__tests__/fixtures";

const DAY = "2026-09-05";

function slateWithOneItem(): DailyAgendaSlate {
  const slate = buildDailyAgendaSlate({
    research: buildResearchContext({ agendaCandidates: [agendaCandidate], briefs: [] }),
    logicalRunKey: `daily-marketing-plan:${DAY}`,
    businessDateKst: DAY,
    runId: "run",
    correlationId: "corr",
    now: NOW,
  });
  const item = {
    ...slate.candidates[0]!,
    titleKo: "일본 가을 여행 안내 변경",
    summaryKo: "가을 여행자를 위한 공식 안내가 바뀌었습니다.",
  };
  return { ...slate, candidates: [item] };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("agendaSlateItemDisplayText", () => {
  it("prefers Korean fields and keeps the differing source title as secondary text", () => {
    expect(
      agendaSlateItemDisplayText({ title: "Japan update", summary: "en", titleKo: "일본 소식", summaryKo: "한국어" }),
    ).toEqual({ displayTitle: "일본 소식", sourceTitle: "Japan update", displaySummary: "한국어" });
    expect(
      agendaSlateItemDisplayText({ title: "오사카 소식", summary: "요약", titleKo: "오사카 소식", summaryKo: null }),
    ).toEqual({ displayTitle: "오사카 소식", sourceTitle: null, displaySummary: "요약" });
    expect(agendaSlateItemDisplayText({ title: "Japan update", summary: "en" })).toEqual({
      displayTitle: "Japan update",
      sourceTitle: null,
      displaySummary: "en",
    });
  });
});

describe("AgendaSlatePanel", () => {
  it("shows the Korean title with the source title and posts keep_in_pool", async () => {
    const slate = slateWithOneItem();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (init?.method === "POST") {
          const kept = { ...slate, candidates: [{ ...slate.candidates[0]!, state: "KEPT_IN_POOL" as const }] };
          return Response.json({ slate: kept, selectedTodayCount: 0 });
        }
        return Response.json({
          slate,
          productionRequests: [],
          selectedTodayCount: 0,
          todayBusinessDateKst: DAY,
          recentDays: [],
        });
      }),
    );

    render(<AgendaSlatePanel />);

    expect(await screen.findByRole("heading", { name: "일본 가을 여행 안내 변경" })).toBeTruthy();
    expect(screen.getByText("원문: Japan autumn travel update")).toBeTruthy();
    expect(screen.getByText("가을 여행자를 위한 공식 안내가 바뀌었습니다.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "내일로 넘기기" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "풀에 남기기" }));
    await waitFor(() => expect(calls.some((c) => c.init?.method === "POST")).toBe(true));
    const post = calls.find((c) => c.init?.method === "POST")!;
    expect(post.url).toContain(`/agenda-slate/${slate.candidates[0]!.slateItemId}/action`);
    expect(JSON.parse(String(post.init?.body))).toMatchObject({ action: "keep_in_pool" });
    expect(await screen.findByText("풀 보관")).toBeTruthy();
  });
});

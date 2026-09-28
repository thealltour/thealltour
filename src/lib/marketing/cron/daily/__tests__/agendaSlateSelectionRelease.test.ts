vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import { readSelectionReleasedSlateItemIds } from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateActions";
import { createAgendaSlateService } from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateService";
import type { DailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/types";
import { createInMemoryDailyAgendaSlateRepository } from "@/lib/marketing/cron/daily/repository/createDailyAgendaSlateRepository";
import {
  buildQueuedProductionRequest,
  createInMemoryMarketingProductionRequestRepository,
  type MarketingProductionRequestRepository,
} from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import { makeSlate } from "@/lib/marketing/editorialDirector/__tests__/editorialFixtures";

const NOW = new Date("2026-09-15T03:00:00.000Z");
const DAY = "2026-09-15";

async function setup(count = 3) {
  const slateRepo = createInMemoryDailyAgendaSlateRepository();
  const slate = await slateRepo.saveSlate(makeSlate(count));
  const productionRequestRepo = createInMemoryMarketingProductionRequestRepository();
  const service = await createAgendaSlateService({ slateRepo, productionRequestRepo, now: NOW });
  return { slate, slateRepo, productionRequestRepo, service };
}

async function seedRequest(
  slate: DailyAgendaSlate,
  repo: MarketingProductionRequestRepository,
  index: number,
  patch: { completedCandidateId?: string | null; metadata?: Record<string, unknown> },
) {
  const candidate = slate.candidates[index]!;
  const { request } = await repo.enqueue(buildQueuedProductionRequest({ slate, candidate, now: NOW }));
  return repo.update({
    ...request,
    status: "COMPLETED",
    completedAt: NOW.toISOString(),
    completedCandidateId: patch.completedCandidateId ?? null,
    metadata: { ...request.metadata, ...(patch.metadata ?? {}) },
  });
}

const awaitingStory = { metadata: { productionOutcome: "awaiting_story_selection" } };

function stateOf(slate: DailyAgendaSlate | null, slateItemId: string) {
  return slate?.candidates.find((c) => c.slateItemId === slateItemId)?.state;
}

describe("agenda slate selection release", () => {
  it("keeps a released Story-waiting agenda unselected across reconcile", async () => {
    const { slate, productionRequestRepo, service } = await setup();
    const id = slate.candidates[0]!.slateItemId;
    await seedRequest(slate, productionRequestRepo, 0, awaitingStory);

    const restored = await service.reconcileTerminalSelections(DAY);
    expect(stateOf(restored, id)).toBe("SELECTED_TODAY");

    const released = await service.applyAction({ slateItemId: id, action: "reset_available", businessDateKst: DAY });
    expect(stateOf(released, id)).toBe("AVAILABLE");
    expect(readSelectionReleasedSlateItemIds(released).has(id)).toBe(true);

    const afterReconcile = await service.reconcileTerminalSelections(DAY);
    expect(stateOf(afterReconcile, id)).toBe("AVAILABLE");
    expect(afterReconcile?.observability.selectedTodayCount).toBe(0);
  });

  it("clears the release record on select_today and keeps the reselection", async () => {
    const { slate, productionRequestRepo, service } = await setup();
    const id = slate.candidates[0]!.slateItemId;
    await seedRequest(slate, productionRequestRepo, 0, awaitingStory);
    await service.reconcileTerminalSelections(DAY);
    await service.applyAction({ slateItemId: id, action: "reset_available", businessDateKst: DAY });

    const reselected = await service.applyAction({ slateItemId: id, action: "select_today", businessDateKst: DAY });
    expect(stateOf(reselected, id)).toBe("SELECTED_TODAY");
    expect(readSelectionReleasedSlateItemIds(reselected).has(id)).toBe(false);

    const afterReconcile = await service.reconcileTerminalSelections(DAY);
    expect(stateOf(afterReconcile, id)).toBe("SELECTED_TODAY");
  });

  it("releaseAllSelected unselects everything and blocks production requests", async () => {
    const { slate, productionRequestRepo, service } = await setup(4);
    const [a, b, c] = slate.candidates.map((x) => x.slateItemId);
    await seedRequest(slate, productionRequestRepo, 0, awaitingStory);
    await service.reconcileTerminalSelections(DAY);
    await service.applyAction({ slateItemId: b!, action: "select_today", businessDateKst: DAY });
    await service.applyAction({ slateItemId: c!, action: "select_today", businessDateKst: DAY });

    const result = await service.releaseAllSelected({ businessDateKst: DAY });
    expect(result.releasedCount).toBe(3);
    expect(result.slate.observability.selectedTodayCount).toBe(0);
    expect([...readSelectionReleasedSlateItemIds(result.slate)].sort()).toEqual([a, b, c].sort());

    const afterReconcile = await service.reconcileTerminalSelections(DAY);
    expect(afterReconcile?.observability.selectedTodayCount).toBe(0);
    await expect(service.requestProductionForSelected({ businessDateKst: DAY })).rejects.toMatchObject({
      code: "MIN_SELECTION",
    });

    const again = await service.releaseAllSelected({ businessDateKst: DAY });
    expect(again.releasedCount).toBe(0);
  });

  it("does not record a release when the system frees a finished production", async () => {
    const { slate, productionRequestRepo, service } = await setup();
    const id = slate.candidates[0]!.slateItemId;
    await service.applyAction({ slateItemId: id, action: "select_today", businessDateKst: DAY });
    await seedRequest(slate, productionRequestRepo, 0, { completedCandidateId: "cmc_done" });

    const reconciled = await service.reconcileTerminalSelections(DAY);
    expect(stateOf(reconciled, id)).toBe("AVAILABLE");
    expect(readSelectionReleasedSlateItemIds(reconciled!).size).toBe(0);
  });
});

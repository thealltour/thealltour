import { formatKstBusinessDate } from "@/lib/marketing/cron/daily/kstBusinessDate";
import {
  applyAgendaSlateAction,
  AgendaSlateActionError,
  listSelectedToday,
  reconcileSelectedTodayWithTerminalRequests,
} from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateActions";
import type { AgendaSlateAction, DailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/types";
import { MAX_SELECTED_TODAY } from "@/lib/marketing/cron/daily/agendaSlate/types";
import { buildLogicalDailyRunKey } from "@/lib/marketing/cron/daily/kstBusinessDate";
import { DAILY_MARKETING_ROUTINE_ID } from "@/lib/marketing/cron/daily/types";
import type { DailyAgendaSlateRepository } from "@/lib/marketing/cron/daily/repository/createDailyAgendaSlateRepository";
import {
  createDailyAgendaSlateRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyAgendaSlateRepository";
import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import type { MarketingProductionRequestRepository } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import {
  buildQueuedProductionRequest,
  createMarketingProductionRequestRepository,
} from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";

export class AgendaSlateServiceError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "AgendaSlateServiceError";
  }
}

export type AgendaSlateService = {
  getTodaySlate(businessDateKst?: string): Promise<DailyAgendaSlate | null>;
  listProductionRequests(businessDateKst?: string): Promise<MarketingProductionRequest[]>;
  applyAction(input: {
    slateItemId: string;
    action: AgendaSlateAction;
    businessDateKst?: string;
  }): Promise<DailyAgendaSlate>;
  requestProductionForSelected(input?: {
    businessDateKst?: string;
    slateItemIds?: string[];
    productId?: string | null;
  }): Promise<{
    slate: DailyAgendaSlate;
    requests: MarketingProductionRequest[];
    createdCount: number;
  }>;
  /** Drop SELECTED_TODAY for items whose production request is COMPLETED/FAILED. */
  reconcileTerminalSelections(businessDateKst?: string): Promise<DailyAgendaSlate | null>;
  /** Re-open a FAILED production request as QUEUED (same logical_run_key). */
  retryFailedProduction(input: {
    slateItemId?: string;
    logicalRunKey?: string;
    businessDateKst?: string;
  }): Promise<{
    slate: DailyAgendaSlate | null;
    request: MarketingProductionRequest;
  }>;
};

export async function createAgendaSlateService(deps: {
  slateRepo?: DailyAgendaSlateRepository;
  productionRequestRepo?: MarketingProductionRequestRepository;
  now?: Date;
} = {}): Promise<AgendaSlateService> {
  const now = deps.now ?? new Date();
  const slateRepo =
    deps.slateRepo ??
    (await createDailyAgendaSlateRepository(
      process.env.VITEST || process.env.NODE_ENV === "test" ? { backend: "memory" } : {},
    ));
  const productionRequestRepo =
    deps.productionRequestRepo ??
    (await createMarketingProductionRequestRepository(
      process.env.VITEST || process.env.NODE_ENV === "test" ? { backend: "memory" } : {},
    ));

  async function getTodaySlate(businessDateKst?: string): Promise<DailyAgendaSlate | null> {
    const date = businessDateKst ?? formatKstBusinessDate(now);
    const byDate = await slateRepo.findByBusinessDate(date);
    if (byDate) return byDate;
    const logicalRunKey = buildLogicalDailyRunKey({
      routineId: DAILY_MARKETING_ROUTINE_ID,
      businessDateKst: date,
    });
    return slateRepo.findByLogicalKey(logicalRunKey);
  }

  async function listProductionRequests(
    businessDateKst?: string,
  ): Promise<MarketingProductionRequest[]> {
    const date = businessDateKst ?? formatKstBusinessDate(now);
    return productionRequestRepo.listByBusinessDate(date);
  }

  async function applyAction(input: {
    slateItemId: string;
    action: AgendaSlateAction;
    businessDateKst?: string;
  }): Promise<DailyAgendaSlate> {
    const date = input.businessDateKst ?? formatKstBusinessDate(now);
    const slate = await getTodaySlate(date);
    if (!slate) {
      throw new AgendaSlateServiceError("slate not found", "SLATE_NOT_FOUND", 404);
    }
    try {
      const next = applyAgendaSlateAction({
        slate,
        slateItemId: input.slateItemId,
        action: input.action,
        expectedBusinessDateKst: date,
        now,
      });
      return slateRepo.updateSlate(next);
    } catch (error) {
      if (error instanceof AgendaSlateActionError) {
        const status =
          error.code === "NOT_FOUND"
            ? 404
            : error.code === "STALE_SLATE"
              ? 409
              : error.code === "MAX_SELECTED"
                ? 409
                : 400;
        throw new AgendaSlateServiceError(error.message, error.code, status);
      }
      throw error;
    }
  }

  async function requestProductionForSelected(input: {
    businessDateKst?: string;
    slateItemIds?: string[];
    productId?: string | null;
  } = {}): Promise<{
    slate: DailyAgendaSlate;
    requests: MarketingProductionRequest[];
    createdCount: number;
  }> {
    const date = input.businessDateKst ?? formatKstBusinessDate(now);
    const slate = await getTodaySlate(date);
    if (!slate) {
      throw new AgendaSlateServiceError("slate not found", "SLATE_NOT_FOUND", 404);
    }
    if (slate.businessDateKst !== date) {
      throw new AgendaSlateServiceError("stale slate", "STALE_SLATE", 409);
    }

    let selected = listSelectedToday(slate);
    if (input.slateItemIds?.length) {
      const wanted = new Set(input.slateItemIds);
      selected = selected.filter((c) => wanted.has(c.slateItemId));
    }
    if (selected.length < 1) {
      throw new AgendaSlateServiceError(
        "at least one SELECTED_TODAY required",
        "MIN_SELECTION",
        400,
      );
    }
    if (selected.length > MAX_SELECTED_TODAY) {
      throw new AgendaSlateServiceError(
        `maximum ${MAX_SELECTED_TODAY} selected`,
        "MAX_SELECTED",
        409,
      );
    }

    const requests: MarketingProductionRequest[] = [];
    let createdCount = 0;
    for (const candidate of selected) {
      const queued = buildQueuedProductionRequest({
        slate,
        candidate,
        now,
        productId: input.productId,
      });
      const result = await productionRequestRepo.enqueue(queued);
      requests.push(result.request);
      if (result.created) createdCount += 1;
    }

    return { slate, requests, createdCount };
  }

  async function reconcileTerminalSelections(
    businessDateKst?: string,
  ): Promise<DailyAgendaSlate | null> {
    const date = businessDateKst ?? formatKstBusinessDate(now);
    const slate = await getTodaySlate(date);
    if (!slate) return null;
    const requests = await productionRequestRepo.listByBusinessDate(date);
    const terminalSlateItemIds = new Set(
      requests
        .filter((r) => r.status === "COMPLETED" || r.status === "FAILED")
        .map((r) => r.slateItemId),
    );
    if (terminalSlateItemIds.size === 0) return slate;
    const { slate: next, releasedCount } = reconcileSelectedTodayWithTerminalRequests({
      slate,
      terminalSlateItemIds,
      expectedBusinessDateKst: date,
      now,
    });
    if (releasedCount === 0) return slate;
    return slateRepo.updateSlate(next);
  }

  async function retryFailedProduction(input: {
    slateItemId?: string;
    logicalRunKey?: string;
    businessDateKst?: string;
  }): Promise<{
    slate: DailyAgendaSlate | null;
    request: MarketingProductionRequest;
  }> {
    const date = input.businessDateKst ?? formatKstBusinessDate(now);
    const logicalRunKey = input.logicalRunKey?.trim() || null;
    const slateItemId = input.slateItemId?.trim() || null;
    if (!logicalRunKey && !slateItemId) {
      throw new AgendaSlateServiceError(
        "slateItemId or logicalRunKey required",
        "INVALID_PAYLOAD",
        400,
      );
    }

    let existing: MarketingProductionRequest | null = null;
    if (logicalRunKey) {
      existing = await productionRequestRepo.findByLogicalKey(logicalRunKey);
    } else if (slateItemId) {
      const rows = await productionRequestRepo.listByBusinessDate(date);
      existing = rows.find((r) => r.slateItemId === slateItemId) ?? null;
    }
    if (!existing) {
      throw new AgendaSlateServiceError(
        "production request not found",
        "PRODUCTION_REQUEST_NOT_FOUND",
        404,
      );
    }
    if (existing.status !== "FAILED") {
      throw new AgendaSlateServiceError(
        `retry requires FAILED status (got ${existing.status})`,
        "REQUEUE_REQUIRES_FAILED",
        409,
      );
    }

    let request: MarketingProductionRequest;
    try {
      request = await productionRequestRepo.requeueFailed({
        logicalRunKey: existing.logicalRunKey,
        now,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("REQUEUE_REQUIRES_FAILED:")) {
        throw new AgendaSlateServiceError(message, "REQUEUE_REQUIRES_FAILED", 409);
      }
      throw error;
    }

    const slate = await reconcileTerminalSelections(date);
    return { slate, request };
  }

  return {
    getTodaySlate,
    listProductionRequests,
    applyAction,
    requestProductionForSelected,
    reconcileTerminalSelections,
    retryFailedProduction,
  };
}

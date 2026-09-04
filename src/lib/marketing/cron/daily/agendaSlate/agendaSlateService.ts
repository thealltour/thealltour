import { formatKstBusinessDate } from "@/lib/marketing/cron/daily/kstBusinessDate";
import {
  applyAgendaSlateAction,
  AgendaSlateActionError,
  listSelectedToday,
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

  return {
    getTodaySlate,
    listProductionRequests,
    applyAction,
    requestProductionForSelected,
  };
}

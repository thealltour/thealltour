import { formatKstBusinessDate } from "@/lib/marketing/cron/daily/kstBusinessDate";
import {
  applyAgendaSlateAction,
  AgendaSlateActionError,
  listSelectedToday,
  reconcileSelectedTodayWithTerminalRequests,
  restoreSelectedTodayForAwaitingStory,
} from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateActions";
import type {
  AgendaSlateAction,
  AgendaSlateDaySummary,
  DailyAgendaSlate,
} from "@/lib/marketing/cron/daily/agendaSlate/types";
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
  /** Distinct recent business dates (newest first), preferring non-superseded rows. */
  listRecentDaySummaries(options?: { limit?: number }): Promise<AgendaSlateDaySummary[]>;
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
  selectStoryAndResumeProduction(input: {
    slateItemId?: string;
    logicalRunKey?: string;
    businessDateKst?: string;
    storyPointId: string;
  }): Promise<{
    slate: DailyAgendaSlate | null;
    request: MarketingProductionRequest;
  }>;
  buildChatGptSlateExport(input?: {
    businessDateKst?: string;
  }): Promise<{
    text: string;
    agendaCount: number;
    slate: DailyAgendaSlate;
  }>;
  importExternalEditorialStories(input: {
    businessDateKst?: string;
    rawJson: string;
    dryRun?: boolean;
  }): Promise<{
    slate: DailyAgendaSlate | null;
    request: MarketingProductionRequest | null;
    dryRun: boolean;
    preview: {
      agendaId: string;
      agendaTitle: string;
      storyCountAccepted: number;
      storyTitles: string[];
      rejectedCount: number;
      selectedAgendaReasonKo: string | null;
    };
    validationErrors?: string[];
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

  async function listRecentDaySummaries(
    options: { limit?: number } = {},
  ): Promise<AgendaSlateDaySummary[]> {
    const limit = Math.min(Math.max(options.limit ?? 21, 1), 60);
    // Fetch extra rows so superseded duplicates of the same date can be collapsed.
    const rows = await slateRepo.listRecent({ limit: limit * 3 });
    const bestByDate = new Map<string, DailyAgendaSlate>();
    for (const row of rows) {
      const prev = bestByDate.get(row.businessDateKst);
      if (!prev) {
        bestByDate.set(row.businessDateKst, row);
        continue;
      }
      const replace =
        (prev.status === "superseded" && row.status !== "superseded") ||
        (prev.status !== "superseded" && row.status === "superseded"
          ? false
          : row.updatedAt > prev.updatedAt);
      if (replace) bestByDate.set(row.businessDateKst, row);
    }
    return [...bestByDate.values()]
      .sort((a, b) => b.businessDateKst.localeCompare(a.businessDateKst))
      .slice(0, limit)
      .map((row) => ({
        businessDateKst: row.businessDateKst,
        status: row.status,
        candidateCount: row.candidates.length,
        selectedTodayCount: row.candidates.filter((c) => c.state === "SELECTED_TODAY").length,
        slateId: row.slateId,
      }));
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
        .filter((r) => {
          if (r.status !== "COMPLETED" && r.status !== "FAILED") return false;
          // Keep SELECTED_TODAY while human must pick a Story.
          if (r.metadata?.productionOutcome === "awaiting_story_selection") return false;
          return true;
        })
        .map((r) => r.slateItemId),
    );
    const awaitingStorySlateItemIds = new Set(
      requests
        .filter(
          (r) =>
            r.status === "COMPLETED" &&
            r.metadata?.productionOutcome === "awaiting_story_selection",
        )
        .map((r) => r.slateItemId),
    );

    let next = slate;
    let dirty = false;
    if (terminalSlateItemIds.size > 0) {
      const released = reconcileSelectedTodayWithTerminalRequests({
        slate: next,
        terminalSlateItemIds,
        expectedBusinessDateKst: date,
        now,
      });
      if (released.releasedCount > 0) {
        next = released.slate;
        dirty = true;
      }
    }
    if (awaitingStorySlateItemIds.size > 0) {
      const restored = restoreSelectedTodayForAwaitingStory({
        slate: next,
        awaitingStorySlateItemIds,
        expectedBusinessDateKst: date,
        now,
      });
      if (restored.restoredCount > 0) {
        next = restored.slate;
        dirty = true;
      }
    }
    if (!dirty) return slate;
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

  async function selectStoryAndResumeProduction(input: {
    slateItemId?: string;
    logicalRunKey?: string;
    businessDateKst?: string;
    storyPointId: string;
  }): Promise<{
    slate: DailyAgendaSlate | null;
    request: MarketingProductionRequest;
  }> {
    const {
      PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION,
      PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY,
      buildHumanStorySelection,
      getPassCandidatesFromRequest,
      isAwaitingStorySelection,
      readHumanStorySelection,
    } = await import("@/lib/marketing/storyPoint/humanStorySelection");
    const { readStoryPointCandidateSetFromProductionRequest } = await import(
      "@/lib/marketing/storyPoint/persistence"
    );

    const date = input.businessDateKst ?? formatKstBusinessDate(now);
    const logicalRunKey = input.logicalRunKey?.trim() || null;
    const slateItemId = input.slateItemId?.trim() || null;
    const storyPointId = input.storyPointId.trim();
    if (!logicalRunKey && !slateItemId) {
      throw new AgendaSlateServiceError(
        "slateItemId or logicalRunKey required",
        "INVALID_PAYLOAD",
        400,
      );
    }
    if (!storyPointId) {
      throw new AgendaSlateServiceError("storyPointId required", "INVALID_PAYLOAD", 400);
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
    if (!isAwaitingStorySelection(existing)) {
      throw new AgendaSlateServiceError(
        `story selection requires awaiting_story_selection (got ${existing.status}/${String(existing.metadata?.productionOutcome ?? "")})`,
        "STORY_SELECTION_NOT_AVAILABLE",
        409,
      );
    }

    const candidateSet = readStoryPointCandidateSetFromProductionRequest(existing);
    if (!candidateSet || candidateSet.outcome !== "pass") {
      throw new AgendaSlateServiceError(
        "story candidate set missing or not pass",
        "STORY_CANDIDATES_MISSING",
        409,
      );
    }
    const pass = getPassCandidatesFromRequest(existing);
    const hit = pass.find((p) => p.point.pointId === storyPointId);
    if (!hit) {
      throw new AgendaSlateServiceError(
        "storyPointId is not a PASS candidate",
        "STORY_CANDIDATE_NOT_PASS",
        400,
      );
    }
    const previous = readHumanStorySelection(existing);
    if (previous?.researchRejectedStoryPointIds?.includes(storyPointId)) {
      throw new AgendaSlateServiceError(
        "story already research-rejected; pick another PASS candidate",
        "STORY_RESEARCH_REJECTED",
        400,
      );
    }

    const selection = buildHumanStorySelection({
      point: hit.point,
      candidateSet,
      now,
      previous,
    });
    const stamped = await productionRequestRepo.update({
      ...existing,
      updatedAt: now.toISOString(),
      metadata: {
        ...existing.metadata,
        [PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY]: selection,
        productionOutcome: PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION,
        selectedStoryPointId: selection.selectedStoryPointId,
        selectedStoryPointHash: selection.selectedStoryPointHash,
      },
    });

    let request: MarketingProductionRequest;
    try {
      request = await productionRequestRepo.requeueAwaitingStorySelection({
        logicalRunKey: stamped.logicalRunKey,
        now,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AgendaSlateServiceError(message, "STORY_SELECTION_REQUEUE_FAILED", 409);
    }

    const slate = await reconcileTerminalSelections(date);
    return { slate, request };
  }

  async function buildChatGptSlateExport(input: {
    businessDateKst?: string;
  } = {}): Promise<{
    text: string;
    agendaCount: number;
    slate: DailyAgendaSlate;
  }> {
    const { buildEditorialDirectorClipboardText } = await import(
      "@/lib/marketing/editorialDirector/buildSlateExport"
    );
    const date = input.businessDateKst ?? formatKstBusinessDate(now);
    const slate = await getTodaySlate(date);
    if (!slate) {
      throw new AgendaSlateServiceError("agenda slate not found", "SLATE_NOT_FOUND", 404);
    }
    if (slate.candidates.length < 1) {
      throw new AgendaSlateServiceError("slate has no agendas", "SLATE_EMPTY", 400);
    }
    const built = buildEditorialDirectorClipboardText(slate, now);
    return { text: built.text, agendaCount: built.agendaCount, slate };
  }

  async function importExternalEditorialStories(input: {
    businessDateKst?: string;
    rawJson: string;
    dryRun?: boolean;
  }): Promise<{
    slate: DailyAgendaSlate | null;
    request: MarketingProductionRequest | null;
    dryRun: boolean;
    preview: {
      agendaId: string;
      agendaTitle: string;
      storyCountAccepted: number;
      storyTitles: string[];
      rejectedCount: number;
      selectedAgendaReasonKo: string | null;
    };
  }> {
    const { parseExternalEditorialDirectorPayload } = await import(
      "@/lib/marketing/editorialDirector/parseExternalPayload"
    );
    const { importExternalEditorialDirector } = await import(
      "@/lib/marketing/editorialDirector/importExternalStories"
    );
    const { normalizeAndGateExternalStories } = await import(
      "@/lib/marketing/editorialDirector/normalizeExternalStory"
    );
    const { deriveAgendaTopicIdentity } = await import(
      "@/lib/marketing/audienceResearch/topicIdentity/deriveTopicIdentity"
    );

    const date = input.businessDateKst ?? formatKstBusinessDate(now);
    const slate = await getTodaySlate(date);
    if (!slate) {
      throw new AgendaSlateServiceError("agenda slate not found", "SLATE_NOT_FOUND", 404);
    }

    const parsed = parseExternalEditorialDirectorPayload(input.rawJson);
    if (!parsed.ok) {
      throw new AgendaSlateServiceError(parsed.messageKo, parsed.code, 400);
    }

    const agendaId = parsed.payload.selectedAgenda.agendaId?.trim() ?? "";
    const slateItem =
      slate.candidates.find((c) => c.slateItemId === agendaId) ??
      slate.candidates.find((c) => c.agendaCandidateId === agendaId);
    if (!slateItem) {
      throw new AgendaSlateServiceError(
        `선택한 agendaId가 오늘 Slate에 없습니다: ${agendaId}`,
        "UNKNOWN_AGENDA",
        400,
      );
    }

    if (input.dryRun) {
      // Lightweight preview without persistence — reuse import path identity checks via normalize.
      const { createSelectedAgenda } = await import(
        "@/lib/marketing/content/createSelectedAgenda"
      );
      const selectedAgenda = createSelectedAgenda({
        title: slateItem.title,
        summary: slateItem.summary,
        destinations: slateItem.destinations,
        topics: slateItem.topics,
        entities: slateItem.entities,
        audienceHint: slateItem.audienceHint,
        agendaCandidateId: slateItem.agendaCandidateId,
        researchBriefId: slateItem.researchBriefId,
      });
      const identity = deriveAgendaTopicIdentity({
        selectedAgenda,
        assignment: null,
      });
      const gated = normalizeAndGateExternalStories({
        stories: parsed.payload.storyCandidates,
        agendaId: slateItem.slateItemId,
        identity,
      });
      const accepted = gated.filter((g) => g.accepted);
      return {
        slate,
        request: null,
        dryRun: true,
        preview: {
          agendaId: slateItem.slateItemId,
          agendaTitle: slateItem.title,
          storyCountAccepted: accepted.length,
          storyTitles: accepted.map(
            (a) => a.point.storyQuestion ?? a.point.storyClaim ?? a.externalStoryId,
          ),
          rejectedCount: gated.length - accepted.length,
          selectedAgendaReasonKo: parsed.payload.selectedAgenda.reasonKo,
        },
      };
    }

    try {
      const result = await importExternalEditorialDirector({
        slate,
        payload: parsed.payload,
        productionRequestRepo,
        now,
      });
      const nextSlate = await reconcileTerminalSelections(date);
      return {
        slate: nextSlate,
        request: result.request,
        dryRun: false,
        preview: {
          ...result.preview,
          selectedAgendaReasonKo: parsed.payload.selectedAgenda.reasonKo,
        },
      };
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code ?? "IMPORT_FAILED")
          : "IMPORT_FAILED";
      const status =
        error && typeof error === "object" && "status" in error
          ? Number((error as { status?: number }).status ?? 400)
          : 400;
      const message = error instanceof Error ? error.message : String(error);
      throw new AgendaSlateServiceError(message, code, status);
    }
  }

  return {
    getTodaySlate,
    listProductionRequests,
    listRecentDaySummaries,
    applyAction,
    requestProductionForSelected,
    reconcileTerminalSelections,
    retryFailedProduction,
    selectStoryAndResumeProduction,
    buildChatGptSlateExport,
    importExternalEditorialStories,
  };
}

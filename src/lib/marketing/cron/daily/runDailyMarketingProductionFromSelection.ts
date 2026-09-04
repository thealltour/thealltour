/**
 * Explicit downstream production entrypoint after human agenda selection.
 * Callable independently of the slate-only cron path.
 */
import type { CreateSelectedAgendaInput } from "@/lib/marketing/content/types";
import type {
  CompactManagerAgendaCandidate,
  CompactManagerResearchBrief,
} from "@/lib/marketing/research/manager/types";
import { buildProductionLogicalRunKey } from "@/lib/marketing/cron/daily/agendaSlate/productionLogicalRunKey";
import {
  runDailyMarketingProductionPipeline,
  type DailyMarketingPipelineDeps,
} from "@/lib/marketing/cron/daily/runDailyMarketingProductionPipeline";
import type {
  DailyMarketingPipelineInput,
  DailyMarketingPipelineResult,
} from "@/lib/marketing/cron/daily/types";
import type { ManagerAgendaResolution } from "@/lib/marketing/cron/daily/resolveMarketingManagerAgenda";
import { formatKstBusinessDate } from "@/lib/marketing/cron/daily/kstBusinessDate";

export type DailyMarketingProductionSelectionInput = DailyMarketingPipelineInput & {
  selection: CreateSelectedAgendaInput;
  researchCandidate?: CompactManagerAgendaCandidate | null;
  researchBrief?: CompactManagerResearchBrief | null;
  managerRationale?: string[];
  /** When false, keep historical daily logicalRunKey (default: derive per-selection key). */
  usePerSelectionLogicalRunKey?: boolean;
  canonicalArticleIds?: string[];
};

/**
 * Runs the legacy MM→CS→GA→candidate→human-review bootstrap path using an
 * explicit human (or test) selection instead of asking the manager to pick.
 */
export async function runDailyMarketingProductionFromSelection(
  input: DailyMarketingProductionSelectionInput,
  deps: DailyMarketingPipelineDeps,
): Promise<DailyMarketingPipelineResult> {
  const businessDateKst =
    input.businessDateKst ?? formatKstBusinessDate(deps.now ?? new Date());
  const usePerSelection = input.usePerSelectionLogicalRunKey !== false;
  const logicalRunKey =
    input.logicalRunKey?.trim() ||
    (usePerSelection
      ? buildProductionLogicalRunKey({
          businessDateKst,
          agendaCandidateId: input.selection.agendaCandidateId,
          researchBriefId: input.selection.researchBriefId,
          title: input.selection.title,
          canonicalArticleIds: input.canonicalArticleIds,
        })
      : undefined);

  const resolution: ManagerAgendaResolution = {
    outcome: "selected",
    input: input.selection,
    researchCandidate: input.researchCandidate ?? null,
    researchBrief: input.researchBrief ?? null,
    managerRationale: input.managerRationale ?? input.selection.rationale ?? [],
  };

  return runDailyMarketingProductionPipeline(
    {
      productId: input.productId,
      channel: input.channel,
      goal: input.goal,
      businessDateKst,
      correlationId: input.correlationId,
      executionAttempt: input.executionAttempt,
      recoveryMode: input.recoveryMode,
      performanceNote: input.performanceNote,
      memoryReferences: input.memoryReferences,
      logicalRunKey,
    },
    {
      ...deps,
      // Bypass research-time manager selection; still loads research for cooldown/context.
      selectManagerAgenda: async () => resolution,
    },
  );
}

/** @deprecated Prefer explicit naming; kept for existing call sites/tests. */
export { runDailyMarketingProductionPipeline as runDailyMarketingPipeline } from "@/lib/marketing/cron/daily/runDailyMarketingProductionPipeline";

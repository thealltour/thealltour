import { isAgendaQualityV2ShadowEnabled } from "@/lib/marketing/agendaQualityV2/shadow/config";
import {
  buildV1V2ComparisonReport,
  formatComparisonReportMarkdown,
  type AgendaQualityV2ComparisonReport,
  type V1SlateComparisonRow,
} from "@/lib/marketing/agendaQualityV2/shadow/comparisonReport";
import {
  createInMemoryDurableAgendaReservoir,
  createReservoirItemFromQualified,
  type DurableAgendaReservoirRepository,
  type AgendaReservoirItem,
} from "@/lib/marketing/agendaQualityV2/reservoir/types";
import {
  selectDailyAgendaSlateV2,
  type DailyAgendaSlateV2,
} from "@/lib/marketing/agendaQualityV2/slate/selectDailySlateV2";
import type { MarketingAgendaCandidateV2 } from "@/lib/marketing/agendaQualityV2/contracts";
import { markReservoirDeferred, markReservoirPresented } from "@/lib/marketing/agendaQualityV2/reservoir/transitions";

export type RunAgendaQualityV2ShadowPhase2Params = {
  businessDateKst: string;
  nowIso: string;
  newlyQualifiedCandidates: MarketingAgendaCandidateV2[];
  v1Slate?: V1SlateComparisonRow[];
  reservoir?: DurableAgendaReservoirRepository;
  /** When true, mark selected V2 as PRESENTED then DEFERRED (shadow lifecycle preview). */
  applyShadowLifecycle?: boolean;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
};

export type RunAgendaQualityV2ShadowPhase2Result =
  | { enabled: false; productionSlateUnchanged: true; report: null; slate: null }
  | {
      enabled: true;
      productionSlateUnchanged: true;
      slate: DailyAgendaSlateV2;
      comparison: AgendaQualityV2ComparisonReport;
      comparisonMarkdown: string;
      reservoir: DurableAgendaReservoirRepository;
    };

/**
 * Phase-2 shadow: score + memory-aware V2 slate + V1/V2 comparison.
 * Never mutates production V1 Slate.
 */
export async function runAgendaQualityV2ShadowPhase2(
  params: RunAgendaQualityV2ShadowPhase2Params,
): Promise<RunAgendaQualityV2ShadowPhase2Result> {
  if (!isAgendaQualityV2ShadowEnabled(params.env ?? process.env)) {
    return { enabled: false, productionSlateUnchanged: true, report: null, slate: null };
  }

  const reservoir = params.reservoir ?? createInMemoryDurableAgendaReservoir();

  const newlyQualified: AgendaReservoirItem[] = [];
  for (const candidate of params.newlyQualifiedCandidates) {
    const item = createReservoirItemFromQualified(candidate, params.nowIso);
    newlyQualified.push(item);
    await reservoir.upsert(item);
  }

  const all = await reservoir.list();
  let slate = selectDailyAgendaSlateV2({
    businessDateKst: params.businessDateKst,
    nowIso: params.nowIso,
    newlyQualified,
    reservoirItems: all,
  });

  if (params.applyShadowLifecycle) {
    for (const row of slate.selected) {
      let item = row.item;
      if (item.status === "QUALIFIED" || item.status === "DEFERRED") {
        item = markReservoirPresented(item, params.nowIso);
        item = markReservoirDeferred(item, params.nowIso);
        await reservoir.upsert(item);
      }
    }
    // refresh slate statuses for report
    const refreshed = await reservoir.list();
    slate = {
      ...slate,
      selected: slate.selected.map((row) => ({
        ...row,
        item: refreshed.find((r) => r.agendaId === row.item.agendaId) ?? row.item,
      })),
    };
  }

  const comparison = buildV1V2ComparisonReport({
    businessDateKst: params.businessDateKst,
    generatedAt: params.nowIso,
    v1: params.v1Slate ?? [],
    v2Slate: slate,
  });

  return {
    enabled: true,
    productionSlateUnchanged: true,
    slate,
    comparison,
    comparisonMarkdown: formatComparisonReportMarkdown(comparison),
    reservoir,
  };
}

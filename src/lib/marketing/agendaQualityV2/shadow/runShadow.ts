import { isAgendaQualityV2ShadowEnabled } from "@/lib/marketing/agendaQualityV2/shadow/config";
import {
  buildShadowRow,
  formatShadowReportMarkdown,
  type AgendaQualityV2ShadowReport,
} from "@/lib/marketing/agendaQualityV2/shadow/report";
import {
  createInMemoryAgendaReservoir,
  createReservoirItemFromQualified,
  isReservoirEligibleForFutureSlate,
  type AgendaReservoirRepository,
} from "@/lib/marketing/agendaQualityV2/reservoir/types";
import {
  transformMarketingAgendaFromLlmOutput,
  transformMarketingAgendaWithInvoke,
  type AgendaTransformInvoke,
  type AgendaTransformResult,
} from "@/lib/marketing/agendaQualityV2/transformer/transform";
import type { MarketingAgendaTransformInput } from "@/lib/marketing/agendaQualityV2/contracts";
import type { MarketingAgendaTransformerLlmOutput } from "@/lib/marketing/agendaQualityV2/contracts";

export type ShadowTransformSource = {
  originalTitle: string;
  originalSummary: string;
  sourceType: string;
  input: MarketingAgendaTransformInput;
  /** Fixture path: skip network and use pre-baked LLM fields. */
  fixtureLlm?: MarketingAgendaTransformerLlmOutput;
};

export type RunAgendaQualityV2ShadowParams = {
  sources: ShadowTransformSource[];
  invoke?: AgendaTransformInvoke;
  reservoir?: AgendaReservoirRepository;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  nowIso?: string;
};

export type RunAgendaQualityV2ShadowResult =
  | { enabled: false; productionSlateUnchanged: true; report: null }
  | {
      enabled: true;
      productionSlateUnchanged: true;
      report: AgendaQualityV2ShadowReport;
      reportMarkdown: string;
      transforms: AgendaTransformResult[];
      reservoir: AgendaReservoirRepository;
    };

/**
 * Shadow / dry-run V2 path. When disabled: zero production change, no work.
 * Never mutates DailyAgendaSlate production generation.
 */
export async function runAgendaQualityV2Shadow(
  params: RunAgendaQualityV2ShadowParams,
): Promise<RunAgendaQualityV2ShadowResult> {
  if (!isAgendaQualityV2ShadowEnabled(params.env ?? process.env)) {
    return { enabled: false, productionSlateUnchanged: true, report: null };
  }

  const reservoir = params.reservoir ?? createInMemoryAgendaReservoir();
  const transforms: AgendaTransformResult[] = [];
  const rows = [];

  for (const source of params.sources) {
    let transform: AgendaTransformResult;
    if (source.fixtureLlm) {
      transform = transformMarketingAgendaFromLlmOutput({
        input: source.input,
        llm: source.fixtureLlm,
        transformModel: "fixture",
        transformRouteSource: "fixture",
        transformProvider: "fixture",
        nowIso: params.nowIso,
      });
    } else if (params.invoke) {
      transform = await transformMarketingAgendaWithInvoke({
        input: source.input,
        invoke: params.invoke,
        nowIso: params.nowIso,
      });
    } else {
      transform = {
        agendaQualityVersion: "v2",
        transformStatus: "invalid",
        transformFailureReason: "shadow_invoke_missing",
        candidate: null,
        transformModel: null,
        transformRouteSource: null,
        transformProvider: null,
        sourceSignalIds: source.input.sourceSignalIds ?? [],
      };
    }

    transforms.push(transform);

    let reservoirItem = null;
    if (transform.transformStatus === "valid" && transform.candidate) {
      reservoirItem = createReservoirItemFromQualified(transform.candidate, params.nowIso);
      reservoir.upsert(reservoirItem);
    }

    rows.push(
      buildShadowRow({
        originalTitle: source.originalTitle,
        originalSummary: source.originalSummary,
        sourceType: source.sourceType,
        transform,
        reservoirItem,
      }),
    );
  }

  const report: AgendaQualityV2ShadowReport = {
    contract: "agenda-quality-v2-shadow-report",
    generatedAt: params.nowIso ?? new Date().toISOString(),
    shadowEnabled: true,
    productionSlateUnchanged: true,
    rows,
    reservoirPreview: reservoir.list().map((item) => ({
      agendaId: item.agendaId,
      status: item.status,
      freshnessClass: item.freshnessClass,
      expiresAt: item.expiresAt,
      deferredReusable: isReservoirEligibleForFutureSlate(item, params.nowIso),
    })),
  };

  return {
    enabled: true,
    productionSlateUnchanged: true,
    report,
    reportMarkdown: formatShadowReportMarkdown(report),
    transforms,
    reservoir,
  };
}

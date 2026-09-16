import type { MarketingAgendaCandidateV2 } from "@/lib/marketing/agendaQualityV2/contracts";
import type { AgendaTransformResult } from "@/lib/marketing/agendaQualityV2/transformer/transform";
import type { AgendaReservoirItem } from "@/lib/marketing/agendaQualityV2/reservoir/types";

export type AgendaQualityV2ShadowRow = {
  originalTitle: string;
  originalSummary: string;
  sourceType: string;
  travelerProblemKo: string | null;
  decisionAtStakeKo: string | null;
  audienceTensionKo: string | null;
  readerPayoffKo: string | null;
  marketingStorySeedKo: string | null;
  freshnessClass: string | null;
  valid: boolean;
  rejectionReason: string | null;
  agendaId: string | null;
  reservoirStatus: string | null;
  transformModel: string | null;
  transformRouteSource: string | null;
  transformProvider: string | null;
  agendaQualityVersion: "v2";
};

export type AgendaQualityV2ShadowReport = {
  contract: "agenda-quality-v2-shadow-report";
  generatedAt: string;
  shadowEnabled: true;
  productionSlateUnchanged: true;
  rows: AgendaQualityV2ShadowRow[];
  reservoirPreview: Array<{
    agendaId: string;
    status: string;
    freshnessClass: string;
    expiresAt: string | null;
    deferredReusable: boolean;
  }>;
};

export function buildShadowRow(params: {
  originalTitle: string;
  originalSummary: string;
  sourceType: string;
  transform: AgendaTransformResult;
  reservoirItem?: AgendaReservoirItem | null;
}): AgendaQualityV2ShadowRow {
  const c: MarketingAgendaCandidateV2 | null = params.transform.candidate;
  return {
    originalTitle: params.originalTitle,
    originalSummary: params.originalSummary,
    sourceType: params.sourceType,
    travelerProblemKo: c?.traveler.travelerProblemKo ?? null,
    decisionAtStakeKo: c?.traveler.decisionAtStakeKo ?? null,
    audienceTensionKo: c?.traveler.audienceTensionKo ?? null,
    readerPayoffKo: c?.traveler.readerPayoffKo ?? null,
    marketingStorySeedKo: c?.editorial.marketingStorySeedKo ?? null,
    freshnessClass: c?.signalContext.freshnessClass ?? null,
    valid: params.transform.transformStatus === "valid",
    rejectionReason: params.transform.transformFailureReason,
    agendaId: c?.agendaId ?? null,
    reservoirStatus: params.reservoirItem?.status ?? c?.lifecycleStatus ?? null,
    transformModel: params.transform.transformModel,
    transformRouteSource: params.transform.transformRouteSource,
    transformProvider: params.transform.transformProvider,
    agendaQualityVersion: "v2",
  };
}

export function formatShadowReportMarkdown(report: AgendaQualityV2ShadowReport): string {
  const lines: string[] = [
    "# Agenda Quality V2 Shadow Report",
    "",
    `generatedAt: ${report.generatedAt}`,
    `productionSlateUnchanged: ${report.productionSlateUnchanged}`,
    "",
  ];
  for (const row of report.rows) {
    lines.push(`## ${row.originalTitle}`);
    lines.push(`- sourceType: ${row.sourceType}`);
    lines.push(`- valid: ${row.valid}`);
    if (row.rejectionReason) lines.push(`- rejectionReason: ${row.rejectionReason}`);
    lines.push(`- travelerProblem: ${row.travelerProblemKo ?? "—"}`);
    lines.push(`- decisionAtStake: ${row.decisionAtStakeKo ?? "—"}`);
    lines.push(`- tension: ${row.audienceTensionKo ?? "—"}`);
    lines.push(`- payoff: ${row.readerPayoffKo ?? "—"}`);
    lines.push(`- storySeed: ${row.marketingStorySeedKo ?? "—"}`);
    lines.push(`- freshnessClass: ${row.freshnessClass ?? "—"}`);
    lines.push(`- reservoirStatus: ${row.reservoirStatus ?? "—"}`);
    lines.push("");
  }
  return lines.join("\n");
}

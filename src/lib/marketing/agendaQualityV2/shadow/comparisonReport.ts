import type { DailyAgendaSlateV2 } from "@/lib/marketing/agendaQualityV2/slate/selectDailySlateV2";

export type V1SlateComparisonRow = {
  rank: number;
  title: string;
  source: string;
};

export type AgendaQualityV2ComparisonReport = {
  contract: "agenda-quality-v2-comparison-report";
  businessDateKst: string;
  generatedAt: string;
  productionSlateUnchanged: true;
  v1: V1SlateComparisonRow[];
  v2: Array<{
    rank: number;
    storySeed: string;
    decisionAtStake: string;
    qualityTier: string;
    totalScore: number;
    reusePenalty: number;
    fatiguePenalty: number;
    sourceFreshness: number | null;
    lifecycleStatus: string;
    origin: "NEW" | "CARRYOVER";
    carriedFromDate: string | null;
  }>;
  v2Rejected: Array<{
    agendaId: string;
    qualityTier: string;
    reason: string;
    totalScore: number;
    origin: "NEW" | "CARRYOVER";
  }>;
  v1DroppedRelativeToV2Titles: string[];
  deferredResurfaced: string[];
};

export function buildV1V2ComparisonReport(params: {
  businessDateKst: string;
  generatedAt: string;
  v1: V1SlateComparisonRow[];
  v2Slate: DailyAgendaSlateV2;
}): AgendaQualityV2ComparisonReport {
  const v2 = params.v2Slate.selected.map((row, idx) => ({
    rank: idx + 1,
    storySeed: row.item.candidate.editorial.marketingStorySeedKo,
    decisionAtStake: row.item.candidate.traveler.decisionAtStakeKo,
    qualityTier: row.score.qualityTier,
    totalScore: row.score.totalScore,
    reusePenalty: row.score.penalties.reusePenalty,
    fatiguePenalty: row.score.penalties.fatiguePenalty,
    sourceFreshness: row.item.candidate.qualityInput.sourceFreshness,
    lifecycleStatus: row.item.status,
    origin: row.origin,
    carriedFromDate: row.carriedFromDate,
  }));

  const v2Seeds = new Set(v2.map((r) => r.storySeed));
  const v1DroppedRelativeToV2Titles = params.v1
    .filter((row) => ![...v2Seeds].some((seed) => seed.includes(row.title) || row.title.includes(seed.slice(0, 12))))
    .map((row) => row.title);

  const deferredResurfaced = params.v2Slate.selected
    .filter((r) => r.origin === "CARRYOVER")
    .map((r) => r.item.agendaId);

  return {
    contract: "agenda-quality-v2-comparison-report",
    businessDateKst: params.businessDateKst,
    generatedAt: params.generatedAt,
    productionSlateUnchanged: true,
    v1: params.v1,
    v2,
    v2Rejected: params.v2Slate.rejected,
    v1DroppedRelativeToV2Titles,
    deferredResurfaced,
  };
}

export function formatComparisonReportMarkdown(report: AgendaQualityV2ComparisonReport): string {
  const lines = [
    `# Agenda Quality V2 Comparison — ${report.businessDateKst}`,
    "",
    "## V1 Slate",
    ...report.v1.map((r) => `${r.rank}. ${r.title} (${r.source})`),
    "",
    "## V2 Slate",
    ...report.v2.map(
      (r) =>
        `${r.rank}. [${r.qualityTier}/${r.origin}] ${r.storySeed} | decision=${r.decisionAtStake} | score=${r.totalScore.toFixed(3)} | reuse=${r.reusePenalty.toFixed(2)} | fatigue=${r.fatiguePenalty.toFixed(2)}`,
    ),
    "",
    "## V2 Rejected",
    ...report.v2Rejected.map(
      (r) => `- ${r.agendaId}: ${r.qualityTier} (${r.reason}) score=${r.totalScore.toFixed(3)}`,
    ),
    "",
    `deferredResurfaced: ${report.deferredResurfaced.join(", ") || "—"}`,
  ];
  return lines.join("\n");
}

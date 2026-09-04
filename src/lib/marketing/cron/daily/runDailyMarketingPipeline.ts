/**
 * Back-compat surface: existing tests/imports still resolve production pipeline.
 * Cron uses `runDailyMarketingAgendaSlate` (human-gated slate stop).
 */
export {
  runDailyMarketingProductionPipeline,
  type DailyMarketingPipelineDeps,
} from "@/lib/marketing/cron/daily/runDailyMarketingProductionPipeline";
export { runDailyMarketingProductionPipeline as runDailyMarketingPipeline } from "@/lib/marketing/cron/daily/runDailyMarketingProductionPipeline";
export { runDailyMarketingAgendaSlate } from "@/lib/marketing/cron/daily/runDailyMarketingAgendaSlate";
export {
  runDailyMarketingProductionFromSelection,
  type DailyMarketingProductionSelectionInput,
} from "@/lib/marketing/cron/daily/runDailyMarketingProductionFromSelection";

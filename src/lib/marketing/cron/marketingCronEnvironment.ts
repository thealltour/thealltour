/**
 * Single source of truth for how a Marketing Cron entry point resolved its
 * environment. The 09:00 agenda job and the production queue worker used to
 * resolve Hermes, the runtime flag, and env files differently, so one could
 * silently run on a different inference path than the other — or fail with a
 * bare `spawnSync hermes ENOENT` under systemd's minimal PATH.
 *
 * Every cron entry point prints this report before doing work, which turns those
 * mismatches into an upfront diagnostic instead of a mid-run failure.
 */

import { existsSync } from "node:fs";

import { AI_RUNTIME_MARKETING_CRON_ENABLED_ENV } from "@/ai-runtime/integration/constants";
import { resolveMarketingCronHermesTimeoutMs } from "@/lib/marketing/cron/hermesSpawnFailure";
import { resolveHermesExecutable } from "@/lib/marketing/cron/resolveHermesExecutable";

export type MarketingCronInferencePath = "ai-runtime" | "hermes-cli";

export type MarketingCronEnvironmentReport = {
  entryPoint: string;
  inferencePath: MarketingCronInferencePath;
  hermesBin: string;
  hermesBinResolvable: boolean;
  hermesHome: string;
  hermesTimeoutMs: number;
  researchCollectionEnabled: boolean;
  traceEnabled: boolean;
  warnings: string[];
};

function isTruthy(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return value === "true" || value === "1";
}

export function inspectMarketingCronEnvironment(input: {
  entryPoint: string;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  fallbackTimeoutMs?: number;
}): MarketingCronEnvironmentReport {
  const env = input.env ?? process.env;
  const useRuntime = isTruthy(env[AI_RUNTIME_MARKETING_CRON_ENABLED_ENV]);
  const hermesBin = resolveHermesExecutable(env);
  // A bare "hermes" means resolveHermesExecutable fell through to PATH, which is
  // exactly the case that breaks under systemd.
  const hermesBinResolvable = hermesBin !== "hermes" && existsSync(hermesBin);
  const hermesTimeoutMs = resolveMarketingCronHermesTimeoutMs(env, input.fallbackTimeoutMs);

  const warnings: string[] = [];
  if (!useRuntime && !hermesBinResolvable) {
    warnings.push(
      `hermes binary is not resolvable (${hermesBin}); set HERMES_BIN or add ~/.local/bin to the unit PATH`,
    );
  }
  if (!isTruthy(env.RESEARCH_COLLECTION_ENABLED)) {
    warnings.push(
      "RESEARCH_COLLECTION_ENABLED is not true; agenda may resolve RESEARCH_EMPTY and content will lack usable facts",
    );
  }
  if (!isTruthy(env.MARKETING_TRACE_ENABLED)) {
    warnings.push("MARKETING_TRACE_ENABLED is not true; spans are dropped and failures are hard to diagnose");
  }

  return {
    entryPoint: input.entryPoint,
    inferencePath: useRuntime ? "ai-runtime" : "hermes-cli",
    hermesBin,
    hermesBinResolvable,
    hermesHome: env.HERMES_HOME?.trim() || "/home/ysh/.hermes",
    hermesTimeoutMs,
    researchCollectionEnabled: isTruthy(env.RESEARCH_COLLECTION_ENABLED),
    traceEnabled: isTruthy(env.MARKETING_TRACE_ENABLED),
    warnings,
  };
}

export function formatMarketingCronEnvironmentLines(
  report: MarketingCronEnvironmentReport,
): string[] {
  const lines = [
    `- entryPoint: ${report.entryPoint}`,
    `- inference_path: ${report.inferencePath}`,
    `- hermesBin: ${report.hermesBin}${report.hermesBinResolvable ? "" : " (unresolved)"}`,
    `- hermesHome: ${report.hermesHome}`,
    `- hermesTimeoutMs: ${report.hermesTimeoutMs}`,
    `- researchCollectionEnabled: ${report.researchCollectionEnabled}`,
    `- traceEnabled: ${report.traceEnabled}`,
  ];
  for (const warning of report.warnings) {
    lines.push(`- WARN: ${warning}`);
  }
  return lines;
}

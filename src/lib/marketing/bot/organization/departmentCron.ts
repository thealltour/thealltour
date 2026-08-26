import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { HermesMarketingProfileId } from "@/lib/marketing/bot/organization/envelope";
import { stripForbiddenBotData } from "@/lib/marketing/bot/sanitize";

export const MULTIPLEX_GATEWAY_STATUS_URL = "http://127.0.0.1:9119/api/status";

export type DepartmentCronJobFact = {
  profile: HermesMarketingProfileId;
  id: string;
  name: string;
  schedule: string;
  deliver: string;
  enabled: boolean;
  noAgent: boolean;
  script: string | null;
  lastStatus: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
};

export type MultiplexGatewayFact = {
  source: "multiplex_default";
  overall: string | null;
  gatewayMode: string | null;
  gatewayRunning: boolean | null;
  telegramMarketingManager: string | null;
  duplicateCredential: number;
  namedProfileCronStatusAuthoritative: false;
};

export type DepartmentCronStatus = {
  jobs: DepartmentCronJobFact[];
  gateway: MultiplexGatewayFact;
};

export type DepartmentCronDeps = {
  hermesHome?: string;
  readJobsFile?: (absolutePath: string) => string | null;
  fetchGatewayStatus?: (url: string) => Promise<unknown>;
};

function defaultRead(absolutePath: string): string | null {
  try {
    return readFileSync(absolutePath, "utf8");
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseJobs(profile: HermesMarketingProfileId, raw: string | null): DepartmentCronJobFact[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const root = asRecord(parsed);
  const jobs = Array.isArray(root?.jobs) ? root.jobs : [];
  const facts: DepartmentCronJobFact[] = [];
  for (const item of jobs) {
    const job = asRecord(item);
    if (!job) continue;
    const schedule = asRecord(job.schedule);
    facts.push({
      profile,
      id: String(job.id ?? ""),
      name: String(job.name ?? ""),
      schedule: String(job.schedule_display ?? schedule?.expr ?? schedule?.display ?? ""),
      deliver: String(job.deliver ?? "local"),
      enabled: job.enabled !== false,
      noAgent: job.no_agent === true,
      script: job.script == null ? null : String(job.script),
      lastStatus: job.last_status == null ? null : String(job.last_status),
      lastRunAt: job.last_run_at == null ? null : String(job.last_run_at),
      nextRunAt: job.next_run_at == null ? null : String(job.next_run_at),
    });
  }
  return facts;
}

async function defaultFetch(url: string): Promise<unknown> {
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) throw new Error(`gateway_status_http_${response.status}`);
  return response.json();
}

export async function collectDepartmentCronStatus(
  profiles: HermesMarketingProfileId[],
  deps: DepartmentCronDeps = {},
): Promise<DepartmentCronStatus> {
  const home = deps.hermesHome ?? process.env.HERMES_HOME ?? "/home/ysh/.hermes";
  const read = deps.readJobsFile ?? defaultRead;
  const jobs = profiles.flatMap((profile) =>
    parseJobs(profile, read(join(home, "profiles", profile, "cron", "jobs.json"))),
  );

  let gateway: MultiplexGatewayFact = {
    source: "multiplex_default",
    overall: null,
    gatewayMode: null,
    gatewayRunning: null,
    telegramMarketingManager: null,
    duplicateCredential: 0,
    namedProfileCronStatusAuthoritative: false,
  };

  try {
    const fetchStatus = deps.fetchGatewayStatus ?? defaultFetch;
    const payload = asRecord(await fetchStatus(MULTIPLEX_GATEWAY_STATUS_URL));
    const platforms = asRecord(payload?.gateway_platforms);
    const telegram = asRecord(platforms?.["marketing-manager:telegram"]);
    const blob = JSON.stringify(payload ?? {});
    gateway = {
      source: "multiplex_default",
      overall: payload?.overall == null ? null : String(payload.overall),
      gatewayMode: payload?.gateway_mode == null ? null : String(payload.gateway_mode),
      gatewayRunning: typeof payload?.gateway_running === "boolean" ? payload.gateway_running : null,
      telegramMarketingManager: telegram?.state == null ? null : String(telegram.state),
      duplicateCredential: blob.toLowerCase().split("duplicate_credential").length - 1,
      namedProfileCronStatusAuthoritative: false,
    };
  } catch {
    gateway = {
      ...gateway,
      overall: "unknown",
    };
  }

  return stripForbiddenBotData({ jobs, gateway });
}

export function departmentCronIncludesExpectedSchedules(status: DepartmentCronStatus): boolean {
  const hasPerformance = status.jobs.some(
    (job) =>
      job.profile === "performance-analyst" &&
      (job.schedule === "30 8 * * *" || /08:30|8:30/.test(job.schedule) || job.schedule.includes("30 8")),
  );
  const hasPlan = status.jobs.some(
    (job) =>
      job.profile === "marketing-manager" &&
      (job.schedule === "0 9 * * *" || /09:00|9:00/.test(job.schedule) || job.schedule.includes("0 9")),
  );
  return hasPerformance && hasPlan;
}

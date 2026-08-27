import {
  JOB_RETENTION_MS,
  JOB_STORE_MAX_ENTRIES,
} from "@/ai-runtime/scheduler/constants";
import type {
  RuntimeJobListFilter,
  RuntimeJobStore,
  SchedulerJob,
} from "@/ai-runtime/scheduler/types";

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

function matchesFilter(job: SchedulerJob, filter?: RuntimeJobListFilter): boolean {
  if (!filter) return true;
  if (filter.requestId && job.request.id !== filter.requestId) return false;
  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    if (!statuses.includes(job.status)) return false;
  }
  return true;
}

export function createInMemoryRuntimeJobStore(): RuntimeJobStore {
  const jobs = new Map<string, SchedulerJob>();

  return {
    save(job: SchedulerJob): void {
      jobs.set(job.id, { ...job, request: { ...job.request } });
    },

    get(jobId: string): SchedulerJob | undefined {
      const job = jobs.get(jobId);
      return job ? { ...job, request: { ...job.request } } : undefined;
    },

    findActiveByRequestId(requestId: string): SchedulerJob | undefined {
      for (const job of jobs.values()) {
        if (job.request.id !== requestId) continue;
        if (TERMINAL_STATUSES.has(job.status)) continue;
        return { ...job, request: { ...job.request } };
      }
      return undefined;
    },

    list(filter?: RuntimeJobListFilter): SchedulerJob[] {
      const matched = [...jobs.values()].filter((job) => matchesFilter(job, filter));
      matched.sort((a, b) => Date.parse(b.queuedAt) - Date.parse(a.queuedAt));
      if (filter?.limit != null) {
        return matched.slice(0, filter.limit).map((job) => ({ ...job, request: { ...job.request } }));
      }
      return matched.map((job) => ({ ...job, request: { ...job.request } }));
    },

    delete(jobId: string): void {
      jobs.delete(jobId);
    },

    clear(): void {
      jobs.clear();
    },

    pruneTerminal(now: Date): void {
      const cutoff = now.getTime() - JOB_RETENTION_MS;
      for (const [jobId, job] of jobs.entries()) {
        if (!TERMINAL_STATUSES.has(job.status)) continue;
        const terminalAt = job.completedAt ?? job.queuedAt;
        if (Date.parse(terminalAt) < cutoff) {
          jobs.delete(jobId);
        }
      }

      const terminalJobs = [...jobs.values()]
        .filter((job) => TERMINAL_STATUSES.has(job.status))
        .sort((a, b) => Date.parse(a.completedAt ?? a.queuedAt) - Date.parse(b.completedAt ?? b.queuedAt));

      while (terminalJobs.length > JOB_STORE_MAX_ENTRIES) {
        const oldest = terminalJobs.shift();
        if (oldest) jobs.delete(oldest.id);
      }
    },
  };
}

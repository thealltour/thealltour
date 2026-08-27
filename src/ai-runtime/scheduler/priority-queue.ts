import { PRIORITY_WEIGHT } from "@/ai-runtime/domain/priority";
import {
  AGING_PRIORITY_BONUS,
  MAX_AGING_BONUS,
  MAX_PRIORITY_WAIT_MS,
} from "@/ai-runtime/scheduler/constants";
import type { SchedulerJob } from "@/ai-runtime/scheduler/types";

export function effectivePriorityWeight(job: SchedulerJob, now: Date): number {
  const base = PRIORITY_WEIGHT[job.request.priority];
  const waitMs = now.getTime() - Date.parse(job.queuedAt);
  const agingSteps = Math.floor(Math.max(0, waitMs) / MAX_PRIORITY_WAIT_MS);
  const agingBonus = Math.min(agingSteps * AGING_PRIORITY_BONUS, MAX_AGING_BONUS);
  return base + agingBonus;
}

export function jobAvailableAtMs(job: SchedulerJob): number {
  if (job.availableAt) return Date.parse(job.availableAt);
  return Date.parse(job.queuedAt);
}

export function isJobRunnable(job: SchedulerJob, now: Date): boolean {
  if (job.status !== "queued") return false;
  return jobAvailableAtMs(job) <= now.getTime();
}

export function isJobDeferred(job: SchedulerJob, now: Date): boolean {
  if (job.status !== "queued") return false;
  return jobAvailableAtMs(job) > now.getTime();
}

export function compareSchedulerJobs(a: SchedulerJob, b: SchedulerJob, now: Date): number {
  const weightDiff = effectivePriorityWeight(b, now) - effectivePriorityWeight(a, now);
  if (weightDiff !== 0) return weightDiff;

  const availableDiff = jobAvailableAtMs(a) - jobAvailableAtMs(b);
  if (availableDiff !== 0) return availableDiff;

  const queuedDiff = Date.parse(a.queuedAt) - Date.parse(b.queuedAt);
  if (queuedDiff !== 0) return queuedDiff;

  return a.id.localeCompare(b.id);
}

export function pickNextRunnableJob(
  jobs: SchedulerJob[],
  now: Date,
): SchedulerJob | undefined {
  const runnable = jobs.filter((job) => isJobRunnable(job, now));
  if (runnable.length === 0) return undefined;
  return [...runnable].sort((a, b) => compareSchedulerJobs(a, b, now))[0];
}

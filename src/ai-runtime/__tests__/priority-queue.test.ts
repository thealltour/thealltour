import { describe, expect, it } from "vitest";

import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import {
  compareSchedulerJobs,
  effectivePriorityWeight,
  isJobDeferred,
  isJobRunnable,
  pickNextRunnableJob,
} from "@/ai-runtime/scheduler/priority-queue";
import { MAX_PRIORITY_WAIT_MS } from "@/ai-runtime/scheduler/constants";
import type { SchedulerJob } from "@/ai-runtime/scheduler/types";

const NOW = new Date("2026-08-27T03:00:00.000Z");

function job(
  id: string,
  priority: RuntimeRequest["priority"],
  queuedAt: string,
  availableAt?: string,
): SchedulerJob {
  return {
    id,
    status: "queued",
    queuedAt,
    availableAt,
    attempts: 0,
    request: {
      id: `req-${id}`,
      createdAt: queuedAt,
      agentId: "marketing-manager",
      source: "desktop",
      workload: "classification",
      priority,
      messages: [{ role: "user", content: "test" }],
    },
  };
}

describe("priority queue", () => {
  it("orders critical > high > normal > background", () => {
    const jobs = [
      job("bg", "background", NOW.toISOString()),
      job("crit", "critical", NOW.toISOString()),
      job("norm", "normal", NOW.toISOString()),
      job("high", "high", NOW.toISOString()),
    ];

    const picked = pickNextRunnableJob(jobs, NOW);
    expect(picked?.id).toBe("crit");
  });

  it("uses FIFO/stable ordering within same priority", () => {
    const earlier = job("a", "normal", "2026-08-27T02:59:00.000Z");
    const later = job("b", "normal", "2026-08-27T02:59:30.000Z");
    expect(compareSchedulerJobs(earlier, later, NOW)).toBeLessThan(0);
    expect(pickNextRunnableJob([later, earlier], NOW)?.id).toBe("a");
  });

  it("does not pick future availableAt jobs as runnable", () => {
    const deferred = job(
      "deferred",
      "critical",
      NOW.toISOString(),
      "2026-08-27T03:05:00.000Z",
    );
    const ready = job("ready", "background", NOW.toISOString());

    expect(isJobDeferred(deferred, NOW)).toBe(true);
    expect(isJobRunnable(deferred, NOW)).toBe(false);
    expect(pickNextRunnableJob([deferred, ready], NOW)?.id).toBe("ready");
  });

  it("applies aging bonus after MAX_PRIORITY_WAIT_MS", () => {
    const oldBackground = job(
      "old-bg",
      "background",
      new Date(NOW.getTime() - MAX_PRIORITY_WAIT_MS - 1_000).toISOString(),
    );
    const freshBackground = job("fresh-bg", "background", NOW.toISOString());

    expect(effectivePriorityWeight(oldBackground, NOW)).toBeGreaterThan(
      effectivePriorityWeight(freshBackground, NOW),
    );
  });
});

import { RuntimeError } from "@/ai-runtime/domain/error";
import type { RuntimeResponse } from "@/ai-runtime/domain/response";
import type { ProviderExecutionContext } from "@/ai-runtime/adapters/types";
import type { RuntimeRouter } from "@/ai-runtime/router";
import type { SchedulerJob } from "@/ai-runtime/scheduler/types";

export async function executeJobWithRouter(input: {
  job: SchedulerJob;
  router: RuntimeRouter;
  context: ProviderExecutionContext;
}): Promise<{ kind: "success"; response: RuntimeResponse } | { kind: "error"; error: RuntimeError }> {
  try {
    const response = await input.router.route(input.job.request, input.context);
    return { kind: "success", response };
  } catch (error) {
    if (error instanceof RuntimeError) {
      return { kind: "error", error };
    }
    throw error;
  }
}

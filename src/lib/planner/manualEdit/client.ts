import type { PlannerPlan } from "@/lib/planner/planSchemas";
import type { PlannerManualCommand } from "@/lib/planner/manualEdit/types";
import { getOrCreatePlannerAnonymousKey } from "@/lib/planner/anonymousKey";

export type ManualEditSuccess = {
  ok: true;
  plan: PlannerPlan;
  updatedAt: string;
  status: string;
  operation: PlannerManualCommand["operation"];
};

export type ManualEditFailure = {
  ok: false;
  status: number;
  code?: string;
  message: string;
};

export async function postPlannerManualEdit(params: {
  sessionId: string;
  command: PlannerManualCommand;
}): Promise<ManualEditSuccess | ManualEditFailure> {
  const anonymousKey = getOrCreatePlannerAnonymousKey();
  const res = await fetch(
    `/api/planner/sessions/${encodeURIComponent(params.sessionId)}/manual-edit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...params.command, anonymousKey }),
    },
  );
  const data = (await res.json().catch(() => null)) as {
    message?: string;
    code?: string;
    session?: { plan?: PlannerPlan; updatedAt?: string; status?: string };
    operation?: PlannerManualCommand["operation"];
  } | null;

  if (!res.ok || !data?.session?.plan || !data.session.updatedAt) {
    return {
      ok: false,
      status: res.status,
      code: data?.code,
      message: data?.message ?? "일정을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  return {
    ok: true,
    plan: data.session.plan,
    updatedAt: data.session.updatedAt,
    status: data.session.status ?? "generated",
    operation: data.operation ?? params.command.operation,
  };
}

"use client";

import { getOrCreatePlannerAnonymousKey } from "@/lib/planner/anonymousKey";

export type PlannerClaimClientResult =
  | {
      ok: true;
      claimed: boolean;
      session: {
        id: string;
        status: string;
        isSaved: boolean;
        updatedAt: string;
        sourceProductId?: string | null;
      };
    }
  | { ok: false; message: string; status?: number; code?: string };

export async function postPlannerSessionClaim(
  sessionId: string,
): Promise<PlannerClaimClientResult> {
  const anonymousKey = getOrCreatePlannerAnonymousKey();
  const res = await fetch(`/api/planner/sessions/${encodeURIComponent(sessionId)}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ anonymousKey }),
  });
  const data = (await res.json().catch(() => null)) as {
    message?: string;
    code?: string;
    claimed?: boolean;
    session?: {
      id?: string;
      status?: string;
      isSaved?: boolean;
      updatedAt?: string;
      sourceProductId?: string | null;
    };
  } | null;

  if (!res.ok) {
    return {
      ok: false,
      message: data?.message ?? "이 플랜을 계정에 연결하지 못했어요.",
      status: res.status,
      code: data?.code,
    };
  }

  const updatedAt = data?.session?.updatedAt;
  const id = data?.session?.id;
  const status = data?.session?.status;
  if (!updatedAt || !id || !status) {
    return { ok: false, message: "이 플랜을 계정에 연결하지 못했어요." };
  }

  return {
    ok: true,
    claimed: Boolean(data?.claimed),
    session: {
      id,
      status,
      isSaved: Boolean(data?.session?.isSaved) || status === "saved",
      updatedAt,
      sourceProductId: data?.session?.sourceProductId ?? null,
    },
  };
}

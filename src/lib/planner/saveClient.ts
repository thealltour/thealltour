"use client";

import { getOrCreatePlannerAnonymousKey } from "@/lib/planner/anonymousKey";

export async function fetchPlannerMemberAuthenticated(): Promise<boolean> {
  try {
    const res = await fetch("/api/me/profile", { method: "GET", credentials: "include" });
    const data = (await res.json().catch(() => null)) as { authenticated?: boolean } | null;
    return Boolean(data?.authenticated);
  } catch {
    return false;
  }
}

export type PlannerSaveClientResult =
  | {
      ok: true;
      claimed: boolean;
      session: {
        id: string;
        status: string;
        isSaved: boolean;
        updatedAt: string;
      };
    }
  | { ok: false; message?: string };

export async function postPlannerSessionSave(
  sessionId: string,
): Promise<PlannerSaveClientResult> {
  const anonymousKey = getOrCreatePlannerAnonymousKey();
  const res = await fetch(`/api/planner/sessions/${encodeURIComponent(sessionId)}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ anonymousKey }),
  });
  const data = (await res.json().catch(() => null)) as {
    message?: string;
    claimed?: boolean;
    session?: {
      id?: string;
      status?: string;
      isSaved?: boolean;
      updatedAt?: string;
    };
  } | null;
  if (!res.ok) {
    return { ok: false, message: data?.message ?? "플랜을 저장하지 못했습니다." };
  }

  const updatedAt = data?.session?.updatedAt;
  const id = data?.session?.id;
  const status = data?.session?.status;
  if (!updatedAt || !id || !status) {
    return { ok: false, message: "플랜을 저장하지 못했습니다." };
  }

  return {
    ok: true,
    claimed: Boolean(data?.claimed),
    session: {
      id,
      status,
      isSaved: Boolean(data?.session?.isSaved) || status === "saved",
      updatedAt,
    },
  };
}

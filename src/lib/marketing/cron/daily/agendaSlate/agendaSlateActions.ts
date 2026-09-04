import { createHash } from "node:crypto";

import type {
  AgendaSlateAction,
  AgendaSlateCandidate,
  AgendaSlateCandidateState,
  DailyAgendaSlate,
} from "@/lib/marketing/cron/daily/agendaSlate/types";
import { MAX_SELECTED_TODAY } from "@/lib/marketing/cron/daily/agendaSlate/types";

export class AgendaSlateActionError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "STALE_SLATE"
      | "ILLEGAL_TRANSITION"
      | "MAX_SELECTED"
      | "MALFORMED_ID"
      | "ALREADY_PRODUCED",
  ) {
    super(message);
    this.name = "AgendaSlateActionError";
  }
}

const ACTION_TO_STATE: Record<AgendaSlateAction, AgendaSlateCandidateState> = {
  select_today: "SELECTED_TODAY",
  defer: "DEFERRED",
  reject: "REJECTED",
  reset_available: "AVAILABLE",
};

function recount(candidates: AgendaSlateCandidate[]): DailyAgendaSlate["observability"] {
  return {
    organicCount: candidates.filter((c) => c.origin === "organic_research").length,
    deferredCarryoverCount: candidates.filter((c) => c.origin === "deferred_carryover").length,
    availableCount: candidates.filter((c) => c.state === "AVAILABLE").length,
    selectedTodayCount: candidates.filter((c) => c.state === "SELECTED_TODAY").length,
  };
}

function assertLegalTransition(
  from: AgendaSlateCandidateState,
  action: AgendaSlateAction,
  target: AgendaSlateCandidateState,
): void {
  if (from === target) return;

  if (action === "reset_available") {
    if (from !== "SELECTED_TODAY" && from !== "DEFERRED" && from !== "REJECTED") {
      throw new AgendaSlateActionError("cannot reset state", "ILLEGAL_TRANSITION");
    }
    return;
  }

  if (from !== "AVAILABLE") {
    throw new AgendaSlateActionError(`cannot ${action} from ${from}`, "ILLEGAL_TRANSITION");
  }
}

export function applyAgendaSlateAction(input: {
  slate: DailyAgendaSlate;
  slateItemId: string;
  action: AgendaSlateAction;
  expectedBusinessDateKst?: string;
  now?: Date;
}): DailyAgendaSlate {
  const now = input.now ?? new Date();
  const slateItemId = input.slateItemId?.trim();
  if (!slateItemId || !/^asc_[a-f0-9]{24}$/i.test(slateItemId)) {
    throw new AgendaSlateActionError("malformed slateItemId", "MALFORMED_ID");
  }

  if (
    input.expectedBusinessDateKst &&
    input.slate.businessDateKst !== input.expectedBusinessDateKst
  ) {
    throw new AgendaSlateActionError("stale or previous-day slate", "STALE_SLATE");
  }

  const index = input.slate.candidates.findIndex((c) => c.slateItemId === slateItemId);
  if (index < 0) {
    throw new AgendaSlateActionError("candidate not in slate", "NOT_FOUND");
  }

  const current = input.slate.candidates[index]!;
  const target = ACTION_TO_STATE[input.action];

  // Idempotent same-state click.
  if (current.state === target) {
    return input.slate;
  }

  assertLegalTransition(current.state, input.action, target);

  if (input.action === "select_today") {
    const selected = input.slate.candidates.filter((c) => c.state === "SELECTED_TODAY").length;
    if (selected >= MAX_SELECTED_TODAY) {
      throw new AgendaSlateActionError(
        `maximum SELECTED_TODAY is ${MAX_SELECTED_TODAY}`,
        "MAX_SELECTED",
      );
    }
  }

  const candidates = input.slate.candidates.map((item, i) => {
    if (i !== index) return item;
    if (input.action === "defer") {
      return {
        ...item,
        state: "DEFERRED" as const,
        deferredFromBusinessDateKst: input.slate.businessDateKst,
        deferredFromSlateItemId: item.slateItemId,
      };
    }
    if (input.action === "reset_available") {
      return {
        ...item,
        state: "AVAILABLE" as const,
        // Keep deferred provenance markers only for carryover-origin items.
        deferredFromBusinessDateKst:
          item.origin === "deferred_carryover" ? item.deferredFromBusinessDateKst : null,
        deferredFromSlateItemId:
          item.origin === "deferred_carryover" ? item.deferredFromSlateItemId : null,
      };
    }
    return { ...item, state: target };
  });

  return {
    ...input.slate,
    candidates,
    updatedAt: now.toISOString(),
    observability: recount(candidates),
  };
}

export function listSelectedToday(slate: DailyAgendaSlate): AgendaSlateCandidate[] {
  return slate.candidates.filter((c) => c.state === "SELECTED_TODAY");
}

/** Stable research identity seed for production logicalRunKey hashing. */
export function researchIdentitySeedForCandidate(item: {
  agendaCandidateId?: string | null;
  researchBriefId?: string | null;
  title: string;
  canonicalArticleIds?: string[];
}): string {
  return [
    item.agendaCandidateId?.trim() ?? "",
    item.researchBriefId?.trim() ?? "",
    (item.canonicalArticleIds ?? [])[0] ?? "",
    item.title.trim().toLowerCase(),
  ].join("|");
}

export function hashResearchIdentity(seed: string): string {
  return createHash("sha256").update(seed).digest("hex").slice(0, 24);
}

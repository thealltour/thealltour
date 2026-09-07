import { normalizeTrendHumanPaste } from "@/lib/marketing/trends/normalizeHumanPaste";
import {
  validateTrendSignalBatchV1,
  type TrendValidationIssue,
} from "@/lib/marketing/trends/validateTrendSignalV1";
import type { TrendSignalPayloadV1 } from "@/lib/marketing/trends/types";
import type { TravelTrendsStagingRepository } from "@/lib/marketing/trends/staging/types";

export type TrendIntakeItemOutcome =
  | {
      index: number;
      status: "accepted";
      observationId: string;
      stagingId: string;
    }
  | {
      index: number;
      status: "duplicate";
      observationId: string;
      existingId: string;
    }
  | {
      index: number;
      status: "rejected";
      observationId: string | null;
      issues: TrendValidationIssue[];
      reason: string;
    };

export type TrendIntakeResult = {
  ok: boolean;
  normalize: { ok: boolean; reason?: string; normalizedCount: number };
  counts: { accepted: number; duplicate: number; rejected: number };
  items: TrendIntakeItemOutcome[];
};

export type TrendIntakeValidatePreview = {
  ok: boolean;
  normalize: { ok: boolean; reason?: string; normalizedCount: number };
  counts: { valid: number; rejected: number };
  items: Array<
    | { index: number; status: "valid"; observationId: string; value: TrendSignalPayloadV1 }
    | {
        index: number;
        status: "rejected";
        observationId: string | null;
        issues: TrendValidationIssue[];
        reason: string;
      }
  >;
};

function primaryReason(issues: TrendValidationIssue[]): string {
  return issues[0]?.code ?? "validation_failed";
}

export function previewTrendIntakePaste(rawPaste: string): TrendIntakeValidatePreview {
  const normalized = normalizeTrendHumanPaste(rawPaste);
  if (!normalized.ok) {
    return {
      ok: false,
      normalize: { ok: false, reason: normalized.reason, normalizedCount: 0 },
      counts: { valid: 0, rejected: 0 },
      items: [],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized.text);
  } catch {
    return {
      ok: false,
      normalize: { ok: true, normalizedCount: normalized.normalizedCount },
      counts: { valid: 0, rejected: 1 },
      items: [
        {
          index: 0,
          status: "rejected",
          observationId: null,
          issues: [{ path: "", code: "invalid_json", message: "paste is not valid JSON" }],
          reason: "invalid_json",
        },
      ],
    };
  }

  // Allow either { provider, items } or a single payload / array of payloads.
  let batchInput: unknown = parsed;
  if (Array.isArray(parsed)) {
    batchInput = { provider: "meta_ai", items: parsed };
  } else if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    "observation_id" in (parsed as object) &&
    !("items" in (parsed as object))
  ) {
    batchInput = { provider: "meta_ai", items: [parsed] };
  }

  const batch = validateTrendSignalBatchV1(batchInput);
  const items: TrendIntakeValidatePreview["items"] = [];
  if (!batch.providerOk) {
    return {
      ok: false,
      normalize: { ok: true, normalizedCount: normalized.normalizedCount },
      counts: { valid: 0, rejected: 1 },
      items: [
        {
          index: 0,
          status: "rejected",
          observationId: null,
          issues: batch.providerIssues,
          reason: primaryReason(batch.providerIssues),
        },
      ],
    };
  }

  for (const item of batch.items) {
    if (item.status === "valid") {
      items.push({
        index: item.index,
        status: "valid",
        observationId: item.value.observation_id,
        value: item.value,
      });
    } else {
      const observationId =
        item.issues &&
        typeof (batchInput as { items?: unknown[] })?.items?.[item.index] === "object" &&
        (batchInput as { items: Array<Record<string, unknown>> }).items[item.index]
          ?.observation_id != null
          ? String(
              (batchInput as { items: Array<Record<string, unknown>> }).items[item.index]!
                .observation_id,
            )
          : null;
      items.push({
        index: item.index,
        status: "rejected",
        observationId,
        issues: item.issues,
        reason: primaryReason(item.issues),
      });
    }
  }

  const valid = items.filter((i) => i.status === "valid").length;
  const rejected = items.filter((i) => i.status === "rejected").length;
  return {
    ok: valid > 0,
    normalize: { ok: true, normalizedCount: normalized.normalizedCount },
    counts: { valid, rejected },
    items,
  };
}

export async function ingestTrendIntakePaste(
  rawPaste: string,
  repo: TravelTrendsStagingRepository,
): Promise<TrendIntakeResult> {
  const preview = previewTrendIntakePaste(rawPaste);
  if (!preview.normalize.ok) {
    return {
      ok: false,
      normalize: preview.normalize,
      counts: { accepted: 0, duplicate: 0, rejected: 0 },
      items: [],
    };
  }

  const validPayloads = preview.items
    .filter((i): i is Extract<(typeof preview.items)[number], { status: "valid" }> => i.status === "valid")
    .map((i) => ({ index: i.index, value: i.value }));

  const rejectedItems: TrendIntakeItemOutcome[] = preview.items
    .filter((i): i is Extract<(typeof preview.items)[number], { status: "rejected" }> => i.status === "rejected")
    .map((i) => ({
      index: i.index,
      status: "rejected" as const,
      observationId: i.observationId,
      issues: i.issues,
      reason: i.reason,
    }));

  if (validPayloads.length === 0) {
    return {
      ok: false,
      normalize: preview.normalize,
      counts: { accepted: 0, duplicate: 0, rejected: rejectedItems.length },
      items: rejectedItems,
    };
  }

  const insertResult = await repo.insertTrendObservations(
    validPayloads.map((p) => ({ payload: p.value })),
  );

  const acceptedByObs = new Map(
    insertResult.accepted.map((r) => [r.observationId, r] as const),
  );
  const dupByObs = new Map(
    insertResult.duplicates.map((d) => [d.observationId, d] as const),
  );

  const outcomes: TrendIntakeItemOutcome[] = [...rejectedItems];
  for (const item of validPayloads) {
    const dup = dupByObs.get(item.value.observation_id);
    if (dup) {
      outcomes.push({
        index: item.index,
        status: "duplicate",
        observationId: item.value.observation_id,
        existingId: dup.existingId,
      });
      continue;
    }
    const accepted = acceptedByObs.get(item.value.observation_id);
    if (accepted) {
      outcomes.push({
        index: item.index,
        status: "accepted",
        observationId: item.value.observation_id,
        stagingId: accepted.id,
      });
    }
  }

  outcomes.sort((a, b) => a.index - b.index);
  const accepted = outcomes.filter((o) => o.status === "accepted").length;
  const duplicate = outcomes.filter((o) => o.status === "duplicate").length;
  const rejected = outcomes.filter((o) => o.status === "rejected").length;

  return {
    ok: accepted > 0 || duplicate > 0,
    normalize: preview.normalize,
    counts: { accepted, duplicate, rejected },
    items: outcomes,
  };
}

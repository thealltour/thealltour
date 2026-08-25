import { isUuid, requireUuid } from "@/lib/marketing/context/validation";
import { GovernanceValidationError } from "@/lib/marketing/governance/errors";
import {
  canonicalGovernanceText,
  governanceContentHash,
  governanceEmbeddingQuery,
  governanceNormalizedHash,
} from "@/lib/marketing/governance/hashes";
import type { GovernanceCandidate, ParsedGovernanceCandidate } from "@/lib/marketing/governance/types";

function optionalUuid(value: string | null | undefined, field: string): string | null {
  if (value == null || value.trim() === "") return null;
  return requireUuid(value, field);
}

export function parseGovernanceCandidate(input: GovernanceCandidate): ParsedGovernanceCandidate {
  const body = canonicalGovernanceText(input.body);
  if (!body) {
    throw new GovernanceValidationError("body is required");
  }
  const channel = input.channel?.trim().toLowerCase() ?? "";
  if (!channel) {
    throw new GovernanceValidationError("channel is required");
  }
  const title = canonicalGovernanceText(input.title) || null;
  const sourceContentId = optionalUuid(input.sourceContentId, "sourceContentId");
  const productId = optionalUuid(input.productId, "productId");
  const campaignId = optionalUuid(input.campaignId, "campaignId");
  const agendaId = optionalUuid(input.agendaId, "agendaId");
  const agendaKey = input.agendaKey?.trim() || null;
  const contentType = input.contentType?.trim() || null;
  let scheduledAt: string | null = null;
  if (input.scheduledAt?.trim()) {
    const parsed = new Date(input.scheduledAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new GovernanceValidationError("scheduledAt must be an ISO date");
    }
    scheduledAt = parsed.toISOString();
  }
  if (sourceContentId && !isUuid(sourceContentId)) {
    throw new GovernanceValidationError("sourceContentId must be a UUID");
  }

  return {
    title,
    body,
    channel,
    productId,
    campaignId,
    agendaId,
    agendaKey,
    scheduledAt,
    contentType,
    sourceContentId,
    exactHash: governanceContentHash(title, body),
    normalizedHash: governanceNormalizedHash(title, body),
    embeddingQuery: governanceEmbeddingQuery(title, body),
  };
}

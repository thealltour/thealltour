import { asString } from "@/lib/marketing/context/json";
import type { ContextCandidate } from "@/lib/marketing/scoring/types";

export function candidateProductId(candidate: ContextCandidate): string | null {
  switch (candidate.kind) {
    case "product":
      return candidate.data.id;
    case "customerInsights":
      return candidate.data.productId;
    case "bookingInsights":
      return candidate.data.productId;
    case "contentHistory":
      return candidate.data.productId;
    case "performance":
      return candidate.data.productId;
    default:
      return null;
  }
}

export function candidateChannel(candidate: ContextCandidate): string | null {
  switch (candidate.kind) {
    case "contentHistory":
      return candidate.data.channel;
    case "publications":
      return candidate.data.channel;
    case "performance":
      return candidate.data.channel;
    default:
      return null;
  }
}

export function candidateCampaignIds(candidate: ContextCandidate): string[] {
  switch (candidate.kind) {
    case "product":
      return candidate.data.campaigns.map((campaign) => campaign.id);
    case "contentHistory": {
      const id = asString(candidate.data.metadata?.campaignId);
      return id ? [id] : [];
    }
    case "agendaHistory":
      return candidate.data.campaignId ? [candidate.data.campaignId] : [];
    default:
      return [];
  }
}

export function candidateAgendaId(candidate: ContextCandidate): string | null {
  switch (candidate.kind) {
    case "contentHistory":
      return asString(candidate.data.metadata?.agendaId);
    case "agendaHistory":
      return candidate.data.id;
    default:
      return null;
  }
}

export function candidateOccurredAt(candidate: ContextCandidate): string | null {
  switch (candidate.kind) {
    case "customerInsights":
      return candidate.data.period.end;
    case "bookingInsights":
      return candidate.data.period.end;
    case "contentHistory":
      return candidate.data.publishedAt ?? candidate.data.createdAt;
    case "publications":
      return candidate.data.publishedAt ?? candidate.data.scheduledAt ?? candidate.data.lastCheckedAt;
    case "performance":
      return candidate.data.period.end;
    case "memory":
      return candidate.data.updatedAt ?? candidate.data.createdAt;
    case "agendaHistory":
      return candidate.data.lastUsedAt ?? candidate.data.createdAt;
    default:
      return null;
  }
}

export function candidateMemoryType(candidate: ContextCandidate): string | null {
  return candidate.kind === "memory" ? candidate.data.memoryType : null;
}

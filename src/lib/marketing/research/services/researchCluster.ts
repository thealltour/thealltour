import { randomUUID } from "node:crypto";

import { selectPrimarySignal } from "@/lib/marketing/research/services/primarySignalSelector";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type { ResearchSignal } from "@/lib/marketing/research/types/researchSignal";

export type ResearchCluster = {
  id: string;
  primarySignalId: string;
  signalIds: string[];
  clusterType: "semantic_event" | "destination_group";
  createdAt: string;
  updatedAt: string;
};

export function buildClustersFromMergeGroups(input: {
  signals: ResearchSignal[];
  mergeGroups: string[][];
  sources: Map<string, ResearchSource>;
  now?: Date;
}): ResearchCluster[] {
  const byId = new Map(input.signals.map((s) => [s.id, s]));
  const timestamp = (input.now ?? new Date()).toISOString();

  return input.mergeGroups.map((memberIds) => {
    const members = memberIds.map((id) => byId.get(id)).filter((s): s is ResearchSignal => Boolean(s));
    const primary = selectPrimarySignal(members, input.sources);
    return {
      id: randomUUID(),
      primarySignalId: primary.id,
      signalIds: members.map((m) => m.id),
      clusterType: members.length > 1 ? "semantic_event" : "destination_group",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
}

export function groupSignalsByCluster(
  signals: ResearchSignal[],
  clusters: ResearchCluster[],
): Map<string, ResearchSignal[]> {
  const byId = new Map(signals.map((s) => [s.id, s]));
  const grouped = new Map<string, ResearchSignal[]>();
  for (const cluster of clusters) {
    grouped.set(
      cluster.id,
      cluster.signalIds.map((id) => byId.get(id)).filter((s): s is ResearchSignal => Boolean(s)),
    );
  }
  return grouped;
}

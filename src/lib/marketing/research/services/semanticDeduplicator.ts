import type { EmbeddingProvider } from "@/lib/marketing/semantic/types";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type { ResearchSignal } from "@/lib/marketing/research/types/researchSignal";
import { cosineSimilarity } from "@/lib/marketing/research/services/cosineSimilarity";
import { selectPrimarySignal } from "@/lib/marketing/research/services/primarySignalSelector";
import {
  DEFAULT_SEMANTIC_DEDUP_POLICY,
  resolveDuplicateDecision,
  type SemanticDedupPolicy,
} from "@/lib/marketing/research/services/semanticDedupPolicy";
import {
  enumerateSemanticCandidatePairs,
  passesSemanticMergeGuards,
} from "@/lib/marketing/research/services/semanticPrefilter";
import { buildSemanticResearchText } from "@/lib/marketing/research/services/semanticText";
import {
  buildClustersFromMergeGroups,
  type ResearchCluster,
} from "@/lib/marketing/research/services/researchCluster";

export type SemanticDedupComparison = {
  signalAId: string;
  signalBId: string;
  similarity: number;
  eligibleForComparison: boolean;
  duplicateDecision: "merge" | "link" | "distinct";
  reasons: string[];
};

export type SemanticDedupMetrics = {
  signalsInput: number;
  candidatePairs: number;
  comparisons: number;
  merges: number;
  uncertainLinks: number;
  serviceFailures: number;
  clusters: number;
  avgClusterSize: number;
  status: "success" | "degraded" | "skipped";
  statusReason?: string;
};

export type SemanticDedupResult = {
  unique: ResearchSignal[];
  duplicates: ResearchSignal[];
  clusters: ResearchCluster[];
  comparisons: SemanticDedupComparison[];
  metrics: SemanticDedupMetrics;
};

class UnionFind {
  private parent = new Map<string, string>();

  add(id: string): void {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: string): string {
    const p = this.parent.get(id) ?? id;
    if (p !== id) {
      const root = this.find(p);
      this.parent.set(id, root);
      return root;
    }
    return id;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }

  groups(): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      const list = out.get(root) ?? [];
      list.push(id);
      out.set(root, list);
    }
    return out;
  }
}

const EMBED_BATCH_SIZE = 50;

export async function runSemanticDedup(input: {
  signals: ResearchSignal[];
  sources: Map<string, ResearchSource>;
  provider?: EmbeddingProvider | null;
  policy?: SemanticDedupPolicy;
  now?: Date;
}): Promise<SemanticDedupResult> {
  const policy = input.policy ?? DEFAULT_SEMANTIC_DEDUP_POLICY;
  const now = input.now ?? new Date();
  const comparisons: SemanticDedupComparison[] = [];
  const metrics: SemanticDedupMetrics = {
    signalsInput: input.signals.length,
    candidatePairs: 0,
    comparisons: 0,
    merges: 0,
    uncertainLinks: 0,
    serviceFailures: 0,
    clusters: 0,
    avgClusterSize: 0,
    status: "skipped",
  };

  if (input.signals.length <= 1) {
    const clusters = buildClustersFromMergeGroups({
      signals: input.signals,
      mergeGroups: input.signals.map((s) => [s.id]),
      sources: input.sources,
      now,
    });
    metrics.clusters = clusters.length;
    metrics.avgClusterSize = input.signals.length;
    metrics.status = "skipped";
    metrics.statusReason = "insufficient_signals";
    return {
      unique: input.signals,
      duplicates: [],
      clusters,
      comparisons,
      metrics: { ...metrics, status: "skipped" },
    };
  }

  if (!input.provider) {
    metrics.status = "skipped";
    metrics.statusReason = "embedding_provider_unavailable";
    const clusters = buildClustersFromMergeGroups({
      signals: input.signals,
      mergeGroups: input.signals.map((s) => [s.id]),
      sources: input.sources,
      now,
    });
    metrics.clusters = clusters.length;
    metrics.avgClusterSize = input.signals.length / Math.max(clusters.length, 1);
    return { unique: input.signals, duplicates: [], clusters, comparisons, metrics };
  }

  const byId = new Map(input.signals.map((s) => [s.id, s]));
  const pairs = enumerateSemanticCandidatePairs(input.signals);
  metrics.candidatePairs = pairs.length;

  const texts: string[] = [];
  const textBySignalId = new Map<string, string>();
  for (const signal of input.signals) {
    const text = buildSemanticResearchText(signal);
    textBySignalId.set(signal.id, text);
    texts.push(text);
  }

  let embeddings: number[][] = [];
  try {
    for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
      const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
      const batchEmbeddings = await input.provider.embedMany(batch);
      embeddings.push(...batchEmbeddings);
    }
    metrics.status = "success";
  } catch (error) {
    metrics.status = "degraded";
    metrics.serviceFailures = 1;
    metrics.statusReason = error instanceof Error ? error.message : "embedding_failed";
    const clusters = buildClustersFromMergeGroups({
      signals: input.signals,
      mergeGroups: input.signals.map((s) => [s.id]),
      sources: input.sources,
      now,
    });
    metrics.clusters = clusters.length;
    metrics.avgClusterSize = input.signals.length / Math.max(clusters.length, 1);
    return { unique: input.signals, duplicates: [], clusters, comparisons, metrics };
  }

  const embeddingById = new Map<string, number[]>();
  input.signals.forEach((signal, index) => {
    embeddingById.set(signal.id, embeddings[index] ?? []);
  });

  const uf = new UnionFind();
  for (const signal of input.signals) uf.add(signal.id);

  for (const [aId, bId] of pairs) {
    const a = byId.get(aId)!;
    const b = byId.get(bId)!;
    const vecA = embeddingById.get(aId) ?? [];
    const vecB = embeddingById.get(bId) ?? [];
    const similarity = cosineSimilarity(vecA, vecB);
    metrics.comparisons += 1;

    const guards = passesSemanticMergeGuards(a, b, policy.maxTimeSensitiveAgeHours);
    let decision = resolveDuplicateDecision(similarity, policy);
    const reasons = [`similarity_${similarity.toFixed(3)}`, ...guards.reasons];

    if (decision === "merge" && !guards.ok) {
      decision = similarity >= policy.strongMergeThreshold ? "link" : "distinct";
      reasons.push("merge_blocked_by_guard");
    }

    if (decision === "merge") {
      uf.union(aId, bId);
      metrics.merges += 1;
    } else if (decision === "link") {
      metrics.uncertainLinks += 1;
    }

    comparisons.push({
      signalAId: aId,
      signalBId: bId,
      similarity,
      eligibleForComparison: true,
      duplicateDecision: decision,
      reasons,
    });
  }

  const mergeGroups = [...uf.groups().values()];
  const clusters = buildClustersFromMergeGroups({
    signals: input.signals,
    mergeGroups,
    sources: input.sources,
    now,
  });

  const duplicates: ResearchSignal[] = [];
  const unique: ResearchSignal[] = [];
  const timestamp = now.toISOString();

  for (const cluster of clusters) {
    const members = cluster.signalIds
      .map((id) => byId.get(id))
      .filter((s): s is ResearchSignal => Boolean(s));
    const primary = selectPrimarySignal(members, input.sources);
    cluster.primarySignalId = primary.id;

    for (const member of members) {
      if (member.id === primary.id) {
        unique.push({
          ...member,
          corroborationCount: Math.max(0, members.length - 1),
          updatedAt: timestamp,
        });
      } else {
        duplicates.push({
          ...member,
          status: "duplicate",
          duplicateOfSignalId: primary.id,
          corroborationCount: 0,
          updatedAt: timestamp,
        });
      }
    }
  }

  metrics.clusters = clusters.length;
  metrics.avgClusterSize =
    clusters.reduce((sum, c) => sum + c.signalIds.length, 0) / Math.max(clusters.length, 1);

  return { unique, duplicates, clusters, comparisons, metrics };
}

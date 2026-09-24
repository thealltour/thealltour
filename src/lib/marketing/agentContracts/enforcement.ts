/**
 * Phase 3A semantic + artifact contract enforcement (test/preflight only).
 * Does not drive runtime lifecycle code.
 */

import type { MarketingArtifactContract } from "@/lib/marketing/agentContracts/artifactContract";
import type { MarketingAgentSemanticContract } from "@/lib/marketing/agentContracts/semanticContract";
import {
  listMarketingArtifactContracts,
} from "@/lib/marketing/agentContracts/artifactRegistry";
import {
  listMarketingAgentSemanticContracts,
} from "@/lib/marketing/agentContracts/semanticRegistry";
import { MARKETING_AGENT_VOCABULARY_SET } from "@/lib/marketing/agentContracts/vocabulary";
import { getMarketingHermesRuntimeContract } from "@/lib/marketing/hermesRuntime/registry";
import { assertSemanticCompletenessHealthy } from "@/lib/marketing/agentContracts/semanticCompleteness";

export type MarketingAgentContractIssue = {
  code:
    | "semantic_runtime_unlinked"
    | "artifact_producer_unknown"
    | "duplicate_artifact_id"
    | "duplicate_relative_path"
    | "missing_dependency"
    | "dependency_cycle"
    | "owns_must_not_overlap"
    | "unknown_vocabulary_key"
    | "semantic_output_artifact_mismatch";
  subject: string;
  detail: string;
};

function collectVocabularyRefs(contract: MarketingAgentSemanticContract): string[] {
  return [
    ...contract.authority.owns,
    ...contract.authority.reads,
    ...contract.authority.advisory,
    ...contract.authority.mustNotOwn,
    ...contract.inputs.required,
    ...(contract.inputs.optional ?? []),
  ];
}

export function collectSemanticRuntimeLinkageIssues(
  semantics: readonly MarketingAgentSemanticContract[] = listMarketingAgentSemanticContracts(),
): MarketingAgentContractIssue[] {
  const issues: MarketingAgentContractIssue[] = [];
  for (const s of semantics) {
    if (!getMarketingHermesRuntimeContract(s.profileId)) {
      issues.push({
        code: "semantic_runtime_unlinked",
        subject: s.profileId,
        detail: "semantic profileId missing from MarketingHermesRuntimeContract registry",
      });
    }
  }
  return issues;
}

export function collectAuthoritySanityIssues(
  semantics: readonly MarketingAgentSemanticContract[] = listMarketingAgentSemanticContracts(),
): MarketingAgentContractIssue[] {
  const issues: MarketingAgentContractIssue[] = [];
  for (const s of semantics) {
    const owns = new Set(s.authority.owns);
    for (const key of s.authority.mustNotOwn) {
      if (owns.has(key)) {
        issues.push({
          code: "owns_must_not_overlap",
          subject: s.profileId,
          detail: `owns ∩ mustNotOwn overlap: ${key}`,
        });
      }
    }
    for (const key of collectVocabularyRefs(s)) {
      if (!MARKETING_AGENT_VOCABULARY_SET.has(key)) {
        issues.push({
          code: "unknown_vocabulary_key",
          subject: s.profileId,
          detail: `unknown vocabulary key: ${key}`,
        });
      }
    }
  }
  return issues;
}

export function collectArtifactUniquenessIssues(
  artifacts: readonly MarketingArtifactContract[] = listMarketingArtifactContracts(),
): MarketingAgentContractIssue[] {
  const issues: MarketingAgentContractIssue[] = [];
  const byId = new Map<string, number>();
  const byPath = new Map<string, string[]>();

  for (const a of artifacts) {
    byId.set(a.artifactId, (byId.get(a.artifactId) ?? 0) + 1);
    const list = byPath.get(a.relativePath) ?? [];
    list.push(a.artifactId);
    byPath.set(a.relativePath, list);
  }

  for (const [id, count] of byId) {
    if (count > 1) {
      issues.push({
        code: "duplicate_artifact_id",
        subject: id,
        detail: `duplicate artifactId count=${count}`,
      });
    }
  }
  for (const [path, ids] of byPath) {
    if (ids.length > 1) {
      issues.push({
        code: "duplicate_relative_path",
        subject: path,
        detail: `relativePath shared by: ${ids.join(", ")}`,
      });
    }
  }
  return issues;
}

export function collectArtifactDependencyIssues(
  artifacts: readonly MarketingArtifactContract[] = listMarketingArtifactContracts(),
): MarketingAgentContractIssue[] {
  const issues: MarketingAgentContractIssue[] = [];
  const ids = new Set(artifacts.map((a) => a.artifactId));

  for (const a of artifacts) {
    for (const dep of a.dependsOn) {
      if (!ids.has(dep)) {
        issues.push({
          code: "missing_dependency",
          subject: a.artifactId,
          detail: `dependsOn missing artifactId: ${dep}`,
        });
      }
    }
  }

  // Cycle detection (DFS)
  const adj = new Map(artifacts.map((a) => [a.artifactId, a.dependsOn] as const));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(node: string, stack: string[]): void {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      issues.push({
        code: "dependency_cycle",
        subject: node,
        detail: `cycle involving: ${[...stack, node].join(" → ")}`,
      });
      return;
    }
    visiting.add(node);
    for (const dep of adj.get(node) ?? []) {
      visit(dep, [...stack, node]);
    }
    visiting.delete(node);
    visited.add(node);
  }

  for (const id of ids) visit(id, []);
  return issues;
}

const KNOWN_NON_PROFILE_PRODUCERS = new Set([
  "asset-source-writer",
  "pipeline:publishable-bundle",
  "deterministic:card-layout-director",
]);

export function collectArtifactProducerIssues(
  artifacts: readonly MarketingArtifactContract[] = listMarketingArtifactContracts(),
  semantics: readonly MarketingAgentSemanticContract[] = listMarketingAgentSemanticContracts(),
): MarketingAgentContractIssue[] {
  const issues: MarketingAgentContractIssue[] = [];
  const semanticProfiles = new Set(semantics.map((s) => s.profileId));

  for (const a of artifacts) {
    const producer = a.producedBy;
    if (KNOWN_NON_PROFILE_PRODUCERS.has(producer)) continue;
    if (getMarketingHermesRuntimeContract(producer) || semanticProfiles.has(producer)) {
      continue;
    }
    issues.push({
      code: "artifact_producer_unknown",
      subject: a.artifactId,
      detail: `producedBy not in runtime/semantic registry or known producers: ${producer}`,
    });
  }

  for (const s of semantics) {
    const outId = s.output?.artifactId;
    if (!outId) continue;
    const art = artifacts.find((a) => a.artifactId === outId);
    if (!art) {
      issues.push({
        code: "semantic_output_artifact_mismatch",
        subject: s.profileId,
        detail: `output.artifactId not in artifact registry: ${outId}`,
      });
      continue;
    }
    // Layout: semantic profile is card-layout-director; producer may be deterministic:*
    if (
      art.producedBy !== s.profileId &&
      !(
        s.profileId === "card-layout-director" &&
        art.producedBy === "deterministic:card-layout-director"
      )
    ) {
      issues.push({
        code: "semantic_output_artifact_mismatch",
        subject: s.profileId,
        detail: `artifact producedBy=${art.producedBy} does not match semantic profileId`,
      });
    }
  }

  return issues;
}

export function collectAllMarketingAgentContractIssues(): MarketingAgentContractIssue[] {
  return [
    ...collectSemanticRuntimeLinkageIssues(),
    ...collectAuthoritySanityIssues(),
    ...collectArtifactUniquenessIssues(),
    ...collectArtifactDependencyIssues(),
    ...collectArtifactProducerIssues(),
  ];
}

export function assertMarketingAgentContractsHealthy(): void {
  const issues = collectAllMarketingAgentContractIssues();
  if (issues.length > 0) {
    throw new Error(
      `Marketing agent contracts failed:\n${issues
        .map((i) => `- [${i.code}] ${i.subject}: ${i.detail}`)
        .join("\n")}`,
    );
  }
  // Phase 3E: every runtime profile must be registered or explicitly excluded.
  assertSemanticCompletenessHealthy();
}

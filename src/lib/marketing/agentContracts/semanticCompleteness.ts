/**
 * Semantic registry completeness vs Marketing Hermes runtime inventory.
 * Phase 3E: report intentional exclusions — no silent gaps.
 */

import { listMarketingAgentSemanticContracts } from "@/lib/marketing/agentContracts/semanticRegistry";
import { MARKETING_AGENT_CONTRACT_DEBT } from "@/lib/marketing/agentContracts/debt";
import type { MarketingHermesRuntimeContract } from "@/lib/marketing/hermesRuntime/contract";
import { listMarketingHermesRuntimeContracts } from "@/lib/marketing/hermesRuntime/registry";

export type SemanticCompletenessClass =
  | "registered"
  | "intentionally_excluded_legacy"
  | "runtime_only_debt"
  | "missing";

export type SemanticCompletenessEntry = {
  profileId: string;
  kind: MarketingHermesRuntimeContract["kind"];
  classification: SemanticCompletenessClass;
  reason?: string;
};

export type SemanticCompletenessReport = {
  entries: SemanticCompletenessEntry[];
  registered: string[];
  intentionallyExcluded: string[];
  runtimeOnlyDebt: string[];
  missing: string[];
};

/**
 * Classify every marketing Hermes runtime profile against the semantic registry.
 */
export function buildSemanticCompletenessReport(): SemanticCompletenessReport {
  const semanticIds = new Set(listMarketingAgentSemanticContracts().map((s) => s.profileId));
  const entries: SemanticCompletenessEntry[] = [];

  for (const runtime of listMarketingHermesRuntimeContracts()) {
    const { profileId, kind } = runtime;
    if (semanticIds.has(profileId)) {
      entries.push({ profileId, kind, classification: "registered" });
      continue;
    }
    if (kind === "legacy_channel_editor") {
      entries.push({
        profileId,
        kind,
        classification: "intentionally_excluded_legacy",
        reason: "legacy channel-editor — excluded from semantic migration (debt: legacy-channel-editors)",
      });
      continue;
    }
    const debt = MARKETING_AGENT_CONTRACT_DEBT.find(
      (d) =>
        d.profileOrPath === profileId ||
        d.profileOrPath.split("|").includes(profileId) ||
        (d.kind === "legacy_channel_editor" && profileId.startsWith("channel-editor-")),
    );
    if (debt) {
      entries.push({
        profileId,
        kind,
        classification: "runtime_only_debt",
        reason: debt.reason,
      });
      continue;
    }
    entries.push({
      profileId,
      kind,
      classification: "missing",
      reason: "runtime profile has no semantic contract and no explicit debt exclusion",
    });
  }

  return {
    entries,
    registered: entries.filter((e) => e.classification === "registered").map((e) => e.profileId),
    intentionallyExcluded: entries
      .filter((e) => e.classification === "intentionally_excluded_legacy")
      .map((e) => e.profileId),
    runtimeOnlyDebt: entries
      .filter((e) => e.classification === "runtime_only_debt")
      .map((e) => e.profileId),
    missing: entries.filter((e) => e.classification === "missing").map((e) => e.profileId),
  };
}

export function assertSemanticCompletenessHealthy(): void {
  const report = buildSemanticCompletenessReport();
  if (report.missing.length > 0) {
    throw new Error(
      `Semantic completeness gap (missing contracts): ${report.missing.join(", ")}`,
    );
  }
}

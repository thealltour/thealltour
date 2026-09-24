/**
 * Explicit Phase 3A debt / exclusions for semantic+artifact migration.
 */

export type MarketingAgentContractDebtEntry = {
  id: string;
  kind:
    | "legacy_channel_editor"
    | "department_unmigrated"
    | "specialist_unmigrated"
    | "advisory_path";
  profileOrPath: string;
  reason: string;
  phaseTarget: "phase-3b" | "phase-4" | "phase-5";
  allowed: true;
};

export const MARKETING_AGENT_CONTRACT_DEBT: readonly MarketingAgentContractDebtEntry[] = [
  {
    id: "legacy-channel-editors",
    kind: "legacy_channel_editor",
    profileOrPath: "channel-editor-*",
    reason:
      "Legacy channel composers excluded from semantic registry migration; production specialists must not silent-fallback to them. Lifecycle wiring deferred.",
    phaseTarget: "phase-5",
    allowed: true,
  },
  {
    id: "department-bots",
    kind: "department_unmigrated",
    profileOrPath: "content-strategist|marketing-manager|governance-auditor|performance-analyst",
    reason: "Department Hermes bots not in semantic migration set.",
    phaseTarget: "phase-4",
    allowed: true,
  },
  {
    id: "legacy-visual-hints",
    kind: "advisory_path",
    profileOrPath: "legacy.visualHints / publishable.visual.*",
    reason: "Advisory compatibility path — must remain; SVP treats as advisory when VRA present.",
    phaseTarget: "phase-5",
    allowed: true,
  },
  {
    id: "materialize-in-repair-loop-divergence",
    kind: "advisory_path",
    profileOrPath: "failurePolicy.materializeInRepairLoop",
    reason:
      "VRA materializeInRepairLoop=true; Narrative/Carousel/Copy/Caption/Presentation/Threads/Blog/Band remain false (current behavior). Do not unify.",
    phaseTarget: "phase-4",
    allowed: true,
  },
  {
    id: "layout-hermes-production-ambiguity",
    kind: "advisory_path",
    profileOrPath: "card-layout-director / deterministic:card-layout-director",
    reason:
      "Production presentation path is deterministic_fallback; Hermes Layout profile exists but is not production-wired.",
    phaseTarget: "phase-4",
    allowed: true,
  },
  {
    id: "spike-alias-usage",
    kind: "advisory_path",
    profileOrPath: "theallcloud/auto (gateway alias)",
    reason: "Spike/compat gateway alias still in use; alias cutover to thealltour/* is a separate PR.",
    phaseTarget: "phase-4",
    allowed: true,
  },
];

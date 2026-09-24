/**
 * Explicit contract debt / exclusions after Phase 3E.
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
    id: "department-profile-env-legacy",
    kind: "advisory_path",
    profileOrPath: "content-strategist|marketing-manager|governance-auditor|performance-analyst",
    reason:
      "Department runtime credentials remain profile_env_legacy (profile-local gateway token duplication). Cleanup deferred; aliases unchanged.",
    phaseTarget: "phase-4",
    allowed: true,
  },
  {
    id: "department-durable-outputs-unregistered",
    kind: "advisory_path",
    profileOrPath:
      "content-plan-v1|content-proposition-v1|selected-agenda-v1|content-assignment-v1|governance-decision-v1|performance-evidence",
    reason:
      "Department durable domain contracts exist in TypeScript but are not MarketingArtifactContract registry entries. Phase 3E maps them docs-only (no new persistence).",
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
    reason:
      "Spike/compat gateway alias still routes specialists; department aliases already use thealltour/*. Alias cutover for specialists is a separate PR.",
    phaseTarget: "phase-4",
    allowed: true,
  },
];

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
    reason: "Legacy channel composers excluded from Phase 3A semantic registry migration.",
    phaseTarget: "phase-5",
    allowed: true,
  },
  {
    id: "department-bots",
    kind: "department_unmigrated",
    profileOrPath: "content-strategist|marketing-manager|governance-auditor|performance-analyst",
    reason: "Department Hermes bots not in Phase 3A semantic migration set.",
    phaseTarget: "phase-4",
    allowed: true,
  },
  {
    id: "naver-band-copy",
    kind: "specialist_unmigrated",
    profileOrPath: "naver-band-copy-writer",
    reason: "Band specialist deferred past Phase 3A optional channel-copy set.",
    phaseTarget: "phase-3b",
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
      "VRA materializeInRepairLoop=true; Narrative/Carousel/CardCopy/Caption/Presentation remain false (current behavior). Do not unify in Phase 3C.",
    phaseTarget: "phase-4",
    allowed: true,
  },
];

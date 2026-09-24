/**
 * Machine-readable Marketing Hermes debt inventory (Phase 2).
 * Distinguishes known/allowed legacy debt from newly introduced debt.
 */

export type MarketingHermesDebtCategory =
  | "direct_spawn"
  | "profile_local_credential"
  | "spike_alias"
  | "legacy_channel_editor"
  | "bot_soft_result_adapter";

export type MarketingHermesDebtEntry = {
  id: string;
  category: MarketingHermesDebtCategory;
  /** Repo-relative path or Hermes profileId */
  pathOrProfile: string;
  reason: string;
  /** Target cleanup phase (informational) */
  phaseTarget: "phase-3" | "phase-4" | "phase-5" | "keep-legacy";
  /** Known debt — new unlisted items FAIL CI */
  allowed: true;
  legacy: boolean;
};

/**
 * Concrete file paths allowed to invoke Hermes outside `invokeMarketingHermesAgent`
 * (or its sync adapter / compatibility wrappers that share the same credential core).
 */
export const MARKETING_HERMES_DIRECT_SPAWN_ALLOWLIST: readonly string[] = [
  // Unified launcher + sync adapter (the only approved invocation cores)
  "src/lib/marketing/hermesRuntime/launcher.ts",
  "src/lib/marketing/hermesRuntime/syncLauncher.ts",
  // Soft-result adapter: wraps launcher, converts throw → Result
  "src/lib/marketing/bot/organization/hermesRuntime.ts",
  // Legacy async spawn retained for unit tests of retry classification
  "src/lib/marketing/cron/hermesSpawnFailure.ts",
  // Desktop / spike paths use `hermes chat` (not marketing -p oneshot)
  "scripts/c4-desktop-e2e.ts",
  "scripts/c4-1-desktop-fallback-e2e.ts",
];

export const MARKETING_HERMES_DEBT_INVENTORY: readonly MarketingHermesDebtEntry[] = [
  {
    id: "bot-soft-result",
    category: "bot_soft_result_adapter",
    pathOrProfile: "src/lib/marketing/bot/organization/hermesRuntime.ts",
    reason:
      "Bot orchestrate keeps soft Result semantics via adapter over unified launcher (no throw to callers).",
    phaseTarget: "keep-legacy",
    allowed: true,
    legacy: true,
  },
  {
    id: "spawn-async-test-legacy",
    category: "direct_spawn",
    pathOrProfile: "src/lib/marketing/cron/hermesSpawnFailure.ts#spawnHermesProfileAsync",
    reason: "Low-level spawn retained for hermesSpawnFailure unit tests; production cron uses launcher.",
    phaseTarget: "phase-5",
    allowed: true,
    legacy: true,
  },
  {
    id: "desktop-hermes-chat",
    category: "direct_spawn",
    pathOrProfile: "scripts/c4-desktop-e2e.ts",
    reason: "Desktop e2e uses `hermes chat` against runtime-spike — not marketing -p oneshot.",
    phaseTarget: "keep-legacy",
    allowed: true,
    legacy: true,
  },
  {
    id: "desktop-fallback-hermes-chat",
    category: "direct_spawn",
    pathOrProfile: "scripts/c4-1-desktop-fallback-e2e.ts",
    reason: "Desktop fallback e2e uses `hermes chat` — not marketing oneshot.",
    phaseTarget: "keep-legacy",
    allowed: true,
    legacy: true,
  },
  {
    id: "dept-profile-env-content-strategist",
    category: "profile_local_credential",
    pathOrProfile: "content-strategist",
    reason: "Department profile_env_legacy — launcher still injects; cleanup in Phase 5.",
    phaseTarget: "phase-5",
    allowed: true,
    legacy: true,
  },
  {
    id: "dept-profile-env-marketing-manager",
    category: "profile_local_credential",
    pathOrProfile: "marketing-manager",
    reason: "Department profile_env_legacy.",
    phaseTarget: "phase-5",
    allowed: true,
    legacy: true,
  },
  {
    id: "dept-profile-env-governance-auditor",
    category: "profile_local_credential",
    pathOrProfile: "governance-auditor",
    reason: "Department profile_env_legacy.",
    phaseTarget: "phase-5",
    allowed: true,
    legacy: true,
  },
  {
    id: "dept-profile-env-performance-analyst",
    category: "profile_local_credential",
    pathOrProfile: "performance-analyst",
    reason: "Department profile_env_legacy.",
    phaseTarget: "phase-5",
    allowed: true,
    legacy: true,
  },
  {
    id: "spike-alias-specialists",
    category: "spike_alias",
    pathOrProfile: "theallcloud/auto",
    reason: "All specialists + legacy channel editors still use spike alias until Phase 3+ cutover.",
    phaseTarget: "phase-3",
    allowed: true,
    legacy: true,
  },
  {
    id: "legacy-channel-editor-instagram",
    category: "legacy_channel_editor",
    pathOrProfile: "channel-editor-instagram",
    reason: "Legacy channel composer profile — retained until channel specialist cutover complete.",
    phaseTarget: "phase-5",
    allowed: true,
    legacy: true,
  },
  {
    id: "legacy-channel-editor-threads",
    category: "legacy_channel_editor",
    pathOrProfile: "channel-editor-threads",
    reason: "Legacy channel composer profile.",
    phaseTarget: "phase-5",
    allowed: true,
    legacy: true,
  },
  {
    id: "legacy-channel-editor-naver-blog",
    category: "legacy_channel_editor",
    pathOrProfile: "channel-editor-naver-blog",
    reason: "Legacy channel composer profile.",
    phaseTarget: "phase-5",
    allowed: true,
    legacy: true,
  },
  {
    id: "legacy-channel-editor-naver-band",
    category: "legacy_channel_editor",
    pathOrProfile: "channel-editor-naver-band",
    reason: "Legacy channel composer profile.",
    phaseTarget: "phase-5",
    allowed: true,
    legacy: true,
  },
  {
    id: "legacy-channel-editor-kakao",
    category: "legacy_channel_editor",
    pathOrProfile: "channel-editor-kakao",
    reason: "Legacy channel composer profile.",
    phaseTarget: "phase-5",
    allowed: true,
    legacy: true,
  },
  {
    id: "legacy-channel-editor-shortform",
    category: "legacy_channel_editor",
    pathOrProfile: "channel-editor-shortform",
    reason: "Legacy channel composer profile.",
    phaseTarget: "phase-5",
    allowed: true,
    legacy: true,
  },
];

/** @deprecated Use MARKETING_HERMES_DEBT_INVENTORY + DIRECT_SPAWN_ALLOWLIST */
export type DirectHermesSpawnDebtEntry = {
  path: string;
  kind: "spawnSync" | "spawn" | "bot_oneshot";
  production: boolean;
  note: string;
};

/** @deprecated Compatibility export for Phase 1 callers */
export const MARKETING_HERMES_DIRECT_SPAWN_DEBT: readonly DirectHermesSpawnDebtEntry[] =
  MARKETING_HERMES_DEBT_INVENTORY.filter((e) => e.category === "direct_spawn" || e.category === "bot_soft_result_adapter").map(
    (e) => ({
      path: e.pathOrProfile,
      kind: e.category === "bot_soft_result_adapter" ? ("bot_oneshot" as const) : ("spawn" as const),
      production: e.category === "bot_soft_result_adapter",
      note: e.reason,
    }),
  );
